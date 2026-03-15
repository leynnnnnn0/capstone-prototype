// ─────────────────────────────────────────────────────────────────────────────
// ARMeasureFree.jsx
//
// Free-tap AR measurement page.
// Works for any shape — L-cabinet, U-cabinet, straight run, ACP panel, etc.
// User taps each corner of the shape, then presses "Done" to place the model.
// Minimum 3 taps required. Undo removes the last tap.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react';
import { router } from '@inertiajs/react';
import { useWebXRFree } from '../hooks/useWebXRFree';

// ── product catalog — same as ARMeasure ──────────────────────────────────────
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
    {
        id: 'cabinet1',
        name: 'L-Cabinet 1',
        type: 'cabinet',
        file: '/models/cabinet_l.glb',
    },
    {
        id: 'cabinet2',
        name: 'L-Cabinet 2',
        type: 'cabinet',
        file: '/models/cabinet_l2.glb',
    },
    {
        id: 'cabinet3',
        name: 'L-Cabinet 3',
        type: 'cabinet',
        file: '/models/cabinet_l3.glb',
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
        hint: 'Tap a corner',
        canTap: true,
    },
    perfect: {
        color: '#00ff88',
        label: 'Perfect',
        hint: 'Tap a corner',
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
    cabinet: {
        bg: 'rgba(180,100,255,0.15)',
        text: '#b464ff',
        border: '#b464ff44',
    },
};

// ── ModelThumb ─────────────────────────────────────────────────────────────────
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
                const s = 1.8 / Math.max(sz.x, sz.y, sz.z);
                model.scale.setScalar(s);
                model.position.sub(ctr.multiplyScalar(s));
                scene.add(model);
            } catch (_) {
                const geo = new THREE.BoxGeometry(1, 0.6, 1.2);
                model = new THREE.Mesh(
                    geo,
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

// ── ModelSelector ──────────────────────────────────────────────────────────────
function ModelSelector({ selected, onSelect }) {
    return (
        <div style={s.selectorWrap}>
            <div style={s.selectorTitle}>Choose a product</div>
            <div style={s.selectorRow}>
                {MODELS.map((m) => {
                    const isSelected = selected?.id === m.id;
                    const tc = TYPE_COLOR[m.type] || TYPE_COLOR.window;
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
                            <div style={s.thumbWrap}>
                                <ModelThumb file={m.file} size={90} />
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
                            <div
                                style={{
                                    ...s.modelName,
                                    color: isSelected ? '#00ff88' : '#fff',
                                }}
                            >
                                {m.name}
                            </div>
                            {isSelected && <div style={s.selectedMark}>✓</div>}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

// ── TapCounter ────────────────────────────────────────────────────────────────
// Shows how many corners have been tapped + a hint about the shape
function TapCounter({ count, canConfirm }) {
    const shapeHint =
        count < 3
            ? 'Tap at least 3 corners'
            : count === 4
              ? 'Rectangle / straight run'
              : count === 5
                ? 'L-shape'
                : count === 6
                  ? 'U-shape or 6-corner run'
                  : `${count}-corner shape`;
    return (
        <div style={s.tapCounter}>
            <div style={s.tapCountNum}>{count}</div>
            <div style={s.tapCountLabel}>corners tapped</div>
            <div style={s.tapCountHint}>{shapeHint}</div>
            {canConfirm && (
                <div style={s.tapCountReady}>Ready — tap "Done" to place</div>
            )}
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

// ── TapToolbar ────────────────────────────────────────────────────────────────
// Fixed bottom bar during tapping: Undo, tap count, Done
function TapToolbar({ tapCount, canConfirm, onUndo, onDone, quality }) {
    const meta = QUALITY_META[quality] || QUALITY_META.none;
    const canTap = meta.canTap;
    return (
        <div style={s.toolbar}>
            {/* undo button */}
            <button
                style={{ ...s.toolbarBtn, opacity: tapCount > 0 ? 1 : 0.35 }}
                onClick={onUndo}
                disabled={tapCount === 0}
            >
                ↩ Undo
            </button>

            {/* center: quality + tap count */}
            <div style={s.toolbarCenter}>
                <div
                    style={{
                        ...s.toolbarQuality,
                        color:
                            meta.color === 'transparent' ? '#666' : meta.color,
                    }}
                >
                    {meta.color !== 'transparent' && (
                        <div
                            style={{
                                ...s.qualityDot,
                                background: meta.color,
                                marginRight: 5,
                            }}
                        />
                    )}
                    {canTap ? `${tapCount} tapped — tap to add` : meta.hint}
                </div>
            </div>

            {/* done button */}
            <button
                style={{
                    ...s.toolbarDoneBtn,
                    opacity: canConfirm ? 1 : 0.35,
                    background: canConfirm
                        ? '#00ff88'
                        : 'rgba(255,255,255,0.1)',
                    color: canConfirm ? '#000' : '#666',
                }}
                onClick={onDone}
                disabled={!canConfirm}
            >
                Done ✓
            </button>
        </div>
    );
}

// ── ResultCard ────────────────────────────────────────────────────────────────
function ResultCard({
    dimensions,
    selectedModel,
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

            <div style={s.resultTitle}>Area measured</div>

            <div style={s.resultMeta}>
                <div style={s.resultMetaItem}>
                    <span style={s.resultMetaVal}>{tapCount}</span>
                    <span style={s.resultMetaLabel}>corners</span>
                </div>
                <div style={s.resultMetaSep}>·</div>
                <div style={s.resultMetaItem}>
                    <span style={s.resultMetaVal}>{dimensions.widthCm}</span>
                    <span style={s.resultMetaLabel}>cm wide</span>
                </div>
                <div style={s.resultMetaSep}>×</div>
                <div style={s.resultMetaItem}>
                    <span style={s.resultMetaVal}>{dimensions.heightCm}</span>
                    <span style={s.resultMetaLabel}>cm tall</span>
                </div>
            </div>

            {modelPlaced && selectedModel && (
                <div style={s.placedModel}>
                    Showing: <strong>{selectedModel.name}</strong>
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
export default function ARMeasureFree() {
    const canvasRef = useRef(null);
    const overlayRef = useRef(null);
    const gestureRef = useRef(null);

    const [checked, setChecked] = useState(false);
    const [hintDismissed, setHintDismissed] = useState(false);
    const [selectedModel, setSelectedModel] = useState(MODELS[0]);

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
        handleUndo,
        handleConfirm: confirmAndPlace,
    } = useWebXRFree();

    useEffect(() => {
        checkSupport().then(() => setChecked(true));
    }, []);
    useEffect(() => {
        if (modelPlaced) setHintDismissed(false);
    }, [modelPlaced]);
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

    if (!checked) return <div style={s.loading}>Checking AR support…</div>;
    if (isSupported === false) return <UnsupportedCard onBack={handleManual} />;

    const qualityMeta = QUALITY_META[reticleQuality] || QUALITY_META.none;
    const canTap = qualityMeta.canTap;
    const showReticle = isActive && !modelPlaced;
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

            {/* XR overlay */}
            <div ref={overlayRef} style={s.overlay}>
                {/* top bar */}
                <div style={s.topBar}>
                    <button style={s.closeBtn} onClick={stopAR}>
                        ✕ Exit
                    </button>
                    <div style={s.topBarRight}>
                        {isActive && !modelPlaced && (
                            <div style={s.selectedBadge}>
                                {selectedModel.name}
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
                    @keyframes slideUp{from{opacity:0;transform:translateY(40px);}to{opacity:1;transform:translateY(0);}}
                `}</style>

                {/* tap toolbar — shown while measuring */}
                {isActive && !modelPlaced && (
                    <TapToolbar
                        tapCount={tapCount}
                        canConfirm={canConfirm}
                        quality={reticleQuality}
                        onUndo={handleUndo}
                        onDone={confirmAndPlace}
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

                {/* start screen */}
                {!isActive && !error && (
                    <div style={s.startWrap}>
                        <h1 style={s.startTitle}>Measure any shape</h1>
                        <p style={s.startText}>
                            Tap each corner of the cabinet, window or opening —
                            any number of corners. Press{' '}
                            <strong style={{ color: '#00ff88' }}>Done</strong>{' '}
                            when finished.
                        </p>

                        {/* shape examples */}
                        <div style={s.shapeExamples}>
                            {[
                                {
                                    label: 'Rectangle',
                                    taps: '4 taps',
                                    icon: '▬',
                                },
                                { label: 'L-shape', taps: '5 taps', icon: '⌐' },
                                { label: 'U-shape', taps: '6 taps', icon: '⊓' },
                                {
                                    label: 'Any shape',
                                    taps: 'N taps',
                                    icon: '⬡',
                                },
                            ].map((ex) => (
                                <div key={ex.label} style={s.shapeCard}>
                                    <div style={s.shapeIcon}>{ex.icon}</div>
                                    <div style={s.shapeLabel}>{ex.label}</div>
                                    <div style={s.shapeTaps}>{ex.taps}</div>
                                </div>
                            ))}
                        </div>

                        <ModelSelector
                            selected={selectedModel}
                            onSelect={setSelectedModel}
                        />

                        <button style={s.btnPrimary} onClick={handleStart}>
                            Start AR — {selectedModel.name}
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
    // toolbar
    toolbar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'rgba(5,5,15,0.92)',
        backdropFilter: 'blur(16px)',
        borderRadius: '20px 20px 0 0',
        padding: '14px 16px 32px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        pointerEvents: 'auto',
        zIndex: 50,
    },
    toolbarBtn: {
        padding: '10px 16px',
        background: 'rgba(255,255,255,0.1)',
        color: '#fff',
        border: '1px solid rgba(255,255,255,0.2)',
        borderRadius: 10,
        fontSize: 14,
        fontWeight: 500,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
    },
    toolbarCenter: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
    },
    toolbarQuality: { fontSize: 12, display: 'flex', alignItems: 'center' },
    toolbarDoneBtn: {
        padding: '10px 20px',
        border: 'none',
        borderRadius: 10,
        fontSize: 14,
        fontWeight: 700,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        transition: 'all 0.2s',
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
    resultMeta: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginBottom: 14,
        flexWrap: 'wrap',
    },
    resultMetaItem: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
    },
    resultMetaVal: {
        fontSize: 28,
        fontWeight: 700,
        color: '#fff',
        lineHeight: 1,
    },
    resultMetaLabel: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.5)',
        marginTop: 2,
    },
    resultMetaSep: {
        fontSize: 20,
        color: 'rgba(255,255,255,0.2)',
        alignSelf: 'center',
    },
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
    // gesture hint
    gestureHint: {
        position: 'absolute',
        bottom: 120,
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
        padding: '10px 8px',
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
    // shape examples
    shapeExamples: { display: 'flex', gap: 8, marginBottom: 4 },
    shapeCard: {
        flex: 1,
        background: 'rgba(255,255,255,0.05)',
        borderRadius: 10,
        padding: '10px 6px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
    },
    shapeIcon: { fontSize: 20, color: 'rgba(255,255,255,0.5)' },
    shapeLabel: {
        fontSize: 11,
        fontWeight: 600,
        color: 'rgba(255,255,255,0.7)',
        textAlign: 'center',
    },
    shapeTaps: { fontSize: 10, color: '#00ff88', fontWeight: 600 },
    // misc
    tapCounter: {
        position: 'absolute',
        top: 80,
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(0,0,0,0.7)',
        borderRadius: 16,
        padding: '12px 20px',
        textAlign: 'center',
        pointerEvents: 'none',
    },
    tapCountNum: {
        fontSize: 36,
        fontWeight: 700,
        color: '#00ff88',
        lineHeight: 1,
    },
    tapCountLabel: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.5)',
        marginTop: 2,
    },
    tapCountHint: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.7)',
        marginTop: 4,
    },
    tapCountReady: {
        fontSize: 11,
        color: '#ffe600',
        marginTop: 4,
        fontWeight: 600,
    },
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
        maxHeight: '90vh',
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
