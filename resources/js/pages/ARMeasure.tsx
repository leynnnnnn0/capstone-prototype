import { useEffect, useRef, useState, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

declare global {
    interface Window {
        THREE: typeof import('three');
    }
}

interface CornerPoint {
    position: THREE.Vector3;
    mesh: THREE.Mesh;
}

interface LabelData {
    canvas: HTMLCanvasElement;
    texture: THREE.CanvasTexture;
    sprite: THREE.Sprite;
}

interface QuadGroup {
    id: number;
    corners: CornerPoint[];
    faceMesh: THREE.Mesh;
    edgeLines: THREE.LineSegments;
    labelData: LabelData[];
}

interface PendingState {
    corners: CornerPoint[];
    previewLines: THREE.LineSegments | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CORNER_COLOR = 0x00e5ff;
const EDGE_COLOR = 0xffffff;
const QUAD_COLOR = 0x00e5ff;

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

function fmtM(m: number): string {
    return m < 1 ? `${(m * 100).toFixed(1)} cm` : `${m.toFixed(2)} m`;
}

function roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();
}

function makeLabelSprite(
    THREE: typeof import('three'),
    text: string,
): LabelData {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    roundRect(ctx, 0, 0, 256, 64, 12);
    ctx.font = 'bold 28px monospace';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 32);
    const texture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: texture, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(0.28, 0.07, 1);
    return { canvas, texture, sprite };
}

function buildQuadGeo(
    THREE: typeof import('three'),
    pts: THREE.Vector3[],
): THREE.BufferGeometry {
    const geo = new THREE.BufferGeometry();
    const v = new Float32Array([
        pts[0].x,
        pts[0].y,
        pts[0].z,
        pts[1].x,
        pts[1].y,
        pts[1].z,
        pts[2].x,
        pts[2].y,
        pts[2].z,
        pts[0].x,
        pts[0].y,
        pts[0].z,
        pts[2].x,
        pts[2].y,
        pts[2].z,
        pts[3].x,
        pts[3].y,
        pts[3].z,
    ]);
    geo.setAttribute('position', new THREE.BufferAttribute(v, 3));
    return geo;
}

function buildEdgeGeo(
    THREE: typeof import('three'),
    pts: THREE.Vector3[],
): THREE.BufferGeometry {
    const geo = new THREE.BufferGeometry();
    const v = new Float32Array([
        pts[0].x,
        pts[0].y,
        pts[0].z,
        pts[1].x,
        pts[1].y,
        pts[1].z,
        pts[1].x,
        pts[1].y,
        pts[1].z,
        pts[2].x,
        pts[2].y,
        pts[2].z,
        pts[2].x,
        pts[2].y,
        pts[2].z,
        pts[3].x,
        pts[3].y,
        pts[3].z,
        pts[3].x,
        pts[3].y,
        pts[3].z,
        pts[0].x,
        pts[0].y,
        pts[0].z,
    ]);
    geo.setAttribute('position', new THREE.BufferAttribute(v, 3));
    return geo;
}

function buildPreviewGeo(
    THREE: typeof import('three'),
    pts: THREE.Vector3[],
): THREE.BufferGeometry {
    const geo = new THREE.BufferGeometry();
    const arr: number[] = [];
    for (let i = 0; i < pts.length - 1; i++) {
        arr.push(
            pts[i].x,
            pts[i].y,
            pts[i].z,
            pts[i + 1].x,
            pts[i + 1].y,
            pts[i + 1].z,
        );
    }
    geo.setAttribute(
        'position',
        new THREE.BufferAttribute(new Float32Array(arr), 3),
    );
    return geo;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ARMeasure() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const overlayRef = useRef<HTMLDivElement>(null);

    // XR refs
    const xrSessionRef = useRef<XRSession | null>(null);
    const xrRefSpaceRef = useRef<XRReferenceSpace | null>(null);
    const xrHitTestSourceRef = useRef<XRHitTestSource | null>(null);
    const rafHandleRef = useRef<number>(0);

    // Three.js refs
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const reticleRef = useRef<THREE.Mesh | null>(null);
    const threeLoadedRef = useRef(false);

    // Quad state refs (mutable, no re-render in frame loop)
    const pendingRef = useRef<PendingState>({
        corners: [],
        previewLines: null,
    });
    const quadsRef = useRef<QuadGroup[]>([]);
    const quadCounterRef = useRef(0);

    // UI state
    const [arSupported, setArSupported] = useState<boolean | null>(null);
    const [sessionActive, setSessionActive] = useState(false);
    const [statusMsg, setStatusMsg] = useState('Checking AR support…');
    const [pendingCount, setPendingCount] = useState(0);
    const [quadCount, setQuadCount] = useState(0);

    // ── AR support check ────────────────────────────────────────────────────────

    useEffect(() => {
        if (!navigator.xr) {
            setArSupported(false);
            setStatusMsg('WebXR not available in this browser.');
            return;
        }
        navigator.xr
            .isSessionSupported('immersive-ar')
            .then((ok) => {
                setArSupported(ok);
                setStatusMsg(
                    ok
                        ? 'AR ready — tap Start AR to begin.'
                        : 'Immersive AR not supported on this device.',
                );
            })
            .catch(() => {
                setArSupported(false);
                setStatusMsg('Could not query AR support.');
            });
    }, []);

    // ── Init Three.js ────────────────────────────────────────────────────────────

    const initThree = useCallback(async (canvas: HTMLCanvasElement) => {
        if (threeLoadedRef.current) return;
        await loadScript(
            'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
        );
        threeLoadedRef.current = true;
        const THREE = window.THREE;

        const renderer = new THREE.WebGLRenderer({
            canvas,
            alpha: true,
            antialias: true,
        });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.xr.enabled = true;
        rendererRef.current = renderer;

        const scene = new THREE.Scene();
        sceneRef.current = scene;
        scene.add(new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1));
        const dir = new THREE.DirectionalLight(0xffffff, 0.8);
        dir.position.set(0.5, 1, 1);
        scene.add(dir);

        const camera = new THREE.PerspectiveCamera(
            70,
            window.innerWidth / window.innerHeight,
            0.01,
            20,
        );
        cameraRef.current = camera;

        // Reticle ring
        const rGeo = new THREE.RingGeometry(0.04, 0.06, 32);
        rGeo.applyMatrix4(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
        const rMat = new THREE.MeshBasicMaterial({
            color: CORNER_COLOR,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.9,
        });
        const reticle = new THREE.Mesh(rGeo, rMat);
        reticle.matrixAutoUpdate = false;
        reticle.visible = false;
        scene.add(reticle);
        reticleRef.current = reticle;

        window.addEventListener('resize', () => {
            renderer.setSize(window.innerWidth, window.innerHeight);
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
        });
    }, []);

    // ── Place a corner sphere ────────────────────────────────────────────────────

    const placeCornerMesh = useCallback((pos: THREE.Vector3): THREE.Mesh => {
        const THREE = window.THREE;
        const geo = new THREE.SphereGeometry(0.018, 16, 16);
        const mat = new THREE.MeshStandardMaterial({
            color: CORNER_COLOR,
            emissive: CORNER_COLOR,
            emissiveIntensity: 0.5,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(pos);
        sceneRef.current!.add(mesh);
        return mesh;
    }, []);

    // ── Finalise quad from 4 corners ────────────────────────────────────────────

    const finaliseQuad = useCallback((corners: CornerPoint[]) => {
        const THREE = window.THREE;
        const scene = sceneRef.current!;
        const pts = corners.map((c) => c.position);

        // Filled translucent face
        const faceMat = new THREE.MeshBasicMaterial({
            color: QUAD_COLOR,
            transparent: true,
            opacity: 0.15,
            side: THREE.DoubleSide,
            depthWrite: false,
        });
        const faceMesh = new THREE.Mesh(buildQuadGeo(THREE, pts), faceMat);
        scene.add(faceMesh);

        // Edge outline
        const edgeMat = new THREE.LineBasicMaterial({ color: EDGE_COLOR });
        const edgeLines = new THREE.LineSegments(
            buildEdgeGeo(THREE, pts),
            edgeMat,
        );
        scene.add(edgeLines);

        // Side-length labels (4 sides: 0→1, 1→2, 2→3, 3→0)
        const labelData: LabelData[] = [];
        for (let i = 0; i < 4; i++) {
            const a = pts[i];
            const b = pts[(i + 1) % 4];
            const dist = a.distanceTo(b);
            const mid = new THREE.Vector3()
                .addVectors(a, b)
                .multiplyScalar(0.5);
            mid.y += 0.045;
            const label = makeLabelSprite(THREE, fmtM(dist));
            label.sprite.position.copy(mid);
            scene.add(label.sprite);
            labelData.push(label);
        }

        quadsRef.current.push({
            id: ++quadCounterRef.current,
            corners,
            faceMesh,
            edgeLines,
            labelData,
        });
        setQuadCount(quadsRef.current.length);
    }, []);

    // ── onSelect: tap → place corner ────────────────────────────────────────────

    const onSelect = useCallback(() => {
        const reticle = reticleRef.current;
        const scene = sceneRef.current;
        if (!reticle?.visible || !scene) return;

        const THREE = window.THREE;
        const mat4 = new THREE.Matrix4().fromArray(reticle.matrix.elements);
        const pos = new THREE.Vector3().setFromMatrixPosition(mat4);
        const pending = pendingRef.current;

        // Remove old preview
        if (pending.previewLines) {
            scene.remove(pending.previewLines);
            pending.previewLines = null;
        }

        const cornerMesh = placeCornerMesh(pos);
        pending.corners.push({ position: pos.clone(), mesh: cornerMesh });

        if (pending.corners.length === 4) {
            // Close the quad
            finaliseQuad([...pending.corners]);
            pendingRef.current = { corners: [], previewLines: null };
            setPendingCount(0);
        } else {
            // Draw dashed preview lines through placed corners
            if (pending.corners.length >= 2) {
                const ppts = pending.corners.map((c) => c.position);
                const pGeo = buildPreviewGeo(THREE, ppts);
                const pMat = new THREE.LineDashedMaterial({
                    color: CORNER_COLOR,
                    dashSize: 0.03,
                    gapSize: 0.02,
                });
                const lines = new THREE.LineSegments(pGeo, pMat);
                lines.computeLineDistances();
                scene.add(lines);
                pending.previewLines = lines;
            }
            setPendingCount(pending.corners.length);
        }
    }, [placeCornerMesh, finaliseQuad]);

    // ── XR frame loop ────────────────────────────────────────────────────────────

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

                    // Live preview: extend dashed line to current reticle position
                    const pending = pendingRef.current;
                    if (pending.corners.length >= 1) {
                        const THREE = window.THREE;
                        const rPos = new THREE.Vector3().setFromMatrixPosition(
                            new THREE.Matrix4().fromArray(
                                hitPose.transform.matrix,
                            ),
                        );
                        const ppts = [
                            ...pending.corners.map((c) => c.position),
                            rPos,
                        ];

                        if (pending.previewLines) {
                            pending.previewLines.geometry.dispose();
                            pending.previewLines.geometry = buildPreviewGeo(
                                THREE,
                                ppts,
                            );
                            (
                                pending.previewLines as THREE.LineSegments
                            ).computeLineDistances();
                        } else {
                            const pGeo = buildPreviewGeo(THREE, ppts);
                            const pMat = new THREE.LineDashedMaterial({
                                color: CORNER_COLOR,
                                dashSize: 0.03,
                                gapSize: 0.02,
                            });
                            const lines = new THREE.LineSegments(pGeo, pMat);
                            lines.computeLineDistances();
                            scene.add(lines);
                            pending.previewLines = lines;
                        }
                    }
                }
            }
        }

        renderer.render(scene, camera);
    };

    // ── Start AR ─────────────────────────────────────────────────────────────────

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
            setStatusMsg('Session ended — tap Start AR to restart.');
        });

        session.addEventListener('select', onSelect);

        const viewerSpace = await session.requestReferenceSpace('viewer');
        const hitTestSource = await session.requestHitTestSource!({
            space: viewerSpace,
        });
        xrHitTestSourceRef.current = hitTestSource!;

        const refSpace = await session.requestReferenceSpace('local');
        xrRefSpaceRef.current = refSpace;

        rafHandleRef.current = session.requestAnimationFrame(
            onXRFrameRef.current,
        );
        setSessionActive(true);
        setStatusMsg('Tap a surface to place corner 1 of 4.');
    }, [initThree, onSelect]);

    // ── End AR ───────────────────────────────────────────────────────────────────

    const endAR = useCallback(async () => {
        if (xrSessionRef.current) await xrSessionRef.current.end();
    }, []);

    // ── Clear all ────────────────────────────────────────────────────────────────

    const clearAll = useCallback(() => {
        const scene = sceneRef.current;
        if (!scene) return;
        quadsRef.current.forEach((q) => {
            scene.remove(q.faceMesh);
            scene.remove(q.edgeLines);
            q.corners.forEach((c) => scene.remove(c.mesh));
            q.labelData.forEach((l) => scene.remove(l.sprite));
        });
        quadsRef.current = [];
        setQuadCount(0);
        const p = pendingRef.current;
        p.corners.forEach((c) => scene.remove(c.mesh));
        if (p.previewLines) scene.remove(p.previewLines);
        pendingRef.current = { corners: [], previewLines: null };
        setPendingCount(0);
    }, []);

    // ── Undo last corner ─────────────────────────────────────────────────────────

    const undoCorner = useCallback(() => {
        const scene = sceneRef.current;
        const pending = pendingRef.current;
        if (!scene || pending.corners.length === 0) return;
        const last = pending.corners.pop()!;
        scene.remove(last.mesh);
        if (pending.previewLines) {
            scene.remove(pending.previewLines);
            pending.previewLines = null;
        }
        // Rebuild preview for remaining corners
        if (pending.corners.length >= 2) {
            const THREE = window.THREE;
            const ppts = pending.corners.map((c) => c.position);
            const pGeo = buildPreviewGeo(THREE, ppts);
            const pMat = new THREE.LineDashedMaterial({
                color: CORNER_COLOR,
                dashSize: 0.03,
                gapSize: 0.02,
            });
            const lines = new THREE.LineSegments(pGeo, pMat);
            lines.computeLineDistances();
            scene.add(lines);
            pending.previewLines = lines;
        }
        setPendingCount(pending.corners.length);
    }, []);

    // ── Hint ────────────────────────────────────────────────────────────────────

    const hints = [
        'Tap to place corner 1 of 4',
        'Tap to place corner 2 of 4',
        'Tap to place corner 3 of 4',
        'Tap final corner — quad closes!',
    ];
    const hintMsg = hints[pendingCount] ?? hints[0];

    // ── Render ───────────────────────────────────────────────────────────────────

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                background: '#090910',
                fontFamily: "'DM Mono','Fira Code',monospace",
                color: '#e0e0e0',
                overflow: 'hidden',
            }}
        >
            {/* AR canvas */}
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

            {/* DOM overlay */}
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
                        'env(safe-area-inset-top,16px) 16px env(safe-area-inset-bottom,24px)',
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
                            gap: 10,
                        }}
                    >
                        <div
                            style={glass({
                                color: '#00e5ff',
                                fontSize: 11,
                                letterSpacing: '0.07em',
                            })}
                        >
                            ● LIVE AR
                        </div>
                        <div
                            style={glass({
                                display: 'flex',
                                gap: 16,
                                fontSize: 12,
                                alignItems: 'center',
                            })}
                        >
                            <span>
                                <span style={{ color: '#666' }}>Quads </span>
                                <b style={{ color: '#fff' }}>{quadCount}</b>
                            </span>
                            <span style={{ color: '#333' }}>│</span>
                            <span>
                                <span style={{ color: '#666' }}>Pts </span>
                                <b
                                    style={{
                                        color:
                                            pendingCount > 0
                                                ? '#ffd740'
                                                : '#fff',
                                    }}
                                >
                                    {pendingCount}/4
                                </b>
                            </span>
                        </div>
                    </div>
                )}

                {/* Middle hint */}
                {sessionActive && (
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <div
                            style={glass({
                                fontSize: 12,
                                color: '#ffd740',
                                letterSpacing: '0.05em',
                            })}
                        >
                            {hintMsg}
                        </div>
                    </div>
                )}

                {/* Bottom buttons */}
                {sessionActive && (
                    <div
                        style={{
                            pointerEvents: 'all',
                            display: 'flex',
                            gap: 10,
                            justifyContent: 'center',
                        }}
                    >
                        <button
                            onClick={undoCorner}
                            disabled={pendingCount === 0}
                            style={btn(
                                '#1a1a2e',
                                'rgba(255,221,64,0.35)',
                                pendingCount === 0,
                            )}
                        >
                            Undo
                        </button>
                        <button
                            onClick={clearAll}
                            style={btn(
                                '#1a1a2e',
                                'rgba(255,255,255,0.12)',
                                false,
                            )}
                        >
                            Clear
                        </button>
                        <button
                            onClick={endAR}
                            style={btn('#2e1a1a', '#ff5252', false)}
                        >
                            Exit AR
                        </button>
                    </div>
                )}
            </div>

            {/* Landing */}
            {!sessionActive && (
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 28,
                        padding: 24,
                    }}
                >
                    <div style={{ textAlign: 'center' }}>
                        <h1
                            style={{
                                margin: 0,
                                fontSize: 'clamp(24px,6vw,46px)',
                                fontWeight: 800,
                                letterSpacing: '-0.02em',
                                background:
                                    'linear-gradient(135deg,#00e5ff,#7c4dff)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                            }}
                        >
                            AR Quad Measure
                        </h1>
                        <p
                            style={{
                                margin: '8px 0 0',
                                fontSize: 11,
                                color: '#444',
                                letterSpacing: '0.14em',
                                textTransform: 'uppercase',
                            }}
                        >
                            4-point surface tracing
                        </p>
                    </div>

                    <div
                        style={glass({
                            maxWidth: 300,
                            width: '100%',
                            textAlign: 'center',
                            fontSize: 13,
                            color: arSupported === false ? '#ff5252' : '#666',
                            lineHeight: 1.7,
                        })}
                    >
                        {statusMsg}
                    </div>

                    {arSupported && (
                        <button
                            onClick={startAR}
                            style={{
                                background:
                                    'linear-gradient(135deg,#00e5ff,#7c4dff)',
                                border: 'none',
                                borderRadius: 14,
                                padding: '14px 44px',
                                fontSize: 14,
                                fontWeight: 700,
                                color: '#fff',
                                letterSpacing: '0.08em',
                                textTransform: 'uppercase',
                                cursor: 'pointer',
                                boxShadow: '0 0 36px rgba(0,229,255,0.28)',
                            }}
                        >
                            Start AR
                        </button>
                    )}

                    {arSupported && (
                        <div
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 10,
                                maxWidth: 260,
                                width: '100%',
                            }}
                        >
                            {(
                                [
                                    'Point at a flat surface',
                                    'Tap 4 corners to trace a quad',
                                    'Side lengths appear automatically',
                                    'Keep tapping to add more quads',
                                ] as string[]
                            ).map((t, i) => (
                                <div
                                    key={t}
                                    style={{
                                        display: 'flex',
                                        gap: 12,
                                        fontSize: 12,
                                        color: '#555',
                                    }}
                                >
                                    <span
                                        style={{
                                            color: '#00e5ff',
                                            fontWeight: 700,
                                            flexShrink: 0,
                                        }}
                                    >
                                        0{i + 1}
                                    </span>
                                    <span>{t}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Style helpers ─────────────────────────────────────────────────────────────

function glass(extra: React.CSSProperties = {}): React.CSSProperties {
    return {
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(14px)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 12,
        padding: '10px 16px',
        ...extra,
    };
}

function btn(
    bg: string,
    border: string,
    disabled: boolean,
): React.CSSProperties {
    return {
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 12,
        padding: '11px 22px',
        fontSize: 12,
        fontWeight: 600,
        color: disabled ? '#444' : '#fff',
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        cursor: disabled ? 'default' : 'pointer',
        fontFamily: 'inherit',
        opacity: disabled ? 0.45 : 1,
    };
}
