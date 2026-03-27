import { useEffect, useRef, useState, useCallback } from 'react';
import { router } from '@inertiajs/react';
import { useWebXR } from '../hooks/useWebXR';

// ── product catalog ───────────────────────────────────────────────────────────
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

const TYPE_COLOR = {
    window: {
        bg: 'rgba(0,200,255,0.15)',
        text: '#00ccff',
        border: '#00ccff44',
    },
    door: { bg: 'rgba(255,160,0,0.15)', text: '#ffa000', border: '#ffa00044' },
};

// ── ModelThumb ────────────────────────────────────────────────────────────────
function ModelThumb({ file, size = 80 }) {
    const canvasRef = useRef(null);
    const rafRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        let renderer,
            model,
            alive = true;

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
            camera.position.set(0, 0, 2.5);
            scene.add(new THREE.AmbientLight(0xffffff, 1.2));
            const d = new THREE.DirectionalLight(0xffffff, 0.8);
            d.position.set(1, 2, 2);
            scene.add(d);
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
                model.scale.setScalar(1.6 / Math.max(sz.x, sz.y, sz.z));
                model.position.sub(
                    ctr.multiplyScalar(1.6 / Math.max(sz.x, sz.y, sz.z)),
                );
                scene.add(model);
            } catch (_) {
                model = new THREE.Mesh(
                    new THREE.BoxGeometry(1, 1.4, 0.1),
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
            style={{ display: 'block', borderRadius: 6 }}
        />
    );
}

// ── QueueBuilder — start screen ───────────────────────────────────────────────
// User adds multiple model+slot entries before starting AR
function QueueBuilder({ queue, onAdd, onRemove, onStart, onManual }) {
    const [pickOpen, setPickOpen] = useState(false);
    const [editIdx, setEditIdx] = useState(null); // null = adding new

    function openAdd() {
        setEditIdx(null);
        setPickOpen(true);
    }
    function openEdit(i) {
        setEditIdx(i);
        setPickOpen(true);
    }
    function pickModel(model) {
        if (editIdx !== null) {
            onAdd(model, editIdx); // replace at index
        } else {
            onAdd(model, null); // append
        }
        setPickOpen(false);
    }

    return (
        <div style={s.startWrap}>
            {pickOpen ? (
                // model picker sheet
                <>
                    <div style={s.startHeader}>
                        <button
                            style={s.backBtn}
                            onClick={() => setPickOpen(false)}
                        >
                            ← Back
                        </button>
                        <h2 style={s.startTitle}>Pick a product</h2>
                    </div>
                    <div style={s.pickerGrid}>
                        {MODELS.map((m) => {
                            const tc = TYPE_COLOR[m.type] || TYPE_COLOR.window;
                            return (
                                <button
                                    key={m.id}
                                    style={s.pickerCard}
                                    onClick={() => pickModel(m)}
                                >
                                    <div style={s.thumbWrap}>
                                        <ModelThumb file={m.file} size={80} />
                                    </div>
                                    <div
                                        style={{
                                            ...s.typePill,
                                            background: tc.bg,
                                            color: tc.text,
                                            border: `1px solid ${tc.border}`,
                                        }}
                                    >
                                        {m.type}
                                    </div>
                                    <div style={s.modelName}>{m.name}</div>
                                </button>
                            );
                        })}
                    </div>
                </>
            ) : (
                <>
                    <div style={s.startHeader}>
                        <h1 style={s.startTitle}>AR Measurement</h1>
                        <p style={s.startText}>
                            Add each opening you want to measure. Tap Start when
                            ready.
                        </p>
                    </div>

                    {/* queue list */}
                    <div style={s.queueList}>
                        {queue.length === 0 && (
                            <div style={s.queueEmpty}>
                                No openings added yet.
                                <br />
                                Tap "+ Add opening" below.
                            </div>
                        )}
                        {queue.map((item, i) => {
                            const tc =
                                TYPE_COLOR[item.type] || TYPE_COLOR.window;
                            return (
                                <div key={i} style={s.queueItem}>
                                    <div style={s.queueThumb}>
                                        <ModelThumb
                                            file={item.file}
                                            size={50}
                                        />
                                    </div>
                                    <div style={s.queueInfo}>
                                        <div style={s.queueNum}>
                                            Opening {i + 1}
                                        </div>
                                        <div style={s.queueName}>
                                            {item.name}
                                        </div>
                                        <div
                                            style={{
                                                ...s.typePill,
                                                ...s.typePillSm,
                                                background: tc.bg,
                                                color: tc.text,
                                                border: `1px solid ${tc.border}`,
                                            }}
                                        >
                                            {item.type}
                                        </div>
                                    </div>
                                    <div style={s.queueActions}>
                                        <button
                                            style={s.queueEditBtn}
                                            onClick={() => openEdit(i)}
                                        >
                                            Change
                                        </button>
                                        <button
                                            style={s.queueRemoveBtn}
                                            onClick={() => onRemove(i)}
                                        >
                                            ✕
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* add button */}
                    <button style={s.addBtn} onClick={openAdd}>
                        + Add opening
                    </button>

                    {/* start */}
                    <button
                        style={{
                            ...s.btnPrimary,
                            opacity: queue.length === 0 ? 0.4 : 1,
                        }}
                        disabled={queue.length === 0}
                        onClick={onStart}
                    >
                        Start AR — {queue.length} opening
                        {queue.length !== 1 ? 's' : ''}
                    </button>

                    <button style={s.btnGhost} onClick={onManual}>
                        Enter measurements manually
                    </button>
                </>
            )}
        </div>
    );
}

// ── UI components ─────────────────────────────────────────────────────────────
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

function InstructionBanner({
    step,
    quality,
    currentItem,
    queueIndex,
    queueTotal,
}) {
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
            {/* queue progress */}
            <div style={s.bannerQueue}>
                Opening {queueIndex + 1} of {queueTotal} —{' '}
                <strong style={{ color: '#00ff88' }}>
                    {currentItem?.name}
                </strong>
            </div>
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
                    <span style={s.gt}>1 finger — move</span>
                </div>
                <div style={s.gestureRow}>
                    <span style={s.gi}>✌</span>
                    <span style={s.gt}>2 finger drag — push / pull</span>
                </div>
            </div>
            <button style={s.gestureOk} onClick={onDismiss}>
                Got it
            </button>
        </div>
    );
}

// After each model is placed — shows dims + next/done
function PlacedCard({
    item,
    dims,
    queueIndex,
    queueTotal,
    onNext,
    onResetPos,
    onFinish,
    modelLoading,
    modelError,
}) {
    const isLast = queueIndex === queueTotal - 1;
    return (
        <div style={s.resultCard}>
            {modelLoading && (
                <div style={s.modelStatus}>
                    <div style={s.spinner} />
                    Loading model…
                </div>
            )}
            {modelError && <div style={s.modelStatusError}>{modelError}</div>}
            <div style={s.resultTitle}>
                Opening {queueIndex + 1} of {queueTotal} — {item?.name}
            </div>
            {dims && (
                <div style={s.resultDims}>
                    <div style={s.dimBox}>
                        <span style={s.dimValue}>{dims.widthCm}</span>
                        <span style={s.dimUnit}>cm wide</span>
                    </div>
                    <div style={s.dimSep}>×</div>
                    <div style={s.dimBox}>
                        <span style={s.dimValue}>{dims.heightCm}</span>
                        <span style={s.dimUnit}>cm tall</span>
                    </div>
                </div>
            )}
            <div style={s.resultButtons}>
                <button style={s.btnSecondary} onClick={onResetPos}>
                    ↺ Reset
                </button>
                {isLast ? (
                    <button style={s.btnPrimary} onClick={onFinish}>
                        All done ✓
                    </button>
                ) : (
                    <button style={s.btnPrimary} onClick={onNext}>
                        Next → {queueTotal - queueIndex - 1} left
                    </button>
                )}
            </div>
        </div>
    );
}

function AllDoneCard({ queue, placedDims, onFindProducts, onExit }) {
    return (
        <div style={s.resultCard}>
            <div style={s.resultTitle}>All openings placed ✓</div>
            <div style={s.allDoneList}>
                {queue.map((item, i) => (
                    <div key={i} style={s.allDoneRow}>
                        <div style={s.allDoneName}>{item.name}</div>
                        <div style={s.allDoneDims}>
                            {placedDims[i]
                                ? `${placedDims[i].widthCm} × ${placedDims[i].heightCm} cm`
                                : '—'}
                        </div>
                    </div>
                ))}
            </div>
            <div style={s.resultButtons}>
                <button style={s.btnSecondary} onClick={onExit}>
                    Exit AR
                </button>
                <button style={s.btnPrimary} onClick={onFindProducts}>
                    Find products
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
    const [queue, setQueue] = useState([]); // list of model objects
    const [queueIndex, setQueueIndex] = useState(0); // which one we're measuring now
    const [placedDims, setPlacedDims] = useState([]); // dims of each placed model
    const [allDone, setAllDone] = useState(false);
    const [hintDismissed, setHintDismissed] = useState(false);
    const [screen, setScreen] = useState('build'); // 'build' | 'ar'

    const currentItem = queue[queueIndex] || null;

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
        swapModel,
    } = useWebXR();

    useEffect(() => {
        checkSupport().then(() => setChecked(true));
    }, []);

    // whenever queueIndex changes, tell the hook which model to use
    useEffect(() => {
        if (currentItem) setHookModel(currentItem.file);
    }, [queueIndex, currentItem]);

    useEffect(() => {
        if (modelPlaced) setHintDismissed(false);
    }, [modelPlaced]);

    // ── gesture listeners ─────────────────────────────────────────────────────
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

    // ── queue management ──────────────────────────────────────────────────────
    function handleAdd(model, replaceIdx) {
        if (replaceIdx !== null) {
            setQueue((q) =>
                q.map((item, i) => (i === replaceIdx ? model : item)),
            );
        } else {
            setQueue((q) => [...q, model]);
        }
    }

    function handleRemove(i) {
        setQueue((q) => q.filter((_, idx) => idx !== i));
    }

    // ── AR flow ───────────────────────────────────────────────────────────────
    function handleStart() {
        setQueueIndex(0);
        setPlacedDims([]);
        setAllDone(false);
        setScreen('ar');
        // small timeout so screen state updates before startAR
        setTimeout(() => startAR(canvasRef.current, overlayRef.current), 50);
    }

    // user taps "Next" after placing a model
    function handleNext() {
        // save dims for this slot
        setPlacedDims((prev) => {
            const updated = [...prev];
            updated[queueIndex] = dimensions;
            return updated;
        });

        if (queueIndex < queue.length - 1) {
            // move to next — reset measurement but keep AR session alive
            reset();
            setQueueIndex((i) => i + 1);
        }
    }

    // last item placed — show all done card
    function handleFinish() {
        setPlacedDims((prev) => {
            const updated = [...prev];
            updated[queueIndex] = dimensions;
            return updated;
        });
        setAllDone(true);
    }

    function handleFindProducts() {
        stopAR();
        // pass first item's dims as default filter; page can show all
        const first = placedDims[0] || dimensions;
        router.visit('/products', {
            data: { w: first?.widthCm, h: first?.heightCm },
        });
    }

    function handleExit() {
        stopAR();
        setScreen('build');
        setAllDone(false);
        setQueueIndex(0);
        setPlacedDims([]);
    }

    function handleManual() {
        router.visit('/measure/manual');
    }

    if (!checked) return <div style={s.loading}>Checking AR support…</div>;
    if (isSupported === false) return <UnsupportedCard onBack={handleManual} />;

    const qualityMeta = QUALITY_META[reticleQuality] || QUALITY_META.none;
    const canTap = qualityMeta.canTap;
    const showReticle = isActive && tapCount < 4 && !modelPlaced;
    const showHint = modelPlaced && !hintDismissed && !modelLoading;

    return (
        <div style={s.root}>
            <canvas ref={canvasRef} style={s.canvas} />
            <div
                ref={gestureRef}
                style={{
                    ...s.gestureLayer,
                    pointerEvents: modelPlaced && !allDone ? 'auto' : 'none',
                }}
            />

            <div ref={overlayRef} style={s.overlay}>
                {/* ── queue builder screen ── */}
                {screen === 'build' && (
                    <QueueBuilder
                        queue={queue}
                        onAdd={handleAdd}
                        onRemove={handleRemove}
                        onStart={handleStart}
                        onManual={handleManual}
                    />
                )}

                {/* ── AR screen ── */}
                {screen === 'ar' && (
                    <>
                        {/* top bar */}
                        <div style={s.topBar}>
                            <button style={s.closeBtn} onClick={handleExit}>
                                ✕ Exit
                            </button>
                            <div style={s.topBarRight}>
                                {currentItem && (
                                    <div style={s.selectedBadge}>
                                        {queueIndex + 1}/{queue.length} —{' '}
                                        {currentItem.name}
                                    </div>
                                )}
                                <QualityBadge quality={reticleQuality} />
                                {!modelPlaced && (
                                    <StepIndicator current={tapCount} />
                                )}
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

                        {/* instruction banner — only while measuring */}
                        {!modelPlaced && !allDone && tapCount < 4 && (
                            <InstructionBanner
                                step={tapCount}
                                quality={reticleQuality}
                                currentItem={currentItem}
                                queueIndex={queueIndex}
                                queueTotal={queue.length}
                            />
                        )}

                        {/* gesture hint */}
                        {showHint && !allDone && (
                            <GestureHint
                                onDismiss={() => setHintDismissed(true)}
                            />
                        )}

                        {/* placed card — next or finish */}
                        {modelPlaced && !allDone && (
                            <PlacedCard
                                item={currentItem}
                                dims={dimensions}
                                queueIndex={queueIndex}
                                queueTotal={queue.length}
                                onNext={handleNext}
                                onResetPos={resetModelTransform}
                                onFinish={handleFinish}
                                modelLoading={modelLoading}
                                modelError={modelError}
                            />
                        )}

                        {/* all done card */}
                        {allDone && (
                            <AllDoneCard
                                queue={queue}
                                placedDims={placedDims}
                                onFindProducts={handleFindProducts}
                                onExit={handleExit}
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
    // start / build screen
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
        gap: 12,
        maxHeight: '92vh',
        overflowY: 'auto',
    },
    startHeader: { display: 'flex', flexDirection: 'column', gap: 4 },
    startTitle: { fontSize: 22, fontWeight: 700, color: '#fff', margin: 0 },
    startText: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.5)',
        margin: 0,
        lineHeight: 1.5,
    },
    backBtn: {
        alignSelf: 'flex-start',
        background: 'transparent',
        border: 'none',
        color: 'rgba(255,255,255,0.5)',
        fontSize: 14,
        cursor: 'pointer',
        padding: 0,
        marginBottom: 4,
    },
    // picker grid
    pickerGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
    pickerCard: {
        background: 'rgba(255,255,255,0.04)',
        border: '1.5px solid rgba(255,255,255,0.1)',
        borderRadius: 14,
        padding: '12px 8px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        cursor: 'pointer',
    },
    thumbWrap: {
        width: 80,
        height: 80,
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
    typePillSm: { fontSize: 9, padding: '1px 6px' },
    modelName: {
        fontSize: 12,
        fontWeight: 600,
        color: '#fff',
        textAlign: 'center',
    },
    // queue list
    queueList: { display: 'flex', flexDirection: 'column', gap: 8 },
    queueEmpty: {
        textAlign: 'center',
        color: 'rgba(255,255,255,0.3)',
        fontSize: 13,
        padding: '24px 0',
        lineHeight: 1.8,
    },
    queueItem: {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: 'rgba(255,255,255,0.05)',
        borderRadius: 14,
        padding: '10px 12px',
        border: '1px solid rgba(255,255,255,0.08)',
    },
    queueThumb: {
        width: 50,
        height: 50,
        borderRadius: 8,
        overflow: 'hidden',
        flexShrink: 0,
        background: 'rgba(255,255,255,0.03)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    queueInfo: { flex: 1, display: 'flex', flexDirection: 'column', gap: 3 },
    queueNum: {
        fontSize: 10,
        color: 'rgba(255,255,255,0.35)',
        fontWeight: 600,
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
    queueName: { fontSize: 14, fontWeight: 600, color: '#fff' },
    queueActions: {
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        alignItems: 'flex-end',
    },
    queueEditBtn: {
        fontSize: 11,
        color: '#00ff88',
        background: 'transparent',
        border: '1px solid rgba(0,255,136,0.25)',
        borderRadius: 6,
        padding: '3px 8px',
        cursor: 'pointer',
    },
    queueRemoveBtn: {
        fontSize: 12,
        color: 'rgba(255,80,80,0.7)',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        padding: '2px 4px',
    },
    addBtn: {
        padding: '13px',
        background: 'rgba(0,255,136,0.08)',
        color: '#00ff88',
        border: '1px dashed rgba(0,255,136,0.3)',
        borderRadius: 12,
        fontSize: 14,
        fontWeight: 600,
        cursor: 'pointer',
        textAlign: 'center',
    },
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
        fontSize: 11,
        fontWeight: 600,
        maxWidth: 180,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
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
    stepRow: { display: 'flex', gap: 8, alignItems: 'center' },
    stepDot: {
        width: 10,
        height: 10,
        borderRadius: '50%',
        transition: 'all 0.2s ease',
    },
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
        transition: 'border-color 0.25s ease',
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
    // banner
    banner: {
        position: 'absolute',
        bottom: 160,
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(0,0,0,0.80)',
        backdropFilter: 'blur(12px)',
        borderRadius: 16,
        padding: '14px 22px',
        textAlign: 'center',
        minWidth: 270,
        border: '1px solid',
        pointerEvents: 'none',
    },
    bannerQueue: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.5)',
        marginBottom: 4,
    },
    bannerStep: {
        fontSize: 11,
        letterSpacing: 2,
        marginBottom: 4,
        fontWeight: 600,
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
    bannerHint: { fontSize: 13 },
    lockedMsg: {
        marginTop: 6,
        fontSize: 11,
        color: 'rgba(255,180,50,0.7)',
        letterSpacing: 0.5,
    },
    // gesture hint
    gestureHint: {
        position: 'absolute',
        bottom: 240,
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
    // placed / result card
    resultCard: {
        position: 'absolute',
        bottom: 40,
        left: 20,
        right: 20,
        zIndex: 50,
        background: 'rgba(10,10,20,0.94)',
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
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        marginBottom: 12,
        textAlign: 'center',
    },
    resultDims: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        marginBottom: 16,
    },
    dimBox: { display: 'flex', flexDirection: 'column', alignItems: 'center' },
    dimValue: { fontSize: 34, fontWeight: 700, color: '#fff', lineHeight: 1 },
    dimUnit: { fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 3 },
    dimSep: { fontSize: 24, color: 'rgba(255,255,255,0.3)' },
    resultButtons: { display: 'flex', gap: 8 },
    // all done card
    allDoneList: {
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        marginBottom: 16,
    },
    allDoneRow: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 10px',
        background: 'rgba(255,255,255,0.04)',
        borderRadius: 8,
    },
    allDoneName: { fontSize: 13, fontWeight: 600, color: '#fff' },
    allDoneDims: { fontSize: 12, color: '#00ff88', fontWeight: 600 },
    // buttons
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
        textAlign: 'center',
    },
    btnSecondary: {
        flex: 0,
        padding: '13px 12px',
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
    // misc
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
