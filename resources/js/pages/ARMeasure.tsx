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
    widthM: number;
    heightM: number;
    confirmed: boolean;
}

export interface QuadSummary {
    modelLabel: string;
    widthCm: number;
    heightCm: number;
}

interface Props {
    onComplete?: (results: QuadSummary[]) => void;
}

// ─── Model catalogue ──────────────────────────────────────────────────────────

const MODELS: ModelDef[] = [
    {
        id: 'window',
        label: 'Window',
        file: '/models/window.glb',
        accentColor: '#00e5ff',
    },
    {
        id: 'window1',
        label: 'Window 1',
        file: '/models/window1.glb',
        accentColor: '#4fc3f7',
    },
    {
        id: 'door1',
        label: 'Door 1',
        file: '/models/door1.glb',
        accentColor: '#ffd740',
    },
    {
        id: 'door2',
        label: 'Door 2',
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
    group.position.set(0, 0, 0);
    group.scale.set(1, 1, 1);
    group.updateMatrixWorld(true);
    const size = new THREE.Vector3();
    new THREE.Box3().setFromObject(group).getSize(size);
    const scaleX = quadWidth / (size.x || 1);
    const scaleY = quadHeight / (size.y || 1);
    group.scale.set(scaleX, scaleY, (scaleX + scaleY) / 2);
    group.updateMatrixWorld(true);
    const boxCentre = new THREE.Vector3();
    new THREE.Box3().setFromObject(group).getCenter(boxCentre);
    group.position.copy(centre.clone().sub(boxCentre).add(group.position));
}

async function renderThumbnail(
    file: string,
    size = 120,
): Promise<string | null> {
    try {
        const THREE = window.THREE;
        const offCanvas = document.createElement('canvas');
        offCanvas.width = size;
        offCanvas.height = size;
        const renderer = new THREE.WebGLRenderer({
            canvas: offCanvas,
            alpha: true,
            antialias: true,
        });
        renderer.setSize(size, size);
        (renderer as any).outputEncoding = (THREE as any).sRGBEncoding;
        const scene = new THREE.Scene();
        scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 1.5));
        const dir = new THREE.DirectionalLight(0xffffff, 1);
        dir.position.set(1, 2, 2);
        scene.add(dir);
        const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 100);
        const gltf = await new Promise<{ scene: THREE.Group }>((res, rej) => {
            new THREE.GLTFLoader().load(file, res, undefined, rej);
        });
        const model = gltf.scene;
        scene.add(model);
        const box = new THREE.Box3().setFromObject(model);
        const centre = new THREE.Vector3();
        box.getCenter(centre);
        const sphere = new THREE.Sphere();
        box.getBoundingSphere(sphere);
        model.position.sub(centre);
        camera.position.set(0, 0, sphere.radius * 2.2);
        camera.lookAt(0, 0, 0);
        renderer.render(scene, camera);
        const url = offCanvas.toDataURL();
        renderer.dispose();
        return url;
    } catch {
        return null;
    }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ARMeasure({ onComplete }: Props) {
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

    // Pending corners
    const pendingCornersRef = useRef<CornerPoint[]>([]);
    const previewLinesRef = useRef<THREE.LineSegments | null>(null);

    // Quads
    const quadsRef = useRef<QuadGroup[]>([]);
    const quadCounterRef = useRef(0);

    // UI touch guard
    const uiTouchedRef = useRef(false);

    // Selected model ref (always fresh in XR callbacks)
    const selectedModelIdRef = useRef<string>(MODELS[0].id);

    // UI state
    const [arSupported, setArSupported] = useState<boolean | null>(null);
    const [sessionActive, setSessionActive] = useState(false);
    const [pendingCount, setPendingCount] = useState(0);
    const [quadCount, setQuadCount] = useState(0);
    const [selectedModelId, setSelectedModelId] = useState<string>(
        MODELS[0].id,
    );
    const [loadingModel, setLoadingModel] = useState(false);
    const [activeQuadId, setActiveQuadId] = useState<number | null>(null);
    const [thumbs, setThumbs] = useState<Record<string, string>>({});
    const [summary, setSummary] = useState<QuadSummary[]>([]);
    const [showSummary, setShowSummary] = useState(false);

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

    // ── Init Three.js ────────────────────────────────────────────────────────────

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

        // ── FIX: Restored thick ring geometry (0.04 inner, 0.06 outer) from File 1 ──
        // File 2 had 0.055 outer which made the ring too thin to see clearly.
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

        // Generate thumbnails after Three.js is ready (best-effort)
        const thumbMap: Record<string, string> = {};
        for (const m of MODELS) {
            const url = await renderThumbnail(m.file);
            if (url) thumbMap[m.id] = url;
        }
        if (Object.keys(thumbMap).length > 0) setThumbs(thumbMap);
    }, []);

    // ── Remove preview lines ─────────────────────────────────────────────────────

    const clearPreviewLines = useCallback(() => {
        if (previewLinesRef.current && sceneRef.current) {
            sceneRef.current.remove(previewLinesRef.current);
            previewLinesRef.current.geometry.dispose();
            previewLinesRef.current = null;
        }
    }, []);

    // ── Place corner sphere ──────────────────────────────────────────────────────

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

    // ── Load GLB, fit to quad, optionally replace existing model ─────────────────

    const loadAndPlaceModel = useCallback(
        (
            modelDef: ModelDef,
            pts: THREE.Vector3[],
            quadId: number,
            replacingGroup?: THREE.Group | null,
        ) => {
            const scene = sceneRef.current;
            if (!scene) return;
            setLoadingModel(true);

            if (replacingGroup) scene.remove(replacingGroup);

            new window.THREE.GLTFLoader().load(
                modelDef.file,
                (gltf) => {
                    setLoadingModel(false);
                    const group = gltf.scene;
                    fitModelToQuad(window.THREE, group, pts);
                    scene.add(group);
                    const quad = quadsRef.current.find((q) => q.id === quadId);
                    if (quad) {
                        quad.modelRoot = group;
                        quad.modelId = modelDef.id;
                    }
                },
                undefined,
                (err) => {
                    setLoadingModel(false);
                    console.error('GLTFLoader:', err);
                },
            );
        },
        [],
    );

    // ── Finalise quad ────────────────────────────────────────────────────────────

    const finaliseQuad = useCallback(
        (corners: CornerPoint[], modelDef: ModelDef) => {
            const THREE = window.THREE;
            const scene = sceneRef.current!;
            const pts = corners.map((c) => c.position);

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

            const labelData: LabelData[] = [];
            for (let i = 0; i < 4; i++) {
                const a = pts[i],
                    b = pts[(i + 1) % 4];
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

            const widthM = pts[0].distanceTo(pts[1]);
            const heightM = pts[0].distanceTo(pts[3]);
            const quadId = ++quadCounterRef.current;

            quadsRef.current.push({
                id: quadId,
                modelId: modelDef.id,
                corners,
                edgeLines,
                labelData,
                modelRoot: null,
                widthM,
                heightM,
                confirmed: false,
            });
            setQuadCount(quadsRef.current.length);
            setActiveQuadId(quadId);

            loadAndPlaceModel(modelDef, pts, quadId);
        },
        [loadAndPlaceModel],
    );

    // ── Swap model on the active (unconfirmed) quad ──────────────────────────────

    const swapActiveModel = useCallback(
        (modelDef: ModelDef) => {
            const quad = quadsRef.current.find((q) => !q.confirmed);
            if (!quad) return;
            const pts = quad.corners.map((c) => c.position);
            loadAndPlaceModel(modelDef, pts, quad.id, quad.modelRoot);
        },
        [loadAndPlaceModel],
    );

    // ── Confirm active quad ──────────────────────────────────────────────────────

    const confirmActiveQuad = useCallback(() => {
        const quad = quadsRef.current.find((q) => !q.confirmed);
        if (!quad) return;
        quad.confirmed = true;
        (quad.edgeLines.material as THREE.LineBasicMaterial).opacity = 0.25;
        setActiveQuadId(null);
    }, []);

    // ── onSelect ─────────────────────────────────────────────────────────────────

    const onSelect = useCallback(() => {
        if (uiTouchedRef.current) {
            uiTouchedRef.current = false;
            return;
        }

        const reticle = reticleRef.current;
        const scene = sceneRef.current;
        if (!reticle?.visible || !scene) return;

        const hasUnconfirmed = quadsRef.current.some((q) => !q.confirmed);
        if (hasUnconfirmed) return;

        const THREE = window.THREE;
        const pos = new THREE.Vector3().setFromMatrixPosition(
            new THREE.Matrix4().fromArray(reticle.matrix.elements),
        );

        const mesh = placeCornerMesh(pos);
        pendingCornersRef.current.push({ position: pos.clone(), mesh });

        const count = pendingCornersRef.current.length;
        setPendingCount(count);

        if (count === 4) {
            clearPreviewLines();
            const modelDef =
                MODELS.find((m) => m.id === selectedModelIdRef.current) ??
                MODELS[0];
            finaliseQuad([...pendingCornersRef.current], modelDef);
            pendingCornersRef.current = [];
            setPendingCount(0);
        }
    }, [placeCornerMesh, clearPreviewLines, finaliseQuad]);

    // ── XR frame loop ────────────────────────────────────────────────────────────

    const onXRFrameRef = useRef<(t: number, frame: XRFrame) => void>(null!);

    onXRFrameRef.current = (_t: number, frame: XRFrame) => {
        frame.session.requestAnimationFrame(onXRFrameRef.current);

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
                        if (previewLinesRef.current) {
                            scene.remove(previewLinesRef.current);
                            previewLinesRef.current.geometry.dispose();
                            previewLinesRef.current = null;
                        }
                    } else {
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
                            const line = new THREE.LineSegments(
                                buildPreviewGeo(THREE, pts),
                                new THREE.LineDashedMaterial({
                                    color: 0x00e5ff,
                                    dashSize: 0.03,
                                    gapSize: 0.02,
                                }),
                            );
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
        setShowSummary(false);
        setSummary([]);
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
        xrHitTestSourceRef.current = (await session.requestHitTestSource!({
            space: viewerSpace,
        }))!;
        xrRefSpaceRef.current = await session.requestReferenceSpace('local');

        session.requestAnimationFrame(onXRFrameRef.current);
        setSessionActive(true);
    }, [initThree, onSelect]);

    // ── End AR + compile summary ─────────────────────────────────────────────────

    const endAR = useCallback(async () => {
        quadsRef.current.forEach((q) => {
            q.confirmed = true;
        });
        setActiveQuadId(null);

        const results: QuadSummary[] = quadsRef.current.map((q) => {
            const model = MODELS.find((m) => m.id === q.modelId) ?? MODELS[0];
            return {
                modelLabel: model.label,
                widthCm: Math.round(q.widthM * 100),
                heightCm: Math.round(q.heightM * 100),
            };
        });
        setSummary(results);
        onComplete?.(results);

        if (xrSessionRef.current) await xrSessionRef.current.end();
        setShowSummary(true);
    }, [onComplete]);

    // ── Undo last corner ─────────────────────────────────────────────────────────

    const undoCorner = useCallback(() => {
        const scene = sceneRef.current;
        if (!scene || pendingCornersRef.current.length === 0) return;
        scene.remove(pendingCornersRef.current.pop()!.mesh);
        if (pendingCornersRef.current.length === 0) {
            if (previewLinesRef.current) {
                scene.remove(previewLinesRef.current);
                previewLinesRef.current.geometry.dispose();
                previewLinesRef.current = null;
            }
        }
        setPendingCount(pendingCornersRef.current.length);
    }, []);

    // ── Clear all ────────────────────────────────────────────────────────────────

    const clearAll = useCallback(() => {
        const scene = sceneRef.current;
        if (!scene) return;
        quadsRef.current.forEach((q) => {
            scene.remove(q.edgeLines);
            q.corners.forEach((c) => scene.remove(c.mesh));
            q.labelData.forEach((l) => scene.remove(l.sprite));
            if (q.modelRoot) scene.remove(q.modelRoot);
        });
        quadsRef.current = [];
        setQuadCount(0);
        setActiveQuadId(null);
        pendingCornersRef.current.forEach((c) => scene.remove(c.mesh));
        pendingCornersRef.current = [];
        setPendingCount(0);
        if (previewLinesRef.current) {
            scene.remove(previewLinesRef.current);
            previewLinesRef.current.geometry.dispose();
            previewLinesRef.current = null;
        }
    }, []);

    // ── Model selection ──────────────────────────────────────────────────────────

    const handleModelSelect = useCallback(
        (id: string) => {
            setSelectedModelId(id);
            selectedModelIdRef.current = id;
            const modelDef = MODELS.find((m) => m.id === id)!;
            const unconfirmed = quadsRef.current.find((q) => !q.confirmed);
            if (unconfirmed) swapActiveModel(modelDef);
        },
        [swapActiveModel],
    );

    // ── Derived ──────────────────────────────────────────────────────────────────

    const selectedModel =
        MODELS.find((m) => m.id === selectedModelId) ?? MODELS[0];
    const hasUnconfirmed = quadsRef.current.some((q) => !q.confirmed);

    const hintMsg = hasUnconfirmed
        ? `Try different models, then tap Confirm`
        : pendingCount === 0
          ? `Pick a model, then tap corner 1`
          : pendingCount === 1
            ? `Tap corner 2 of 4`
            : pendingCount === 2
              ? `Tap corner 3 of 4`
              : `Tap corner 4 — quad closes!`;

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

            {/*
             * ── NO CSS crosshair overlay here ──
             * File 2 had a CSS crosshair div centred on screen which visually
             * competed with and obscured the 3D reticle ring. It has been
             * removed. The 3D reticle (cyan ring) is the sole aiming indicator,
             * and it correctly follows the AR hit-test surface position.
             */}

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
                        onPointerDown={() => {
                            uiTouchedRef.current = true;
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
                            <span style={{ color: '#333' }}>│</span>
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
                <div /> {/* spacer */}
                {/* Bottom section */}
                {sessionActive && (
                    <div
                        style={{
                            pointerEvents: 'all',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 8,
                            alignItems: 'center',
                        }}
                        onPointerDown={() => {
                            uiTouchedRef.current = true;
                        }}
                    >
                        {/* Hint */}
                        <div
                            style={glass({
                                fontSize: 11,
                                color: hasUnconfirmed
                                    ? '#ffd740'
                                    : selectedModel.accentColor,
                                letterSpacing: '0.05em',
                                textAlign: 'center',
                                maxWidth: 300,
                                pointerEvents: 'none',
                            })}
                        >
                            {hintMsg}
                        </div>

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
                                        onClick={() => handleModelSelect(m.id)}
                                        style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            gap: 4,
                                            padding: '6px 8px',
                                            background: active
                                                ? m.accentColor + '22'
                                                : 'transparent',
                                            border: active
                                                ? `1.5px solid ${m.accentColor}`
                                                : '1.5px solid rgba(255,255,255,0.06)',
                                            borderRadius: 12,
                                            cursor: 'pointer',
                                            minWidth: 62,
                                        }}
                                    >
                                        <div
                                            style={{
                                                width: 48,
                                                height: 48,
                                                borderRadius: 8,
                                                overflow: 'hidden',
                                                background:
                                                    'rgba(255,255,255,0.04)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                border: `1px solid ${active ? m.accentColor + '55' : 'transparent'}`,
                                            }}
                                        >
                                            {thumbs[m.id] ? (
                                                <img
                                                    src={thumbs[m.id]}
                                                    alt={m.label}
                                                    style={{
                                                        width: '100%',
                                                        height: '100%',
                                                        objectFit: 'contain',
                                                    }}
                                                />
                                            ) : (
                                                <div
                                                    style={{
                                                        fontSize: 22,
                                                        opacity: 0.6,
                                                    }}
                                                >
                                                    📦
                                                </div>
                                            )}
                                        </div>
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

                        {/* Action row */}
                        <div
                            style={{
                                display: 'flex',
                                gap: 8,
                                flexWrap: 'wrap',
                                justifyContent: 'center',
                            }}
                        >
                            <button
                                onClick={undoCorner}
                                disabled={pendingCount === 0 || hasUnconfirmed}
                                style={btn(
                                    '#111',
                                    'rgba(255,221,64,0.3)',
                                    pendingCount === 0 || hasUnconfirmed,
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
                            {hasUnconfirmed && (
                                <button
                                    onClick={confirmActiveQuad}
                                    style={btn(
                                        '#003322',
                                        '#00e5ff',
                                        false,
                                        '#00e5ff',
                                    )}
                                >
                                    ✓ Confirm &amp; Next
                                </button>
                            )}
                            <button
                                onClick={endAR}
                                style={btn('#1a0808', '#ff5252', false)}
                            >
                                Done
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Summary screen ── */}
            {showSummary && !sessionActive && (
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 20,
                        padding: 24,
                        background: '#08080f',
                    }}
                >
                    <h2
                        style={{
                            margin: 0,
                            fontSize: 20,
                            fontWeight: 800,
                            color: '#00e5ff',
                            letterSpacing: '-0.01em',
                        }}
                    >
                        Placement Summary
                    </h2>

                    <div
                        style={{
                            width: '100%',
                            maxWidth: 360,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 8,
                        }}
                    >
                        {summary.length === 0 && (
                            <div
                                style={{
                                    color: '#444',
                                    fontSize: 13,
                                    textAlign: 'center',
                                }}
                            >
                                No placements recorded.
                            </div>
                        )}
                        {summary.map((s, i) => {
                            const model =
                                MODELS.find((m) => m.label === s.modelLabel) ??
                                MODELS[0];
                            return (
                                <div
                                    key={i}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '12px 16px',
                                        background: 'rgba(255,255,255,0.03)',
                                        border: `1px solid ${model.accentColor}33`,
                                        borderRadius: 12,
                                    }}
                                >
                                    <div
                                        style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: 2,
                                        }}
                                    >
                                        <span
                                            style={{
                                                fontSize: 13,
                                                fontWeight: 700,
                                                color: model.accentColor,
                                            }}
                                        >
                                            {s.modelLabel}
                                        </span>
                                        <span
                                            style={{
                                                fontSize: 11,
                                                color: '#555',
                                            }}
                                        >
                                            #{i + 1}
                                        </span>
                                    </div>
                                    <div
                                        style={{
                                            fontSize: 14,
                                            fontWeight: 700,
                                            color: '#fff',
                                            letterSpacing: '0.02em',
                                        }}
                                    >
                                        {s.widthCm} × {s.heightCm} cm
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div style={{ display: 'flex', gap: 10 }}>
                        <button
                            onClick={() => setShowSummary(false)}
                            style={btn('#111', 'rgba(255,255,255,0.12)', false)}
                        >
                            Back
                        </button>
                        <button
                            onClick={startAR}
                            style={btn('#001833', '#00e5ff', false, '#00e5ff')}
                        >
                            New Session
                        </button>
                    </div>
                </div>
            )}

            {/* ── Landing screen ── */}
            {!sessionActive && !showSummary && (
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 24,
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

                    {/* Model cards */}
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
                                    gap: 6,
                                    padding: '10px 12px',
                                    background: 'rgba(255,255,255,0.03)',
                                    border: `1px solid ${m.accentColor}33`,
                                    borderRadius: 14,
                                    minWidth: 72,
                                }}
                            >
                                <div
                                    style={{
                                        width: 56,
                                        height: 56,
                                        borderRadius: 10,
                                        overflow: 'hidden',
                                        background: 'rgba(255,255,255,0.04)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}
                                >
                                    {thumbs[m.id] ? (
                                        <img
                                            src={thumbs[m.id]}
                                            alt={m.label}
                                            style={{
                                                width: '100%',
                                                height: '100%',
                                                objectFit: 'contain',
                                            }}
                                        />
                                    ) : (
                                        <div
                                            style={{
                                                fontSize: 26,
                                                opacity: 0.5,
                                            }}
                                        >
                                            📦
                                        </div>
                                    )}
                                </div>
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
                                gap: 8,
                                maxWidth: 270,
                                width: '100%',
                            }}
                        >
                            {(
                                [
                                    'Pick a model from the toolbar',
                                    'Tap 4 corners to trace the area',
                                    'Swap models freely, then Confirm',
                                    'Tap Done to see your summary',
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
    glowColor?: string,
): React.CSSProperties {
    return {
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 12,
        padding: '10px 18px',
        fontSize: 11,
        fontWeight: 600,
        color: disabled ? '#333' : '#fff',
        letterSpacing: '0.07em',
        textTransform: 'uppercase',
        cursor: disabled ? 'default' : 'pointer',
        fontFamily: 'inherit',
        opacity: disabled ? 0.4 : 1,
        boxShadow: glowColor && !disabled ? `0 0 18px ${glowColor}44` : 'none',
    };
}
