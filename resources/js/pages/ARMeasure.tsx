import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

const MAX_WALL_OBJECTS = 15;
type ARState = 'checking' | 'supported' | 'unsupported' | 'active' | 'error';

export default function ARMeasure() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const ringRef = useRef<HTMLDivElement>(null);
    const [arState, setArState] = useState<ARState>('checking');
    const [errorMsg, setErrorMsg] = useState('');

    // Check AR support on mount
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

    // Build renderer once
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

    async function requestRefSpace(
        session: XRSession,
    ): Promise<XRReferenceSpace> {
        try {
            return await session.requestReferenceSpace('local');
        } catch {
            return await session.requestReferenceSpace('local-floor');
        }
    }

    async function startAR() {
        if (!navigator.xr || !rendererRef.current) return;
        const renderer = rendererRef.current;

        const scene = new THREE.Scene();
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

        // 3D reticle that sticks to the wall surface in the scene
        const reticle = new THREE.Mesh(
            new THREE.TorusGeometry(0.06, 0.008, 16, 64),
            new THREE.MeshBasicMaterial({ color: 0x00ffff }),
        );
        reticle.visible = false;
        scene.add(reticle);

        const wallObjects: THREE.Group[] = [];

        function createPanel(): THREE.Group {
            const g = new THREE.Group();
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

        function onSelect() {
            if (!reticle.visible) return;
            const panel = createPanel();
            panel.position.copy(reticle.position);
            panel.quaternion.copy(reticle.quaternion);
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

            const xrRefSpace = await requestRefSpace(session);
            const xrViewerSpace = await session.requestReferenceSpace('viewer');
            const xrHitTestSource = await session.requestHitTestSource({
                space: xrViewerSpace,
                entityTypes: ['plane'],
            });

            setArState('active');

            renderer.setAnimationLoop((_t: number, frame: unknown) => {
                const xrFrame = frame as XRFrame | null;
                if (!xrFrame) return;

                const hits = xrFrame.getHitTestResults(xrHitTestSource);
                const hit =
                    hits.length > 0 ? hits[0].getPose(xrRefSpace) : null;

                if (hit) {
                    // Position the 3D reticle on the wall surface
                    const mat = new THREE.Matrix4().fromArray(
                        hit.transform.matrix,
                    );
                    mat.decompose(
                        reticle.position,
                        reticle.quaternion,
                        new THREE.Vector3(),
                    );
                    reticle.visible = true;

                    // Turn the HTML center ring CYAN — direct DOM, no setState
                    if (ringRef.current) {
                        ringRef.current.style.borderColor = '#00ffff';
                        ringRef.current.style.boxShadow = '0 0 0 2px #00ffff55';
                    }
                } else {
                    reticle.visible = false;

                    // Turn the HTML center ring WHITE
                    if (ringRef.current) {
                        ringRef.current.style.borderColor =
                            'rgba(255,255,255,0.5)';
                        ringRef.current.style.boxShadow = 'none';
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
            setErrorMsg(err instanceof Error ? err.message : String(err));
            setArState('error');
        }
    }

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

            {/* CENTER RETICLE — always dead center, color changes on detection */}
            {arState === 'active' && (
                <div
                    style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        width: 48,
                        height: 48,
                        marginTop:
                            -24 /* exactly half height — no transform needed */,
                        marginLeft: -24 /* exactly half width */,
                        borderRadius: '50%',
                        border: '2px solid rgba(255,255,255,0.5)',
                        boxShadow: 'none',
                        pointerEvents: 'none',
                    }}
                    ref={ringRef}
                />
            )}

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
                        Point at a wall. Ring turns cyan when detected. Tap to
                        place.
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
    },
    title: { fontSize: 22, fontWeight: 700, marginBottom: 12 },
    hint: { fontSize: 14, color: '#aaa', lineHeight: 1.7, marginBottom: 24 },
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
