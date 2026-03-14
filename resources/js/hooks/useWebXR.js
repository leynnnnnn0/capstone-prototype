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

    // ── 3-tap measurement ─────────────────────────────────────────────────────
    // User taps: [0] top-left, [1] top-right, [2] bottom-left
    // We compute bottom-right from the parallelogram
    function calcDimensionsFrom3([tl, tr, bl]) {
        const widthCm = dist3D(tl, tr).toFixed(1);
        const heightCm = dist3D(tl, bl).toFixed(1);
        // bottom-right = top-right + (bottom-left - top-left)
        const br = {
            x: tr.x + (bl.x - tl.x),
            y: tr.y + (bl.y - tl.y),
            z: tr.z + (bl.z - tl.z),
        };
        return { widthCm, heightCm, corners: [tl, tr, bl, br] };
    }

    function evalQuality(stableFrames, hasHit) {
        if (!hasHit) return 'none';
        if (stableFrames < STABLE_FRAMES_OKAY) return 'poor';
        if (stableFrames < STABLE_FRAMES_GOOD) return 'okay';
        if (stableFrames < STABLE_FRAMES_PERFECT) return 'good';
        return 'perfect';
    }

    function addDot(THREE, position, index) {
        const colors = [0x00ff88, 0x00ccff, 0xff6600];
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

        const center = new THREE.Vector3()
            .add(tl)
            .add(tr)
            .add(bl)
            .add(br)
            .divideScalar(4);

        const topEdge = new THREE.Vector3().subVectors(tr, tl);
        const bottomEdge = new THREE.Vector3().subVectors(br, bl);
        const right = new THREE.Vector3()
            .addVectors(topEdge, bottomEdge)
            .normalize();

        const leftEdge = new THREE.Vector3().subVectors(tl, bl);
        const rightEdge = new THREE.Vector3().subVectors(tr, br);
        const up = new THREE.Vector3()
            .addVectors(leftEdge, rightEdge)
            .normalize();

        const normal = new THREE.Vector3().crossVectors(right, up).normalize();

        const widthM = (topEdge.length() + bottomEdge.length()) / 2;
        const heightM = (leftEdge.length() + rightEdge.length()) / 2;

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

        const rotMatrix = new THREE.Matrix4().makeBasis(right, up, normal);
        model.setRotationFromMatrix(rotMatrix);

        const scaledBox = new THREE.Box3().setFromObject(model);
        const scaledCenter = new THREE.Vector3();
        scaledBox.getCenter(scaledCenter);

        model.position.set(
            center.x + (model.position.x - scaledCenter.x),
            center.y + (model.position.y - scaledCenter.y),
            center.z + (model.position.z - scaledCenter.z),
        );
    }

    async function loadWindowModel(THREE, scene, corners) {
        setModelLoading(true);
        setModelError(null);
        try {
            const { GLTFLoader } =
                await import('three/examples/jsm/loaders/GLTFLoader.js');
            const loader = new GLTFLoader();
            const gltf = await new Promise((resolve, reject) => {
                loader.load('/models/window.glb', resolve, undefined, reject);
            });
            const model = gltf.scene;
            model.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
            placeModel(THREE, model, corners);
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
        } catch (err) {
            console.error('[WebXR] GLTFLoader error:', err);
            setModelError(
                'Could not load window.glb — check public/models/window.glb exists.',
            );
            setModelLoading(false);
        }
    }

    // ── tap handler — now only needs 3 taps ──────────────────────────────────
    const handleTap = useCallback((THREE) => {
        if (windowModelRef.current) return; // model placed, gestures take over

        const q = qualityRef.current;
        if (q === 'none' || q === 'poor' || q === 'okay') return;
        if (!latestHitRef.current) return;

        const anchors = anchorsRef.current;
        if (anchors.length >= 3) return;

        const pos = latestHitRef.current;
        anchors.push({ x: pos.x, y: pos.y, z: pos.z });
        addDot(THREE, pos, anchors.length - 1);

        // draw outline lines as taps come in
        if (anchors.length === 2) addLine(THREE, anchors[0], anchors[1]);
        if (anchors.length === 3) {
            // compute br and draw the full rectangle
            const [tl, tr, bl] = anchors;
            const br = {
                x: tr.x + (bl.x - tl.x),
                y: tr.y + (bl.y - tl.y),
                z: tr.z + (bl.z - tl.z),
            };
            addLine(THREE, tl, bl);
            addLine(THREE, tr, br);
            addLine(THREE, bl, br);

            const result = calcDimensionsFrom3(anchors);
            setDimensions({
                widthCm: result.widthCm,
                heightCm: result.heightCm,
            });
            loadWindowModel(THREE, sceneRef.current, result.corners);
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

                session.addEventListener('select', () => handleTap(THREE));

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
    };
}
