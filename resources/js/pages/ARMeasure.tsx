import { useEffect, useRef, useState, useCallback } from 'react';
import { router } from '@inertiajs/react';
import { useWebXR } from '../hooks/useWebXR';

// ─── Google Fonts ─────────────────────────────────────────────────────────────
const FONT_LINK = `@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Playfair+Display:ital,wght@0,700;1,700&display=swap');`;

// ─── Types ────────────────────────────────────────────────────────────────────
interface ModelDef {
    id: string;
    name: string;
    type: 'window' | 'door';
    file: string;
}

interface Placement {
    uid: string;
    model: ModelDef;
    widthCm: number;
    heightCm: number;
    /** Key into window.__arPlacements to find the live Three.js Object3D */
    objectKey: string;
}

type ReticleQuality = 'none' | 'poor' | 'okay' | 'good' | 'perfect';

// Extend window to carry AR globals set by the WebXR hook
declare global {
    interface Window {
        __arModel: any;
        __arCamera: any;
        __arScene: any;
        __arPlacements: Record<string, any>;
        __pendingModelSwap: { key: string; file: string } | null;
    }
}

// ─── Product catalog ──────────────────────────────────────────────────────────
const MODELS: ModelDef[] = [
    {
        id: 'window1',
        name: 'Window 1',
        type: 'window',
        file: '/models/window.glb',
    },
    {
        id: 'window2',
        name: 'Window 2',
        type: 'window',
        file: '/models/window2.glb',
    },
    { id: 'door1', name: 'Door 1', type: 'door', file: '/models/door1.glb' },
    { id: 'door2', name: 'Door 2', type: 'door', file: '/models/door2.glb' },
];

const STEPS = [
    {
        label: 'Top-left corner',
        hint: 'Tap the top-left corner of the opening',
    },
    { label: 'Top-right corner', hint: 'Tap the top-right corner' },
    { label: 'Bottom-left corner', hint: 'Tap the bottom-left corner' },
    {
        label: 'Bottom-right corner',
        hint: 'Tap the bottom-right corner — done!',
    },
];

const QUALITY_META: Record<
    ReticleQuality,
    { color: string; label: string; hint: string; canTap: boolean }
> = {
    none: {
        color: 'transparent',
        label: '',
        hint: 'Searching for surface…',
        canTap: false,
    },
    poor: {
        color: '#ef4444',
        label: 'Poor',
        hint: 'Move slowly — finding surface',
        canTap: false,
    },
    okay: {
        color: '#f59e0b',
        label: 'Okay',
        hint: 'Almost ready — keep still',
        canTap: false,
    },
    good: {
        color: '#3b82f6',
        label: 'Good',
        hint: 'Surface locked — tap to place',
        canTap: true,
    },
    perfect: {
        color: '#10b981',
        label: 'Perfect',
        hint: 'Surface locked — tap to place',
        canTap: true,
    },
};

// ─── ModelThumb ───────────────────────────────────────────────────────────────
function ModelThumb({ file, size = 100 }: { file: string; size?: number }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const rafRef = useRef<number>(0);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        let alive = true;
        let rendererInst: any;

        async function init() {
            const THREE = await import('three');
            rendererInst = new THREE.WebGLRenderer({
                canvas,
                alpha: true,
                antialias: true,
            });
            rendererInst.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            rendererInst.setSize(size, size);
            const scene = new THREE.Scene();
            const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 100);
            camera.position.set(0, 0, 2.5);
            scene.add(new THREE.AmbientLight(0xffffff, 1.2));
            const dir = new THREE.DirectionalLight(0xffffff, 0.8);
            dir.position.set(1, 2, 2);
            scene.add(dir);
            let model: any;
            try {
                const { GLTFLoader } =
                    await import('three/examples/jsm/loaders/GLTFLoader.js');
                const gltf = await new Promise<any>((res, rej) =>
                    new GLTFLoader().load(file, res, undefined, rej),
                );
                model = gltf.scene;
                const box = new THREE.Box3().setFromObject(model);
                const size3 = new THREE.Vector3();
                const center = new THREE.Vector3();
                box.getSize(size3);
                box.getCenter(center);
                const maxDim = Math.max(size3.x, size3.y, size3.z);
                model.scale.setScalar(1.6 / maxDim);
                model.position.sub(center.multiplyScalar(1.6 / maxDim));
                scene.add(model);
            } catch {
                model = new THREE.Mesh(
                    new THREE.BoxGeometry(1, 1.4, 0.1),
                    new THREE.MeshStandardMaterial({ color: 0x1a56db }),
                );
                scene.add(model);
            }
            function animate() {
                if (!alive) return;
                rafRef.current = requestAnimationFrame(animate);
                if (model) model.rotation.y += 0.008;
                rendererInst.render(scene, camera);
            }
            animate();
        }
        init();
        return () => {
            alive = false;
            cancelAnimationFrame(rafRef.current);
            rendererInst?.dispose();
        };
    }, [file, size]);

    return (
        <canvas
            ref={canvasRef}
            width={size}
            height={size}
            style={{ display: 'block', borderRadius: 10 }}
        />
    );
}

// ─── ModelSelector ────────────────────────────────────────────────────────────
function ModelSelector({
    selected,
    onSelect,
    title = 'Choose a product',
}: {
    selected: ModelDef | null;
    onSelect: (m: ModelDef) => void;
    title?: string;
}) {
    return (
        <div style={s.selectorWrap}>
            <div style={s.selectorTitle}>{title}</div>
            <div style={s.selectorRow}>
                {MODELS.map((m) => {
                    const isSel = selected?.id === m.id;
                    return (
                        <button
                            key={m.id}
                            style={{
                                ...s.modelCard,
                                borderColor: isSel
                                    ? '#1a56db'
                                    : 'rgba(26,86,219,0.15)',
                                background: isSel
                                    ? 'rgba(26,86,219,0.07)'
                                    : '#fff',
                                transform: isSel ? 'scale(1.04)' : 'scale(1)',
                                boxShadow: isSel
                                    ? '0 4px 20px rgba(26,86,219,0.18)'
                                    : '0 1px 6px rgba(0,0,0,0.06)',
                            }}
                            onClick={() => onSelect(m)}
                        >
                            <div style={s.thumbWrap}>
                                <ModelThumb file={m.file} size={86} />
                            </div>
                            <div
                                style={{
                                    ...s.typePill,
                                    background:
                                        m.type === 'window'
                                            ? 'rgba(59,130,246,0.1)'
                                            : 'rgba(245,158,11,0.1)',
                                    color:
                                        m.type === 'window'
                                            ? '#1a56db'
                                            : '#b45309',
                                    border: `1px solid ${m.type === 'window' ? 'rgba(26,86,219,0.2)' : 'rgba(180,83,9,0.2)'}`,
                                }}
                            >
                                {m.type}
                            </div>
                            <div
                                style={{
                                    ...s.modelName,
                                    color: isSel ? '#1a56db' : '#1e293b',
                                }}
                            >
                                {m.name}
                            </div>
                            {isSel && <div style={s.selectedMark}>✓</div>}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

// ─── StepIndicator ────────────────────────────────────────────────────────────
function StepIndicator({ current }: { current: number }) {
    return (
        <div style={s.stepRow}>
            {STEPS.map((_, i) => (
                <div
                    key={i}
                    style={{
                        ...s.stepDot,
                        background:
                            i < current
                                ? '#1a56db'
                                : i === current
                                  ? '#fff'
                                  : 'rgba(255,255,255,0.3)',
                        transform: i === current ? 'scale(1.35)' : 'scale(1)',
                    }}
                />
            ))}
        </div>
    );
}

// ─── QualityBadge ─────────────────────────────────────────────────────────────
function QualityBadge({ quality }: { quality: ReticleQuality }) {
    const meta = QUALITY_META[quality] ?? QUALITY_META.none;
    if (quality === 'none') return null;
    return (
        <div
            style={{
                ...s.qualityBadge,
                background: meta.color + '18',
                border: `1px solid ${meta.color}55`,
                color: meta.color,
            }}
        >
            <div style={{ ...s.qualityDot, background: meta.color }} />
            {meta.label}
        </div>
    );
}

// ─── InstructionBanner ───────────────────────────────────────────────────────
function InstructionBanner({
    step,
    quality,
    placementIndex,
}: {
    step: number;
    quality: ReticleQuality;
    placementIndex: number;
}) {
    const stepInfo = STEPS[step];
    const qualityMeta = QUALITY_META[quality] ?? QUALITY_META.none;
    const canTap = qualityMeta.canTap;
    return (
        <div
            style={{
                ...s.banner,
                borderColor:
                    qualityMeta.color === 'transparent'
                        ? 'rgba(255,255,255,0.15)'
                        : qualityMeta.color + '55',
            }}
        >
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    justifyContent: 'center',
                    marginBottom: 6,
                }}
            >
                <div
                    style={{
                        ...s.bannerPill,
                        background: canTap
                            ? '#1a56db'
                            : 'rgba(255,255,255,0.12)',
                    }}
                >
                    STEP {step + 1} / 4
                </div>
                <div style={s.placementPill}>#{placementIndex}</div>
            </div>
            <div style={s.bannerLabel}>{stepInfo.label}</div>
            <div style={s.qualityRow}>
                {(['poor', 'okay', 'good', 'perfect'] as ReticleQuality[]).map(
                    (q, i) => {
                        const levels: ReticleQuality[] = [
                            'poor',
                            'okay',
                            'good',
                            'perfect',
                        ];
                        const currentIdx = levels.indexOf(quality);
                        const isActive = i <= currentIdx && quality !== 'none';
                        return (
                            <div
                                key={q}
                                style={{
                                    ...s.qualityBar,
                                    background: isActive
                                        ? QUALITY_META[q].color
                                        : 'rgba(255,255,255,0.15)',
                                }}
                            />
                        );
                    },
                )}
            </div>
            <div
                style={{
                    ...s.bannerHint,
                    color: canTap
                        ? 'rgba(255,255,255,0.95)'
                        : 'rgba(255,210,120,0.9)',
                }}
            >
                {canTap ? stepInfo.hint : qualityMeta.hint}
            </div>
        </div>
    );
}

// ─── GestureHint ─────────────────────────────────────────────────────────────
function GestureHint({ onDismiss }: { onDismiss: () => void }) {
    useEffect(() => {
        const t = setTimeout(onDismiss, 5000);
        return () => clearTimeout(t);
    }, [onDismiss]);
    return (
        <div style={s.gestureHint}>
            <div style={s.gestureTitle}>Adjust models</div>
            <div style={s.gestureRows}>
                <div style={s.gestureRow}>
                    <span style={s.gi}>☝</span>
                    <span style={s.gt}>1 finger drag — move last placed</span>
                </div>
                <div style={s.gestureRow}>
                    <span style={s.gi}>✌</span>
                    <span style={s.gt}>2 finger drag — push / pull depth</span>
                </div>
            </div>
            <button style={s.gestureOk} onClick={onDismiss}>
                Got it
            </button>
        </div>
    );
}

// ─── PlacementRow ─────────────────────────────────────────────────────────────
function PlacementRow({
    placement,
    index,
    onDelete,
    onSwap,
}: {
    placement: Placement;
    index: number;
    onDelete: (uid: string) => void;
    onSwap: (uid: string) => void;
}) {
    return (
        <div style={s.placementRow}>
            <div style={s.placementIdx}>{index + 1}</div>
            <div style={s.placementInfo}>
                <div style={s.placementName}>{placement.model.name}</div>
                <div style={s.placementDims}>
                    {placement.widthCm} × {placement.heightCm} cm
                </div>
            </div>
            <div style={s.placementActions}>
                <button
                    style={s.rowIconBtn}
                    onClick={() => onSwap(placement.uid)}
                    title="Swap model"
                >
                    ⇄
                </button>
                <button
                    style={{ ...s.rowIconBtn, ...s.rowIconBtnDanger }}
                    onClick={() => onDelete(placement.uid)}
                    title="Remove"
                >
                    ✕
                </button>
            </div>
        </div>
    );
}

// ─── PlacementsPanel ─────────────────────────────────────────────────────────
function PlacementsPanel({
    placements,
    onDelete,
    onSwap,
    onAddMore,
    onConfirmAll,
}: {
    placements: Placement[];
    onDelete: (uid: string) => void;
    onSwap: (uid: string) => void;
    onAddMore: () => void;
    onConfirmAll: () => void;
}) {
    return (
        <div style={s.placementsPanel}>
            <div style={s.panelHandle} />
            <div style={s.panelHeader}>
                <div>
                    <div style={s.panelTitle}>Placed objects</div>
                    <div style={s.panelSub}>
                        {placements.length} item
                        {placements.length !== 1 ? 's' : ''} measured
                    </div>
                </div>
                <button style={s.addMoreBtn} onClick={onAddMore}>
                    + Add more
                </button>
            </div>
            <div style={s.placementList}>
                {placements.map((p, i) => (
                    <PlacementRow
                        key={p.uid}
                        placement={p}
                        index={i}
                        onDelete={onDelete}
                        onSwap={onSwap}
                    />
                ))}
            </div>
            <button style={s.btnPrimary} onClick={onConfirmAll}>
                Find products for all {placements.length} →
            </button>
        </div>
    );
}

// ─── SwapSheet ────────────────────────────────────────────────────────────────
function SwapSheet({
    targetUid,
    current,
    onSelect,
    onClose,
}: {
    targetUid: string;
    current: ModelDef;
    onSelect: (uid: string, m: ModelDef) => void;
    onClose: () => void;
}) {
    return (
        <div style={s.swapSheetBg} onClick={onClose}>
            <div style={s.swapSheet} onClick={(e) => e.stopPropagation()}>
                <div style={s.swapSheetHandle} />
                <div style={s.swapSheetTitle}>Swap model</div>
                <div style={s.swapSheetSub}>
                    Measurement stays — only the 3D preview changes.
                </div>
                <div style={s.selectorRow}>
                    {MODELS.map((m) => {
                        const isSel = current.id === m.id;
                        return (
                            <button
                                key={m.id}
                                style={{
                                    ...s.modelCard,
                                    borderColor: isSel
                                        ? '#1a56db'
                                        : 'rgba(26,86,219,0.15)',
                                    background: isSel
                                        ? 'rgba(26,86,219,0.07)'
                                        : '#fff',
                                    boxShadow: isSel
                                        ? '0 4px 20px rgba(26,86,219,0.15)'
                                        : '0 1px 4px rgba(0,0,0,0.05)',
                                }}
                                onClick={() => {
                                    onSelect(targetUid, m);
                                    onClose();
                                }}
                            >
                                <div style={s.thumbWrap}>
                                    <ModelThumb file={m.file} size={80} />
                                </div>
                                <div
                                    style={{
                                        ...s.typePill,
                                        background:
                                            m.type === 'window'
                                                ? 'rgba(59,130,246,0.1)'
                                                : 'rgba(245,158,11,0.1)',
                                        color:
                                            m.type === 'window'
                                                ? '#1a56db'
                                                : '#b45309',
                                        border: `1px solid ${m.type === 'window' ? 'rgba(26,86,219,0.2)' : 'rgba(180,83,9,0.2)'}`,
                                    }}
                                >
                                    {m.type}
                                </div>
                                <div
                                    style={{
                                        ...s.modelName,
                                        color: isSel ? '#1a56db' : '#1e293b',
                                    }}
                                >
                                    {m.name}
                                </div>
                                {isSel && <div style={s.selectedMark}>✓</div>}
                            </button>
                        );
                    })}
                </div>
                <button
                    style={{ ...s.btnOutline, marginTop: 12, width: '100%' }}
                    onClick={onClose}
                >
                    Cancel
                </button>
            </div>
        </div>
    );
}

// ─── AddMoreSheet ─────────────────────────────────────────────────────────────
// Bottom sheet shown when user taps "+ Add more" — lets them pick the next model
function AddMoreSheet({
    onStart,
    onClose,
}: {
    onStart: (model: ModelDef) => void;
    onClose: () => void;
}) {
    const [picked, setPicked] = useState<ModelDef>(MODELS[0]);
    return (
        <div style={s.swapSheetBg} onClick={onClose}>
            <div style={s.swapSheet} onClick={(e) => e.stopPropagation()}>
                <div style={s.swapSheetHandle} />
                <div style={s.swapSheetTitle}>Add another opening</div>
                <div style={s.swapSheetSub}>
                    All previous placements stay visible in AR.
                </div>
                <ModelSelector
                    selected={picked}
                    onSelect={setPicked}
                    title="Product to measure next"
                />
                <button
                    style={{ ...s.btnPrimary, marginTop: 4 }}
                    onClick={() => onStart(picked)}
                >
                    Measure {picked.name} →
                </button>
                <button
                    style={{ ...s.btnOutline, marginTop: 8, width: '100%' }}
                    onClick={onClose}
                >
                    Cancel
                </button>
            </div>
        </div>
    );
}

// ─── UnsupportedCard ──────────────────────────────────────────────────────────
function UnsupportedCard({ onBack }: { onBack: () => void }) {
    return (
        <div style={s.unsupportedWrap}>
            <style>{FONT_LINK}</style>
            <a
                href="/"
                style={
                    {
                        ...s.logoRow,
                        textDecoration: 'none',
                    } as React.CSSProperties
                }
            >
                <div style={s.logoMark}>G</div>
                <span style={s.logoText}>
                    Glass<span style={{ color: '#1a56db' }}>Viz</span>
                </span>
            </a>
            <div style={s.unsupportedCard}>
                <div style={s.unsupportedIcon}>⚠️</div>
                <h2 style={s.unsupportedTitle}>AR Not Available</h2>
                <p style={s.unsupportedText}>
                    WebXR AR requires <strong>Android Chrome</strong> on a
                    compatible device.
                </p>
                <p style={s.unsupportedText}>
                    You can still enter your measurements manually.
                </p>
                <button style={s.btnPrimary} onClick={onBack}>
                    Enter measurements manually
                </button>
            </div>
        </div>
    );
}

// ─── Main page ────────────────────────────────────────────────────────────────
/**
 * Multi-object AR measure session.
 *
 * State machine:
 *   idle      → user on start screen, picks a model, taps "Start AR"
 *   measuring → AR active, user is tapping corners for one opening
 *               when tapCount reaches 4 → modelPlaced fires → commit placement → panel
 *   panel     → PlacementsPanel visible; user can add more, swap, delete, or confirm all
 *   addMore   → AddMoreSheet open; user picks model; on confirm → measuring for next opening
 *
 * window.__arPlacements: Record<uid, Object3D>
 *   Each placed model is stored here so gesture handling and deletion can target it.
 *   The hook's window.__arModel always holds the *currently active* (just placed) model.
 *   On placement commit we move it into __arPlacements and clear __arModel so the hook
 *   can place a fresh model for the next measurement.
 */
export default function ARMeasure() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const overlayRef = useRef<HTMLDivElement>(null);
    const gestureRef = useRef<HTMLDivElement>(null);

    const [checked, setChecked] = useState(false);
    const [hintShown, setHintShown] = useState(false);
    const [hintDismissed, setHintDismissed] = useState(false);

    // Model chosen for the *next* tap sequence
    const [selectedModel, setSelectedModel] = useState<ModelDef>(MODELS[0]);

    // All committed placements in this session
    const [placements, setPlacements] = useState<Placement[]>([]);

    // UI state: 'idle' | 'measuring' | 'panel' | 'addMore'
    const [uiState, setUiState] = useState<
        'idle' | 'measuring' | 'panel' | 'addMore'
    >('idle');

    // Which placement uid is pending a model swap
    const [swapTarget, setSwapTarget] = useState<string | null>(null);

    // Track which uid corresponds to the model that just got placed
    const pendingUidRef = useRef<string | null>(null);

    const {
        isSupported,
        isActive,
        tapCount,
        dimensions,
        error,
        reticleQuality,
        modelLoading,
        modelError,
        modelPlaced,
        checkSupport,
        startAR,
        stopAR,
        reset,
        setSelectedModel: setHookModel,
    } = useWebXR();

    // ── bootstrap ──────────────────────────────────────────────────────────────
    useEffect(() => {
        checkSupport().then(() => setChecked(true));
    }, []);

    useEffect(() => {
        setHookModel(selectedModel.file);
    }, [selectedModel]);

    // ── Commit placement when hook signals modelPlaced ─────────────────────────
    useEffect(() => {
        if (!modelPlaced || uiState !== 'measuring') return;
        if (!dimensions?.widthCm || !dimensions?.heightCm) return;

        const uid = pendingUidRef.current ?? `p-${Date.now()}`;
        pendingUidRef.current = null;

        // Stash the live Three.js object so it stays in scene but is now "owned" by this placement
        if (window.__arModel) {
            window.__arPlacements = window.__arPlacements ?? {};
            window.__arPlacements[uid] = window.__arModel;
            // Null out __arModel so the hook creates a fresh one next round
            window.__arModel = null as any;
        }

        setPlacements((prev) => [
            ...prev,
            {
                uid,
                model: selectedModel,
                widthCm: dimensions.widthCm,
                heightCm: dimensions.heightCm,
                objectKey: uid,
            },
        ]);

        setUiState('panel');

        if (!hintShown) {
            setHintShown(true);
            setHintDismissed(false);
        }
    }, [modelPlaced]);

    // ── Gesture: 1-finger move / 2-finger depth — targets last placed model ────
    useEffect(() => {
        const el = gestureRef.current;
        if (!el) return;
        let lastX = 0,
            lastY = 0,
            lastMidY = 0;
        let intent: 'move' | 'depth' | null = null;

        function getGestureTarget(): any {
            // While measuring, control the live model (preview before placement)
            if (uiState === 'measuring' && window.__arModel)
                return window.__arModel;
            // After placing, control the most recently placed object
            if (!placements.length) return null;
            const lastUid = placements[placements.length - 1].objectKey;
            return window.__arPlacements?.[lastUid] ?? null;
        }

        function onStart(e: TouchEvent) {
            if (!getGestureTarget()) return;
            intent = null;
            if (e.touches.length === 1) {
                lastX = e.touches[0].clientX;
                lastY = e.touches[0].clientY;
                intent = 'move';
            } else if (e.touches.length === 2) {
                lastMidY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
                intent = 'depth';
            }
        }
        function onMove(e: TouchEvent) {
            const model = getGestureTarget();
            const camera = window.__arCamera;
            if (!model || !camera) return;
            e.preventDefault();
            const m = camera.matrixWorld.elements;
            if (intent === 'move' && e.touches.length === 1) {
                const S = 2.0;
                const dx = (e.touches[0].clientX - lastX) / window.innerWidth;
                const dy = (e.touches[0].clientY - lastY) / window.innerHeight;
                model.position.x += dx * m[0] * S - dy * m[4] * S;
                model.position.y += dx * m[1] * S - dy * m[5] * S;
                model.position.z += dx * m[2] * S - dy * m[6] * S;
                lastX = e.touches[0].clientX;
                lastY = e.touches[0].clientY;
            } else if (intent === 'depth' && e.touches.length === 2) {
                const S = 1.5;
                const newMid =
                    (e.touches[0].clientY + e.touches[1].clientY) / 2;
                const dy = (newMid - lastMidY) / window.innerHeight;
                model.position.x += dy * -m[8] * S;
                model.position.y += dy * -m[9] * S;
                model.position.z += dy * -m[10] * S;
                lastMidY = newMid;
            }
        }
        function onEnd(e: TouchEvent) {
            if (e.touches.length === 0) intent = null;
            else if (e.touches.length === 1) {
                lastX = e.touches[0].clientX;
                lastY = e.touches[0].clientY;
                intent = 'move';
            }
        }
        el.addEventListener('touchstart', onStart, { passive: true });
        el.addEventListener('touchmove', onMove, { passive: false });
        el.addEventListener('touchend', onEnd, { passive: true });
        return () => {
            el.removeEventListener('touchstart', onStart);
            el.removeEventListener('touchmove', onMove);
            el.removeEventListener('touchend', onEnd);
        };
    }, [uiState, placements]);

    // ── Handlers ───────────────────────────────────────────────────────────────
    const handleStart = useCallback(() => {
        pendingUidRef.current = `p-${Date.now()}`;
        setUiState('measuring');
        startAR(canvasRef.current!, overlayRef.current!);
    }, [startAR]);

    const handleAddMoreStart = useCallback(
        (model: ModelDef) => {
            setSelectedModel(model);
            setHookModel(model.file);
            pendingUidRef.current = `p-${Date.now()}`;
            setUiState('measuring');
            // Don't stop/restart AR — just reset tap state so user can tap fresh corners
            reset();
        },
        [reset, setHookModel],
    );

    const handleDeletePlacement = useCallback((uid: string) => {
        // Remove the Three.js mesh from the scene
        const obj = window.__arPlacements?.[uid];
        if (obj?.parent) obj.parent.remove(obj);
        delete window.__arPlacements?.[uid];
        setPlacements((prev) => prev.filter((p) => p.uid !== uid));
    }, []);

    const handleSwapModel = useCallback((uid: string, newModel: ModelDef) => {
        setPlacements((prev) =>
            prev.map((p) => (p.uid === uid ? { ...p, model: newModel } : p)),
        );
        // Signal the hook to hot-swap the Three.js geometry for this placement
        window.__pendingModelSwap = { key: uid, file: newModel.file };
    }, []);

    const handleConfirmAll = useCallback(() => {
        if (!placements.length) return;
        stopAR();
        router.visit('/products', {
            data: {
                items: JSON.stringify(
                    placements.map((p) => ({
                        modelId: p.model.id,
                        widthCm: p.widthCm,
                        heightCm: p.heightCm,
                    })),
                ),
            },
        });
    }, [placements, stopAR]);

    const handleManual = useCallback(() => router.visit('/measure/manual'), []);

    const handleStopAR = useCallback(() => {
        stopAR();
        setPlacements([]);
        setUiState('idle');
        setHintShown(false);
        setHintDismissed(false);
        // Clean up all stored AR objects
        window.__arPlacements = {};
        window.__arModel = null as any;
    }, [stopAR]);

    // ── Derived state ──────────────────────────────────────────────────────────
    if (!checked) {
        return (
            <div style={s.loadingWrap}>
                <style>{FONT_LINK}</style>
                <a
                    href="/"
                    style={
                        {
                            ...s.logoRow,
                            textDecoration: 'none',
                        } as React.CSSProperties
                    }
                >
                    <div style={s.logoMark}>G</div>
                    <span style={s.logoText}>
                        Glass<span style={{ color: '#1a56db' }}>Viz</span>
                    </span>
                </a>
                <div style={s.loadingSpinner} />
                <div style={s.loadingText}>Checking AR support…</div>
            </div>
        );
    }
    if (isSupported === false) return <UnsupportedCard onBack={handleManual} />;

    const qualityMeta =
        QUALITY_META[reticleQuality as ReticleQuality] ?? QUALITY_META.none;
    const canTap = qualityMeta.canTap;
    const isMeasuring = uiState === 'measuring';
    const showReticle = isActive && isMeasuring && tapCount < 4;
    const showHint = hintShown && !hintDismissed && uiState === 'panel';

    // Gesture layer is active whenever AR is running
    const gestureActive = isActive;

    return (
        <div style={s.root}>
            <style>
                {FONT_LINK}
                {`
        @keyframes pulse   { 0%,100%{transform:translate(-50%,-50%) scale(1);opacity:1;} 50%{transform:translate(-50%,-50%) scale(1.18);opacity:.7;} }
        @keyframes spin    { to{transform:rotate(360deg);} }
        @keyframes fadeIn  { from{opacity:0;transform:translateY(10px);} to{opacity:1;transform:translateY(0);} }
        @keyframes slideUp { from{opacity:0;transform:translateY(50px);} to{opacity:1;transform:translateY(0);} }
      `}
            </style>

            <canvas ref={canvasRef} style={s.canvas} />

            {/* touch-gesture layer — sits above canvas, below UI */}
            <div
                ref={gestureRef}
                style={{
                    ...s.gestureLayer,
                    pointerEvents: gestureActive ? 'auto' : 'none',
                }}
            />

            {/* XR DOM overlay — everything inside here is composited over the camera feed */}
            <div ref={overlayRef} style={s.overlay}>
                {/* ── Top bar (AR active) ── */}
                {isActive && (
                    <div style={s.topBar}>
                        <button style={s.closeBtn} onClick={handleStopAR}>
                            <span style={s.closeBtnX}>✕</span> Exit AR
                        </button>
                        <div style={s.topBarRight}>
                            {isMeasuring && (
                                <>
                                    <div style={s.selectedBadge}>
                                        {selectedModel.name}
                                    </div>
                                    <QualityBadge
                                        quality={
                                            reticleQuality as ReticleQuality
                                        }
                                    />
                                    <StepIndicator current={tapCount} />
                                </>
                            )}
                            {!isMeasuring && placements.length > 0 && (
                                <div style={s.countBadge}>
                                    {placements.length} placed
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ── Reticle (while tapping corners) ── */}
                {showReticle && (
                    <div style={s.reticleGuide}>
                        <div
                            style={{
                                ...s.reticleRing,
                                borderColor:
                                    qualityMeta.color === 'transparent'
                                        ? 'rgba(255,255,255,0.4)'
                                        : qualityMeta.color,
                                boxShadow: canTap
                                    ? `0 0 16px ${qualityMeta.color}66`
                                    : 'none',
                                animation: canTap
                                    ? 'pulse 1.2s ease-in-out infinite'
                                    : 'none',
                            }}
                        />
                        <div
                            style={{
                                ...s.reticleDot,
                                background:
                                    qualityMeta.color === 'transparent'
                                        ? 'rgba(255,255,255,0.5)'
                                        : qualityMeta.color,
                            }}
                        />
                        {!canTap && reticleQuality !== 'none' && (
                            <div style={s.reticleLock}>
                                <div style={s.reticleLockIcon}>⊘</div>
                            </div>
                        )}
                    </div>
                )}

                {/* ── Instruction banner (measuring) ── */}
                {isActive && isMeasuring && tapCount < 4 && (
                    <InstructionBanner
                        step={tapCount}
                        quality={reticleQuality as ReticleQuality}
                        placementIndex={placements.length + 1}
                    />
                )}

                {/* ── Model loading / error banners ── */}
                {isActive && isMeasuring && modelLoading && (
                    <div style={s.modelLoadingBanner}>
                        <div style={s.spinner} /> Loading {selectedModel.name}…
                    </div>
                )}
                {isActive && isMeasuring && modelError && (
                    <div style={s.errorBanner}>{modelError}</div>
                )}

                {/* ── Gesture hint (after first placement) ── */}
                {showHint && (
                    <GestureHint onDismiss={() => setHintDismissed(true)} />
                )}

                {/* ── Placements panel (review mode) ── */}
                {uiState === 'panel' && placements.length > 0 && (
                    <PlacementsPanel
                        placements={placements}
                        onDelete={handleDeletePlacement}
                        onSwap={(uid) => setSwapTarget(uid)}
                        onAddMore={() => setUiState('addMore')}
                        onConfirmAll={handleConfirmAll}
                    />
                )}

                {/* ── Add-more sheet ── */}
                {uiState === 'addMore' && (
                    <AddMoreSheet
                        onStart={handleAddMoreStart}
                        onClose={() => setUiState('panel')}
                    />
                )}

                {/* ── Swap sheet ── */}
                {swapTarget &&
                    (() => {
                        const target = placements.find(
                            (p) => p.uid === swapTarget,
                        );
                        if (!target) return null;
                        return (
                            <SwapSheet
                                targetUid={swapTarget}
                                current={target.model}
                                onSelect={(uid, m) => {
                                    handleSwapModel(uid, m);
                                    setSwapTarget(null);
                                }}
                                onClose={() => setSwapTarget(null)}
                            />
                        );
                    })()}

                {/* ── General error ── */}
                {error && <div style={s.errorBanner}>{error}</div>}

                {/* ── Start screen ── */}
                {!isActive && uiState === 'idle' && !error && (
                    <div style={s.startWrap}>
                        <div style={s.startBrand}>
                            <div style={s.logoMark}>G</div>
                            <div>
                                <div style={s.startBrandName}>
                                    Glass
                                    <span style={{ color: '#1a56db' }}>
                                        Viz
                                    </span>
                                </div>
                                <div style={s.startBrandSub}>
                                    AR Measurement
                                </div>
                            </div>
                        </div>
                        <div style={s.startDivider} />
                        <h1 style={s.startTitle}>Measure Multiple Openings</h1>
                        <p style={s.startText}>
                            Pick a product, tap 4 corners of the opening and see
                            it appear in AR immediately. Keep adding more — all
                            windows and doors visible together in one session.
                        </p>
                        <div style={s.startSteps}>
                            {[
                                'Choose product',
                                'Tap 4 corners',
                                'See in AR',
                                'Add more or finish',
                            ].map((label, i) => (
                                <div key={label} style={s.startStep}>
                                    <div style={s.startStepNum}>{i + 1}</div>
                                    <div style={s.startStepLabel}>{label}</div>
                                </div>
                            ))}
                        </div>
                        <ModelSelector
                            selected={selectedModel}
                            onSelect={setSelectedModel}
                        />
                        <button style={s.btnPrimary} onClick={handleStart}>
                            Start AR — place {selectedModel.name}
                        </button>
                        <button style={s.btnOutline} onClick={handleManual}>
                            Enter measurements manually
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const FONT = "'DM Sans', sans-serif";

const s: Record<string, React.CSSProperties> = {
    root: {
        position: 'relative',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        background: '#000',
        fontFamily: FONT,
    },
    canvas: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 1,
    },
    gestureLayer: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 5,
    },
    overlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        fontFamily: FONT,
        zIndex: 10,
    },

    // ── loading ──────────────────────────────────────────────────────────────
    loadingWrap: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: '#f0f4ff',
        gap: 20,
        fontFamily: FONT,
    },
    loadingSpinner: {
        width: 36,
        height: 36,
        border: '3px solid rgba(26,86,219,0.15)',
        borderTopColor: '#1a56db',
        borderRadius: '50%',
        animation: 'spin 0.9s linear infinite',
    },
    loadingText: { fontSize: 15, color: '#64748b', fontWeight: 500 },

    // ── brand ─────────────────────────────────────────────────────────────────
    logoRow: { display: 'flex', alignItems: 'center', gap: 10 },
    logoMark: {
        width: 36,
        height: 36,
        borderRadius: 10,
        background: 'linear-gradient(135deg,#1a56db,#3b82f6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontWeight: 900,
        fontSize: 18,
    },
    logoText: {
        fontWeight: 700,
        fontSize: 20,
        color: '#1e293b',
        fontFamily: FONT,
    },

    // ── unsupported ──────────────────────────────────────────────────────────
    unsupportedWrap: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: '#f0f4ff',
        padding: '32px 24px',
        gap: 20,
        fontFamily: FONT,
    },
    unsupportedCard: {
        background: '#fff',
        borderRadius: 24,
        padding: '32px 24px',
        border: '1px solid rgba(26,86,219,0.1)',
        boxShadow: '0 8px 32px rgba(26,86,219,0.08)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
        maxWidth: 340,
        width: '100%',
        textAlign: 'center',
    },
    unsupportedIcon: { fontSize: 44 },
    unsupportedTitle: {
        fontSize: 20,
        fontWeight: 700,
        color: '#1e293b',
        margin: 0,
    },
    unsupportedText: {
        fontSize: 14,
        color: '#64748b',
        lineHeight: 1.6,
        margin: 0,
    },

    // ── top bar ───────────────────────────────────────────────────────────────
    topBar: {
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 18px',
        pointerEvents: 'auto',
    },
    closeBtn: {
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        background: 'rgba(255,255,255,0.15)',
        backdropFilter: 'blur(12px)',
        color: '#fff',
        border: '1px solid rgba(255,255,255,0.25)',
        borderRadius: 10,
        padding: '8px 14px',
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
        fontFamily: FONT,
    },
    closeBtnX: { fontSize: 12, opacity: 0.7 },
    topBarRight: { display: 'flex', alignItems: 'center', gap: 8 },
    selectedBadge: {
        background: 'rgba(26,86,219,0.2)',
        backdropFilter: 'blur(8px)',
        color: '#fff',
        border: '1px solid rgba(59,130,246,0.4)',
        borderRadius: 20,
        padding: '5px 12px',
        fontSize: 11,
        fontWeight: 600,
    },
    countBadge: {
        background: 'rgba(16,185,129,0.2)',
        backdropFilter: 'blur(8px)',
        color: '#10b981',
        border: '1px solid rgba(16,185,129,0.4)',
        borderRadius: 20,
        padding: '5px 12px',
        fontSize: 11,
        fontWeight: 700,
    },
    qualityBadge: {
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        padding: '5px 11px',
        borderRadius: 20,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 0.3,
        transition: 'all 0.3s ease',
        backdropFilter: 'blur(8px)',
    },
    qualityDot: { width: 6, height: 6, borderRadius: '50%' },
    stepRow: { display: 'flex', gap: 7, alignItems: 'center' },
    stepDot: {
        width: 8,
        height: 8,
        borderRadius: '50%',
        transition: 'all 0.25s ease',
    },

    // ── reticle ───────────────────────────────────────────────────────────────
    reticleGuide: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%,-50%)',
        pointerEvents: 'none',
        width: 58,
        height: 58,
    },
    reticleRing: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%,-50%)',
        width: 54,
        height: 54,
        borderRadius: '50%',
        border: '2.5px solid',
        transition: 'border-color 0.25s, box-shadow 0.25s',
    },
    reticleDot: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%,-50%)',
        width: 6,
        height: 6,
        borderRadius: '50%',
        transition: 'background 0.25s',
    },
    reticleLock: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%,-50%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    reticleLockIcon: {
        fontSize: 18,
        color: 'rgba(255,255,255,0.45)',
        lineHeight: 1,
    },

    // ── instruction banner ────────────────────────────────────────────────────
    banner: {
        position: 'absolute',
        bottom: 200,
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(15,23,42,0.85)',
        backdropFilter: 'blur(16px)',
        borderRadius: 18,
        padding: '18px 26px',
        textAlign: 'center',
        minWidth: 280,
        border: '1px solid',
        pointerEvents: 'none',
        transition: 'border-color 0.3s ease',
    },
    bannerPill: {
        display: 'inline-block',
        padding: '3px 10px',
        borderRadius: 20,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 2,
        color: '#fff',
        transition: 'background 0.3s',
    },
    placementPill: {
        display: 'inline-block',
        padding: '3px 10px',
        borderRadius: 20,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 1,
        color: '#10b981',
        background: 'rgba(16,185,129,0.15)',
        border: '1px solid rgba(16,185,129,0.3)',
    },
    bannerLabel: {
        fontSize: 17,
        fontWeight: 700,
        color: '#f1f5f9',
        marginBottom: 10,
    },
    qualityRow: {
        display: 'flex',
        gap: 4,
        justifyContent: 'center',
        marginBottom: 8,
    },
    qualityBar: {
        width: 34,
        height: 3,
        borderRadius: 2,
        transition: 'background 0.3s ease',
    },
    bannerHint: {
        fontSize: 13,
        lineHeight: 1.4,
        transition: 'color 0.3s ease',
    },

    // ── loading banner ────────────────────────────────────────────────────────
    modelLoadingBanner: {
        position: 'absolute',
        bottom: 160,
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(15,23,42,0.8)',
        backdropFilter: 'blur(12px)',
        color: 'rgba(255,255,255,0.8)',
        borderRadius: 12,
        padding: '10px 18px',
        fontSize: 13,
        fontWeight: 500,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        pointerEvents: 'none',
    },

    // ── gesture hint ──────────────────────────────────────────────────────────
    gestureHint: {
        position: 'absolute',
        bottom: 310,
        left: 20,
        right: 20,
        zIndex: 100,
        background: 'rgba(15,23,42,0.94)',
        backdropFilter: 'blur(20px)',
        borderRadius: 20,
        padding: '18px 22px',
        border: '1px solid rgba(59,130,246,0.35)',
        pointerEvents: 'auto',
        animation: 'fadeIn 0.3s ease',
    },
    gestureTitle: {
        color: '#3b82f6',
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 1.8,
        textTransform: 'uppercase',
        marginBottom: 12,
        textAlign: 'center',
    },
    gestureRows: {
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        marginBottom: 14,
    },
    gestureRow: { display: 'flex', alignItems: 'center', gap: 10 },
    gi: { fontSize: 18, width: 24, textAlign: 'center', flexShrink: 0 },
    gt: { fontSize: 13, color: 'rgba(241,245,249,0.75)' },
    gestureOk: {
        width: '100%',
        padding: '11px',
        background: 'linear-gradient(135deg,#1a56db,#3b82f6)',
        color: '#fff',
        border: 'none',
        borderRadius: 12,
        fontSize: 14,
        fontWeight: 700,
        cursor: 'pointer',
        fontFamily: FONT,
    },

    // ── placements panel ──────────────────────────────────────────────────────
    placementsPanel: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'rgba(255,255,255,0.97)',
        backdropFilter: 'blur(24px)',
        borderRadius: '24px 24px 0 0',
        padding: '0 20px 44px',
        boxShadow: '0 -8px 40px rgba(15,23,42,0.2)',
        pointerEvents: 'auto',
        animation: 'slideUp 0.3s ease',
        maxHeight: '60vh',
        overflowY: 'auto',
        zIndex: 60,
    },
    panelHandle: {
        width: 36,
        height: 4,
        borderRadius: 2,
        background: '#e2e8f0',
        margin: '12px auto 16px',
    },
    panelHeader: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 14,
    },
    panelTitle: { fontSize: 16, fontWeight: 700, color: '#1e293b' },
    panelSub: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
    addMoreBtn: {
        background: 'rgba(26,86,219,0.08)',
        color: '#1a56db',
        border: '1px solid rgba(26,86,219,0.2)',
        borderRadius: 10,
        padding: '8px 14px',
        fontSize: 13,
        fontWeight: 700,
        cursor: 'pointer',
        fontFamily: FONT,
    },

    // ── placement list rows ───────────────────────────────────────────────────
    placementList: {
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        marginBottom: 16,
    },
    placementRow: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        background: '#f8fafc',
        borderRadius: 12,
        padding: '10px 12px',
        border: '1px solid #e2e8f0',
    },
    placementIdx: {
        width: 26,
        height: 26,
        borderRadius: 8,
        background: 'linear-gradient(135deg,#1a56db,#3b82f6)',
        color: '#fff',
        fontSize: 11,
        fontWeight: 800,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    placementInfo: { flex: 1 },
    placementName: { fontSize: 13, fontWeight: 600, color: '#1e293b' },
    placementDims: { fontSize: 11, color: '#94a3b8', marginTop: 1 },
    placementActions: { display: 'flex', gap: 6 },
    rowIconBtn: {
        width: 32,
        height: 32,
        borderRadius: 8,
        background: '#fff',
        border: '1px solid #e2e8f0',
        color: '#64748b',
        fontSize: 14,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: FONT,
    },
    rowIconBtnDanger: {
        color: '#ef4444',
        borderColor: 'rgba(239,68,68,0.2)',
        background: 'rgba(239,68,68,0.04)',
    },

    // ── model selector ────────────────────────────────────────────────────────
    selectorWrap: { width: '100%', marginBottom: 6 },
    selectorTitle: {
        fontSize: 11,
        fontWeight: 700,
        color: '#94a3b8',
        letterSpacing: 1.5,
        textTransform: 'uppercase',
        marginBottom: 10,
    },
    selectorRow: {
        display: 'flex',
        gap: 10,
        overflowX: 'auto',
        paddingBottom: 4,
    },
    modelCard: {
        flexShrink: 0,
        width: 110,
        borderRadius: 16,
        padding: '10px 8px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        pointerEvents: 'auto',
        position: 'relative',
        border: '1.5px solid',
    },
    thumbWrap: {
        width: 86,
        height: 86,
        borderRadius: 10,
        overflow: 'hidden',
        background: '#f1f5f9',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    typePill: {
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        padding: '2px 8px',
        borderRadius: 20,
    },
    modelName: {
        fontSize: 12,
        fontWeight: 600,
        textAlign: 'center',
        transition: 'color 0.2s',
    },
    selectedMark: {
        position: 'absolute',
        top: 6,
        right: 8,
        fontSize: 11,
        color: '#1a56db',
        fontWeight: 800,
    },

    // ── buttons ───────────────────────────────────────────────────────────────
    btnPrimary: {
        flex: 1,
        padding: '14px 12px',
        background: 'linear-gradient(135deg,#1a56db,#3b82f6)',
        color: '#fff',
        border: 'none',
        borderRadius: 12,
        fontSize: 14,
        fontWeight: 700,
        cursor: 'pointer',
        fontFamily: FONT,
        letterSpacing: 0.2,
        boxShadow: '0 4px 16px rgba(26,86,219,0.3)',
    },
    btnOutline: {
        padding: '14px 20px',
        background: 'transparent',
        color: '#64748b',
        border: '1px solid #cbd5e1',
        borderRadius: 12,
        fontSize: 14,
        cursor: 'pointer',
        width: '100%',
        fontFamily: FONT,
    },

    // ── swap / add-more sheets ────────────────────────────────────────────────
    swapSheetBg: {
        position: 'absolute',
        inset: 0,
        background: 'rgba(15,23,42,0.55)',
        backdropFilter: 'blur(4px)',
        zIndex: 200,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        pointerEvents: 'auto',
    },
    swapSheet: {
        background: '#fff',
        borderRadius: '24px 24px 0 0',
        padding: '8px 20px 44px',
        boxShadow: '0 -8px 40px rgba(15,23,42,0.15)',
        animation: 'slideUp 0.25s ease',
        maxHeight: '85vh',
        overflowY: 'auto',
    },
    swapSheetHandle: {
        width: 36,
        height: 4,
        borderRadius: 2,
        background: '#e2e8f0',
        margin: '12px auto 16px',
    },
    swapSheetTitle: {
        color: '#1e293b',
        fontSize: 17,
        fontWeight: 700,
        textAlign: 'center',
        marginBottom: 4,
    },
    swapSheetSub: {
        color: '#94a3b8',
        fontSize: 12,
        textAlign: 'center',
        marginBottom: 16,
    },

    // ── error / status ────────────────────────────────────────────────────────
    errorBanner: {
        position: 'absolute',
        bottom: 36,
        left: 16,
        right: 16,
        background: '#fef2f2',
        border: '1px solid #fecaca',
        borderRadius: 14,
        padding: '14px 18px',
        color: '#dc2626',
        fontSize: 13,
        textAlign: 'center',
        pointerEvents: 'auto',
        fontWeight: 500,
    },
    spinner: {
        width: 13,
        height: 13,
        border: '2px solid rgba(26,86,219,0.15)',
        borderTopColor: '#1a56db',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
    },

    // ── start screen ──────────────────────────────────────────────────────────
    startWrap: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        background: '#fff',
        borderRadius: '26px 26px 0 0',
        padding: '0 20px 44px',
        pointerEvents: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        maxHeight: '88vh',
        overflowY: 'auto',
        boxShadow: '0 -8px 40px rgba(15,23,42,0.12)',
    },
    startBrand: {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        paddingTop: 24,
    },
    startBrandName: {
        fontSize: 18,
        fontWeight: 700,
        color: '#1e293b',
        lineHeight: 1,
    },
    startBrandSub: {
        fontSize: 11,
        color: '#94a3b8',
        marginTop: 2,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    startDivider: { height: 1, background: '#f1f5f9', margin: '0 -20px' },
    startTitle: {
        fontSize: 22,
        fontWeight: 800,
        color: '#1e293b',
        margin: 0,
        lineHeight: 1.2,
    },
    startText: { fontSize: 14, color: '#64748b', lineHeight: 1.6, margin: 0 },
    startSteps: {
        display: 'flex',
        gap: 8,
        overflowX: 'auto',
        paddingBottom: 2,
    },
    startStep: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        flexShrink: 0,
        background: '#f8faff',
        borderRadius: 12,
        padding: '10px 12px',
        border: '1px solid rgba(26,86,219,0.1)',
        minWidth: 78,
    },
    startStepNum: {
        width: 26,
        height: 26,
        borderRadius: 8,
        background: 'linear-gradient(135deg,#1a56db,#3b82f6)',
        color: '#fff',
        fontSize: 12,
        fontWeight: 800,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    startStepLabel: {
        fontSize: 10,
        fontWeight: 600,
        color: '#475569',
        textAlign: 'center',
        lineHeight: 1.3,
    },
};
