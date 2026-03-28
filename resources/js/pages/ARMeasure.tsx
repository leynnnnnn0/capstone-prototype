/**
 * WallHitTest.tsx
 *
 * A React + Three.js WebXR AR component that:
 *  1. Checks if the device supports immersive-ar
 *  2. Shows a "Start AR" button (required — browsers need a user gesture)
 *  3. On tap, enters AR and casts hit tests against VERTICAL surfaces (walls)
 *  4. Shows a reticle ring on the detected wall
 *  5. On screen tap, places a flat panel object on the wall
 */

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

// ---------------------------------------------------------------------------
// How many wall panels are allowed before the oldest one is removed
// ---------------------------------------------------------------------------
const MAX_WALL_OBJECTS = 15;

// ---------------------------------------------------------------------------
// Component state machine
//   "checking"    → detecting browser support
//   "supported"   → ready, showing Start AR button
//   "unsupported" → device/browser can't do immersive-ar
//   "active"      → inside the AR session
//   "error"       → session failed to start
// ---------------------------------------------------------------------------
type ARState = 'checking' | 'supported' | 'unsupported' | 'active' | 'error';

export default function ARMeasure() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [arState, setArState] = useState<ARState>('checking');
    const [errorMsg, setErrorMsg] = useState('');

    // Keep Three.js renderer in a ref so startAR can access it
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

    // -------------------------------------------------------------------------
    // On mount: check if immersive-ar is supported and update state
    // -------------------------------------------------------------------------
    useEffect(() => {
        if (!navigator.xr) {
            setArState('unsupported');
            return;
        }
        navigator.xr
            .isSessionSupported('immersive-ar')
            .then((supported) => {
                setArState(supported ? 'supported' : 'unsupported');
            })
            .catch(() => setArState('unsupported'));
    }, []);

    // -------------------------------------------------------------------------
    // Initialize Three.js renderer once (after canvas is in the DOM)
    // -------------------------------------------------------------------------
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        // Build renderer once and store in ref
        const renderer = new THREE.WebGLRenderer({
            canvas,
            alpha: true, // transparent background so camera feed shows through
            antialias: true,
        });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.xr.enabled = true; // mandatory for WebXR sessions

        rendererRef.current = renderer;

        const onResize = () => {
            renderer.setSize(window.innerWidth, window.innerHeight);
        };
        window.addEventListener('resize', onResize);

        return () => {
            window.removeEventListener('resize', onResize);
            renderer.dispose();
        };
    }, []);

    // -------------------------------------------------------------------------
    // startAR — called when the user taps "Start AR"
    // Must be triggered by a user gesture (tap/click) or browsers will block it
    // -------------------------------------------------------------------------
    async function startAR() {
        if (!navigator.xr || !rendererRef.current) return;

        const renderer = rendererRef.current;

        // Build the Three.js scene
        const scene = new THREE.Scene();

        // Camera — values are overridden by the XR headset/phone, but Three.js needs one
        const camera = new THREE.PerspectiveCamera(
            70,
            window.innerWidth / window.innerHeight,
            0.01,
            20,
        );

        // Basic lighting so placed objects have shading
        scene.add(new THREE.AmbientLight(0xffffff, 0.6));
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(1, 2, 1);
        scene.add(dirLight);

        // -----------------------------------------------------------------------
        // RETICLE — cyan ring shown on the detected wall surface
        // Rotated 90° on X so it lies flat against the wall (faces outward)
        // -----------------------------------------------------------------------
        const reticle = new THREE.Mesh(
            new THREE.TorusGeometry(0.08, 0.012, 8, 24),
            new THREE.MeshBasicMaterial({ color: 0x00ffff }),
        );
        reticle.rotation.x = Math.PI / 2;
        reticle.visible = false; // hidden until a wall is detected
        scene.add(reticle);

        // Placed panel objects and their count
        const wallObjects: THREE.Group[] = [];

        // -----------------------------------------------------------------------
        // WALL PANEL FACTORY — creates a flat framed rectangle to stick on walls
        // -----------------------------------------------------------------------
        function createWallPanel(): THREE.Group {
            const group = new THREE.Group();

            // Colored panel face
            const face = new THREE.Mesh(
                new THREE.BoxGeometry(0.25, 0.35, 0.01),
                new THREE.MeshStandardMaterial({
                    color: 0x4488ff,
                    emissive: 0x112244,
                    roughness: 0.4,
                    metalness: 0.3,
                }),
            );
            group.add(face);

            // Gold border frame slightly behind the face
            const frame = new THREE.Mesh(
                new THREE.BoxGeometry(0.27, 0.37, 0.008),
                new THREE.MeshStandardMaterial({
                    color: 0xddaa55,
                    roughness: 0.6,
                    metalness: 0.7,
                }),
            );
            frame.position.z = -0.006;
            group.add(frame);

            return group;
        }

        // -----------------------------------------------------------------------
        // SELECT HANDLER — fires on screen tap while in AR
        // Places a wall panel at the reticle's current position/orientation
        // -----------------------------------------------------------------------
        function onSelect() {
            if (!reticle.visible) return;

            const panel = createWallPanel();
            panel.position.copy(reticle.position);
            panel.quaternion.copy(reticle.quaternion);
            scene.add(panel);
            wallObjects.push(panel);

            // Remove + dispose the oldest panel if over the limit
            if (wallObjects.length > MAX_WALL_OBJECTS) {
                const oldest = wallObjects.shift()!;
                scene.remove(oldest);
                oldest.traverse((child) => {
                    if (child instanceof THREE.Mesh) {
                        child.geometry.dispose();
                        (Array.isArray(child.material)
                            ? child.material
                            : [child.material]
                        ).forEach((m) => m.dispose());
                    }
                });
            }
        }

        try {
            // -----------------------------------------------------------------------
            // REQUEST THE AR SESSION
            // 'local'    → stable world-anchored reference space
            // 'hit-test' → permission to cast rays and detect surfaces
            // 'plane-detection' is optional; improves wall detection on ARCore/ARKit
            // -----------------------------------------------------------------------
            const session = await navigator.xr.requestSession('immersive-ar', {
                requiredFeatures: ['local', 'hit-test'],
                optionalFeatures: ['plane-detection'],
            });

            // Hand the session to Three.js so it owns the render loop
            await renderer.xr.setSession(session as unknown as THREE.XRSession);

            // Listen for taps
            session.addEventListener('select', onSelect as EventListener);

            // -----------------------------------------------------------------------
            // HIT TEST SOURCE SETUP
            // 'viewer' space = origin at the device itself, ray pointing forward.
            // We use this as the source for hit testing (cast from device camera).
            // 'entityTypes: ["plane"]' focuses hits on detected planes (walls/floors).
            // -----------------------------------------------------------------------
            const xrViewerSpace = await session.requestReferenceSpace('viewer');
            const xrHitTestSource = await session.requestHitTestSource({
                space: xrViewerSpace,
                entityTypes: ['plane'],
            });

            // 'local' space = world anchor, used to read back hit poses
            const xrRefSpace = await session.requestReferenceSpace('local');

            setArState('active');

            // -----------------------------------------------------------------------
            // PER-FRAME XR RENDER LOOP
            // Three.js calls this every frame while the session is running.
            // -----------------------------------------------------------------------
            renderer.setAnimationLoop((_timestamp: number, frame: unknown) => {
                const xrFrame = frame as XRFrame | null;
                if (!xrFrame) return;

                reticle.visible = false;

                // Get hit test results for this frame
                const hits = xrFrame.getHitTestResults(xrHitTestSource);
                if (hits.length > 0) {
                    const pose = hits[0].getPose(xrRefSpace);
                    if (pose) {
                        // Decompose the hit pose matrix into position + quaternion.
                        // The hit matrix's +Z axis points away from the wall surface.
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

            // -----------------------------------------------------------------------
            // SESSION END — clean up everything
            // -----------------------------------------------------------------------
            session.addEventListener('end', () => {
                xrHitTestSource.cancel();
                renderer.setAnimationLoop(null);
                setArState('supported'); // back to ready state
            });
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            setErrorMsg(msg);
            setArState('error');
        }
    }

    // -------------------------------------------------------------------------
    // RENDER
    // The canvas is always mounted (Three.js needs it).
    // UI overlays are conditionally shown on top.
    // -------------------------------------------------------------------------
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
            {/* Three.js renders here. Always present so the renderer can attach. */}
            <canvas
                ref={canvasRef}
                style={{ display: 'block', width: '100%', height: '100%' }}
            />

            {/* ── CHECKING ── */}
            {arState === 'checking' && (
                <Overlay>
                    <p style={styles.hint}>Checking AR support…</p>
                </Overlay>
            )}

            {/* ── UNSUPPORTED ── */}
            {arState === 'unsupported' && (
                <Overlay>
                    <p style={styles.title}>AR Not Available</p>
                    <p style={styles.hint}>
                        This device or browser does not support WebXR
                        immersive-ar. Try Chrome on Android with ARCore, or
                        Safari on iOS 16+.
                    </p>
                </Overlay>
            )}

            {/* ── SUPPORTED — show the Start AR button ── */}
            {arState === 'supported' && (
                <Overlay>
                    <p style={styles.title}>Wall Hit Test</p>
                    <p style={styles.hint}>
                        Point your camera at a wall.{'\n'}
                        Tap Start AR, then tap the screen to place objects.
                    </p>
                    {/* onClick is the required user gesture that unlocks XR session creation */}
                    <button onClick={startAR} style={styles.button}>
                        Start AR
                    </button>
                </Overlay>
            )}

            {/* ── ACTIVE — minimal hint while in AR ── */}
            {arState === 'active' && (
                <div style={styles.activeHint}>
                    Point at a wall · Tap to place
                </div>
            )}

            {/* ── ERROR ── */}
            {arState === 'error' && (
                <Overlay>
                    <p style={styles.title}>Failed to Start AR</p>
                    <p style={styles.hint}>{errorMsg}</p>
                    <button
                        onClick={() => setArState('supported')}
                        style={styles.button}
                    >
                        Try Again
                    </button>
                </Overlay>
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Small helper component: full-screen centered overlay
// ---------------------------------------------------------------------------
function Overlay({ children }: { children: React.ReactNode }) {
    return (
        <div style={styles.overlay}>
            <div style={styles.card}>{children}</div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Inline styles
// ---------------------------------------------------------------------------
const styles: Record<string, React.CSSProperties> = {
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
    title: {
        fontSize: 22,
        fontWeight: 700,
        marginBottom: 12,
    },
    hint: {
        fontSize: 14,
        color: '#aaa',
        lineHeight: 1.6,
        whiteSpace: 'pre-line',
        marginBottom: 24,
    },
    button: {
        display: 'inline-block',
        padding: '14px 36px',
        background: '#00aaff',
        color: '#fff',
        border: 'none',
        borderRadius: 50,
        fontSize: 16,
        fontWeight: 600,
        cursor: 'pointer',
        letterSpacing: 1,
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
