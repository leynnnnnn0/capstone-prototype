import { useEffect, useRef, useState } from 'react';
import { router } from '@inertiajs/react';
import { useWebXR } from '../hooks/useWebXR';

// ── product catalog ───────────────────────────────────────────────────────────
// Add more entries here as you add .glb files to public/models/
const MODELS = [
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
        hint: 'Surface locked — tap to place',
        canTap: true,
    },
    perfect: {
        color: '#00ff88',
        label: 'Perfect',
        hint: 'Surface locked — tap to place',
        canTap: true,
    },
};

// ── ModelThumb ─────────────────────────────────────────────────────────────────
// Renders a live rotating 3D preview of a .glb file into a small canvas.
// Uses its own mini Three.js scene — completely independent of the AR session.
function ModelThumb({ file, size = 100 }) {
    const canvasRef = useRef(null);
    const rafRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        let renderer, scene, camera, model;
        let alive = true;

        async function init() {
            const THREE = await import('three');

            renderer = new THREE.WebGLRenderer({
                canvas,
                alpha: true,
                antialias: true,
            });
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            renderer.setSize(size, size);

            scene = new THREE.Scene();
            camera = new THREE.PerspectiveCamera(45, 1, 0.01, 100);
            camera.position.set(0, 0, 2.5);

            scene.add(new THREE.AmbientLight(0xffffff, 1.2));
            const dir = new THREE.DirectionalLight(0xffffff, 0.8);
            dir.position.set(1, 2, 2);
            scene.add(dir);
            const back = new THREE.DirectionalLight(0x88aaff, 0.3);
            back.position.set(-1, -1, -2);
            scene.add(back);

            try {
                const { GLTFLoader } =
                    await import('three/examples/jsm/loaders/GLTFLoader.js');
                const loader = new GLTFLoader();
                const gltf = await new Promise((res, rej) =>
                    loader.load(file, res, undefined, rej),
                );
                model = gltf.scene;

                // fit model into view
                const box = new THREE.Box3().setFromObject(model);
                const size3 = new THREE.Vector3();
                const center = new THREE.Vector3();
                box.getSize(size3);
                box.getCenter(center);
                const maxDim = Math.max(size3.x, size3.y, size3.z);
                model.scale.setScalar(1.6 / maxDim);
                model.position.sub(center.multiplyScalar(1.6 / maxDim));

                scene.add(model);
            } catch (_) {
                // file not found — show placeholder cube
                const geo = new THREE.BoxGeometry(1, 1.4, 0.1);
                const mat = new THREE.MeshStandardMaterial({ color: 0x334455 });
                model = new THREE.Mesh(geo, mat);
                scene.add(model);
            }

            function animate() {
                if (!alive) return;
                rafRef.current = requestAnimationFrame(animate);
                if (model) model.rotation.y += 0.008;
                renderer.render(scene, camera);
            }
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

// ── ModelSelector ──────────────────────────────────────────────────────────────
// Horizontal scrollable row of cards, each showing a 3D preview + name + type tag.
// Tapping a card selects it and calls onSelect with the model object.
function ModelSelector({ selected, onSelect }) {
    return (
        <div style={s.selectorWrap}>
            <div style={s.selectorTitle}>Choose a product</div>
            <div style={s.selectorRow}>
                {MODELS.map((m) => {
                    const isSelected = selected?.id === m.id;
                    return (
                        <button
                            key={m.id}
                            style={{
                                ...s.modelCard,
                                borderColor: isSelected
                                    ? '#00ff88'
                                    : 'rgba(255,255,255,0.12)',
                                background: isSelected
                                    ? 'rgba(0,255,136,0.08)'
                                    : 'rgba(255,255,255,0.04)',
                                transform: isSelected
                                    ? 'scale(1.04)'
                                    : 'scale(1)',
                            }}
                            onClick={() => onSelect(m)}
                        >
                            {/* 3D rotating preview */}
                            <div style={s.thumbWrap}>
                                <ModelThumb file={m.file} size={90} />
                            </div>

                            {/* type pill */}
                            <div
                                style={{
                                    ...s.typePill,
                                    background:
                                        m.type === 'window'
                                            ? 'rgba(0,200,255,0.15)'
                                            : 'rgba(255,160,0,0.15)',
                                    color:
                                        m.type === 'window'
                                            ? '#00ccff'
                                            : '#ffa000',
                                    border: `1px solid ${m.type === 'window' ? '#00ccff44' : '#ffa00044'}`,
                                }}
                            >
                                {m.type}
                            </div>

                            {/* product name */}
                            <div
                                style={{
                                    ...s.modelName,
                                    color: isSelected ? '#00ff88' : '#fff',
                                }}
                            >
                                {m.name}
                            </div>

                            {/* selected checkmark */}
                            {isSelected && <div style={s.selectedMark}>✓</div>}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

// ── SelectedBadge ─────────────────────────────────────────────────────────────
// Small pill shown in the top bar during AR session so user knows which model
// they're placing without the full selector being visible.
function SelectedBadge({ model }) {
    if (!model) return null;
    return <div style={s.selectedBadge}>{model.name}</div>;
}

function StepIndicator({ current }) {
    return (
        <div style={s.stepRow}>
            {STEPS.map((_, i) => (
                <div
                    key={i}
                    style={{
                        ...s.stepDot,
                        background:
                            i < current
                                ? '#00ff88'
                                : i === current
                                  ? '#fff'
                                  : 'rgba(255,255,255,0.25)',
                        transform: i === current ? 'scale(1.3)' : 'scale(1)',
                    }}
                />
            ))}
        </div>
    );
}

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

function InstructionBanner({ step, quality }) {
    const stepInfo = STEPS[step];
    const qualityMeta = QUALITY_META[quality] || QUALITY_META.none;
    const canTap = qualityMeta.canTap;
    return (
        <div
            style={{
                ...s.banner,
                borderColor:
                    qualityMeta.color === 'transparent'
                        ? 'rgba(255,255,255,0.12)'
                        : qualityMeta.color + '55',
            }}
        >
            <div
                style={{ ...s.bannerStep, color: canTap ? '#00ff88' : '#aaa' }}
            >
                TAP {step + 1} / 4
            </div>
            <div style={s.bannerLabel}>{stepInfo.label}</div>
            <div style={s.qualityRow}>
                {['poor', 'okay', 'good', 'perfect'].map((q) => (
                    <div
                        key={q}
                        style={{
                            ...s.qualityBar,
                            background:
                                quality === q ||
                                (q === 'poor'
                                    ? true
                                    : q === 'okay'
                                      ? ['okay', 'good', 'perfect'].includes(
                                            quality,
                                        )
                                      : q === 'good'
                                        ? ['good', 'perfect'].includes(quality)
                                        : quality === 'perfect')
                                    ? QUALITY_META[q].color
                                    : 'rgba(255,255,255,0.12)',
                            opacity: quality === 'none' ? 0.3 : 1,
                        }}
                    />
                ))}
            </div>
            <div
                style={{
                    ...s.bannerHint,
                    color: canTap
                        ? 'rgba(255,255,255,0.9)'
                        : 'rgba(255,200,100,0.85)',
                }}
            >
                {canTap ? stepInfo.hint : qualityMeta.hint}
            </div>
            {!canTap && quality !== 'none' && (
                <div style={s.lockedMsg}>Hold still for a moment</div>
            )}
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

function ResultCard({
    dimensions,
    selectedModel,
    onConfirm,
    onReset,
    onResetPos,
    onSwap,
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

            <div style={s.resultTitle}>Opening measured</div>
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

            {/* swap model row — visible after model is placed */}
            {modelPlaced && (
                <div style={s.swapRow}>
                    <div style={s.swapLabel}>
                        Showing: <strong>{selectedModel?.name}</strong>
                    </div>
                    <button style={s.swapBtn} onClick={onSwap}>
                        Swap model
                    </button>
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

// ── SwapSheet ──────────────────────────────────────────────────────────────────
// Modal-like bottom sheet that lets user pick a different model mid-session
// without re-measuring. Tapping a card swaps the model instantly.
function SwapSheet({ selected, onSelect, onClose }) {
    return (
        <div style={s.swapSheetBg} onClick={onClose}>
            <div style={s.swapSheet} onClick={(e) => e.stopPropagation()}>
                <div style={s.swapSheetTitle}>Try another model</div>
                <div style={s.swapSheetSub}>
                    Your measurement stays — no need to re-tap.
                </div>
                <div style={s.selectorRow}>
                    {MODELS.map((m) => {
                        const isSelected = selected?.id === m.id;
                        return (
                            <button
                                key={m.id}
                                style={{
                                    ...s.modelCard,
                                    borderColor: isSelected
                                        ? '#00ff88'
                                        : 'rgba(255,255,255,0.12)',
                                    background: isSelected
                                        ? 'rgba(0,255,136,0.08)'
                                        : 'rgba(255,255,255,0.04)',
                                }}
                                onClick={() => {
                                    onSelect(m);
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
                                                ? 'rgba(0,200,255,0.15)'
                                                : 'rgba(255,160,0,0.15)',
                                        color:
                                            m.type === 'window'
                                                ? '#00ccff'
                                                : '#ffa000',
                                        border: `1px solid ${m.type === 'window' ? '#00ccff44' : '#ffa00044'}`,
                                    }}
                                >
                                    {m.type}
                                </div>
                                <div
                                    style={{
                                        ...s.modelName,
                                        color: isSelected ? '#00ff88' : '#fff',
                                    }}
                                >
                                    {m.name}
                                </div>
                                {isSelected && (
                                    <div style={s.selectedMark}>✓</div>
                                )}
                            </button>
                        );
                    })}
                </div>
                <button
                    style={{ ...s.btnSecondary, marginTop: 12, width: '100%' }}
                    onClick={onClose}
                >
                    Cancel
                </button>
            </div>
        </div>
    );
}

function UnsupportedCard({ onBack }) {
    return (
        <div style={s.unsupportedWrap}>
            <div style={s.unsupportedIcon}>⚠</div>
            <h2 style={s.unsupportedTitle}>AR not available</h2>
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
    );
}

// ── main page ─────────────────────────────────────────────────────────────────
export default function ARMeasure() {
    const canvasRef = useRef(null);
    const overlayRef = useRef(null);
    const gestureRef = useRef(null);

    const [checked, setChecked] = useState(false);
    const [hintDismissed, setHintDismissed] = useState(false);
    const [selectedModel, setSelectedModel] = useState(MODELS[0]); // default: first item
    const [showSwapSheet, setShowSwapSheet] = useState(false);

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
        resetModelTransform,
        setSelectedModel: setHookModel,
    } = useWebXR();

    useEffect(() => {
        checkSupport().then(() => setChecked(true));
    }, []);
    useEffect(() => {
        if (modelPlaced) setHintDismissed(false);
    }, [modelPlaced]);

    // keep the hook's selectedModelUrlRef in sync with local state
    useEffect(() => {
        setHookModel(selectedModel.file);
    }, [selectedModel]);

    // ── gesture listeners ─────────────────────────────────────────────────────
    useEffect(() => {
        const el = gestureRef.current;
        if (!el) return;

        let lastX = 0,
            lastY = 0,
            lastMidY = 0,
            touchCount = 0,
            intent = null;

        function onStart(e) {
            if (!window.__arModel) return;
            touchCount = e.touches.length;
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
                const m = camera.matrixWorld.elements;
                const S = 2.0;
                model.position.x += dx * m[0] * S - dy * m[4] * S;
                model.position.y += dx * m[1] * S - dy * m[5] * S;
                model.position.z += dx * m[2] * S - dy * m[6] * S;
                lastX = e.touches[0].clientX;
                lastY = e.touches[0].clientY;
            } else if (intent === 'depth' && e.touches.length === 2) {
                const newMid =
                    (e.touches[0].clientY + e.touches[1].clientY) / 2;
                const dy = (newMid - lastMidY) / window.innerHeight;
                const m = camera.matrixWorld.elements;
                const S = 1.5;
                model.position.x += dy * -m[8] * S;
                model.position.y += dy * -m[9] * S;
                model.position.z += dy * -m[10] * S;
                lastMidY = newMid;
            }
        }

        function onEnd(e) {
            touchCount = e.touches.length;
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

    // ── swap model — keeps measurement, only changes the 3D model ──────────────
    // Uses swapModel() from useWebXR which removes the old model and loads
    // the new one at the SAME saved corners. No re-tapping required.
    const handleSwapSelect = async (newModel) => {
        setSelectedModel(newModel);
        setHookModel(newModel.file);
        setShowSwapSheet(false);
        await swapModel(newModel.file);
    };

    const handleStart = () => startAR(canvasRef.current, overlayRef.current);
    const handleManual = () => router.visit('/measure/manual');
    const handleConfirm = () => {
        if (!dimensions) return;
        stopAR();
        router.visit('/products', {
            data: { w: dimensions.widthCm, h: dimensions.heightCm },
        });
    };
    const handleReset = () => {
        setHintDismissed(false);
        reset();
    };
    const handleResetPos = () => resetModelTransform();

    if (!checked) return <div style={s.loading}>Checking AR support…</div>;
    if (isSupported === false) return <UnsupportedCard onBack={handleManual} />;

    const qualityMeta = QUALITY_META[reticleQuality] || QUALITY_META.none;
    const canTap = qualityMeta.canTap;
    const showReticle = isActive && tapCount < 4 && !modelPlaced;
    const showHint = modelPlaced && !hintDismissed && !modelLoading;

    return (
        <div style={s.root}>
            <canvas ref={canvasRef} style={s.canvas} />

            {/* gesture layer */}
            <div
                ref={gestureRef}
                style={{
                    ...s.gestureLayer,
                    pointerEvents: modelPlaced ? 'auto' : 'none',
                }}
            />

            {/* XR DOM overlay */}
            <div ref={overlayRef} style={s.overlay}>
                {/* top bar */}
                <div style={s.topBar}>
                    <button style={s.closeBtn} onClick={stopAR}>
                        ✕ Exit
                    </button>
                    <div style={s.topBarRight}>
                        {isActive && <SelectedBadge model={selectedModel} />}
                        <QualityBadge quality={reticleQuality} />
                        {!modelPlaced && <StepIndicator current={tapCount} />}
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
                    @keyframes slideUp{from{opacity:0;transform:translateY(40px);}to{opacity:1;transform:translateY(0);}}
                `}</style>

                {/* instruction banner */}
                {isActive && !modelPlaced && tapCount < 4 && (
                    <InstructionBanner
                        step={tapCount}
                        quality={reticleQuality}
                    />
                )}

                {/* gesture hint */}
                {showHint && (
                    <GestureHint onDismiss={() => setHintDismissed(true)} />
                )}

                {/* result card */}
                {dimensions?.widthCm && dimensions?.heightCm && (
                    <ResultCard
                        dimensions={dimensions}
                        selectedModel={selectedModel}
                        onConfirm={handleConfirm}
                        onReset={handleReset}
                        onResetPos={handleResetPos}
                        onSwap={() => setShowSwapSheet(true)}
                        modelLoading={modelLoading}
                        modelError={modelError}
                        modelPlaced={modelPlaced}
                    />
                )}

                {/* swap sheet */}
                {showSwapSheet && (
                    <SwapSheet
                        selected={selectedModel}
                        onSelect={handleSwapSelect}
                        onClose={() => setShowSwapSheet(false)}
                    />
                )}

                {error && <div style={s.errorBanner}>{error}</div>}

                {/* start screen with model selector */}
                {!isActive && !error && (
                    <div style={s.startWrap}>
                        <h1 style={s.startTitle}>Measure opening</h1>
                        <p style={s.startText}>
                            Pick a product, then tap all 4 corners of the
                            opening.
                        </p>

                        {/* model selector */}
                        <ModelSelector
                            selected={selectedModel}
                            onSelect={setSelectedModel}
                        />

                        <button style={s.btnPrimary} onClick={handleStart}>
                            Start AR — place {selectedModel.name}
                        </button>
                        <button style={s.btnGhost} onClick={handleManual}>
                            Enter measurements manually
                        </button>
                    </div>
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
    qualityBadge: {
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        padding: '5px 10px',
        borderRadius: 20,
        fontSize: 12,
        fontWeight: 600,
        transition: 'all 0.3s ease',
    },
    qualityDot: { width: 7, height: 7, borderRadius: '50%' },
    selectedBadge: {
        background: 'rgba(0,0,0,0.6)',
        color: '#00ff88',
        border: '1px solid rgba(0,255,136,0.3)',
        borderRadius: 20,
        padding: '5px 12px',
        fontSize: 12,
        fontWeight: 600,
    },
    stepRow: { display: 'flex', gap: 8, alignItems: 'center' },
    stepDot: {
        width: 10,
        height: 10,
        borderRadius: '50%',
        transition: 'all 0.2s ease',
    },
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
        transition: 'background 0.25s ease',
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
    banner: {
        position: 'absolute',
        bottom: 160,
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(0,0,0,0.80)',
        backdropFilter: 'blur(12px)',
        borderRadius: 16,
        padding: '16px 24px',
        textAlign: 'center',
        minWidth: 270,
        border: '1px solid',
        pointerEvents: 'none',
        transition: 'border-color 0.3s ease',
    },
    bannerStep: {
        fontSize: 11,
        letterSpacing: 2,
        marginBottom: 4,
        fontWeight: 600,
        transition: 'color 0.3s ease',
    },
    bannerLabel: {
        fontSize: 18,
        fontWeight: 600,
        color: '#fff',
        marginBottom: 8,
    },
    qualityRow: {
        display: 'flex',
        gap: 4,
        justifyContent: 'center',
        marginBottom: 8,
    },
    qualityBar: {
        width: 36,
        height: 4,
        borderRadius: 2,
        transition: 'background 0.3s ease',
    },
    bannerHint: { fontSize: 13, transition: 'color 0.3s ease' },
    lockedMsg: {
        marginTop: 6,
        fontSize: 11,
        color: 'rgba(255,180,50,0.7)',
        letterSpacing: 0.5,
    },
    gestureHint: {
        position: 'absolute',
        bottom: 260,
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
    // model selector
    selectorWrap: { width: '100%', marginBottom: 4 },
    selectorTitle: {
        fontSize: 11,
        fontWeight: 600,
        color: 'rgba(255,255,255,0.5)',
        letterSpacing: 1.5,
        textTransform: 'uppercase',
        marginBottom: 10,
    },
    selectorRow: {
        display: 'flex',
        gap: 10,
        overflowX: 'auto',
        paddingBottom: 4,
        WebkitOverflowScrolling: 'touch',
    },
    modelCard: {
        flexShrink: 0,
        width: 110,
        background: 'rgba(255,255,255,0.04)',
        border: '1.5px solid',
        borderRadius: 14,
        padding: '10px 8px 10px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        pointerEvents: 'auto',
        position: 'relative',
    },
    thumbWrap: {
        width: 90,
        height: 90,
        borderRadius: 8,
        overflow: 'hidden',
        background: 'rgba(255,255,255,0.03)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    typePill: {
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 1,
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
        fontSize: 12,
        color: '#00ff88',
        fontWeight: 700,
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
        fontSize: 13,
        fontWeight: 600,
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
    dimValue: { fontSize: 36, fontWeight: 700, color: '#fff', lineHeight: 1 },
    dimUnit: { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 4 },
    dimSep: { fontSize: 26, color: 'rgba(255,255,255,0.3)' },
    swapRow: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
        padding: '8px 10px',
        background: 'rgba(255,255,255,0.05)',
        borderRadius: 10,
    },
    swapLabel: { fontSize: 12, color: 'rgba(255,255,255,0.6)' },
    swapBtn: {
        fontSize: 12,
        fontWeight: 600,
        color: '#00ff88',
        background: 'transparent',
        border: '1px solid rgba(0,255,136,0.3)',
        borderRadius: 8,
        padding: '4px 10px',
        cursor: 'pointer',
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
        padding: '14px 20px',
        background: 'transparent',
        color: 'rgba(255,255,255,0.6)',
        border: '1px solid rgba(255,255,255,0.2)',
        borderRadius: 12,
        fontSize: 14,
        cursor: 'pointer',
        width: '100%',
    },
    // swap sheet
    swapSheetBg: {
        position: 'absolute',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        zIndex: 200,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        pointerEvents: 'auto',
    },
    swapSheet: {
        background: 'rgba(10,10,20,0.97)',
        backdropFilter: 'blur(20px)',
        borderRadius: '20px 20px 0 0',
        padding: '20px 20px 40px',
        border: '1px solid rgba(255,255,255,0.1)',
        animation: 'slideUp 0.25s ease',
    },
    swapSheetTitle: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 700,
        marginBottom: 4,
        textAlign: 'center',
    },
    swapSheetSub: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 12,
        textAlign: 'center',
        marginBottom: 16,
    },
    errorBanner: {
        position: 'absolute',
        bottom: 40,
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
    startWrap: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'rgba(5,5,15,0.97)',
        borderRadius: '24px 24px 0 0',
        padding: '24px 20px 44px',
        pointerEvents: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        maxHeight: '85vh',
        overflowY: 'auto',
    },
    startTitle: { fontSize: 22, fontWeight: 700, color: '#fff', margin: 0 },
    startText: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.6)',
        lineHeight: 1.5,
        margin: 0,
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
