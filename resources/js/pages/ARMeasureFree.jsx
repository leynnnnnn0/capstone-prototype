import { useEffect, useRef, useState } from 'react';
import { router } from '@inertiajs/react';
import { useWebXRFree } from '../hooks/useWebXRFree';

// ── product catalog ───────────────────────────────────────────────────────────
// taps  = exact number of corners required for this shape
// shape = label shown in the tap diagram
// corners = description of which corner is which (shown as instructions)
const MODELS = [
    {
        id: 'window1',
        name: 'Window 1',
        type: 'window',
        file: '/models/window.glb',
        taps: 4,
        shape: 'rectangle',
        corners: ['Top-left', 'Top-right', 'Bottom-left', 'Bottom-right'],
        shapeDesc: 'Standard 4-corner rectangle',
    },
    {
        id: 'window2',
        name: 'Window 2',
        type: 'window',
        file: '/models/window2.glb',
        taps: 4,
        shape: 'rectangle',
        corners: ['Top-left', 'Top-right', 'Bottom-left', 'Bottom-right'],
        shapeDesc: 'Standard 4-corner rectangle',
    },
    {
        id: 'door1',
        name: 'Door 1',
        type: 'door',
        file: '/models/door1.glb',
        taps: 4,
        shape: 'rectangle',
        corners: ['Top-left', 'Top-right', 'Bottom-left', 'Bottom-right'],
        shapeDesc: 'Standard 4-corner rectangle',
    },
    {
        id: 'door2',
        name: 'Door 2',
        type: 'door',
        file: '/models/door2.glb',
        taps: 4,
        shape: 'rectangle',
        corners: ['Top-left', 'Top-right', 'Bottom-left', 'Bottom-right'],
        shapeDesc: 'Standard 4-corner rectangle',
    },
    {
        id: 'cabinet1',
        name: 'L-Cabinet 1',
        type: 'cabinet',
        file: '/models/cabinet_l.glb',
        taps: 6,
        shape: 'l-shape',
        corners: [
            'Top-left',
            'Top-middle',
            'Inner corner',
            'Top-right',
            'Bottom-right',
            'Bottom-left',
        ],
        shapeDesc: 'L-shape — 6 corners',
    },
    {
        id: 'cabinet2',
        name: 'L-Cabinet 2',
        type: 'cabinet',
        file: '/models/cabinet_l2.glb',
        taps: 6,
        shape: 'l-shape',
        corners: [
            'Top-left',
            'Top-middle',
            'Inner corner',
            'Top-right',
            'Bottom-right',
            'Bottom-left',
        ],
        shapeDesc: 'L-shape — 6 corners',
    },
    {
        id: 'cabinet3',
        name: 'L-Cabinet 3',
        type: 'cabinet',
        file: '/models/cabinet_l3.glb',
        taps: 6,
        shape: 'l-shape',
        corners: [
            'Top-left',
            'Top-middle',
            'Inner corner',
            'Top-right',
            'Bottom-right',
            'Bottom-left',
        ],
        shapeDesc: 'L-shape — 6 corners',
    },
];

const QUALITY_META = {
    none: {
        color: 'transparent',
        label: '',
        hint: 'Searching for surface…',
        canTap: false,
    },
    poor: {
        color: '#ff2d2d',
        label: 'Poor',
        hint: 'Move slowly — finding surface',
        canTap: false,
    },
    okay: {
        color: '#ff8c00',
        label: 'Okay',
        hint: 'Almost ready — keep still',
        canTap: false,
    },
    good: {
        color: '#ffe600',
        label: 'Good',
        hint: 'Tap the corner',
        canTap: true,
    },
    perfect: {
        color: '#00ff88',
        label: 'Perfect',
        hint: 'Tap the corner',
        canTap: true,
    },
};

const TYPE_COLOR = {
    window: {
        bg: 'rgba(0,200,255,0.12)',
        text: '#00ccff',
        border: '#00ccff33',
    },
    door: { bg: 'rgba(255,160,0,0.12)', text: '#ffa000', border: '#ffa00033' },
    cabinet: {
        bg: 'rgba(180,100,255,0.12)',
        text: '#b464ff',
        border: '#b464ff33',
    },
};

// ── ShapeDiagram ──────────────────────────────────────────────────────────────
// SVG diagram showing the shape and numbered tap points
function ShapeDiagram({ shape, taps }) {
    if (shape === 'rectangle') {
        return (
            <svg viewBox="0 0 200 130" style={{ width: '100%', maxWidth: 220 }}>
                <rect
                    x="20"
                    y="20"
                    width="160"
                    height="90"
                    fill="none"
                    stroke="rgba(0,255,136,0.4)"
                    strokeWidth="1.5"
                    strokeDasharray="6,3"
                    rx="2"
                />
                {[
                    ['1', 'TL', 20, 20],
                    ['2', 'TR', 180, 20],
                    ['3', 'BL', 20, 110],
                    ['4', 'BR', 180, 110],
                ].map(([n, _, cx, cy]) => (
                    <g key={n}>
                        <circle
                            cx={cx}
                            cy={cy}
                            r="9"
                            fill="#00ff88"
                            opacity="0.9"
                        />
                        <text
                            x={cx}
                            y={cy + 1}
                            textAnchor="middle"
                            dominantBaseline="central"
                            fontSize="10"
                            fontWeight="700"
                            fill="#000"
                        >
                            {n}
                        </text>
                    </g>
                ))}
                <text
                    x="100"
                    y="68"
                    textAnchor="middle"
                    fontSize="11"
                    fill="rgba(255,255,255,0.35)"
                >
                    4 corners
                </text>
            </svg>
        );
    }
    if (shape === 'l-shape') {
        // L-shape: full-width top, then drops down on the right
        return (
            <svg viewBox="0 0 220 160" style={{ width: '100%', maxWidth: 240 }}>
                <polyline
                    points="20,20 130,20 130,80 200,80 200,140 20,140 20,20"
                    fill="none"
                    stroke="rgba(0,255,136,0.4)"
                    strokeWidth="1.5"
                    strokeDasharray="6,3"
                />
                {[
                    ['1', 20, 20],
                    ['2', 130, 20],
                    ['3', 130, 80],
                    ['4', 200, 80],
                    ['5', 200, 140],
                    ['6', 20, 140],
                ].map(([n, cx, cy]) => (
                    <g key={n}>
                        <circle
                            cx={cx}
                            cy={cy}
                            r="10"
                            fill="#00ff88"
                            opacity="0.9"
                        />
                        <text
                            x={cx}
                            y={cy + 1}
                            textAnchor="middle"
                            dominantBaseline="central"
                            fontSize="10"
                            fontWeight="700"
                            fill="#000"
                        >
                            {n}
                        </text>
                    </g>
                ))}
                <text
                    x="80"
                    y="95"
                    textAnchor="middle"
                    fontSize="11"
                    fill="rgba(255,255,255,0.35)"
                >
                    6 corners
                </text>
            </svg>
        );
    }
    return null;
}

// ── ModelThumb ────────────────────────────────────────────────────────────────
function ModelThumb({ file, size = 90 }) {
    const canvasRef = useRef(null);
    const rafRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        let renderer,
            alive = true,
            model;

        async function init() {
            const THREE = await import('three');
            renderer = new THREE.WebGLRenderer({
                canvas,
                alpha: true,
                antialias: true,
            });
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            renderer.setSize(size, size);
            const scene = new THREE.Scene();
            const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 100);
            camera.position.set(0, 0.3, 2.8);
            scene.add(new THREE.AmbientLight(0xffffff, 1.2));
            const d = new THREE.DirectionalLight(0xffffff, 0.8);
            d.position.set(1, 2, 2);
            scene.add(d);
            const b = new THREE.DirectionalLight(0x88aaff, 0.3);
            b.position.set(-1, -1, -2);
            scene.add(b);
            try {
                const { GLTFLoader } =
                    await import('three/examples/jsm/loaders/GLTFLoader.js');
                const gltf = await new Promise((res, rej) =>
                    new GLTFLoader().load(file, res, undefined, rej),
                );
                model = gltf.scene;
                const box = new THREE.Box3().setFromObject(model);
                const sz = new THREE.Vector3();
                const ctr = new THREE.Vector3();
                box.getSize(sz);
                box.getCenter(ctr);
                const sc = 1.8 / Math.max(sz.x, sz.y, sz.z);
                model.scale.setScalar(sc);
                model.position.sub(ctr.multiplyScalar(sc));
                scene.add(model);
            } catch (_) {
                model = new THREE.Mesh(
                    new THREE.BoxGeometry(1, 0.6, 0.1),
                    new THREE.MeshStandardMaterial({ color: 0x334455 }),
                );
                scene.add(model);
            }
            const animate = () => {
                if (!alive) return;
                rafRef.current = requestAnimationFrame(animate);
                if (model) model.rotation.y += 0.008;
                renderer.render(scene, camera);
            };
            animate();
        }
        init();
        return () => {
            alive = false;
            cancelAnimationFrame(rafRef.current);
            renderer?.dispose();
        };
    }, [file]);

    return (
        <canvas
            ref={canvasRef}
            width={size}
            height={size}
            style={{ display: 'block', borderRadius: 8 }}
        />
    );
}

// ── Step 1: ProductPickerScreen ───────────────────────────────────────────────
// User scrolls through product cards and taps one to select it.
// Tapping "Next →" advances to Step 2.
function ProductPickerScreen({ selected, onSelect, onNext }) {
    return (
        <div style={s.startWrap}>
            <div style={s.stepHeader}>
                <div style={s.stepPill}>Step 1 of 2</div>
                <h1 style={s.startTitle}>Choose a product</h1>
                <p style={s.startText}>Select what you want to place in AR.</p>
            </div>

            {/* product grid */}
            <div style={s.productGrid}>
                {MODELS.map((m) => {
                    const isSelected = selected?.id === m.id;
                    const tc = TYPE_COLOR[m.type] || TYPE_COLOR.window;
                    return (
                        <button
                            key={m.id}
                            style={{
                                ...s.productCard,
                                borderColor: isSelected
                                    ? '#00ff88'
                                    : 'rgba(255,255,255,0.1)',
                                background: isSelected
                                    ? 'rgba(0,255,136,0.07)'
                                    : 'rgba(255,255,255,0.03)',
                            }}
                            onClick={() => onSelect(m)}
                        >
                            {isSelected && <div style={s.productCheck}>✓</div>}
                            <div style={s.productThumb}>
                                <ModelThumb file={m.file} size={80} />
                            </div>
                            <div
                                style={{
                                    ...s.productTypePill,
                                    background: tc.bg,
                                    color: tc.text,
                                    border: `1px solid ${tc.border}`,
                                }}
                            >
                                {m.type}
                            </div>
                            <div
                                style={{
                                    ...s.productName,
                                    color: isSelected ? '#00ff88' : '#fff',
                                }}
                            >
                                {m.name}
                            </div>
                            <div style={s.productTapBadge}>{m.taps} taps</div>
                        </button>
                    );
                })}
            </div>

            <button
                style={{ ...s.btnPrimary, opacity: selected ? 1 : 0.4 }}
                disabled={!selected}
                onClick={onNext}
            >
                Next — see tap guide →
            </button>
        </div>
    );
}

// ── Step 2: TapGuideScreen ────────────────────────────────────────────────────
// Shows the shape diagram, numbered corner list, and the Start AR button.
function TapGuideScreen({ model, onBack, onStart }) {
    return (
        <div style={s.startWrap}>
            <div style={s.stepHeader}>
                <div style={s.stepPill}>Step 2 of 2</div>
                <h1 style={s.startTitle}>{model.name}</h1>
                <p style={s.startText}>{model.shapeDesc}</p>
            </div>

            {/* shape diagram */}
            <div style={s.diagramWrap}>
                <ShapeDiagram shape={model.shape} taps={model.taps} />
            </div>

            {/* numbered corner list */}
            <div style={s.cornerList}>
                <div style={s.cornerListTitle}>Tap order</div>
                {model.corners.map((label, i) => (
                    <div key={i} style={s.cornerRow}>
                        <div style={s.cornerNum}>{i + 1}</div>
                        <div style={s.cornerLabel}>{label}</div>
                    </div>
                ))}
            </div>

            <button style={s.btnPrimary} onClick={onStart}>
                Start AR — {model.taps} taps
            </button>
            <button style={s.btnGhost} onClick={onBack}>
                ← Back to products
            </button>
        </div>
    );
}

// ── QualityBadge ──────────────────────────────────────────────────────────────
function QualityBadge({ quality }) {
    const meta = QUALITY_META[quality] || QUALITY_META.none;
    if (quality === 'none') return null;
    return (
        <div
            style={{
                ...s.qualityBadge,
                background: meta.color + '22',
                border: `1px solid ${meta.color}`,
                color: meta.color,
            }}
        >
            <div style={{ ...s.qualityDot, background: meta.color }} />
            {meta.label}
        </div>
    );
}

// ── TapProgress ───────────────────────────────────────────────────────────────
// Bottom bar shown during tapping — shows progress and current corner name
function TapProgress({
    tapCount,
    requiredTaps,
    corners,
    canUndo,
    onUndo,
    quality,
}) {
    const meta = QUALITY_META[quality] || QUALITY_META.none;
    const canTap = meta.canTap;
    const currentCorner = corners[tapCount] || null;
    const progress = Math.min(tapCount / requiredTaps, 1);

    return (
        <div style={s.tapBar}>
            {/* progress track */}
            <div style={s.progressTrack}>
                <div
                    style={{ ...s.progressFill, width: `${progress * 100}%` }}
                />
            </div>

            <div style={s.tapBarInner}>
                {/* undo */}
                <button
                    style={{ ...s.undoBtn, opacity: canUndo ? 1 : 0.3 }}
                    onClick={onUndo}
                    disabled={!canUndo}
                >
                    ↩
                </button>

                {/* center info */}
                <div style={s.tapBarCenter}>
                    <div style={s.tapBarCount}>
                        <span style={s.tapBarNum}>{tapCount}</span>
                        <span style={s.tapBarOf}> / {requiredTaps}</span>
                    </div>
                    {currentCorner && canTap && (
                        <div style={s.tapBarCorner}>{currentCorner}</div>
                    )}
                    {!canTap && quality !== 'none' && (
                        <div style={{ ...s.tapBarCorner, color: meta.color }}>
                            {meta.hint}
                        </div>
                    )}
                    {quality === 'none' && (
                        <div style={{ ...s.tapBarCorner, color: '#666' }}>
                            Point camera at surface
                        </div>
                    )}
                </div>

                {/* quality indicator */}
                <div
                    style={{
                        ...s.tapBarQuality,
                        color:
                            meta.color === 'transparent' ? '#444' : meta.color,
                    }}
                >
                    {meta.label || '—'}
                </div>
            </div>
        </div>
    );
}

// ── ResultCard ────────────────────────────────────────────────────────────────
function ResultCard({
    dimensions,
    model,
    tapCount,
    onConfirm,
    onReset,
    onResetPos,
    modelLoading,
    modelError,
    modelPlaced,
}) {
    if (!dimensions?.widthCm || !dimensions?.heightCm) return null;
    return (
        <div style={s.resultCard}>
            {modelLoading && (
                <div style={s.modelStatus}>
                    <div style={s.spinner} />
                    Loading model…
                </div>
            )}
            {modelError && <div style={s.modelStatusError}>{modelError}</div>}
            <div style={s.resultTitle}>Measured</div>
            <div style={s.resultDims}>
                <div style={s.dimBox}>
                    <span style={s.dimValue}>{dimensions.widthCm}</span>
                    <span style={s.dimUnit}>cm wide</span>
                </div>
                <div style={s.dimSep}>×</div>
                <div style={s.dimBox}>
                    <span style={s.dimValue}>{dimensions.heightCm}</span>
                    <span style={s.dimUnit}>cm tall</span>
                </div>
            </div>
            {modelPlaced && model && (
                <div style={s.placedModel}>
                    Showing: <strong>{model.name}</strong>
                </div>
            )}
            <div style={s.resultButtons}>
                <button style={s.btnSecondary} onClick={onReset}>
                    Re-measure
                </button>
                {modelPlaced && (
                    <button style={s.btnSecondary} onClick={onResetPos}>
                        ↺ Reset
                    </button>
                )}
                <button style={s.btnPrimary} onClick={onConfirm}>
                    Find products
                </button>
            </div>
        </div>
    );
}

function GestureHint({ onDismiss }) {
    useEffect(() => {
        const t = setTimeout(onDismiss, 5000);
        return () => clearTimeout(t);
    }, []);
    return (
        <div style={s.gestureHint}>
            <div style={s.gestureTitle}>Adjust the model</div>
            <div style={s.gestureRows}>
                <div style={s.gestureRow}>
                    <span style={s.gi}>☝</span>
                    <span style={s.gt}>1 finger drag — move</span>
                </div>
                <div style={s.gestureRow}>
                    <span style={s.gi}>✌</span>
                    <span style={s.gt}>
                        2 finger drag up/down — push / pull
                    </span>
                </div>
            </div>
            <button style={s.gestureOk} onClick={onDismiss}>
                Got it
            </button>
        </div>
    );
}

function UnsupportedCard({ onBack }) {
    return (
        <div style={s.unsupportedWrap}>
            <div style={s.unsupportedIcon}>⚠</div>
            <h2 style={s.unsupportedTitle}>AR not available</h2>
            <p style={s.unsupportedText}>
                WebXR AR requires <strong>Android Chrome</strong>.
            </p>
            <button style={s.btnPrimary} onClick={onBack}>
                Enter measurements manually
            </button>
        </div>
    );
}

// ── main page ─────────────────────────────────────────────────────────────────
export default function ARMeasureFree() {
    const canvasRef = useRef(null);
    const overlayRef = useRef(null);
    const gestureRef = useRef(null);

    const [checked, setChecked] = useState(false);
    const [hintDismissed, setHintDismissed] = useState(false);
    const [selectedModel, setSelectedModel] = useState(null); // null = nothing picked yet
    const [screen, setScreen] = useState('pick'); // 'pick' | 'guide' | 'ar'

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
        canConfirm,
        checkSupport,
        startAR,
        stopAR,
        reset,
        resetModelTransform,
        setSelectedModel: setHookModel,
        setRequiredTaps,
        handleUndo,
        handleConfirm: confirmAndPlace,
    } = useWebXRFree();

    useEffect(() => {
        checkSupport().then(() => setChecked(true));
    }, []);
    useEffect(() => {
        if (modelPlaced) setHintDismissed(false);
    }, [modelPlaced]);

    // sync selected model to hook
    useEffect(() => {
        if (selectedModel) {
            setHookModel(selectedModel.file);
            setRequiredTaps(selectedModel.taps);
        }
    }, [selectedModel]);

    // gesture listeners
    useEffect(() => {
        const el = gestureRef.current;
        if (!el) return;
        let lastX = 0,
            lastY = 0,
            lastMidY = 0,
            intent = null;
        function onStart(e) {
            if (!window.__arModel) return;
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
        function onMove(e) {
            const model = window.__arModel,
                camera = window.__arCamera;
            if (!model || !camera) return;
            e.preventDefault();
            if (intent === 'move' && e.touches.length === 1) {
                const dx = (e.touches[0].clientX - lastX) / window.innerWidth;
                const dy = (e.touches[0].clientY - lastY) / window.innerHeight;
                const m = camera.matrixWorld.elements,
                    S = 2.0;
                model.position.x += dx * m[0] * S - dy * m[4] * S;
                model.position.y += dx * m[1] * S - dy * m[5] * S;
                model.position.z += dx * m[2] * S - dy * m[6] * S;
                lastX = e.touches[0].clientX;
                lastY = e.touches[0].clientY;
            } else if (intent === 'depth' && e.touches.length === 2) {
                const newMid =
                    (e.touches[0].clientY + e.touches[1].clientY) / 2;
                const dy = (newMid - lastMidY) / window.innerHeight;
                const m = camera.matrixWorld.elements,
                    S = 1.5;
                model.position.x += dy * -m[8] * S;
                model.position.y += dy * -m[9] * S;
                model.position.z += dy * -m[10] * S;
                lastMidY = newMid;
            }
        }
        function onEnd(e) {
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
    }, []);

    const handlePickSelect = (m) => setSelectedModel(m);
    const handlePickNext = () => setScreen('guide');
    const handleGuideBack = () => setScreen('pick');
    const handleGuideStart = () => {
        setScreen('ar');
        startAR(canvasRef.current, overlayRef.current);
    };
    const handleStopAR = () => {
        stopAR();
        setScreen('pick');
    };
    const handleReset = () => {
        setHintDismissed(false);
        reset();
        // stay in AR, user re-taps corners
    };
    const handleConfirm = () => {
        if (!dimensions) return;
        stopAR();
        router.visit('/products', {
            data: { w: dimensions.widthCm, h: dimensions.heightCm },
        });
    };

    if (!checked) return <div style={s.loading}>Checking AR support…</div>;
    if (isSupported === false)
        return (
            <UnsupportedCard onBack={() => router.visit('/measure/manual')} />
        );

    const qualityMeta = QUALITY_META[reticleQuality] || QUALITY_META.none;
    const canTap = qualityMeta.canTap;
    const showReticle = isActive && !modelPlaced;
    const showHint = modelPlaced && !hintDismissed && !modelLoading;
    const requiredTaps = selectedModel?.taps ?? 4;
    const corners = selectedModel?.corners ?? [];

    return (
        <div style={s.root}>
            <canvas ref={canvasRef} style={s.canvas} />
            <div
                ref={gestureRef}
                style={{
                    ...s.gestureLayer,
                    pointerEvents: modelPlaced ? 'auto' : 'none',
                }}
            />

            <div ref={overlayRef} style={s.overlay}>
                {/* ── step 1: product picker ── */}
                {screen === 'pick' && (
                    <ProductPickerScreen
                        selected={selectedModel}
                        onSelect={handlePickSelect}
                        onNext={handlePickNext}
                    />
                )}

                {/* ── step 2: tap guide ── */}
                {screen === 'guide' && selectedModel && (
                    <TapGuideScreen
                        model={selectedModel}
                        onBack={handleGuideBack}
                        onStart={handleGuideStart}
                    />
                )}

                {/* ── step 3: AR session ── */}
                {screen === 'ar' && (
                    <>
                        {/* top bar */}
                        <div style={s.topBar}>
                            <button style={s.closeBtn} onClick={handleStopAR}>
                                ✕ Exit
                            </button>
                            <div style={s.topBarRight}>
                                {!modelPlaced && (
                                    <div style={s.selectedBadge}>
                                        {selectedModel?.name}
                                    </div>
                                )}
                                <QualityBadge quality={reticleQuality} />
                            </div>
                        </div>

                        {/* reticle */}
                        {showReticle && (
                            <div style={s.reticleGuide}>
                                <div
                                    style={{
                                        ...s.reticleRing,
                                        borderColor:
                                            qualityMeta.color === 'transparent'
                                                ? 'rgba(255,255,255,0.3)'
                                                : qualityMeta.color,
                                        boxShadow: canTap
                                            ? `0 0 12px ${qualityMeta.color}88`
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
                                                ? 'rgba(255,255,255,0.4)'
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

                        <style>{`
                            @keyframes pulse{0%,100%{transform:translate(-50%,-50%) scale(1);opacity:1;}50%{transform:translate(-50%,-50%) scale(1.15);opacity:0.75;}}
                            @keyframes spin{to{transform:rotate(360deg);}}
                            @keyframes fadeIn{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}
                        `}</style>

                        {/* tap progress bar — shown while measuring */}
                        {!modelPlaced && (
                            <TapProgress
                                tapCount={tapCount}
                                requiredTaps={requiredTaps}
                                corners={corners}
                                canUndo={tapCount > 0}
                                onUndo={handleUndo}
                                quality={reticleQuality}
                            />
                        )}

                        {/* gesture hint */}
                        {showHint && (
                            <GestureHint
                                onDismiss={() => setHintDismissed(true)}
                            />
                        )}

                        {/* result card */}
                        {dimensions?.widthCm && dimensions?.heightCm && (
                            <ResultCard
                                dimensions={dimensions}
                                model={selectedModel}
                                tapCount={tapCount}
                                onConfirm={handleConfirm}
                                onReset={handleReset}
                                onResetPos={resetModelTransform}
                                modelLoading={modelLoading}
                                modelError={modelError}
                                modelPlaced={modelPlaced}
                            />
                        )}

                        {error && <div style={s.errorBanner}>{error}</div>}
                    </>
                )}
            </div>
        </div>
    );
}

const s = {
    root: {
        position: 'relative',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        background: '#000',
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
        fontFamily: "'Inter',sans-serif",
        zIndex: 10,
    },
    // start screens
    startWrap: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'rgba(5,5,15,0.97)',
        borderRadius: '24px 24px 0 0',
        padding: '24px 20px 48px',
        pointerEvents: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        maxHeight: '92vh',
        overflowY: 'auto',
    },
    stepHeader: { display: 'flex', flexDirection: 'column', gap: 4 },
    stepPill: {
        display: 'inline-block',
        background: 'rgba(0,255,136,0.12)',
        color: '#00ff88',
        border: '1px solid rgba(0,255,136,0.3)',
        borderRadius: 20,
        padding: '3px 12px',
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 1,
        alignSelf: 'flex-start',
    },
    startTitle: { fontSize: 22, fontWeight: 700, color: '#fff', margin: 0 },
    startText: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.5)',
        margin: 0,
        lineHeight: 1.5,
    },
    // product grid (2 columns)
    productGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
    productCard: {
        background: 'rgba(255,255,255,0.03)',
        border: '1.5px solid',
        borderRadius: 14,
        padding: '12px 10px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        cursor: 'pointer',
        transition: 'all 0.2s',
        position: 'relative',
    },
    productCheck: {
        position: 'absolute',
        top: 8,
        right: 10,
        fontSize: 14,
        color: '#00ff88',
        fontWeight: 700,
    },
    productThumb: {
        width: 80,
        height: 80,
        borderRadius: 8,
        overflow: 'hidden',
        background: 'rgba(255,255,255,0.03)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    productTypePill: {
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 1,
        textTransform: 'uppercase',
        padding: '2px 8px',
        borderRadius: 20,
    },
    productName: { fontSize: 13, fontWeight: 600, textAlign: 'center' },
    productTapBadge: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.35)',
        fontWeight: 500,
    },
    // tap guide
    diagramWrap: {
        display: 'flex',
        justifyContent: 'center',
        padding: '8px 0',
        background: 'rgba(255,255,255,0.03)',
        borderRadius: 12,
    },
    cornerList: { display: 'flex', flexDirection: 'column', gap: 0 },
    cornerListTitle: {
        fontSize: 11,
        fontWeight: 700,
        color: 'rgba(255,255,255,0.4)',
        letterSpacing: 1.5,
        textTransform: 'uppercase',
        marginBottom: 8,
    },
    cornerRow: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 0',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
    },
    cornerNum: {
        width: 24,
        height: 24,
        borderRadius: '50%',
        background: '#00ff88',
        color: '#000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 12,
        fontWeight: 700,
        flexShrink: 0,
    },
    cornerLabel: { fontSize: 14, color: 'rgba(255,255,255,0.8)' },
    // AR top bar
    topBar: {
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 20px',
        pointerEvents: 'auto',
    },
    closeBtn: {
        background: 'rgba(0,0,0,0.55)',
        color: '#fff',
        border: '1px solid rgba(255,255,255,0.2)',
        borderRadius: 8,
        padding: '8px 14px',
        fontSize: 14,
        cursor: 'pointer',
    },
    topBarRight: { display: 'flex', alignItems: 'center', gap: 8 },
    selectedBadge: {
        background: 'rgba(0,0,0,0.6)',
        color: '#00ff88',
        border: '1px solid rgba(0,255,136,0.3)',
        borderRadius: 20,
        padding: '5px 12px',
        fontSize: 12,
        fontWeight: 600,
    },
    qualityBadge: {
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        padding: '5px 10px',
        borderRadius: 20,
        fontSize: 12,
        fontWeight: 600,
    },
    qualityDot: { width: 7, height: 7, borderRadius: '50%' },
    // reticle
    reticleGuide: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%,-50%)',
        pointerEvents: 'none',
        width: 56,
        height: 56,
    },
    reticleRing: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%,-50%)',
        width: 52,
        height: 52,
        borderRadius: '50%',
        border: '2.5px solid',
        transition: 'border-color 0.25s ease, box-shadow 0.25s ease',
    },
    reticleDot: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%,-50%)',
        width: 7,
        height: 7,
        borderRadius: '50%',
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
        color: 'rgba(255,255,255,0.5)',
        lineHeight: 1,
    },
    // tap progress bar
    tapBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'rgba(5,5,15,0.94)',
        backdropFilter: 'blur(16px)',
        borderRadius: '20px 20px 0 0',
        paddingBottom: 32,
        pointerEvents: 'auto',
        zIndex: 50,
    },
    progressTrack: {
        height: 3,
        background: 'rgba(255,255,255,0.08)',
        borderRadius: '20px 20px 0 0',
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        background: '#00ff88',
        borderRadius: 2,
        transition: 'width 0.3s ease',
    },
    tapBarInner: {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px 0',
    },
    undoBtn: {
        padding: '8px 14px',
        background: 'rgba(255,255,255,0.08)',
        color: '#fff',
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: 10,
        fontSize: 16,
        cursor: 'pointer',
        flexShrink: 0,
    },
    tapBarCenter: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
    },
    tapBarCount: { fontSize: 15, fontWeight: 700, color: '#fff' },
    tapBarNum: { fontSize: 22, fontWeight: 700, color: '#00ff88' },
    tapBarOf: { fontSize: 14, color: 'rgba(255,255,255,0.4)' },
    tapBarCorner: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.6)',
        textAlign: 'center',
    },
    tapBarQuality: {
        fontSize: 12,
        fontWeight: 700,
        minWidth: 40,
        textAlign: 'right',
        flexShrink: 0,
    },
    // result card
    resultCard: {
        position: 'absolute',
        bottom: 40,
        left: 20,
        right: 20,
        zIndex: 50,
        background: 'rgba(10,10,20,0.92)',
        backdropFilter: 'blur(20px)',
        borderRadius: 20,
        padding: '20px',
        border: '1px solid rgba(0,255,136,0.3)',
        pointerEvents: 'auto',
    },
    resultTitle: {
        color: '#00ff88',
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: 1.5,
        textTransform: 'uppercase',
        marginBottom: 12,
        textAlign: 'center',
    },
    resultDims: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        marginBottom: 14,
    },
    dimBox: { display: 'flex', flexDirection: 'column', alignItems: 'center' },
    dimValue: { fontSize: 34, fontWeight: 700, color: '#fff', lineHeight: 1 },
    dimUnit: { fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 3 },
    dimSep: { fontSize: 24, color: 'rgba(255,255,255,0.3)' },
    placedModel: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.5)',
        textAlign: 'center',
        marginBottom: 10,
    },
    resultButtons: { display: 'flex', gap: 8 },
    btnPrimary: {
        flex: 1,
        padding: '13px 10px',
        background: '#00ff88',
        color: '#000',
        border: 'none',
        borderRadius: 12,
        fontSize: 14,
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'opacity 0.2s',
    },
    btnSecondary: {
        flex: 0,
        padding: '13px 10px',
        background: 'rgba(255,255,255,0.1)',
        color: '#fff',
        border: '1px solid rgba(255,255,255,0.2)',
        borderRadius: 12,
        fontSize: 13,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
    },
    btnGhost: {
        padding: '13px 20px',
        background: 'transparent',
        color: 'rgba(255,255,255,0.5)',
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: 12,
        fontSize: 14,
        cursor: 'pointer',
        textAlign: 'center',
    },
    // gesture hint
    gestureHint: {
        position: 'absolute',
        bottom: 100,
        left: 20,
        right: 20,
        zIndex: 100,
        background: 'rgba(0,0,0,0.92)',
        backdropFilter: 'blur(16px)',
        borderRadius: 18,
        padding: '18px 22px',
        border: '1px solid rgba(0,255,136,0.4)',
        pointerEvents: 'auto',
        animation: 'fadeIn 0.3s ease',
    },
    gestureTitle: {
        color: '#00ff88',
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: 1.5,
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
    gt: { fontSize: 13, color: 'rgba(255,255,255,0.75)' },
    gestureOk: {
        width: '100%',
        padding: '10px',
        background: '#00ff88',
        color: '#000',
        border: 'none',
        borderRadius: 10,
        fontSize: 14,
        fontWeight: 700,
        cursor: 'pointer',
    },
    // misc
    errorBanner: {
        position: 'absolute',
        bottom: 100,
        left: 20,
        right: 20,
        background: 'rgba(255,60,60,0.9)',
        borderRadius: 12,
        padding: '14px 18px',
        color: '#fff',
        fontSize: 14,
        textAlign: 'center',
        pointerEvents: 'auto',
    },
    loading: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        fontSize: 16,
        color: '#666',
    },
    unsupportedWrap: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '32px 24px',
        gap: 16,
        maxWidth: 400,
        margin: '0 auto',
        textAlign: 'center',
    },
    unsupportedIcon: { fontSize: 48 },
    unsupportedTitle: { fontSize: 22, fontWeight: 700, margin: 0 },
    unsupportedText: {
        fontSize: 15,
        color: '#666',
        lineHeight: 1.6,
        margin: 0,
    },
    modelStatus: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 13,
        color: 'rgba(255,255,255,0.6)',
        marginBottom: 10,
        justifyContent: 'center',
    },
    modelStatusError: {
        fontSize: 12,
        color: '#ff6b6b',
        marginBottom: 10,
        textAlign: 'center',
    },
    spinner: {
        width: 14,
        height: 14,
        border: '2px solid rgba(255,255,255,0.2)',
        borderTopColor: '#00ff88',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
    },
};
