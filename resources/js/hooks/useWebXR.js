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
    // stores the 4 tapped world positions for projection
    const tappedCornersRef = useRef([]);

    const [isSupported, setIsSupported] = useState(null);
    const [isActive, setIsActive] = useState(false);
    const [tapCount, setTapCount] = useState(0);
    const [dimensions, setDimensions] = useState(null);
    const [error, setError] = useState(null);
    const [reticleQuality, setReticleQuality] = useState('none');
    // screen-space rect: { left, top, width, height } in CSS px
    const [overlayRect, setOverlayRect] = useState(null);

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

    // project one 3-D world point → 2-D screen pixel { x, y }
    function projectToScreen(THREE, camera, worldPos) {
        const v = new THREE.Vector3(worldPos.x, worldPos.y, worldPos.z);
        v.project(camera);
        return {
            x: ((v.x + 1) / 2) * window.innerWidth,
            y: ((-v.y + 1) / 2) * window.innerHeight,
        };
    }

    // given the 4 projected screen points, return a bounding rect
    function cornersToRect(pts) {
        const xs = pts.map((p) => p.x);
        const ys = pts.map((p) => p.y);
        const left = Math.min(...xs);
        const top = Math.min(...ys);
        const right = Math.max(...xs);
        const bottom = Math.max(...ys);
        return { left, top, width: right - left, height: bottom - top };
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
            // save corners for live projection in the render loop
            tappedCornersRef.current = [...anchors];
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
                setOverlayRect(null);
                anchorsRef.current = [];
                dotMeshesRef.current = [];
                lineMeshesRef.current = [];
                tappedCornersRef.current = [];
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

                scene.add(new THREE.AmbientLight(0xffffff, 1));

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

                    // ── live-project the 4 tapped corners every frame ─────────────
                    // This keeps the image overlay glued to the measured rectangle
                    // even as the user's hand/phone moves slightly after measuring.
                    if (tappedCornersRef.current.length === 4) {
                        const pts = tappedCornersRef.current.map((c) =>
                            projectToScreen(THREE, camera, c),
                        );
                        setOverlayRect(cornersToRect(pts));
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
        setOverlayRect(null);
    }, []);

    return {
        isSupported,
        isActive,
        tapCount,
        dimensions,
        error,
        reticleQuality,
        overlayRect, // ← new: { left, top, width, height } in CSS px
        checkSupport,
        startAR,
        stopAR,
        reset,
    };
}
