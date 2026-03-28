/**
 * WallHitTest.tsx
 *
 * React + Three.js WebXR AR — places virtual panels on detected walls.
 *
 * Fix: reference space "local" is not supported on all devices.
 * We try "local" first, then fall back to "local-floor".
 * "viewer" space (used for the hit-test ray) is always available inside a session.
 */

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

const MAX_WALL_OBJECTS = 15;

type ARState = 'checking' | 'supported' | 'unsupported' | 'active' | 'error';

export default function ARMeasure() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const [arState, setArState] = useState<ARState>('checking');
    const [errorMsg, setErrorMsg] = useState('');

    // ------------------------------------------------------------------
    // Check AR support on mount
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
    // Build Three.js renderer once the canvas is in the DOM
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
    // Helper: request reference space with automatic fallback
    // Some devices only support "local-floor", others only "local".
    // We try both so we don't crash on either.
    // ------------------------------------------------------------------
    async function requestRefSpace(
        session: XRSession,
    ): Promise<XRReferenceSpace> {
        try {
            // "local" — best for AR, origin near the user's head at session start
            return await session.requestReferenceSpace('local');
        } catch {
            // "local-floor" — origin on the floor below the user; also works for AR
            return await session.requestReferenceSpace('local-floor');
        }
    }

    // ------------------------------------------------------------------
    // startAR — MUST be called from a user gesture (button click)
    // ------------------------------------------------------------------
    async function startAR() {
        if (!navigator.xr || !rendererRef.current) return;
        const renderer = rendererRef.current;

        // ---- Three.js scene ----
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(
            70,
            window.innerWidth / window.innerHeight,
            0.01,
            20,
        );
        scene.add(new THREE.AmbientLight(0xffffff, 0.6));
        const dir = new THREE.DirectionalLight(0xffffff, 0.8);
        dir.position.set(1, 2, 1);
        scene.add(dir);

        // ---- Reticle (targeting ring shown on the wall) ----
        const reticle = new THREE.Mesh(
            new THREE.TorusGeometry(0.08, 0.012, 8, 24),
            new THREE.MeshBasicMaterial({ color: 0x00ffff }),
        );
        reticle.rotation.x = Math.PI / 2; // lay flat against the wall
        reticle.visible = false;
        scene.add(reticle);

        const wallObjects: THREE.Group[] = [];

        // ---- Factory: flat panel that sticks to a wall ----
        function createPanel(): THREE.Group {
            const g = new THREE.Group();
            g.add(
                new THREE.Mesh(
                    new THREE.BoxGeometry(0.25, 0.35, 0.01),
                    new THREE.MeshStandardMaterial({
                        color: 0x4488ff,
                        emissive: 0x112244,
                        roughness: 0.4,
                        metalness: 0.3,
                    }),
                ),
            );
            const frame = new THREE.Mesh(
                new THREE.BoxGeometry(0.27, 0.37, 0.008),
                new THREE.MeshStandardMaterial({
                    color: 0xddaa55,
                    roughness: 0.6,
                    metalness: 0.7,
                }),
            );
            frame.position.z = -0.006;
            g.add(frame);
            return g;
        }

        function onSelect() {
            if (!reticle.visible) return;
            const panel = createPanel();
            panel.position.copy(reticle.position);
            panel.quaternion.copy(reticle.quaternion);
            scene.add(panel);
            wallObjects.push(panel);
            // Evict oldest panel when limit exceeded
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
            // ------------------------------------------------------------------
            // Request session
            // We list BOTH "local" and "local-floor" as optional so the browser
            // can grant whichever one the device supports.
            // "hit-test" is required — without it we can't detect surfaces at all.
            // ------------------------------------------------------------------
            const session = await navigator.xr.requestSession('immersive-ar', {
                requiredFeatures: ['hit-test'],
                optionalFeatures: ['local', 'local-floor', 'plane-detection'],
            });

            await renderer.xr.setSession(session as unknown as THREE.XRSession);
            session.addEventListener('select', onSelect as EventListener);

            // ------------------------------------------------------------------
            // Reference spaces
            //
            // xrRefSpace  — world anchor used to read hit-pose coordinates
            // xrViewerSpace — origin AT the device; the hit-test ray shoots forward from here
            //
            // We use requestRefSpace() which tries "local" then falls back to "local-floor"
            // "viewer" is always available inside any XR session — no try/catch needed
            // ------------------------------------------------------------------
            const xrRefSpace = await requestRefSpace(session);
            const xrViewerSpace = await session.requestReferenceSpace('viewer');

            // ------------------------------------------------------------------
            // Hit test source
            // Shoots a ray from the viewer (device camera) forward every frame.
            // entityTypes: ["plane"] targets detected flat surfaces including walls.
            // ------------------------------------------------------------------
            const xrHitTestSource = await session.requestHitTestSource({
                space: xrViewerSpace,
                entityTypes: ['plane'],
            });

            setArState('active');

            // ------------------------------------------------------------------
            // Per-frame render loop
            // ------------------------------------------------------------------
            renderer.setAnimationLoop((_t: number, frame: unknown) => {
                const xrFrame = frame as XRFrame | null;
                if (!xrFrame) return;

                reticle.visible = false;

                const hits = xrFrame.getHitTestResults(xrHitTestSource);
                if (hits.length > 0) {
                    const pose = hits[0].getPose(xrRefSpace);
                    if (pose) {
                        // The hit pose matrix encodes both position and orientation of
                        // the surface. +Z of the matrix points away from the wall.
                        const m = new THREE.Matrix4().fromArray(
                            pose.transform.matrix,
                        );
                        m.decompose(
                            reticle.position,
                            reticle.quaternion,
                            new THREE.Vector3(),
                        );
                        reticle.visible = true;
                    }
                }

                renderer.render(scene, camera);
            });

            session.addEventListener('end', () => {
                xrHitTestSource.cancel();
                renderer.setAnimationLoop(null);
                setArState('supported');
            });
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            setErrorMsg(msg);
            setArState('error');
        }
    }

    // ------------------------------------------------------------------
    // Render
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
            <canvas
                ref={canvasRef}
                style={{ display: 'block', width: '100%', height: '100%' }}
            />

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
                        Point at a wall, tap Start AR, then tap to place
                        objects.
                    </p>
                    <button style={s.btn} onClick={startAR}>
                        Start AR
                    </button>
                </Overlay>
            )}

            {arState === 'active' && (
                <div style={s.activeHint}>Point at a wall · Tap to place</div>
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
        background: 'rgba(10,10,20,0.85)',
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: 16,
        padding: '32px 28px',
        maxWidth: 320,
        textAlign: 'center',
        color: '#fff',
        fontFamily: 'sans-serif',
        backdropFilter: 'blur(8px)',
    },
    title: { fontSize: 22, fontWeight: 700, marginBottom: 12 },
    hint: { fontSize: 14, color: '#aaa', lineHeight: 1.6, marginBottom: 24 },
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
    activeHint: {
        position: 'absolute',
        bottom: 40,
        width: '100%',
        textAlign: 'center',
        color: '#fff',
        fontFamily: 'sans-serif',
        fontSize: 15,
        pointerEvents: 'none',
        textShadow: '0 1px 6px rgba(0,0,0,0.9)',
    },
};
