// ─────────────────────────────────────────────────────────────────────────────
// useWebXRFree.js
//
// Free-tap variant of useWebXR.
// Differences from the 4-tap version:
//   - User taps ANY number of corners (min 3)
//   - Taps a floating "Done" button to confirm and place the model
//   - Width/height derived from the bounding box of all tapped points
//   - Wall orientation still uses world-up (same fix as before)
//   - Supports an undo-last-tap button
// ─────────────────────────────────────────────────────────────────────────────

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
const DEFAULT_MIN_TAPS = 3;

export function useWebXRFree() {
    const sessionRef = useRef(null);
    const rendererRef = useRef(null);
    const sceneRef = useRef(null);
    const cameraRef = useRef(null);
    const hitTestSourceRef = useRef(null);
    const refSpaceRef = useRef(null);
    const reticleRef = useRef(null);
    const innerCircleRef = useRef(null);
    const reticleMatRef = useRef(null);
    const innerMatRef = useRef(null);
    const latestHitRef = useRef(null);
    const prevHitRef = useRef(null);
    const stableFramesRef = useRef(0);
    const qualityRef = useRef('none');
    const anchorsRef = useRef([]); // all tapped world points
    const dotMeshesRef = useRef([]);
    const lineMeshesRef = useRef([]);
    const windowModelRef = useRef(null);
    const originalTransformRef = useRef(null);
    const selectedModelUrlRef = useRef('/models/window.glb');
    const requiredTapsRef = useRef(4); // set from selected model's tap count

    const [isSupported, setIsSupported] = useState(null);
    const [isActive, setIsActive] = useState(false);
    const [tapCount, setTapCount] = useState(0);
    const [dimensions, setDimensions] = useState(null);
    const [error, setError] = useState(null);
    const [reticleQuality, setReticleQuality] = useState('none');
    const [modelLoading, setModelLoading] = useState(false);
    const [modelError, setModelError] = useState(null);
    const [modelPlaced, setModelPlaced] = useState(false);
    const [canConfirm, setCanConfirm] = useState(false); // true when >= MIN_TAPS

    const checkSupport = useCallback(async () => {
        if (!navigator.xr) {
            setIsSupported(false);
            return false;
        }
        const ok = await navigator.xr.isSessionSupported('immersive-ar');
        setIsSupported(ok);
        return ok;
    }, []);

    function dist3DRaw(a, b) {
        return Math.sqrt(
            Math.pow(b.x - a.x, 2) +
                Math.pow(b.y - a.y, 2) +
                Math.pow(b.z - a.z, 2),
        );
    }

    function evalQuality(stableFrames, hasHit) {
        if (!hasHit) return 'none';
        if (stableFrames < STABLE_FRAMES_OKAY) return 'poor';
        if (stableFrames < STABLE_FRAMES_GOOD) return 'okay';
        if (stableFrames < STABLE_FRAMES_PERFECT) return 'good';
        return 'perfect';
    }

    // ── compute dimensions from N tapped points ───────────────────────────────
    // Uses the bounding box of all points projected onto the wall plane.
    // This works for L-shapes, U-shapes, any polygon — we measure the
    // total span (width = left-to-right, height = bottom-to-top).
    function calcDimensionsFromPoints(THREE, points) {
        if (points.length < 2) return { widthCm: 0, heightCm: 0 };

        // ── step 1: find the wall's horizontal axis ───────────────────────
        // Use the first two points to get an approximate right vector,
        // then force world-up for vertical.
        const p0 = new THREE.Vector3(points[0].x, points[0].y, points[0].z);
        const p1 = new THREE.Vector3(points[1].x, points[1].y, points[1].z);

        const rawRight = new THREE.Vector3().subVectors(p1, p0).normalize();
        const worldUp = new THREE.Vector3(0, 1, 0);
        const normal = new THREE.Vector3()
            .crossVectors(rawRight, worldUp)
            .normalize();
        const right = new THREE.Vector3()
            .crossVectors(worldUp, normal)
            .normalize();

        // ── step 2: project every point onto the (right, worldUp) plane ───
        const projected = points.map((p) => {
            const v = new THREE.Vector3(p.x, p.y, p.z);
            return {
                u: v.dot(right), // horizontal component
                v: v.dot(worldUp), // vertical component
            };
        });

        const minU = Math.min(...projected.map((p) => p.u));
        const maxU = Math.max(...projected.map((p) => p.u));
        const minV = Math.min(...projected.map((p) => p.v));
        const maxV = Math.max(...projected.map((p) => p.v));

        return {
            widthCm: ((maxU - minU) * 100).toFixed(1),
            heightCm: ((maxV - minV) * 100).toFixed(1),
            right,
            worldUp,
            normal,
            center: {
                x: points.reduce((s, p) => s + p.x, 0) / points.length,
                y: points.reduce((s, p) => s + p.y, 0) / points.length,
                z: points.reduce((s, p) => s + p.z, 0) / points.length,
            },
        };
    }

    function addDot(THREE, position, index) {
        // cycle through colors as dots accumulate
        const palette = [
            0x00ff88, 0x00ccff, 0xff6600, 0xff0066, 0xffcc00, 0xaa00ff,
            0x00ffcc, 0xff4488,
        ];
        const color = palette[index % palette.length];
        const geo = new THREE.SphereGeometry(0.012, 16, 16);
        const mat = new THREE.MeshBasicMaterial({ color });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(position.x, position.y, position.z);
        sceneRef.current.add(mesh);
        dotMeshesRef.current.push(mesh);
    }

    function addLine(THREE, a, b, color = 0xffffff) {
        const points = [
            new THREE.Vector3(a.x, a.y, a.z),
            new THREE.Vector3(b.x, b.y, b.z),
        ];
        const geo = new THREE.BufferGeometry().setFromPoints(points);
        const mat = new THREE.LineBasicMaterial({ color, linewidth: 2 });
        const line = new THREE.Line(geo, mat);
        sceneRef.current.add(line);
        lineMeshesRef.current.push(line);
    }

    // redraw all lines from current anchors (called after undo)
    function redrawLines(THREE) {
        lineMeshesRef.current.forEach((l) => sceneRef.current?.remove(l));
        lineMeshesRef.current = [];
        const anchors = anchorsRef.current;
        for (let i = 1; i < anchors.length; i++) {
            addLine(THREE, anchors[i - 1], anchors[i]);
        }
        // close the polygon if >= 3 points
        if (anchors.length >= 3) {
            addLine(THREE, anchors[anchors.length - 1], anchors[0], 0x00ff8888);
        }
    }

    // ── placeModel ────────────────────────────────────────────────────────────
    // Same world-up approach as the 4-tap version.
    // Width/height come from the bounding box of all tapped points.
    function placeModel(THREE, model, dims) {
        const { widthCm, heightCm, right, worldUp, normal, center } = dims;
        const widthM = parseFloat(widthCm) / 100;
        const heightM = parseFloat(heightCm) / 100;

        const box = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        box.getSize(size);

        console.log(
            '[WebXRFree] model size:',
            size,
            '→ target:',
            widthM.toFixed(3),
            heightM.toFixed(3),
        );

        const scaleX = size.x > 0 ? widthM / size.x : 1;
        const scaleY = size.y > 0 ? heightM / size.y : 1;
        const scaleZ = Math.min(scaleX, scaleY);
        model.scale.set(scaleX, scaleY, scaleZ);

        const rotMatrix = new THREE.Matrix4().makeBasis(right, worldUp, normal);
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

    async function loadModel(THREE, scene, dims) {
        setModelLoading(true);
        setModelError(null);
        try {
            const { GLTFLoader } =
                await import('three/examples/jsm/loaders/GLTFLoader.js');
            const loader = new GLTFLoader();
            const gltf = await new Promise((res, rej) =>
                loader.load(selectedModelUrlRef.current, res, undefined, rej),
            );
            const model = gltf.scene;
            model.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });

            placeModel(THREE, model, dims);
            scene.add(model);
            windowModelRef.current = model;
            originalTransformRef.current = {
                position: model.position.clone(),
                rotation: model.rotation.clone(),
                scale: model.scale.clone(),
            };
            window.__arModel = model;
            window.__arCamera = cameraRef.current;
            setModelLoading(false);
            setModelPlaced(true);
        } catch (err) {
            console.error('[WebXRFree] load error:', err);
            setModelError(
                'Could not load model — check the file exists in public/models/',
            );
            setModelLoading(false);
        }
    }

    // ── tap: add a point ──────────────────────────────────────────────────────
    const handleTap = useCallback((THREE) => {
        if (windowModelRef.current) return;
        const q = qualityRef.current;
        if (q === 'none' || q === 'poor' || q === 'okay') return;
        if (!latestHitRef.current) return;

        const pos = latestHitRef.current;
        const anchors = anchorsRef.current;

        // guard: don't add more taps than required
        if (anchors.length >= requiredTapsRef.current) return;

        anchors.push({ x: pos.x, y: pos.y, z: pos.z });
        addDot(THREE, pos, anchors.length - 1);

        // draw line from previous point to this one
        if (anchors.length >= 2) {
            addLine(
                THREE,
                anchors[anchors.length - 2],
                anchors[anchors.length - 1],
            );
        }

        const newCount = anchors.length;
        setTapCount(newCount);

        // auto-confirm: inline the logic here so THREE is the correct reference
        // (calling confirmMeasurement via useCallback would use a stale closure)
        if (newCount === requiredTapsRef.current) {
            const dims = calcDimensionsFromPoints(THREE, anchors);
            setDimensions({ widthCm: dims.widthCm, heightCm: dims.heightCm });
            loadModel(THREE, sceneRef.current, dims);
        } else {
            setCanConfirm(newCount >= DEFAULT_MIN_TAPS);
        }
    }, []);

    // ── undo last tap ─────────────────────────────────────────────────────────
    const undoTap = useCallback((THREE) => {
        const anchors = anchorsRef.current;
        if (anchors.length === 0) return;

        anchors.pop();

        // remove last dot
        const dot = dotMeshesRef.current.pop();
        if (dot) sceneRef.current?.remove(dot);

        redrawLines(THREE);

        const newCount = anchors.length;
        setTapCount(newCount);
        // auto-confirm when required taps reached
        if (newCount === requiredTapsRef.current) {
            confirmMeasurement(THREE);
        } else {
            setCanConfirm(newCount >= DEFAULT_MIN_TAPS);
        }
    }, []);

    // ── confirm: compute dimensions and place model ───────────────────────────
    const confirmMeasurement = useCallback((THREE) => {
        const anchors = anchorsRef.current;
        if (anchors.length < MIN_TAPS) return;

        const dims = calcDimensionsFromPoints(THREE, anchors);
        setDimensions({ widthCm: dims.widthCm, heightCm: dims.heightCm });
        loadModel(THREE, sceneRef.current, dims);
    }, []);

    const startAR = useCallback(
        async (canvasEl, overlayEl) => {
            try {
                setError(null);
                setDimensions(null);
                setTapCount(0);
                setCanConfirm(false);
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
                reticleMatRef.current = reticleMat;

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
                innerCircleRef.current = innerCircle;
                innerMatRef.current = innerMat;

                scene.add(new THREE.AmbientLight(0xffffff, 0.8));
                const dir = new THREE.DirectionalLight(0xffffff, 0.6);
                dir.position.set(1, 2, 3);
                scene.add(dir);

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

                // expose THREE so UI buttons can call handleTap/undoTap/confirmMeasurement
                window.__arTHREE = THREE;
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
                            stableFramesRef.current =
                                drift < DRIFT_THRESHOLD
                                    ? Math.min(
                                          stableFramesRef.current + 1,
                                          STABLE_FRAMES_PERFECT + 10,
                                      )
                                    : Math.max(0, stableFramesRef.current - 8);
                        }
                        prevHitRef.current = curr;
                        latestHitRef.current = curr;

                        const q = evalQuality(stableFramesRef.current, true);
                        const color = QUALITY_COLOR[q];
                        reticleMat.color.setHex(color);
                        innerMat.color.setHex(color);

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
        setCanConfirm(false);
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

    const setSelectedModel = useCallback((url) => {
        selectedModelUrlRef.current = url;
    }, []);

    const setRequiredTaps = useCallback((n) => {
        requiredTapsRef.current = n;
    }, []);

    // expose undo/confirm so UI buttons can call them
    const handleUndo = useCallback(() => undoTap(window.__arTHREE), [undoTap]);
    const handleConfirm = useCallback(
        () => confirmMeasurement(window.__arTHREE),
        [confirmMeasurement],
    );

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
        canConfirm,
        checkSupport,
        startAR,
        stopAR,
        reset,
        resetModelTransform,
        setSelectedModel,
        handleUndo,
        handleConfirm,
        setRequiredTaps,
    };
}
