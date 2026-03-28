import { useEffect, useRef, useState, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlacedObject {
    id: number;
    matrix: Float32Array;
    mesh: THREE.Mesh;
}

// We load Three.js dynamically to avoid SSR issues
declare global {
    interface Window {
        THREE: typeof import('three');
    }
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_OBJECTS = 30;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) {
            resolve();
            return;
        }
        const s = document.createElement('script');
        s.src = src;
        s.onload = () => resolve();
        s.onerror = reject;
        document.head.appendChild(s);
    });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ARMeasure() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const overlayRef = useRef<HTMLDivElement>(null);

    // XR state
    const xrSessionRef = useRef<XRSession | null>(null);
    const xrRefSpaceRef = useRef<XRReferenceSpace | null>(null);
    const xrViewerSpaceRef = useRef<XRReferenceSpace | null>(null);
    const xrHitTestSourceRef = useRef<XRHitTestSource | null>(null);
    const rafHandleRef = useRef<number>(0);

    // Three.js state
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const reticleRef = useRef<THREE.Mesh | null>(null);
    const placedObjectsRef = useRef<PlacedObject[]>([]);
    const objectCounterRef = useRef(0);
    const threeLoadedRef = useRef(false);

    const [arSupported, setArSupported] = useState<boolean | null>(null);
    const [sessionActive, setSessionActive] = useState(false);
    const [objectCount, setObjectCount] = useState(0);
    const [statusMsg, setStatusMsg] = useState('Checking AR support…');

    // ── Check AR support on mount ──────────────────────────────────────────────

    useEffect(() => {
        if (!navigator.xr) {
            setArSupported(false);
            setStatusMsg('WebXR not available in this browser.');
            return;
        }
        navigator.xr
            .isSessionSupported('immersive-ar')
            .then((supported) => {
                setArSupported(supported);
                setStatusMsg(
                    supported
                        ? 'AR ready. Tap Start AR to begin.'
                        : 'Immersive AR not supported on this device.',
                );
            })
            .catch(() => {
                setArSupported(false);
                setStatusMsg('Could not query AR support.');
            });
    }, []);

    // ── Build Three.js scene ───────────────────────────────────────────────────

    const initThree = useCallback(async (canvas: HTMLCanvasElement) => {
        if (threeLoadedRef.current) return;

        await loadScript(
            'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
        );
        threeLoadedRef.current = true;

        const THREE = window.THREE;

        // Renderer
        const renderer = new THREE.WebGLRenderer({
            canvas,
            alpha: true,
            antialias: true,
        });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.xr.enabled = true;
        rendererRef.current = renderer;

        // Scene
        const scene = new THREE.Scene();
        sceneRef.current = scene;

        // Lighting
        scene.add(new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1));
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(0.5, 1, 1);
        scene.add(dirLight);

        // Camera
        const camera = new THREE.PerspectiveCamera(
            70,
            window.innerWidth / window.innerHeight,
            0.01,
            20,
        );
        cameraRef.current = camera;

        // Reticle — animated ring
        const reticleGeo = new THREE.RingGeometry(0.05, 0.07, 32);
        reticleGeo.applyMatrix4(
            new THREE.Matrix4().makeRotationX(-Math.PI / 2),
        );
        const reticleMat = new THREE.MeshBasicMaterial({
            color: 0x00e5ff,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.85,
        });
        const reticle = new THREE.Mesh(reticleGeo, reticleMat);
        reticle.matrixAutoUpdate = false;
        reticle.visible = false;
        scene.add(reticle);
        reticleRef.current = reticle;

        // Resize
        const onResize = () => {
            renderer.setSize(window.innerWidth, window.innerHeight);
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
        };
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    // ── Create placed object ───────────────────────────────────────────────────

    const createPlacedObject = useCallback((matrix: Float32Array) => {
        if (!sceneRef.current) return;
        const THREE = window.THREE;

        // Stack of cylinders ≈ a simple flower/pin
        const group = new THREE.Group();

        // Stem
        const stemGeo = new THREE.CylinderGeometry(0.005, 0.005, 0.12, 8);
        const stemMat = new THREE.MeshStandardMaterial({ color: 0x4caf50 });
        const stem = new THREE.Mesh(stemGeo, stemMat);
        stem.position.y = 0.06;
        group.add(stem);

        // Head
        const headGeo = new THREE.SphereGeometry(0.025, 16, 16);
        const hue = Math.random();
        const headMat = new THREE.MeshStandardMaterial({
            color: new THREE.Color().setHSL(hue, 0.9, 0.55),
            roughness: 0.3,
            metalness: 0.1,
        });
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.y = 0.13;
        group.add(head);

        // Drop shadow disc
        const shadowGeo = new THREE.CircleGeometry(0.06, 32);
        const shadowMat = new THREE.MeshBasicMaterial({
            color: 0x000000,
            transparent: true,
            opacity: 0.25,
            depthWrite: false,
        });
        const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
        shadowMesh.rotation.x = -Math.PI / 2;
        shadowMesh.position.y = 0.001;
        group.add(shadowMesh);

        // Apply hit-test matrix
        const m = new THREE.Matrix4();
        m.fromArray(matrix);
        const pos = new THREE.Vector3();
        const quat = new THREE.Quaternion();
        const scale = new THREE.Vector3();
        m.decompose(pos, quat, scale);
        group.position.copy(pos);
        group.quaternion.copy(quat);

        sceneRef.current.add(group);

        const id = ++objectCounterRef.current;
        placedObjectsRef.current.push({
            id,
            matrix,
            mesh: group as unknown as THREE.Mesh,
        });

        // Prune oldest
        if (placedObjectsRef.current.length > MAX_OBJECTS) {
            const oldest = placedObjectsRef.current.shift();
            if (oldest)
                sceneRef.current.remove(
                    oldest.mesh as unknown as THREE.Object3D,
                );
        }

        setObjectCount(placedObjectsRef.current.length);
    }, []);

    // ── XR frame loop ──────────────────────────────────────────────────────────
    // Store the callback in a ref so it can call itself recursively without
    // creating a circular useCallback dependency.

    const onXRFrameRef = useRef<(t: number, frame: XRFrame) => void>(null!);

    onXRFrameRef.current = (_t: number, frame: XRFrame) => {
        const session = frame.session;
        rafHandleRef.current = session.requestAnimationFrame(
            onXRFrameRef.current,
        );

        const renderer = rendererRef.current;
        const scene = sceneRef.current;
        const camera = cameraRef.current;
        const reticle = reticleRef.current;

        if (
            !renderer ||
            !scene ||
            !camera ||
            !reticle ||
            !xrRefSpaceRef.current
        )
            return;

        const pose = frame.getViewerPose(xrRefSpaceRef.current);
        reticle.visible = false;

        if (xrHitTestSourceRef.current && pose) {
            const results = frame.getHitTestResults(xrHitTestSourceRef.current);
            if (results.length > 0) {
                const hitPose = results[0].getPose(xrRefSpaceRef.current!);
                if (hitPose) {
                    reticle.visible = true;
                    reticle.matrix.fromArray(hitPose.transform.matrix);
                }
            }
        }

        renderer.render(scene, camera);
    };

    // ── Select handler (tap to place) ─────────────────────────────────────────

    const onSelect = useCallback(() => {
        const reticle = reticleRef.current;
        if (reticle?.visible) {
            const m = new Float32Array(16);
            reticle.matrix.toArray(m);
            createPlacedObject(m);
        }
    }, [createPlacedObject]);

    // ── Start AR session ───────────────────────────────────────────────────────

    const startAR = useCallback(async () => {
        if (!canvasRef.current) return;

        await initThree(canvasRef.current);

        const session = await navigator.xr!.requestSession('immersive-ar', {
            requiredFeatures: ['local', 'hit-test'],
            optionalFeatures: ['dom-overlay'],
            ...(overlayRef.current
                ? { domOverlay: { root: overlayRef.current } }
                : {}),
        });

        xrSessionRef.current = session;

        const renderer = rendererRef.current!;
        renderer.xr.setReferenceSpaceType('local');
        await renderer.xr.setSession(session);

        session.addEventListener('end', () => {
            xrHitTestSourceRef.current?.cancel();
            xrHitTestSourceRef.current = null;
            xrSessionRef.current = null;
            setSessionActive(false);
            setStatusMsg('Session ended. Tap Start AR to restart.');
        });

        session.addEventListener('select', onSelect);

        // Viewer space → hit-test source
        const viewerSpace = await session.requestReferenceSpace('viewer');
        xrViewerSpaceRef.current = viewerSpace;
        const hitTestSource = await session.requestHitTestSource!({
            space: viewerSpace,
        });
        xrHitTestSourceRef.current = hitTestSource!;

        // Local reference space → render loop
        const refSpace = await session.requestReferenceSpace('local');
        xrRefSpaceRef.current = refSpace;

        rafHandleRef.current = session.requestAnimationFrame(
            onXRFrameRef.current,
        );
        setSessionActive(true);
        setStatusMsg('Point at a surface, then tap to place objects.');
    }, [initThree, onSelect]);

    // ── End AR session ─────────────────────────────────────────────────────────

    const endAR = useCallback(async () => {
        if (xrSessionRef.current) {
            await xrSessionRef.current.end();
        }
    }, []);

    // ── Clear placed objects ───────────────────────────────────────────────────

    const clearObjects = useCallback(() => {
        const scene = sceneRef.current;
        if (!scene) return;
        placedObjectsRef.current.forEach((o) =>
            scene.remove(o.mesh as unknown as THREE.Object3D),
        );
        placedObjectsRef.current = [];
        setObjectCount(0);
    }, []);

    // ── Render ─────────────────────────────────────────────────────────────────

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                background: '#0a0a0f',
                fontFamily: "'DM Mono', 'Fira Code', monospace",
                color: '#e0e0e0',
                overflow: 'hidden',
            }}
        >
            {/* AR canvas — fills the screen */}
            <canvas
                ref={canvasRef}
                style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    display: sessionActive ? 'block' : 'none',
                }}
            />

            {/* DOM overlay (visible during AR) */}
            <div
                ref={overlayRef}
                style={{
                    position: 'absolute',
                    inset: 0,
                    pointerEvents: 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    padding:
                        'env(safe-area-inset-top, 16px) 16px env(safe-area-inset-bottom, 24px)',
                }}
            >
                {/* Top bar */}
                {sessionActive && (
                    <div
                        style={{
                            pointerEvents: 'all',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            gap: 12,
                        }}
                    >
                        <div
                            style={{
                                background: 'rgba(0,0,0,0.55)',
                                backdropFilter: 'blur(12px)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: 12,
                                padding: '8px 14px',
                                fontSize: 12,
                                color: '#00e5ff',
                                letterSpacing: '0.05em',
                            }}
                        >
                            ● LIVE AR
                        </div>

                        <div
                            style={{
                                background: 'rgba(0,0,0,0.55)',
                                backdropFilter: 'blur(12px)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: 12,
                                padding: '8px 14px',
                                fontSize: 12,
                                display: 'flex',
                                gap: 12,
                                alignItems: 'center',
                            }}
                        >
                            <span style={{ color: '#aaa' }}>Objects</span>
                            <span style={{ color: '#fff', fontWeight: 700 }}>
                                {objectCount}/{MAX_OBJECTS}
                            </span>
                        </div>
                    </div>
                )}

                {/* Bottom controls */}
                {sessionActive && (
                    <div
                        style={{
                            pointerEvents: 'all',
                            display: 'flex',
                            gap: 12,
                            justifyContent: 'center',
                        }}
                    >
                        <button
                            onClick={clearObjects}
                            style={btnStyle('#1a1a2e', 'rgba(255,255,255,0.1)')}
                        >
                            Clear
                        </button>
                        <button
                            onClick={endAR}
                            style={btnStyle('#2e1a1a', '#ff5252')}
                        >
                            Exit AR
                        </button>
                    </div>
                )}
            </div>

            {/* Pre-session landing UI */}
            {!sessionActive && (
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 32,
                        padding: 24,
                    }}
                >
                    {/* Title */}
                    <div style={{ textAlign: 'center' }}>
                        <h1
                            style={{
                                margin: 0,
                                fontSize: 'clamp(28px, 6vw, 52px)',
                                fontWeight: 800,
                                letterSpacing: '-0.02em',
                                background:
                                    'linear-gradient(135deg, #00e5ff 0%, #7c4dff 100%)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                            }}
                        >
                            AR Hit Test
                        </h1>
                        <p
                            style={{
                                margin: '8px 0 0',
                                fontSize: 13,
                                color: '#666',
                                letterSpacing: '0.12em',
                                textTransform: 'uppercase',
                            }}
                        >
                            Place objects on real surfaces
                        </p>
                    </div>

                    {/* Status card */}
                    <div
                        style={{
                            background: 'rgba(255,255,255,0.04)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: 16,
                            padding: '16px 24px',
                            maxWidth: 320,
                            width: '100%',
                            textAlign: 'center',
                            fontSize: 13,
                            color: arSupported === false ? '#ff5252' : '#aaa',
                            lineHeight: 1.6,
                        }}
                    >
                        {statusMsg}
                    </div>

                    {/* CTA */}
                    {arSupported && (
                        <button
                            onClick={startAR}
                            style={{
                                background:
                                    'linear-gradient(135deg, #00e5ff, #7c4dff)',
                                border: 'none',
                                borderRadius: 14,
                                padding: '16px 48px',
                                fontSize: 15,
                                fontWeight: 700,
                                color: '#fff',
                                letterSpacing: '0.08em',
                                textTransform: 'uppercase',
                                cursor: 'pointer',
                                boxShadow: '0 0 40px rgba(0,229,255,0.25)',
                                transition: 'transform 0.15s, box-shadow 0.15s',
                            }}
                            onMouseEnter={(e) => {
                                (
                                    e.currentTarget as HTMLButtonElement
                                ).style.transform = 'scale(1.04)';
                            }}
                            onMouseLeave={(e) => {
                                (
                                    e.currentTarget as HTMLButtonElement
                                ).style.transform = 'scale(1)';
                            }}
                        >
                            Start AR
                        </button>
                    )}

                    {/* Instructions */}
                    {arSupported && (
                        <ul
                            style={{
                                listStyle: 'none',
                                margin: 0,
                                padding: 0,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 10,
                                maxWidth: 300,
                                width: '100%',
                            }}
                        >
                            {[
                                ['📷', 'Allow camera access when prompted'],
                                ['🔍', 'Move device to scan surfaces'],
                                ['✨', 'Tap the screen to place an object'],
                            ].map(([icon, text]) => (
                                <li
                                    key={text}
                                    style={{
                                        display: 'flex',
                                        gap: 12,
                                        alignItems: 'flex-start',
                                        fontSize: 13,
                                        color: '#666',
                                    }}
                                >
                                    <span style={{ fontSize: 16 }}>{icon}</span>
                                    <span>{text}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Tiny style helper ────────────────────────────────────────────────────────

function btnStyle(bg: string, border: string): React.CSSProperties {
    return {
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 12,
        padding: '12px 28px',
        fontSize: 13,
        fontWeight: 600,
        color: '#fff',
        letterSpacing: '0.06em',
        textTransform: 'uppercase' as const,
        cursor: 'pointer',
        fontFamily: 'inherit',
    };
}
