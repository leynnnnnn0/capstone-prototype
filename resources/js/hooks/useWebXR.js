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
    // ── engine refs (never cause re-renders) ──────────────────────────────────
    const sessionRef = useRef(null);
    const rendererRef = useRef(null);
    const sceneRef = useRef(null);
    const cameraRef = useRef(null);
    const hitTestSourceRef = useRef(null);
    const refSpaceRef = useRef(null);
    const latestHitRef = useRef(null);
    const prevHitRef = useRef(null);
    const stableFramesRef = useRef(0);
    const qualityRef = useRef('none');
    const anchorsRef = useRef([]);
    const dotMeshesRef = useRef([]);
    const lineMeshesRef = useRef([]);
    const THREERef = useRef(null); // stored once from startAR
    const activeModelRef = useRef(null); // current placed model
    const savedCornersRef = useRef(null); // corners from last measurement
    const savedModelUrlRef = useRef('/models/window.glb');
    const isBusyRef = useRef(false); // lock while loading/swapping

    // ── react state (causes re-renders) ──────────────────────────────────────
    const [isSupported, setIsSupported] = useState(null);
    const [isActive, setIsActive] = useState(false);
    const [tapCount, setTapCount] = useState(0);
    const [dimensions, setDimensions] = useState(null);
    const [error, setError] = useState(null);
    const [reticleQuality, setReticleQuality] = useState('none');
    const [modelLoading, setModelLoading] = useState(false);
    const [modelError, setModelError] = useState(null);
    const [modelPlaced, setModelPlaced] = useState(false);

    // ── helpers ───────────────────────────────────────────────────────────────
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
            (b.x - a.x) ** 2 + (b.y - a.y) ** 2 + (b.z - a.z) ** 2,
        );
    }

    function dist3D(a, b) {
        return dist3DRaw(a, b) * 100;
    }

    function evalQuality(f, hit) {
        if (!hit) return 'none';
        if (f < STABLE_FRAMES_OKAY) return 'poor';
        if (f < STABLE_FRAMES_GOOD) return 'okay';
        if (f < STABLE_FRAMES_PERFECT) return 'good';
        return 'perfect';
    }

    function calcDims([tl, tr, bl, br]) {
        return {
            widthCm: ((dist3D(tl, tr) + dist3D(bl, br)) / 2).toFixed(1),
            heightCm: ((dist3D(tl, bl) + dist3D(tr, br)) / 2).toFixed(1),
        };
    }

    function addDot(T, pos, i) {
        const colors = [0x00ff88, 0x00ccff, 0xff6600, 0xff0066];
        const m = new T.Mesh(
            new T.SphereGeometry(0.012, 16, 16),
            new T.MeshBasicMaterial({ color: colors[i] }),
        );
        m.position.set(pos.x, pos.y, pos.z);
        sceneRef.current.add(m);
        dotMeshesRef.current.push(m);
    }

    function addLine(T, a, b) {
        const geo = new T.BufferGeometry().setFromPoints([
            new T.Vector3(a.x, a.y, a.z),
            new T.Vector3(b.x, b.y, b.z),
        ]);
        const l = new T.Line(geo, new T.LineBasicMaterial({ color: 0xffffff }));
        sceneRef.current.add(l);
        lineMeshesRef.current.push(l);
    }

    // ── placeModel ────────────────────────────────────────────────────────────
    // Positions, orients and scales a loaded model to fit the 4 tapped corners.
    function placeModel(T, model, corners) {
        const [tl, tr, bl, br] = corners.map(
            (c) => new T.Vector3(c.x, c.y, c.z),
        );
        const center = new T.Vector3()
            .add(tl)
            .add(tr)
            .add(bl)
            .add(br)
            .divideScalar(4);
        const widthM = (tl.distanceTo(tr) + bl.distanceTo(br)) / 2;
        const heightM = (tl.distanceTo(bl) + tr.distanceTo(br)) / 2;

        const rawRight = new T.Vector3()
            .addVectors(
                new T.Vector3().subVectors(tr, tl),
                new T.Vector3().subVectors(br, bl),
            )
            .normalize();
        const worldUp = new T.Vector3(0, 1, 0);
        const normal = new T.Vector3()
            .crossVectors(rawRight, worldUp)
            .normalize();
        const right = new T.Vector3().crossVectors(worldUp, normal).normalize();

        const box = new T.Box3().setFromObject(model);
        const size = new T.Vector3();
        box.getSize(size);

        const scaleX = size.x > 0 ? widthM / size.x : 1;
        const scaleY = size.y > 0 ? heightM / size.y : 1;
        const scaleZ = Math.min(scaleX, scaleY);
        model.scale.set(scaleX, scaleY, scaleZ);
        model.setRotationFromMatrix(
            new T.Matrix4().makeBasis(right, worldUp, normal),
        );

        const sc = new T.Vector3();
        new T.Box3().setFromObject(model).getCenter(sc);
        model.position.set(
            center.x + (model.position.x - sc.x),
            center.y + (model.position.y - sc.y),
            center.z + (model.position.z - sc.z),
        );
    }

    // ── removeActiveModel ─────────────────────────────────────────────────────
    // Removes the current model from the scene and frees GPU memory.
    function removeActiveModel() {
        const model = activeModelRef.current;
        if (!model || !sceneRef.current) return;
        sceneRef.current.remove(model);
        model.traverse((c) => {
            if (c.isMesh) {
                c.geometry?.dispose();
                Array.isArray(c.material)
                    ? c.material.forEach((m) => m.dispose())
                    : c.material?.dispose();
            }
        });
        activeModelRef.current = null;
        window.__arModel = null;
    }

    // ── loadAndPlace ──────────────────────────────────────────────────────────
    // Core loader. Always uses THREERef (set once in startAR).
    // corners must be the saved 4-point array.
    async function loadAndPlace(url, corners) {
        const T = THREERef.current;
        const scene = sceneRef.current;
        window.__dbg = window.__dbg || [];
        window.__dbg.push(
            'loadAndPlace: T:' + !!T + ' scene:' + !!scene + ' url:' + url,
        );
        if (!T || !scene) {
            window.__dbg.push('ABORT no T or scene');
            return;
        }

        setModelLoading(true);
        setModelError(null);

        try {
            const { GLTFLoader } =
                await import('three/examples/jsm/loaders/GLTFLoader.js');
            const gltf = await new Promise((res, rej) =>
                new GLTFLoader().load(url, res, undefined, rej),
            );

            // verify session is still alive
            if (!sceneRef.current || sceneRef.current !== scene) return;

            const model = gltf.scene;
            model.traverse((c) => {
                if (c.isMesh) {
                    c.castShadow = true;
                    c.receiveShadow = true;
                }
            });

            placeModel(T, model, corners);
            scene.add(model);

            activeModelRef.current = model;
            window.__arModel = model;
            window.__arCamera = cameraRef.current;

            setModelLoading(false);
            setModelPlaced(true);
        } catch (err) {
            setModelError('Could not load model: ' + url);
            setModelLoading(false);
        }
    }

    // ── handleTap ─────────────────────────────────────────────────────────────
    const handleTap = useCallback((T, modelUrl) => {
        if (activeModelRef.current) return;
        if (isBusyRef.current) return;
        const q = qualityRef.current;
        if (q === 'none' || q === 'poor' || q === 'okay') return;
        if (!latestHitRef.current) return;

        const anchors = anchorsRef.current;
        if (anchors.length >= 4) return;

        const pos = latestHitRef.current;
        anchors.push({ x: pos.x, y: pos.y, z: pos.z });
        addDot(T, pos, anchors.length - 1);

        if (anchors.length === 2) addLine(T, anchors[0], anchors[1]);
        if (anchors.length === 3) addLine(T, anchors[0], anchors[2]);
        if (anchors.length === 4) {
            addLine(T, anchors[1], anchors[3]);
            addLine(T, anchors[2], anchors[3]);

            const dims = calcDims(anchors);
            setDimensions(dims);

            // save corners for later swaps
            savedCornersRef.current = [...anchors];

            isBusyRef.current = true;
            loadAndPlace(modelUrl, savedCornersRef.current).finally(() => {
                isBusyRef.current = false;
            });
        }

        setTapCount(anchors.length);
    }, []);

    // ── swapModel ─────────────────────────────────────────────────────────────
    // Public function — swap to a different model keeping same corners.
    const swapModel = useCallback(async (newUrl) => {
        window.__dbg = window.__dbg || [];
        window.__dbg.push('swapModel called: ' + newUrl);
        window.__dbg.push(
            'busy:' +
                isBusyRef.current +
                ' corners:' +
                !!savedCornersRef.current +
                ' THREE:' +
                !!THREERef.current,
        );

        if (isBusyRef.current) {
            window.__dbg.push('BLOCKED by busy');
            return;
        }
        const corners = savedCornersRef.current;
        if (!corners) {
            window.__dbg.push('BLOCKED no corners');
            return;
        }

        isBusyRef.current = true;
        window.__dbg.push('removing old model...');
        removeActiveModel();
        window.__dbg.push('loading: ' + newUrl);
        try {
            await loadAndPlace(newUrl, corners);
            window.__dbg.push('loadAndPlace done');
        } catch (e) {
            window.__dbg.push('loadAndPlace ERROR: ' + e.message);
        }
        isBusyRef.current = false;
    }, []);

    // ── startAR ───────────────────────────────────────────────────────────────
    const startAR = useCallback(
        async (canvasEl, overlayEl) => {
            try {
                // reset state
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
                isBusyRef.current = false;
                savedCornersRef.current = null;
                activeModelRef.current = null;
                window.__arModel = null;
                window.__arCamera = null;

                const T = await import('three');
                THREERef.current = T; // store once — never re-import

                const renderer = new T.WebGLRenderer({
                    canvas: canvasEl,
                    alpha: true,
                    antialias: true,
                });
                renderer.setPixelRatio(window.devicePixelRatio);
                renderer.setSize(window.innerWidth, window.innerHeight);
                renderer.xr.enabled = true;
                rendererRef.current = renderer;

                const scene = new T.Scene();
                const camera = new T.PerspectiveCamera(
                    70,
                    window.innerWidth / window.innerHeight,
                    0.01,
                    20,
                );
                sceneRef.current = scene;
                cameraRef.current = camera;

                // reticle
                const reticleGeo = new T.RingGeometry(0.03, 0.04, 32).rotateX(
                    -Math.PI / 2,
                );
                const reticleMat = new T.MeshBasicMaterial({
                    color: QUALITY_COLOR.poor,
                    side: T.DoubleSide,
                });
                const reticle = new T.Mesh(reticleGeo, reticleMat);
                reticle.matrixAutoUpdate = false;
                reticle.visible = false;
                scene.add(reticle);

                const innerGeo = new T.CircleGeometry(0.025, 32).rotateX(
                    -Math.PI / 2,
                );
                const innerMat = new T.MeshBasicMaterial({
                    color: QUALITY_COLOR.poor,
                    side: T.DoubleSide,
                    transparent: true,
                    opacity: 0.25,
                });
                const innerCircle = new T.Mesh(innerGeo, innerMat);
                innerCircle.matrixAutoUpdate = false;
                innerCircle.visible = false;
                scene.add(innerCircle);

                scene.add(new T.AmbientLight(0xffffff, 0.8));
                const dir = new T.DirectionalLight(0xffffff, 0.6);
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

                session.addEventListener('select', () =>
                    handleTap(T, savedModelUrlRef.current),
                );

                let lastQ = 'none';

                renderer.setAnimationLoop((_, frame) => {
                    if (!frame) return;
                    const results = frame.getHitTestResults(hitTestSource);

                    if (results.length > 0) {
                        const pose = results[0].getPose(refSpace);
                        const pos = pose.transform.position;
                        const curr = { x: pos.x, y: pos.y, z: pos.z };

                        if (prevHitRef.current) {
                            const d = dist3DRaw(prevHitRef.current, curr);
                            stableFramesRef.current =
                                d < DRIFT_THRESHOLD
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

                        const done = !!activeModelRef.current;
                        reticle.visible = !done;
                        innerCircle.visible = !done;
                        if (!done) {
                            reticle.matrix.fromArray(pose.transform.matrix);
                            innerCircle.matrix.fromArray(pose.transform.matrix);
                        }

                        if (q !== lastQ) {
                            lastQ = q;
                            qualityRef.current = q;
                            setReticleQuality(q);
                        }
                    } else {
                        stableFramesRef.current = 0;
                        reticle.visible = false;
                        innerCircle.visible = false;
                        latestHitRef.current = null;
                        if (lastQ !== 'none') {
                            lastQ = 'none';
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
                setError(err.message || 'Failed to start AR');
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
        removeActiveModel();
        window.__arModel = null;
        window.__arCamera = null;
        savedCornersRef.current = null;
        isBusyRef.current = false;
        anchorsRef.current = [];
        dotMeshesRef.current.forEach((m) => sceneRef.current?.remove(m));
        lineMeshesRef.current.forEach((l) => sceneRef.current?.remove(l));
        dotMeshesRef.current = [];
        lineMeshesRef.current = [];
        stableFramesRef.current = 0;
        prevHitRef.current = null;
        setTapCount(0);
        setDimensions(null);
        setModelLoading(false);
        setModelError(null);
        setModelPlaced(false);
    }, []);

    const resetModelTransform = useCallback(() => {
        // not tracking original transform anymore — could re-place if needed
        // for now just re-place at saved corners
        const corners = savedCornersRef.current;
        const model = activeModelRef.current;
        if (!model || !corners) return;
        placeModel(THREERef.current, model, corners);
        window.__arModel = model;
    }, []);

    const setSelectedModel = useCallback((url) => {
        savedModelUrlRef.current = url;
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
