import { useEffect, useRef, useState, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

declare global {
    interface Window {
        THREE: typeof import('three') & {
            GLTFLoader: new () => {
                load: (
                    url: string,
                    onLoad: (gltf: { scene: THREE.Group }) => void,
                    onProgress?: (e: ProgressEvent) => void,
                    onError?: (err: unknown) => void,
                ) => void;
            };
        };
    }
}

interface ModelDef {
    id: string;
    label: string;
    icon: string;
    file: string;
    accentColor: string;
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
    modelId: string;
    corners: CornerPoint[];
    edgeLines: THREE.LineSegments;
    labelData: LabelData[];
    modelRoot: THREE.Group | null;
}

// ─── Model catalogue ──────────────────────────────────────────────────────────

const MODELS: ModelDef[] = [
    {
        id: 'window',
        label: 'Window',
        icon: '🪟',
        file: '/models/window.glb',
        accentColor: '#00e5ff',
    },
    {
        id: 'window1',
        label: 'Window 1',
        icon: '🔲',
        file: '/models/window1.glb',
        accentColor: '#4fc3f7',
    },
    {
        id: 'door1',
        label: 'Door 1',
        icon: '🚪',
        file: '/models/door1.glb',
        accentColor: '#ffd740',
    },
    {
        id: 'door2',
        label: 'Door 2',
        icon: '🏠',
        file: '/models/door2.glb',
        accentColor: '#ff6e40',
    },
];

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
    color: string,
): LabelData {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'rgba(0,0,0,0.78)';
    roundRect(ctx, 0, 0, 256, 64, 12);
    ctx.font = 'bold 26px monospace';
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 32);
    const texture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: texture, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(0.28, 0.07, 1);
    return { canvas, texture, sprite };
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

function fitModelToQuad(
    THREE: typeof import('three'),
    group: THREE.Group,
    pts: THREE.Vector3[],
): void {
    const centre = new THREE.Vector3()
        .add(pts[0])
        .add(pts[1])
        .add(pts[2])
        .add(pts[3])
        .multiplyScalar(0.25);

    const quadWidth = pts[0].distanceTo(pts[1]);
    const quadHeight = pts[0].distanceTo(pts[3]);

    const edgeX = new THREE.Vector3().subVectors(pts[1], pts[0]).normalize();
    const edgeY = new THREE.Vector3().subVectors(pts[3], pts[0]).normalize();
    const normal = new THREE.Vector3().crossVectors(edgeX, edgeY).normalize();

    group.setRotationFromMatrix(
        new THREE.Matrix4().makeBasis(edgeX, edgeY, normal),
    );

    // First pass: measure bounding box
    group.position.set(0, 0, 0);
    group.scale.set(1, 1, 1);
    group.updateMatrixWorld(true);
    const size = new THREE.Vector3();
    new THREE.Box3().setFromObject(group).getSize(size);

    // Scale to fit quad width, clamped by height
    const scale = Math.min(
        quadWidth / (size.x || 1),
        quadHeight / (size.y || 1),
    );
    group.scale.setScalar(scale);

    // Second pass: centre on quad
    group.updateMatrixWorld(true);
    const boxCentre = new THREE.Vector3();
    new THREE.Box3().setFromObject(group).getCenter(boxCentre);
    group.position.add(centre).sub(boxCentre);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ARMeasure() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const overlayRef = useRef<HTMLDivElement>(null);

    // XR
    const xrSessionRef = useRef<XRSession | null>(null);
    const xrRefSpaceRef = useRef<XRReferenceSpace | null>(null);
    const xrHitTestSourceRef = useRef<XRHitTestSource | null>(null);

    // Three.js
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const reticleRef = useRef<THREE.Mesh | null>(null);
    const threeLoadedRef = useRef(false);

    // ── Pending corners — flat independent refs, never replaced as objects ──────
    // This is the key fix: frame loop and onSelect both mutate THE SAME arrays/refs,
    // no object replacement that could cause one side to see a stale reference.
    const pendingCornersRef = useRef<CornerPoint[]>([]); // corners placed so far
    const previewLinesRef = useRef<THREE.LineSegments | null>(null); // live dashed line

    // Completed quads
    const quadsRef = useRef<QuadGroup[]>([]);
    const quadCounterRef = useRef(0);

    // Selected model — ref keeps it fresh inside the XR frame callback
    const selectedModelIdRef = useRef<string>(MODELS[0].id);

    // UI state (React)
    const [arSupported, setArSupported] = useState<boolean | null>(null);
    const [sessionActive, setSessionActive] = useState(false);
    const [pendingCount, setPendingCount] = useState(0); // mirrors pendingCornersRef.length
    const [quadCount, setQuadCount] = useState(0);
    const [selectedModelId, setSelectedModelId] = useState<string>(
        MODELS[0].id,
    );
    const [loadingModel, setLoadingModel] = useState(false);

    // Keep model ref in sync with state
    useEffect(() => {
        selectedModelIdRef.current = selectedModelId;
    }, [selectedModelId]);

    // ── AR support check ────────────────────────────────────────────────────────

    useEffect(() => {
        if (!navigator.xr) {
            setArSupported(false);
            return;
        }
        navigator.xr
            .isSessionSupported('immersive-ar')
            .then((ok) => setArSupported(ok))
            .catch(() => setArSupported(false));
    }, []);

    // ── Init Three.js + GLTFLoader ───────────────────────────────────────────────

    const initThree = useCallback(async (canvas: HTMLCanvasElement) => {
        if (threeLoadedRef.current) return;
        await loadScript(
            'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
        );
        await loadScript(
            'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js',
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
        (renderer as any).outputEncoding = (THREE as any).sRGBEncoding;
        rendererRef.current = renderer;

        const scene = new THREE.Scene();
        sceneRef.current = scene;
        scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 1.2));
        const sun = new THREE.DirectionalLight(0xffffff, 1.0);
        sun.position.set(1, 2, 1.5);
        scene.add(sun);
        const fill = new THREE.DirectionalLight(0xffffff, 0.4);
        fill.position.set(-1, 0.5, -1);
        scene.add(fill);

        const camera = new THREE.PerspectiveCamera(
            70,
            window.innerWidth / window.innerHeight,
            0.01,
            20,
        );
        cameraRef.current = camera;

        // Reticle
        const rGeo = new THREE.RingGeometry(0.04, 0.06, 32);
        rGeo.applyMatrix4(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
        const rMat = new THREE.MeshBasicMaterial({
            color: 0x00e5ff,
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

    // ── Remove preview lines from scene completely ───────────────────────────────
    // Single function used by BOTH onSelect and the frame loop — no duplication

    const clearPreviewLines = useCallback(() => {
        if (previewLinesRef.current && sceneRef.current) {
            sceneRef.current.remove(previewLinesRef.current);
            previewLinesRef.current.geometry.dispose();
            previewLinesRef.current = null;
        }
    }, []);

    // ── Rebuild preview lines from current pending corners + optional extra pt ──

    const rebuildPreviewLines = useCallback(
        (extraPt?: THREE.Vector3) => {
            const scene = sceneRef.current;
            const corners = pendingCornersRef.current;
            if (!scene) return;

            const THREE = window.THREE;

            // Need at least 1 corner + the moving reticle point to draw anything
            const pts = [
                ...corners.map((c) => c.position),
                ...(extraPt ? [extraPt] : []),
            ];
            if (pts.length < 2) {
                clearPreviewLines();
                return;
            }

            if (previewLinesRef.current) {
                // Reuse existing LineSegments object — just swap geometry
                previewLinesRef.current.geometry.dispose();
                previewLinesRef.current.geometry = buildPreviewGeo(THREE, pts);
                previewLinesRef.current.computeLineDistances();
            } else {
                const geo = buildPreviewGeo(THREE, pts);
                const mat = new THREE.LineDashedMaterial({
                    color: 0x00e5ff,
                    dashSize: 0.03,
                    gapSize: 0.02,
                });
                const line = new THREE.LineSegments(geo, mat);
                line.computeLineDistances();
                scene.add(line);
                previewLinesRef.current = line;
            }
        },
        [clearPreviewLines],
    );

    // ── Place a corner sphere in the scene ──────────────────────────────────────

    const placeCornerMesh = useCallback((pos: THREE.Vector3): THREE.Mesh => {
        const THREE = window.THREE;
        const geo = new THREE.SphereGeometry(0.016, 16, 16);
        const mat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            emissive: 0x00e5ff,
            emissiveIntensity: 0.6,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(pos);
        sceneRef.current!.add(mesh);
        return mesh;
    }, []);

    // ── Load GLB and fit to quad ─────────────────────────────────────────────────

    const loadAndPlaceModel = useCallback(
        (modelDef: ModelDef, pts: THREE.Vector3[], quadId: number) => {
            const scene = sceneRef.current;
            if (!scene) return;
            setLoadingModel(true);

            const loader = new window.THREE.GLTFLoader();
            loader.load(
                modelDef.file,
                (gltf) => {
                    setLoadingModel(false);
                    const group = gltf.scene;
                    fitModelToQuad(window.THREE, group, pts);
                    scene.add(group);
                    const quad = quadsRef.current.find((q) => q.id === quadId);
                    if (quad) quad.modelRoot = group;
                },
                undefined,
                (err) => {
                    setLoadingModel(false);
                    console.error('GLTFLoader error:', err);
                },
            );
        },
        [],
    );

    // ── Finalise quad from 4 corners ────────────────────────────────────────────

    const finaliseQuad = useCallback(
        (corners: CornerPoint[], modelDef: ModelDef) => {
            const THREE = window.THREE;
            const scene = sceneRef.current!;
            const pts = corners.map((c) => c.position);

            // Permanent edge outline
            const edgeMat = new THREE.LineBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0.5,
            });
            const edgeLines = new THREE.LineSegments(
                buildEdgeGeo(THREE, pts),
                edgeMat,
            );
            scene.add(edgeLines);

            // Side-length labels
            const labelData: LabelData[] = [];
            for (let i = 0; i < 4; i++) {
                const a = pts[i];
                const b = pts[(i + 1) % 4];
                const mid = new THREE.Vector3()
                    .addVectors(a, b)
                    .multiplyScalar(0.5);
                mid.y += 0.05;
                const label = makeLabelSprite(
                    THREE,
                    fmtM(a.distanceTo(b)),
                    modelDef.accentColor,
                );
                label.sprite.position.copy(mid);
                scene.add(label.sprite);
                labelData.push(label);
            }

            const quadId = ++quadCounterRef.current;
            quadsRef.current.push({
                id: quadId,
                modelId: modelDef.id,
                corners,
                edgeLines,
                labelData,
                modelRoot: null,
            });
            setQuadCount(quadsRef.current.length);

            loadAndPlaceModel(modelDef, pts, quadId);
        },
        [loadAndPlaceModel],
    );

    // ── onSelect: called on every tap ───────────────────────────────────────────

    const onSelect = useCallback(() => {
        const reticle = reticleRef.current;
        const scene = sceneRef.current;
        if (!reticle?.visible || !scene) return;

        const THREE = window.THREE;

        // World position of the reticle hit point
        const mat4 = new THREE.Matrix4().fromArray(reticle.matrix.elements);
        const pos = new THREE.Vector3().setFromMatrixPosition(mat4);

        // Place corner sphere
        const mesh = placeCornerMesh(pos);
        pendingCornersRef.current.push({ position: pos.clone(), mesh });

        const count = pendingCornersRef.current.length;
        setPendingCount(count);

        if (count === 4) {
            // ── Quad complete ──────────────────────────────────────────────────────
            // 1. Kill the preview lines completely — they belong to the pending phase
            clearPreviewLines();

            // 2. Build the finished quad
            const modelDef =
                MODELS.find((m) => m.id === selectedModelIdRef.current) ??
                MODELS[0];
            finaliseQuad([...pendingCornersRef.current], modelDef);

            // 3. Reset pending state
            pendingCornersRef.current = [];
            setPendingCount(0);
        } else {
            // ── Still collecting corners — update dashed preview ──────────────────
            // The reticle's current position is the "next" point user is aiming at,
            // so just rebuild lines through the placed corners (no extra moving point yet;
            // the frame loop will extend it to the live reticle on the next frame).
            rebuildPreviewLines();
        }
    }, [placeCornerMesh, clearPreviewLines, rebuildPreviewLines, finaliseQuad]);

    // ── XR frame loop ────────────────────────────────────────────────────────────

    const onXRFrameRef = useRef<(t: number, frame: XRFrame) => void>(null!);

    onXRFrameRef.current = (_t: number, frame: XRFrame) => {
        const session = frame.session;
        session.requestAnimationFrame(onXRFrameRef.current);

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

                    const corners = pendingCornersRef.current;

                    if (corners.length === 0) {
                        // No pending corners — ensure no stale preview line lingers
                        if (previewLinesRef.current) {
                            scene.remove(previewLinesRef.current);
                            previewLinesRef.current.geometry.dispose();
                            previewLinesRef.current = null;
                        }
                    } else {
                        // Extend the dashed preview line from placed corners to live reticle
                        const THREE = window.THREE;
                        const rPos = new THREE.Vector3().setFromMatrixPosition(
                            new THREE.Matrix4().fromArray(
                                hitPose.transform.matrix,
                            ),
                        );
                        const pts = [...corners.map((c) => c.position), rPos];

                        if (previewLinesRef.current) {
                            previewLinesRef.current.geometry.dispose();
                            previewLinesRef.current.geometry = buildPreviewGeo(
                                THREE,
                                pts,
                            );
                            previewLinesRef.current.computeLineDistances();
                        } else {
                            const geo = buildPreviewGeo(THREE, pts);
                            const mat = new THREE.LineDashedMaterial({
                                color: 0x00e5ff,
                                dashSize: 0.03,
                                gapSize: 0.02,
                            });
                            const line = new THREE.LineSegments(geo, mat);
                            line.computeLineDistances();
                            scene.add(line);
                            previewLinesRef.current = line;
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
        });

        session.addEventListener('select', onSelect);

        const viewerSpace = await session.requestReferenceSpace('viewer');
        const hitTestSource = await session.requestHitTestSource!({
            space: viewerSpace,
        });
        xrHitTestSourceRef.current = hitTestSource!;

        const refSpace = await session.requestReferenceSpace('local');
        xrRefSpaceRef.current = refSpace;

        session.requestAnimationFrame(onXRFrameRef.current);
        setSessionActive(true);
    }, [initThree, onSelect]);

    // ── End AR ───────────────────────────────────────────────────────────────────

    const endAR = useCallback(async () => {
        if (xrSessionRef.current) await xrSessionRef.current.end();
    }, []);

    // ── Clear all ────────────────────────────────────────────────────────────────

    const clearAll = useCallback(() => {
        const scene = sceneRef.current;
        if (!scene) return;

        // Remove all finished quads
        quadsRef.current.forEach((q) => {
            scene.remove(q.edgeLines);
            q.corners.forEach((c) => scene.remove(c.mesh));
            q.labelData.forEach((l) => scene.remove(l.sprite));
            if (q.modelRoot) scene.remove(q.modelRoot);
        });
        quadsRef.current = [];
        setQuadCount(0);

        // Remove pending corners
        pendingCornersRef.current.forEach((c) => scene.remove(c.mesh));
        pendingCornersRef.current = [];
        setPendingCount(0);

        // Remove preview lines
        if (previewLinesRef.current) {
            scene.remove(previewLinesRef.current);
            previewLinesRef.current.geometry.dispose();
            previewLinesRef.current = null;
        }
    }, []);

    // ── Undo last corner ─────────────────────────────────────────────────────────

    const undoCorner = useCallback(() => {
        const scene = sceneRef.current;
        if (!scene || pendingCornersRef.current.length === 0) return;

        const last = pendingCornersRef.current.pop()!;
        scene.remove(last.mesh);

        // Rebuild preview without the removed corner
        // (rebuildPreviewLines with no extraPt — frame loop will extend to reticle)
        if (pendingCornersRef.current.length < 1) {
            // No corners left — kill preview entirely
            if (previewLinesRef.current) {
                scene.remove(previewLinesRef.current);
                previewLinesRef.current.geometry.dispose();
                previewLinesRef.current = null;
            }
        }
        // else: frame loop will naturally rebuild next frame

        setPendingCount(pendingCornersRef.current.length);
    }, []);

    // ── Derived hint ─────────────────────────────────────────────────────────────
    // pendingCount = how many corners have been placed already (0–3)

    const selectedModel =
        MODELS.find((m) => m.id === selectedModelId) ?? MODELS[0];

    const hintMsg =
        pendingCount === 0
            ? `Pick a model, then tap corner 1`
            : pendingCount === 1
              ? `Tap corner 2 of 4`
              : pendingCount === 2
                ? `Tap corner 3 of 4`
                : `Tap corner 4 of 4 — closes the quad!`;

    // ── Render ───────────────────────────────────────────────────────────────────

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                background: '#08080f',
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
                        'env(safe-area-inset-top,16px) 16px env(safe-area-inset-bottom,12px)',
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
                                gap: 14,
                                fontSize: 12,
                                alignItems: 'center',
                            })}
                        >
                            {loadingModel && (
                                <span
                                    style={{ color: '#ffd740', fontSize: 11 }}
                                >
                                    ⏳ Loading…
                                </span>
                            )}
                            <span>
                                <span style={{ color: '#555' }}>Quads </span>
                                <b style={{ color: '#fff' }}>{quadCount}</b>
                            </span>
                            <span style={{ color: '#222' }}>│</span>
                            <span>
                                <span style={{ color: '#555' }}>Pts </span>
                                <b
                                    style={{
                                        color:
                                            pendingCount > 0
                                                ? selectedModel.accentColor
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
                                color: selectedModel.accentColor,
                                letterSpacing: '0.05em',
                                textAlign: 'center',
                                maxWidth: 280,
                            })}
                        >
                            {hintMsg}
                        </div>
                    </div>
                )}

                {/* Bottom: model toolbar + action buttons */}
                {sessionActive && (
                    <div
                        style={{
                            pointerEvents: 'all',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 10,
                            alignItems: 'center',
                        }}
                    >
                        {/* Model picker */}
                        <div
                            style={{
                                display: 'flex',
                                gap: 8,
                                padding: '8px 10px',
                                background: 'rgba(0,0,0,0.72)',
                                backdropFilter: 'blur(16px)',
                                border: '1px solid rgba(255,255,255,0.07)',
                                borderRadius: 18,
                            }}
                        >
                            {MODELS.map((m) => {
                                const active = m.id === selectedModelId;
                                return (
                                    <button
                                        key={m.id}
                                        onClick={() => setSelectedModelId(m.id)}
                                        style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            gap: 3,
                                            padding: '8px 12px',
                                            background: active
                                                ? m.accentColor + '22'
                                                : 'transparent',
                                            border: active
                                                ? `1.5px solid ${m.accentColor}`
                                                : '1.5px solid transparent',
                                            borderRadius: 12,
                                            cursor: 'pointer',
                                            minWidth: 56,
                                        }}
                                    >
                                        <span style={{ fontSize: 22 }}>
                                            {m.icon}
                                        </span>
                                        <span
                                            style={{
                                                fontSize: 9,
                                                letterSpacing: '0.04em',
                                                color: active
                                                    ? m.accentColor
                                                    : '#555',
                                                fontFamily: 'inherit',
                                                textTransform: 'uppercase',
                                                fontWeight: active ? 700 : 400,
                                            }}
                                        >
                                            {m.label}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Action buttons */}
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button
                                onClick={undoCorner}
                                disabled={pendingCount === 0}
                                style={btn(
                                    '#111',
                                    'rgba(255,221,64,0.3)',
                                    pendingCount === 0,
                                )}
                            >
                                Undo
                            </button>
                            <button
                                onClick={clearAll}
                                style={btn(
                                    '#111',
                                    'rgba(255,255,255,0.1)',
                                    false,
                                )}
                            >
                                Clear
                            </button>
                            <button
                                onClick={endAR}
                                style={btn('#1a0808', '#ff5252', false)}
                            >
                                Exit AR
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Landing screen */}
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
                            AR Model Placer
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
                            Place windows &amp; doors with 4-point tracing
                        </p>
                    </div>

                    <div
                        style={{
                            display: 'flex',
                            gap: 10,
                            flexWrap: 'wrap',
                            justifyContent: 'center',
                        }}
                    >
                        {MODELS.map((m) => (
                            <div
                                key={m.id}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: 4,
                                    padding: '10px 14px',
                                    background: 'rgba(255,255,255,0.03)',
                                    border: `1px solid ${m.accentColor}33`,
                                    borderRadius: 14,
                                }}
                            >
                                <span style={{ fontSize: 24 }}>{m.icon}</span>
                                <span
                                    style={{
                                        fontSize: 10,
                                        color: m.accentColor,
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.06em',
                                    }}
                                >
                                    {m.label}
                                </span>
                            </div>
                        ))}
                    </div>

                    <div
                        style={glass({
                            maxWidth: 300,
                            width: '100%',
                            textAlign: 'center',
                            fontSize: 13,
                            color: arSupported === false ? '#ff5252' : '#555',
                            lineHeight: 1.7,
                        })}
                    >
                        {arSupported === null && 'Checking AR support…'}
                        {arSupported === true &&
                            'AR ready — tap Start AR to begin.'}
                        {arSupported === false &&
                            'Immersive AR not supported on this device.'}
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
                                boxShadow: '0 0 36px rgba(0,229,255,0.25)',
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
                                maxWidth: 270,
                                width: '100%',
                            }}
                        >
                            {(
                                [
                                    'Pick a model from the toolbar',
                                    'Tap 4 corners to trace the area',
                                    'Model loads and fits automatically',
                                    'Switch models to place more',
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
        background: 'rgba(0,0,0,0.62)',
        backdropFilter: 'blur(16px)',
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
        padding: '10px 20px',
        fontSize: 11,
        fontWeight: 600,
        color: disabled ? '#333' : '#fff',
        letterSpacing: '0.07em',
        textTransform: 'uppercase',
        cursor: disabled ? 'default' : 'pointer',
        fontFamily: 'inherit',
        opacity: disabled ? 0.4 : 1,
    };
}
