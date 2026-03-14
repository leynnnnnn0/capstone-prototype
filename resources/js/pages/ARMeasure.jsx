import { useEffect, useRef, useState } from 'react';
import { router } from '@inertiajs/react';
import { useWebXR } from '../hooks/useWebXR';

const STEPS = [
    {
        label: 'Top-left corner',
        hint: 'Tap the top-left corner of the opening',
    },
    { label: 'Top-right corner', hint: 'Tap the top-right corner' },
    { label: 'Bottom-left corner', hint: 'Tap the bottom-left corner — done!' },
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
                TAP {step + 1} / 3
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
            <div style={s.gestureTitle}>Adjust the window</div>
            <div style={s.gestureRows}>
                <div style={s.gestureRow}>
                    <span style={s.gi}>☝</span>
                    <span style={s.gt}>
                        1 finger drag — move left / right / up / down
                    </span>
                </div>
                <div style={s.gestureRow}>
                    <span style={s.gi}>✌</span>
                    <span style={s.gt}>
                        2 finger drag up / down — push forward or back
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
                    Loading 3D model…
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

// ── main page ────────────────────────────────────────────────────────────────
export default function ARMeasure() {
    const canvasRef = useRef(null);
    const overlayRef = useRef(null);
    const gestureRef = useRef(null);
    const [checked, setChecked] = useState(false);
    const [hintDismissed, setHintDismissed] = useState(false);

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
    } = useWebXR();

    useEffect(() => {
        checkSupport().then(() => setChecked(true));
    }, []);

    useEffect(() => {
        if (modelPlaced) setHintDismissed(false);
    }, [modelPlaced]);

    // ── gesture listeners on the dedicated div ────────────────────────────────
    // Attached here in the component so we always have closure over latest state.
    // We read window.__arModel and window.__arCamera which useWebXR sets when
    // the model is placed — this avoids any timing issues with hook dependencies.
    useEffect(() => {
        const el = gestureRef.current;
        if (!el) return;

        // state for 1-finger move
        let lastX = 0,
            lastY = 0;
        // state for 2-finger depth
        let lastMidY = 0;
        let touchCount = 0;
        // intent lock so move and depth don't fire together
        let intent = null; // 'move' | 'depth'

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
            const model = window.__arModel;
            const camera = window.__arCamera;
            if (!model || !camera) return;
            e.preventDefault();

            if (intent === 'move' && e.touches.length === 1) {
                const dx = (e.touches[0].clientX - lastX) / window.innerWidth;
                const dy = (e.touches[0].clientY - lastY) / window.innerHeight;

                // extract camera right and up axes from its world matrix
                const rx = camera.matrixWorld.elements[0];
                const ry = camera.matrixWorld.elements[1];
                const rz = camera.matrixWorld.elements[2];
                const ux = camera.matrixWorld.elements[4];
                const uy = camera.matrixWorld.elements[5];
                const uz = camera.matrixWorld.elements[6];

                const SPEED = 2.0;
                model.position.x += dx * rx * SPEED - dy * ux * SPEED;
                model.position.y += dx * ry * SPEED - dy * uy * SPEED;
                model.position.z += dx * rz * SPEED - dy * uz * SPEED;

                lastX = e.touches[0].clientX;
                lastY = e.touches[0].clientY;
            } else if (intent === 'depth' && e.touches.length === 2) {
                const newMidY =
                    (e.touches[0].clientY + e.touches[1].clientY) / 2;
                const dy = (newMidY - lastMidY) / window.innerHeight;

                // camera forward = negative Z of its world matrix
                const fx = -camera.matrixWorld.elements[8];
                const fy = -camera.matrixWorld.elements[9];
                const fz = -camera.matrixWorld.elements[10];

                const DEPTH = 1.5;
                model.position.x += dy * fx * DEPTH;
                model.position.y += dy * fy * DEPTH;
                model.position.z += dy * fz * DEPTH;

                lastMidY = newMidY;
            }
        }

        function onEnd(e) {
            touchCount = e.touches.length;
            if (e.touches.length === 0) {
                intent = null;
            } else if (e.touches.length === 1) {
                // finger lifted from 2-finger — switch to move
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
    }, []); // empty deps — reads window.__arModel live, no stale closure issues

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
    const handleResetPos = () => {
        resetModelTransform();
    };

    if (!checked) return <div style={s.loading}>Checking AR support…</div>;
    if (isSupported === false) return <UnsupportedCard onBack={handleManual} />;

    const qualityMeta = QUALITY_META[reticleQuality] || QUALITY_META.none;
    const canTap = qualityMeta.canTap;
    const showReticle = isActive && tapCount < 3 && !modelPlaced;
    const showHint = modelPlaced && !hintDismissed && !modelLoading;

    return (
        <div style={s.root}>
            <canvas ref={canvasRef} style={s.canvas} />

            {/* gesture layer — full screen transparent div, active only after model placed */}
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
                        <QualityBadge quality={reticleQuality} />
                        {!modelPlaced && <StepIndicator current={tapCount} />}
                    </div>
                </div>

                {/* reticle — only shown during measuring */}
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
                    @keyframes pulse {
                        0%,100%{transform:translate(-50%,-50%) scale(1);opacity:1;}
                        50%{transform:translate(-50%,-50%) scale(1.15);opacity:0.75;}
                    }
                    @keyframes spin   { to{transform:rotate(360deg);} }
                    @keyframes fadeIn { from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);} }
                `}</style>

                {/* instruction banner */}
                {isActive && !modelPlaced && tapCount < 3 && (
                    <InstructionBanner
                        step={tapCount}
                        quality={reticleQuality}
                    />
                )}

                {/* gesture hint */}
                {showHint && (
                    <GestureHint onDismiss={() => setHintDismissed(true)} />
                )}

                {/* result card — reset button lives here */}
                {dimensions?.widthCm && dimensions?.heightCm && (
                    <ResultCard
                        dimensions={dimensions}
                        onConfirm={handleConfirm}
                        onReset={handleReset}
                        onResetPos={handleResetPos}
                        modelLoading={modelLoading}
                        modelError={modelError}
                        modelPlaced={modelPlaced}
                    />
                )}

                {error && <div style={s.errorBanner}>{error}</div>}

                {!isActive && !error && (
                    <div style={s.startWrap}>
                        <h1 style={s.startTitle}>Measure</h1>
                        <p style={s.startText}>
                            Tap 3 corners — top-left, top-right, bottom-left.
                            The window appears automatically.
                        </p>
                        <button style={s.btnPrimary} onClick={handleStart}>
                            Start AR measurement
                        </button>
                        <button style={s.btnGhost} onClick={handleManual}>
                            Enter manually instead
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
    topBarRight: { display: 'flex', alignItems: 'center', gap: 10 },
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
    resultCard: {
        position: 'absolute',
        bottom: 40,
        left: 20,
        right: 20,
        zIndex: 50,
        background: 'rgba(10,10,20,0.92)',
        backdropFilter: 'blur(20px)',
        borderRadius: 20,
        padding: '24px 20px',
        border: '1px solid rgba(0,255,136,0.3)',
        pointerEvents: 'auto',
    },
    resultTitle: {
        color: '#00ff88',
        fontSize: 13,
        fontWeight: 600,
        letterSpacing: 1.5,
        textTransform: 'uppercase',
        marginBottom: 16,
        textAlign: 'center',
    },
    resultDims: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        marginBottom: 20,
    },
    dimBox: { display: 'flex', flexDirection: 'column', alignItems: 'center' },
    dimValue: { fontSize: 38, fontWeight: 700, color: '#fff', lineHeight: 1 },
    dimUnit: { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 4 },
    dimSep: { fontSize: 28, color: 'rgba(255,255,255,0.3)' },
    resultButtons: { display: 'flex', gap: 8 },
    btnPrimary: {
        flex: 1,
        padding: '14px 12px',
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
        padding: '14px 12px',
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
        marginTop: 10,
        width: '100%',
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
        background: 'rgba(5,5,15,0.95)',
        borderRadius: '24px 24px 0 0',
        padding: '32px 24px 48px',
        pointerEvents: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
    },
    startTitle: { fontSize: 24, fontWeight: 700, color: '#fff', margin: 0 },
    startText: {
        fontSize: 15,
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
        marginBottom: 12,
        justifyContent: 'center',
    },
    modelStatusError: {
        fontSize: 12,
        color: '#ff6b6b',
        marginBottom: 12,
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
