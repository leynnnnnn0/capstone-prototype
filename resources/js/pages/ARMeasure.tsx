import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

const MAX_WALL_OBJECTS = 15;
type ARState = 'checking' | 'supported' | 'unsupported' | 'active' | 'error';

export default function ARMeasure() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const [arState, setArState] = useState<ARState>('checking');
    const [errorMsg, setErrorMsg] = useState('');

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

        // ------------------------------------------------------------------
        // We need TWO scenes:
        //
        // 1. mainScene  — where AR panels are placed in world space
        // 2. hudScene   — rendered AFTER mainScene on top of everything,
        //                 using an orthographic camera so objects are in
        //                 screen space (pixels). The reticle lives here.
        //                 It never moves — always dead center.
        // ------------------------------------------------------------------

        const mainScene = new THREE.Scene();
        const mainCamera = new THREE.PerspectiveCamera(
            70,
            window.innerWidth / window.innerHeight,
            0.01,
            20,
        );
        mainScene.add(new THREE.AmbientLight(0xffffff, 0.7));
        const dir = new THREE.DirectionalLight(0xffffff, 0.8);
        dir.position.set(1, 2, 1);
        mainScene.add(dir);

        // HUD scene — orthographic camera covering the full screen in pixels
        const hudScene = new THREE.Scene();
        const hw = window.innerWidth / 2;
        const hh = window.innerHeight / 2;
        const hudCamera = new THREE.OrthographicCamera(-hw, hw, hh, -hh, 0, 10);
        hudCamera.position.z = 1;

        // ------------------------------------------------------------------
        // RETICLE — a ring drawn in HUD (screen) space.
        // Position is (0, 0) in the ortho camera = exact center of screen.
        // Color switches based on hit-test result.
        // ------------------------------------------------------------------
        const RING_RADIUS = 28; // pixels
        const RING_TUBE = 3; // pixels

        const reticleMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const reticleMesh = new THREE.Mesh(
            new THREE.TorusGeometry(RING_RADIUS, RING_TUBE, 16, 64),
            reticleMat,
        );
        // x=0, y=0 in ortho space = center of screen
        reticleMesh.position.set(0, 0, 0);
        hudScene.add(reticleMesh);

        // Center dot
        const dotMesh = new THREE.Mesh(
            new THREE.CircleGeometry(4, 16),
            new THREE.MeshBasicMaterial({ color: 0xffffff }),
        );
        dotMesh.position.set(0, 0, 0);
        hudScene.add(dotMesh);

        // ------------------------------------------------------------------
        // Wall panels placed in main scene
        // ------------------------------------------------------------------
        let lastHitMatrix: THREE.Matrix4 | null = null;
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
            if (!lastHitMatrix) return;
            const panel = createPanel();
            const pos = new THREE.Vector3();
            const quat = new THREE.Quaternion();
            lastHitMatrix.decompose(pos, quat, new THREE.Vector3());
            panel.position.copy(pos);
            panel.quaternion.copy(quat);
            mainScene.add(panel);
            wallObjects.push(panel);
            if (wallObjects.length > MAX_WALL_OBJECTS) {
                const old = wallObjects.shift()!;
                mainScene.remove(old);
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
                    lastHitMatrix = new THREE.Matrix4().fromArray(
                        hit.transform.matrix,
                    );
                    // Cyan = surface detected
                    reticleMat.color.setHex(0x00ffff);
                    (dotMesh.material as THREE.MeshBasicMaterial).color.setHex(
                        0x00ffff,
                    );
                } else {
                    lastHitMatrix = null;
                    // White = no surface
                    reticleMat.color.setHex(0xffffff);
                    (dotMesh.material as THREE.MeshBasicMaterial).color.setHex(
                        0xffffff,
                    );
                }

                // Render main AR scene first, then HUD on top
                renderer.autoClear = false;
                renderer.clear();
                renderer.render(mainScene, mainCamera);
                renderer.clearDepth(); // clear depth so HUD always draws on top
                renderer.render(hudScene, hudCamera);
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
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.55)',
        zIndex: 100,
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
