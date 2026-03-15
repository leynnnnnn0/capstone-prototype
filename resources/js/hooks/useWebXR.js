import { useRef, useState, useCallback } from 'react';

export const QUALITY_COLOR = {
    none: null,
    poor: 0xff2d2d,
    okay: 0xff8c00,
    good: 0xffe600,
    perfect: 0x00ff88,
};

const STABLE_FRAMES_OKAY = 5;
const STABLE_FRAMES_GOOD = 15;
const STABLE_FRAMES_PERFECT = 30;
const DRIFT_THRESHOLD = 0.005;

export function useWebXR() {
    const sessionRef = useRef(null);
    const rendererRef = useRef(null);
    const sceneRef = useRef(null);
    const cameraRef = useRef(null);
    const hitTestSourceRef = useRef(null);
    const refSpaceRef = useRef(null);
    const reticleRef = useRef(null);
    const latestHitRef = useRef(null);
    const prevHitRef = useRef(null);
    const stableFramesRef = useRef(0);
    const qualityRef = useRef('none');
    const anchorsRef = useRef([]);
    const dotMeshesRef = useRef([]);
    const lineMeshesRef = useRef([]);
    const windowModelRef = useRef(null);
    const originalTransformRef = useRef(null);
    const lastCornersRef = useRef(null); // saved after every measurement for model swapping
    const THREERef = useRef(null); // stored from startAR so swapModel can reuse it
    const isSwappingRef = useRef(false); // lock during swap to block stray taps
    const selectedModelUrlRef = useRef('/models/window.glb'); // default model

    const [isSupported, setIsSupported] = useState(null);
    const [isActive, setIsActive] = useState(false);
    const [tapCount, setTapCount] = useState(0);
    const [dimensions, setDimensions] = useState(null);
    const [error, setError] = useState(null);
    const [reticleQuality, setReticleQuality] = useState('none');
    const [modelLoading, setModelLoading] = useState(false);
    const [modelError, setModelError] = useState(null);
    const [modelPlaced, setModelPlaced] = useState(false);

    const checkSupport = useCallback(async () => {
        if (!navigator.xr) {
            setIsSupported(false);
            return false;
        }
        const ok = await navigator.xr.isSessionSupported('immersive-ar');
        setIsSupported(ok);
        return ok;
    }, []);

    function dist3D(a, b) {
        return (
            Math.sqrt(
                Math.pow(b.x - a.x, 2) +
                    Math.pow(b.y - a.y, 2) +
                    Math.pow(b.z - a.z, 2),
            ) * 100
        );
    }

    function dist3DRaw(a, b) {
        return Math.sqrt(
            Math.pow(b.x - a.x, 2) +
                Math.pow(b.y - a.y, 2) +
                Math.pow(b.z - a.z, 2),
        );
    }

    // ── 4-tap measurement ─────────────────────────────────────────────────────
    // User taps: [0] top-left, [1] top-right, [2] bottom-left, [3] bottom-right
    // Average top+bottom for width, average left+right for height — reduces noise
    function calcDimensionsFrom4([tl, tr, bl, br]) {
        const topW = dist3D(tl, tr);
        const botW = dist3D(bl, br);
        const leftH = dist3D(tl, bl);
        const rightH = dist3D(tr, br);
        return {
            widthCm: ((topW + botW) / 2).toFixed(1),
            heightCm: ((leftH + rightH) / 2).toFixed(1),
            corners: [tl, tr, bl, br],
        };
    }

    function evalQuality(stableFrames, hasHit) {
        if (!hasHit) return 'none';
        if (stableFrames < STABLE_FRAMES_OKAY) return 'poor';
        if (stableFrames < STABLE_FRAMES_GOOD) return 'okay';
        if (stableFrames < STABLE_FRAMES_PERFECT) return 'good';
        return 'perfect';
    }

    function addDot(THREE, position, index) {
        const colors = [0x00ff88, 0x00ccff, 0xff6600, 0xff0066]; // 4 colors for 4 taps
        const geo = new THREE.SphereGeometry(0.012, 16, 16);
        const mat = new THREE.MeshBasicMaterial({ color: colors[index] });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(position.x, position.y, position.z);
        sceneRef.current.add(mesh);
        dotMeshesRef.current.push(mesh);
    }

    function addLine(THREE, a, b) {
        const points = [
            new THREE.Vector3(a.x, a.y, a.z),
            new THREE.Vector3(b.x, b.y, b.z),
        ];
        const geo = new THREE.BufferGeometry().setFromPoints(points);
        const mat = new THREE.LineBasicMaterial({
            color: 0xffffff,
            linewidth: 2,
        });
        const line = new THREE.Line(geo, mat);
        sceneRef.current.add(line);
        lineMeshesRef.current.push(line);
    }

    function placeModel(THREE, model, corners) {
        const [tl, tr, bl, br] = corners.map(
            (c) => new THREE.Vector3(c.x, c.y, c.z),
        );

        // ── center: average of all 4 tapped corners ───────────────────────
        const center = new THREE.Vector3()
            .add(tl)
            .add(tr)
            .add(bl)
            .add(br)
            .divideScalar(4);

        // ── measured size in meters ───────────────────────────────────────
        // Average top+bottom width and left+right height to reduce tap noise
        const widthM = (tl.distanceTo(tr) + bl.distanceTo(br)) / 2;
        const heightM = (tl.distanceTo(bl) + tr.distanceTo(br)) / 2;

        // ── derive the wall's facing direction (normal) from tapped points ─
        // Right vector: horizontal direction of the wall (averaged top + bottom)
        const rawRight = new THREE.Vector3()
            .addVectors(
                new THREE.Vector3().subVectors(tr, tl),
                new THREE.Vector3().subVectors(br, bl),
            )
            .normalize();

        // WORLD UP: always use (0,1,0) — never derive up from the tapped points.
        // This is the key fix for the slanting issue.
        // Tapped points have small Z-depth differences between them which cause
        // a tilted "up" vector. Forcing world Y-up makes the model always
        // stand perfectly vertical regardless of measurement noise.
        const worldUp = new THREE.Vector3(0, 1, 0);

        // Wall normal = right × worldUp (perpendicular to wall, pointing toward viewer)
        // We derive normal from right × up instead of from the raw tap geometry
        const normal = new THREE.Vector3()
            .crossVectors(rawRight, worldUp)
            .normalize();

        // Recompute right to be exactly perpendicular to both normal and worldUp
        // This makes all 3 axes perfectly orthogonal (no tiny floating-point tilt)
        const right = new THREE.Vector3()
            .crossVectors(worldUp, normal)
            .normalize();

        // ── scale model to fill the measured opening ──────────────────────
        const box = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        box.getSize(size);

        console.log(
            '[WebXR] model size:',
            size,
            '→ target:',
            widthM.toFixed(3),
            heightM.toFixed(3),
        );

        const scaleX = size.x > 0 ? widthM / size.x : 1;
        const scaleY = size.y > 0 ? heightM / size.y : 1;
        const scaleZ = Math.min(scaleX, scaleY);
        model.scale.set(scaleX, scaleY, scaleZ);

        // ── apply rotation using the 3 orthogonal axes ────────────────────
        // makeBasis(right, up, normal) builds a rotation matrix where:
        //   model's local +X = right (horizontal along wall)
        //   model's local +Y = worldUp (always perfectly vertical)
        //   model's local +Z = normal (facing toward the camera)
        const rotMatrix = new THREE.Matrix4().makeBasis(right, worldUp, normal);
        model.setRotationFromMatrix(rotMatrix);

        // ── position at opening center ────────────────────────────────────
        // After scaling + rotating, recompute bounding box center to correct offset
        const scaledBox = new THREE.Box3().setFromObject(model);
        const scaledCenter = new THREE.Vector3();
        scaledBox.getCenter(scaledCenter);

        model.position.set(
            center.x + (model.position.x - scaledCenter.x),
            center.y + (model.position.y - scaledCenter.y),
            center.z + (model.position.z - scaledCenter.z),
        );
    }

    async function loadWindowModel(THREE, scene, corners, modelUrl) {
        if (!scene || !modelUrl) {
            setModelError('Load aborted: no scene or url');
            return;
        }
        setModelLoading(true);
        setModelError(null);
        try {
            const { GLTFLoader } =
                await import('three/examples/jsm/loaders/GLTFLoader.js');
            const loader = new GLTFLoader();
            const gltf = await new Promise((resolve, reject) => {
                loader.load(modelUrl, resolve, undefined, reject);
            });
            const model = gltf.scene;
            model.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
            placeModel(THREE, model, corners);

            // guard: if the session ended while we were loading, don't add
            if (sceneRef.current !== scene) {
                setModelError('Scene changed during load');
                return;
            }

            scene.add(model);
            windowModelRef.current = model;
            originalTransformRef.current = {
                position: model.position.clone(),
                rotation: model.rotation.clone(),
                scale: model.scale.clone(),
            };
            // expose for gesture hook (avoids prop-drilling across hook boundary)
            window.__arModel = model;
            window.__arCamera = cameraRef.current;
            setModelLoading(false);
            setModelPlaced(true);
            // save corners so swapModel can re-place without re-measuring
            lastCornersRef.current = corners;
        } catch (err) {
            console.error('[WebXR] GLTFLoader error:', err);
            setModelError(
                'Could not load window.glb — check public/models/window.glb exists.',
            );
            setModelLoading(false);
        }
    }

    // ── tap handler — 4 taps: TL, TR, BL, BR ────────────────────────────────
    const handleTap = useCallback((THREE, modelUrl) => {
        if (windowModelRef.current) return; // model placed, gestures take over
        if (isSwappingRef.current) return; // swap in progress, ignore taps

        const q = qualityRef.current;
        if (q === 'none' || q === 'poor' || q === 'okay') return;
        if (!latestHitRef.current) return;

        const anchors = anchorsRef.current;
        if (anchors.length >= 4) return;

        const pos = latestHitRef.current;
        anchors.push({ x: pos.x, y: pos.y, z: pos.z });
        addDot(THREE, pos, anchors.length - 1);

        // draw outline as corners accumulate
        if (anchors.length === 2) addLine(THREE, anchors[0], anchors[1]); // top edge
        if (anchors.length === 3) addLine(THREE, anchors[0], anchors[2]); // left edge
        if (anchors.length === 4) {
            addLine(THREE, anchors[1], anchors[3]); // right edge
            addLine(THREE, anchors[2], anchors[3]); // bottom edge

            const result = calcDimensionsFrom4(anchors);
            setDimensions({
                widthCm: result.widthCm,
                heightCm: result.heightCm,
            });
            loadWindowModel(THREE, sceneRef.current, result.corners, modelUrl);
        }

        setTapCount(anchors.length);
    }, []);

    const startAR = useCallback(
        async (canvasEl, overlayEl) => {
            try {
                setError(null);
                setDimensions(null);
                setTapCount(0);
                setReticleQuality('none');
                setModelLoading(false);
                setModelError(null);
                setModelPlaced(false);
                anchorsRef.current = [];
                dotMeshesRef.current = [];
                lineMeshesRef.current = [];
                stableFramesRef.current = 0;
                qualityRef.current = 'none';
                prevHitRef.current = null;

                const THREE = await import('three');
                THREERef.current = THREE; // store for swapModel to reuse

                const renderer = new THREE.WebGLRenderer({
                    canvas: canvasEl,
                    alpha: true,
                    antialias: true,
                });
                renderer.setPixelRatio(window.devicePixelRatio);
                renderer.setSize(window.innerWidth, window.innerHeight);
                renderer.xr.enabled = true;
                rendererRef.current = renderer;

                const scene = new THREE.Scene();
                const camera = new THREE.PerspectiveCamera(
                    70,
                    window.innerWidth / window.innerHeight,
                    0.01,
                    20,
                );
                sceneRef.current = scene;
                cameraRef.current = camera;

                const reticleGeo = new THREE.RingGeometry(
                    0.03,
                    0.04,
                    32,
                ).rotateX(-Math.PI / 2);
                const reticleMat = new THREE.MeshBasicMaterial({
                    color: QUALITY_COLOR.poor,
                    side: THREE.DoubleSide,
                });
                const reticle = new THREE.Mesh(reticleGeo, reticleMat);
                reticle.matrixAutoUpdate = false;
                reticle.visible = false;
                scene.add(reticle);
                reticleRef.current = reticle;

                const innerGeo = new THREE.CircleGeometry(0.025, 32).rotateX(
                    -Math.PI / 2,
                );
                const innerMat = new THREE.MeshBasicMaterial({
                    color: QUALITY_COLOR.poor,
                    side: THREE.DoubleSide,
                    transparent: true,
                    opacity: 0.25,
                });
                const innerCircle = new THREE.Mesh(innerGeo, innerMat);
                innerCircle.matrixAutoUpdate = false;
                innerCircle.visible = false;
                scene.add(innerCircle);

                scene.add(new THREE.AmbientLight(0xffffff, 0.8));
                const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
                dirLight.position.set(1, 2, 3);
                scene.add(dirLight);

                const session = await navigator.xr.requestSession(
                    'immersive-ar',
                    {
                        requiredFeatures: ['hit-test'],
                        optionalFeatures: ['dom-overlay'],
                        domOverlay: { root: overlayEl },
                    },
                );
                sessionRef.current = session;
                renderer.xr.setReferenceSpaceType('local');
                await renderer.xr.setSession(session);

                const refSpace = await session.requestReferenceSpace('local');
                const viewerSpace =
                    await session.requestReferenceSpace('viewer');
                const hitTestSource = await session.requestHitTestSource({
                    space: viewerSpace,
                });
                refSpaceRef.current = refSpace;
                hitTestSourceRef.current = hitTestSource;

                session.addEventListener('select', () =>
                    handleTap(THREE, selectedModelUrlRef.current),
                );

                let lastQualityStr = 'none';

                renderer.setAnimationLoop((_, frame) => {
                    if (!frame) return;

                    const results = frame.getHitTestResults(hitTestSource);

                    if (results.length > 0) {
                        const pose = results[0].getPose(refSpace);
                        const pos = pose.transform.position;
                        const curr = { x: pos.x, y: pos.y, z: pos.z };

                        if (prevHitRef.current) {
                            const drift = dist3DRaw(prevHitRef.current, curr);
                            if (drift < DRIFT_THRESHOLD) {
                                stableFramesRef.current = Math.min(
                                    stableFramesRef.current + 1,
                                    STABLE_FRAMES_PERFECT + 10,
                                );
                            } else {
                                stableFramesRef.current = Math.max(
                                    0,
                                    stableFramesRef.current - 8,
                                );
                            }
                        }
                        prevHitRef.current = curr;
                        latestHitRef.current = curr;

                        const q = evalQuality(stableFramesRef.current, true);
                        const color = QUALITY_COLOR[q];
                        reticleMat.color.setHex(color);
                        innerMat.color.setHex(color);

                        // hide reticle once model is placed
                        const modelDone = !!windowModelRef.current;
                        reticle.visible = !modelDone;
                        innerCircle.visible = !modelDone;

                        if (!modelDone) {
                            reticle.matrix.fromArray(pose.transform.matrix);
                            innerCircle.matrix.fromArray(pose.transform.matrix);
                        }

                        if (q !== lastQualityStr) {
                            lastQualityStr = q;
                            qualityRef.current = q;
                            setReticleQuality(q);
                        }
                    } else {
                        stableFramesRef.current = 0;
                        reticle.visible = false;
                        innerCircle.visible = false;
                        latestHitRef.current = null;
                        if (lastQualityStr !== 'none') {
                            lastQualityStr = 'none';
                            qualityRef.current = 'none';
                            setReticleQuality('none');
                        }
                    }

                    renderer.render(scene, camera);
                });

                session.addEventListener('end', () => {
                    setIsActive(false);
                    setReticleQuality('none');
                    renderer.setAnimationLoop(null);
                });

                setIsActive(true);
            } catch (err) {
                setError(err.message || 'Failed to start AR session');
                console.error('WebXR error:', err);
            }
        },
        [handleTap],
    );

    const stopAR = useCallback(async () => {
        if (sessionRef.current) {
            await sessionRef.current.end();
            sessionRef.current = null;
        }
        if (rendererRef.current) {
            rendererRef.current.setAnimationLoop(null);
            rendererRef.current.dispose();
            rendererRef.current = null;
        }
        setIsActive(false);
        setReticleQuality('none');
    }, []);

    const reset = useCallback(() => {
        if (windowModelRef.current && sceneRef.current) {
            sceneRef.current.remove(windowModelRef.current);
            windowModelRef.current = null;
        }
        window.__arModel = null;
        window.__arCamera = null;
        lastCornersRef.current = null;
        isSwappingRef.current = false;
        anchorsRef.current = [];
        dotMeshesRef.current.forEach((m) => sceneRef.current?.remove(m));
        lineMeshesRef.current.forEach((l) => sceneRef.current?.remove(l));
        dotMeshesRef.current = [];
        lineMeshesRef.current = [];
        stableFramesRef.current = 0;
        prevHitRef.current = null;
        originalTransformRef.current = null;
        setTapCount(0);
        setDimensions(null);
        setModelLoading(false);
        setModelError(null);
        setModelPlaced(false);
    }, []);

    const resetModelTransform = useCallback(() => {
        const model = windowModelRef.current;
        const orig = originalTransformRef.current;
        if (!model || !orig) return;
        model.position.copy(orig.position);
        model.rotation.copy(orig.rotation);
        model.scale.copy(orig.scale);
    }, []);

    // let the UI change which model will be placed on next measurement
    const setSelectedModel = useCallback((url) => {
        selectedModelUrlRef.current = url;
    }, []);

    // ── swapModel ─────────────────────────────────────────────────────────────
    const swapModel = useCallback(async (newModelUrl) => {
        // snapshot everything we need RIGHT NOW before any async
        const THREE = THREERef.current;
        const scene = sceneRef.current;
        const corners = lastCornersRef.current;

        if (!THREE || !scene || !corners) return;
        if (isSwappingRef.current) return;
        isSwappingRef.current = true;

        // step 1: remove old model synchronously
        const old = windowModelRef.current;
        if (old) {
            scene.remove(old);
            old.traverse((c) => {
                if (c.isMesh) {
                    c.geometry?.dispose();
                    Array.isArray(c.material)
                        ? c.material.forEach((m) => m.dispose())
                        : c.material?.dispose();
                }
            });
            windowModelRef.current = null;
            window.__arModel = null;
        }

        // step 2: load new model
        setModelLoading(true);
        setModelError(null);
        try {
            const { GLTFLoader } =
                await import('three/examples/jsm/loaders/GLTFLoader.js');
            const gltf = await new Promise((res, rej) =>
                new GLTFLoader().load(newModelUrl, res, undefined, rej),
            );
            const model = gltf.scene;
            model.traverse((c) => {
                if (c.isMesh) {
                    c.castShadow = true;
                    c.receiveShadow = true;
                }
            });

            placeModel(THREE, model, corners);
            scene.add(model);

            windowModelRef.current = model;
            window.__arModel = model;
            originalTransformRef.current = {
                position: model.position.clone(),
                rotation: model.rotation.clone(),
                scale: model.scale.clone(),
            };
            // keep lastCornersRef intact for next swap
            setModelLoading(false);
            setModelPlaced(true);
        } catch (err) {
            setModelError('Failed to load: ' + (err.message || newModelUrl));
            setModelLoading(false);
        } finally {
            isSwappingRef.current = false;
        }
    }, []);

    return {
        isSupported,
        isActive,
        tapCount,
        dimensions,
        error,
        reticleQuality,
        modelLoading,
        modelError,
        modelPlaced,
        checkSupport,
        startAR,
        stopAR,
        reset,
        resetModelTransform,
        setSelectedModel,
        swapModel,
    };
}
