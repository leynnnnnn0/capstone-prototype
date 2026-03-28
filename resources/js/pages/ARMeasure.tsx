/**
 * WallHitTest.tsx
 *
 * React + Three.js WebXR AR wall hit test.
 *
 * How it works:
 * - A 3D reticle ring lives INSIDE the AR scene so it appears on the wall in the camera feed
 * - The hit-test ray always shoots from the CENTER of the screen (viewer origin, forward direction)
 * - A ref (not state) drives the label so React re-renders don't break the XR loop
 * - Panels are placed flush to the wall using the hit pose orientation (+Z = wall normal)
 */

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

const MAX_WALL_OBJECTS = 15;
type ARState = 'checking' | 'supported' | 'unsupported' | 'active' | 'error';

export default function WallHitTest() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

    // Use a ref for wall-detected so the XR animation loop can write it
    // without causing React re-renders every frame (60fps setState = bad)
    const wallDetectedRef = useRef(false);

    // Separate label ref that we update via direct DOM manipulation
    const labelRef = useRef<HTMLDivElement>(null);
    const ringRef = useRef<HTMLDivElement>(null);

    const [arState, setArState] = useState<ARState>('checking');
    const [errorMsg, setErrorMsg] = useState('');

    // ------------------------------------------------------------------
    // Check AR support
    // ------------------------------------------------------------------
    useEffect(() => {
        if (!navigator.xr) {
            setArState('unsupported');
            return;
        }
        navigator.xr
            .isSessionSupported('immersive-ar')
            .then((ok) => setArState(ok ? 'supported' : 'unsupported'))
            .catch(() => setArState('unsupported'));
    }, []);

    // ------------------------------------------------------------------
    // Build renderer once
    // ------------------------------------------------------------------
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const renderer = new THREE.WebGLRenderer({
            canvas,
            alpha: true,
            antialias: true,
        });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.xr.enabled = true;
        rendererRef.current = renderer;
        const onResize = () =>
            renderer.setSize(window.innerWidth, window.innerHeight);
        window.addEventListener('resize', onResize);
        return () => {
            window.removeEventListener('resize', onResize);
            renderer.dispose();
        };
    }, []);

    // ------------------------------------------------------------------
    // Update the HTML reticle ring + label via direct DOM — safe from XR loop
    // ------------------------------------------------------------------
    function setDetected(detected: boolean) {
        if (wallDetectedRef.current === detected) return; // no change, skip DOM write
        wallDetectedRef.current = detected;

        if (ringRef.current) {
            ringRef.current.style.borderColor = detected
                ? '#00ffff'
                : 'rgba(255,255,255,0.35)';
            ringRef.current.style.boxShadow = detected
                ? '0 0 14px #00ffff, 0 0 28px #00ffff55'
                : 'none';
        }
        if (labelRef.current) {
            labelRef.current.textContent = detected
                ? 'WALL DETECTED · TAP TO PLACE'
                : 'POINT AT A WALL';
            labelRef.current.style.color = detected
                ? '#00ffff'
                : 'rgba(255,255,255,0.4)';
            labelRef.current.style.textShadow = detected
                ? '0 0 10px #00ffff'
                : 'none';
        }
    }

    // ------------------------------------------------------------------
    // Reference space helper
    // ------------------------------------------------------------------
    async function requestRefSpace(
        session: XRSession,
    ): Promise<XRReferenceSpace> {
        try {
            return await session.requestReferenceSpace('local');
        } catch {
            return await session.requestReferenceSpace('local-floor');
        }
    }

    // ------------------------------------------------------------------
    // START AR — must be triggered by user tap
    // ------------------------------------------------------------------
    async function startAR() {
        if (!navigator.xr || !rendererRef.current) return;
        const renderer = rendererRef.current;

        // ---- Scene ----
        const scene = new THREE.Scene();
        // PerspectiveCamera is required by Three.js but XR overrides it
        const camera = new THREE.PerspectiveCamera(
            70,
            window.innerWidth / window.innerHeight,
            0.01,
            20,
        );

        scene.add(new THREE.AmbientLight(0xffffff, 0.7));
        const dir = new THREE.DirectionalLight(0xffffff, 0.8);
        dir.position.set(1, 2, 1);
        scene.add(dir);

        // ------------------------------------------------------------------
        // 3D RETICLE — lives in the AR scene so it renders on the wall surface
        //
        // Built from a torus (ring) + small center sphere.
        // We DON'T rotate it here — instead we apply the full hit-pose matrix
        // each frame so it always lies flat against whatever surface is detected.
        // ------------------------------------------------------------------
        const reticleGroup = new THREE.Group();

        const ring = new THREE.Mesh(
            new THREE.TorusGeometry(0.06, 0.008, 16, 64),
            new THREE.MeshBasicMaterial({
                color: 0x00ffff,
                transparent: true,
                opacity: 0.9,
            }),
        );
        reticleGroup.add(ring);

        const dot = new THREE.Mesh(
            new THREE.SphereGeometry(0.008, 16, 16),
            new THREE.MeshBasicMaterial({ color: 0xffffff }),
        );
        reticleGroup.add(dot);

        // Four short tick marks at N/S/E/W of the ring
        [-1, 1].forEach((sign) => {
            ['x', 'y'].forEach((axis) => {
                const tick = new THREE.Mesh(
                    new THREE.BoxGeometry(
                        axis === 'x' ? 0.02 : 0.002,
                        axis === 'x' ? 0.002 : 0.02,
                        0.001,
                    ),
                    new THREE.MeshBasicMaterial({ color: 0x00ffff }),
                );
                if (axis === 'x') tick.position.x = sign * 0.072;
                else tick.position.y = sign * 0.072;
                reticleGroup.add(tick);
            });
        });

        reticleGroup.visible = false; // hidden until first hit
        scene.add(reticleGroup);

        // ---- Placed wall panels ----
        const wallObjects: THREE.Group[] = [];

        function createPanel(): THREE.Group {
            const g = new THREE.Group();
            // Face
            g.add(
                new THREE.Mesh(
                    new THREE.BoxGeometry(0.24, 0.32, 0.012),
                    new THREE.MeshStandardMaterial({
                        color: 0x3377ff,
                        emissive: 0x0a1a44,
                        roughness: 0.3,
                        metalness: 0.4,
                    }),
                ),
            );
            // Frame border (slightly larger, pushed back)
            const frame = new THREE.Mesh(
                new THREE.BoxGeometry(0.28, 0.36, 0.009),
                new THREE.MeshStandardMaterial({
                    color: 0xcc9933,
                    roughness: 0.5,
                    metalness: 0.8,
                }),
            );
            frame.position.z = -0.007;
            g.add(frame);
            return g;
        }

        // ---- On tap: place panel at reticle's current world transform ----
        function onSelect() {
            if (!reticleGroup.visible) return;
            const panel = createPanel();
            // Copy exact world position + rotation from the reticle
            panel.position.copy(reticleGroup.position);
            panel.quaternion.copy(reticleGroup.quaternion);
            scene.add(panel);
            wallObjects.push(panel);

            if (wallObjects.length > MAX_WALL_OBJECTS) {
                const old = wallObjects.shift()!;
                scene.remove(old);
                old.traverse((c) => {
                    if (c instanceof THREE.Mesh) {
                        c.geometry.dispose();
                        (Array.isArray(c.material)
                            ? c.material
                            : [c.material]
                        ).forEach((m) => m.dispose());
                    }
                });
            }
        }

        try {
            const session = await navigator.xr.requestSession('immersive-ar', {
                requiredFeatures: ['hit-test'],
                optionalFeatures: ['local', 'local-floor', 'plane-detection'],
            });

            await renderer.xr.setSession(session as unknown as THREE.XRSession);
            session.addEventListener('select', onSelect as EventListener);

            // World anchor space — used to read hit poses back in world coords
            const xrRefSpace = await requestRefSpace(session);

            // Viewer space — origin = device, +Z points OUT of the screen (behind camera).
            // Hit-test API shoots a ray in -Z (into the scene) from this origin.
            // This means the ray always comes from the exact CENTER of the camera view.
            const xrViewerSpace = await session.requestReferenceSpace('viewer');

            const xrHitTestSource = await session.requestHitTestSource({
                space: xrViewerSpace,
                // "plane" targets detected flat surfaces.
                // Without plane-detection enabled the browser still does mesh-based hits.
                entityTypes: ['plane'],
            });

            setArState('active');

            // ------------------------------------------------------------------
            // PER-FRAME XR LOOP
            // ------------------------------------------------------------------
            renderer.setAnimationLoop((_t: number, frame: unknown) => {
                const xrFrame = frame as XRFrame | null;
                if (!xrFrame) return;

                const hits = xrFrame.getHitTestResults(xrHitTestSource);

                if (hits.length > 0) {
                    const pose = hits[0].getPose(xrRefSpace);
                    if (pose) {
                        // pose.transform.matrix is a column-major Float32Array[16] from WebXR.
                        // It encodes the surface position AND orientation.
                        // For a wall: +Y is up along the wall, +X is along the wall, +Z points away from the wall.
                        const mat = new THREE.Matrix4().fromArray(
                            pose.transform.matrix,
                        );

                        // Apply the full matrix to the reticle group so it sits flush on the surface
                        reticleGroup.matrix.copy(mat);
                        reticleGroup.matrix.decompose(
                            reticleGroup.position,
                            reticleGroup.quaternion,
                            reticleGroup.scale,
                        );
                        reticleGroup.visible = true;

                        // Update HTML ring + label (no setState — direct DOM)
                        setDetected(true);
                    } else {
                        reticleGroup.visible = false;
                        setDetected(false);
                    }
                } else {
                    reticleGroup.visible = false;
                    setDetected(false);
                }

                renderer.render(scene, camera);
            });

            session.addEventListener('end', () => {
                xrHitTestSource.cancel();
                renderer.setAnimationLoop(null);
                setDetected(false);
                setArState('supported');
            });
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            setErrorMsg(msg);
            setArState('error');
        }
    }

    // ------------------------------------------------------------------
    // RENDER
    // ------------------------------------------------------------------
    return (
        <div
            style={{
                position: 'relative',
                width: '100vw',
                height: '100vh',
                background: '#000',
                overflow: 'hidden',
            }}
        >
            {/* Three.js canvas */}
            <canvas
                ref={canvasRef}
                style={{ display: 'block', width: '100%', height: '100%' }}
            />

            {/* ── CENTER RETICLE RING (HTML overlay, center of screen) ── */}
            {arState === 'active' && (
                <div
                    style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        pointerEvents: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    {/* Outer ring — color driven by direct DOM ref */}
                    <div
                        ref={ringRef}
                        style={{
                            width: 60,
                            height: 60,
                            borderRadius: '50%',
                            border: '2px solid rgba(255,255,255,0.35)',
                            boxShadow: 'none',
                            transition:
                                'border-color 0.12s ease, box-shadow 0.12s ease',
                            position: 'absolute',
                        }}
                    />
                    {/* Center dot */}
                    <div
                        style={{
                            width: 5,
                            height: 5,
                            borderRadius: '50%',
                            background: 'rgba(255,255,255,0.7)',
                        }}
                    />
                </div>
            )}

            {/* ── STATUS LABEL below the reticle ── */}
            {arState === 'active' && (
                <div
                    ref={labelRef}
                    style={{
                        position: 'absolute',
                        top: 'calc(50% + 46px)',
                        width: '100%',
                        textAlign: 'center',
                        pointerEvents: 'none',
                        fontFamily: 'monospace',
                        fontSize: 12,
                        letterSpacing: 2,
                        color: 'rgba(255,255,255,0.4)',
                        textShadow: 'none',
                        transition: 'color 0.12s ease',
                    }}
                >
                    POINT AT A WALL
                </div>
            )}

            {/* ── Pre-session overlays ── */}
            {arState === 'checking' && (
                <Overlay>
                    <p style={s.hint}>Checking AR support…</p>
                </Overlay>
            )}

            {arState === 'unsupported' && (
                <Overlay>
                    <p style={s.title}>AR Not Available</p>
                    <p style={s.hint}>
                        Try Chrome on Android (ARCore) or Safari on iOS 16+.
                    </p>
                </Overlay>
            )}

            {arState === 'supported' && (
                <Overlay>
                    <p style={s.title}>Wall Hit Test</p>
                    <p style={s.hint}>
                        Point your camera at a wall.{'\n'}
                        The ring turns cyan when a surface is detected.{'\n'}
                        Tap to place an object.
                    </p>
                    <button style={s.btn} onClick={startAR}>
                        Start AR
                    </button>
                </Overlay>
            )}

            {arState === 'error' && (
                <Overlay>
                    <p style={s.title}>Error</p>
                    <p style={s.hint}>{errorMsg}</p>
                    <button
                        style={s.btn}
                        onClick={() => setArState('supported')}
                    >
                        Try Again
                    </button>
                </Overlay>
            )}
        </div>
    );
}

function Overlay({ children }: { children: React.ReactNode }) {
    return (
        <div style={s.overlay}>
            <div style={s.card}>{children}</div>
        </div>
    );
}

const s: Record<string, React.CSSProperties> = {
    overlay: {
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.55)',
    },
    card: {
        background: 'rgba(10,10,20,0.88)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 16,
        padding: '32px 28px',
        maxWidth: 320,
        textAlign: 'center',
        color: '#fff',
        fontFamily: 'sans-serif',
        backdropFilter: 'blur(8px)',
    },
    title: { fontSize: 22, fontWeight: 700, marginBottom: 12 },
    hint: {
        fontSize: 14,
        color: '#aaa',
        lineHeight: 1.7,
        whiteSpace: 'pre-line',
        marginBottom: 24,
    },
    btn: {
        padding: '14px 36px',
        background: '#00aaff',
        color: '#fff',
        border: 'none',
        borderRadius: 50,
        fontSize: 16,
        fontWeight: 600,
        cursor: 'pointer',
    },
};
