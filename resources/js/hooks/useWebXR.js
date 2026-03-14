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
    const tappedCornersRef = useRef([]);
    const windowModelRef = useRef(null);
    const canvasElRef = useRef(null);

    // ── gesture state ────────────────────────────────────────────────────────
    const gestureRef = useRef({
        active: false,
        touchCount: 0,
        // single finger
        lastX: 0,
        lastY: 0,
        // two finger
        lastDist: 0, // pinch distance
        lastAngle: 0, // rotation angle
        lastMidY: 0, // for depth push/pull
    });

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

    function calcDimensions([tl, tr, bl, br]) {
        return {
            widthCm: ((dist3D(tl, tr) + dist3D(bl, br)) / 2).toFixed(1),
            heightCm: ((dist3D(tl, bl) + dist3D(tr, br)) / 2).toFixed(1),
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
        const colors = [0x00ff88, 0x00ccff, 0xff6600, 0xff0066];
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

        console.log('[WebXR] model natural size (m):', size);
        console.log(
            '[WebXR] target size (m):',
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

    // ── touch helpers ─────────────────────────────────────────────────────────
    function getTouchDist(t1, t2) {
        return Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
    }

    function getTouchAngle(t1, t2) {
        return Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX);
    }

    function getTouchMid(t1, t2) {
        return {
            x: (t1.clientX + t2.clientX) / 2,
            y: (t1.clientY + t2.clientY) / 2,
        };
    }

    // ── attach gesture listeners to the canvas ────────────────────────────────
    function attachGestures(canvas, THREE) {
        const g = gestureRef.current;

        function onTouchStart(e) {
            // only intercept gestures when model is placed
            if (!windowModelRef.current) return;
            g.active = true;
            g.touchCount = e.touches.length;

            if (e.touches.length === 1) {
                g.lastX = e.touches[0].clientX;
                g.lastY = e.touches[0].clientY;
            } else if (e.touches.length === 2) {
                g.lastDist = getTouchDist(e.touches[0], e.touches[1]);
                g.lastAngle = getTouchAngle(e.touches[0], e.touches[1]);
                g.lastMidY = getTouchMid(e.touches[0], e.touches[1]).y;
            }
        }

        function onTouchMove(e) {
            if (!g.active || !windowModelRef.current) return;
            e.preventDefault();

            const model = windowModelRef.current;
            const camera = cameraRef.current;

            if (e.touches.length === 1 && g.touchCount === 1) {
                // ── 1 finger: move model along its own plane ──────────────────
                const dx = (e.touches[0].clientX - g.lastX) / window.innerWidth;
                const dy =
                    (e.touches[0].clientY - g.lastY) / window.innerHeight;

                // get camera right and up in world space
                const camRight = new THREE.Vector3();
                const camUp = new THREE.Vector3();
                camera.matrixWorld.extractBasis(
                    camRight,
                    camUp,
                    new THREE.Vector3(),
                );

                // move sensitivity: 2 meters per full screen swipe
                const MOVE_SPEED = 2.0;
                model.position.addScaledVector(camRight, dx * MOVE_SPEED);
                model.position.addScaledVector(camUp, -dy * MOVE_SPEED);

                g.lastX = e.touches[0].clientX;
                g.lastY = e.touches[0].clientY;
            } else if (e.touches.length === 2) {
                const newDist = getTouchDist(e.touches[0], e.touches[1]);
                const newAngle = getTouchAngle(e.touches[0], e.touches[1]);
                const newMidY = getTouchMid(e.touches[0], e.touches[1]).y;

                // ── pinch: scale model ────────────────────────────────────────
                if (g.lastDist > 0) {
                    const scaleFactor = newDist / g.lastDist;
                    model.scale.multiplyScalar(scaleFactor);
                    // clamp scale: 0.1× to 5× of original
                    const minS = 0.05;
                    const maxS = 5;
                    model.scale.clampScalar(minS, maxS);
                }

                // ── two finger rotate: spin model around its up/normal axis ───
                const angleDelta = newAngle - g.lastAngle;
                // rotate around the world Y axis for natural spin
                model.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), angleDelta);

                // ── two finger vertical drag: push/pull depth ─────────────────
                const depthDelta = (newMidY - g.lastMidY) / window.innerHeight;
                // get camera forward vector
                const camForward = new THREE.Vector3();
                camera.getWorldDirection(camForward);
                const DEPTH_SPEED = 2.0;
                model.position.addScaledVector(
                    camForward,
                    depthDelta * DEPTH_SPEED,
                );

                g.lastDist = newDist;
                g.lastAngle = newAngle;
                g.lastMidY = newMidY;
            }
        }

        function onTouchEnd(e) {
            g.touchCount = e.touches.length;
            if (e.touches.length === 0) {
                g.active = false;
                // re-init for next gesture
                g.lastDist = 0;
                g.lastAngle = 0;
            }
        }

        canvas.addEventListener('touchstart', onTouchStart, { passive: true });
        canvas.addEventListener('touchmove', onTouchMove, { passive: false });
        canvas.addEventListener('touchend', onTouchEnd, { passive: true });

        // return cleanup fn
        return () => {
            canvas.removeEventListener('touchstart', onTouchStart);
            canvas.removeEventListener('touchmove', onTouchMove);
            canvas.removeEventListener('touchend', onTouchEnd);
        };
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

    const handleTap = useCallback((THREE) => {
        const q = qualityRef.current;
        if (q === 'none' || q === 'poor' || q === 'okay') return;
        if (!latestHitRef.current) return;

        const anchors = anchorsRef.current;
        if (anchors.length >= 4) return;

        const pos = latestHitRef.current;
        anchors.push({ x: pos.x, y: pos.y, z: pos.z });
        addDot(THREE, pos, anchors.length - 1);

        if (anchors.length === 2) addLine(THREE, anchors[0], anchors[1]);
        if (anchors.length === 3) addLine(THREE, anchors[0], anchors[2]);
        if (anchors.length === 4) {
            addLine(THREE, anchors[1], anchors[3]);
            addLine(THREE, anchors[2], anchors[3]);
            setDimensions(calcDimensions(anchors));
            tappedCornersRef.current = [...anchors];
            loadWindowModel(THREE, sceneRef.current, anchors);
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
                tappedCornersRef.current = [];
                stableFramesRef.current = 0;
                qualityRef.current = 'none';
                prevHitRef.current = null;
                canvasElRef.current = canvasEl;

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

                // attach gesture listeners — detach on session end
                const detachGestures = attachGestures(canvasEl, THREE);

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
                        reticle.visible = true;
                        innerCircle.visible = true;
                        reticle.matrix.fromArray(pose.transform.matrix);
                        innerCircle.matrix.fromArray(pose.transform.matrix);

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
                    detachGestures();
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
        anchorsRef.current = [];
        dotMeshesRef.current.forEach((m) => sceneRef.current?.remove(m));
        lineMeshesRef.current.forEach((l) => sceneRef.current?.remove(l));
        dotMeshesRef.current = [];
        lineMeshesRef.current = [];
        tappedCornersRef.current = [];
        stableFramesRef.current = 0;
        prevHitRef.current = null;
        setTapCount(0);
        setDimensions(null);
        setModelLoading(false);
        setModelError(null);
        setModelPlaced(false);
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
    };
}
