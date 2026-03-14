import { useEffect, useRef, useState } from 'react';
import { router } from '@inertiajs/react';
import { useWebXR } from '../hooks/useWebXR';

const STEPS = [
    {
        label: 'Top-left corner',
        hint: 'Point at the top-left corner of the opening',
    },
    { label: 'Top-right corner', hint: 'Move to the top-right corner' },
    { label: 'Bottom-left corner', hint: 'Move to the bottom-left corner' },
    { label: 'Bottom-right corner', hint: 'Move to the bottom-right corner' },
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
        <div style={styles.stepRow}>
            {STEPS.map((s, i) => (
                <div
                    key={i}
                    style={{
                        ...styles.stepDot,
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
                ...styles.qualityBadge,
                background: meta.color + '22',
                border: `1px solid ${meta.color}`,
                color: meta.color,
            }}
        >
            <div style={{ ...styles.qualityDot, background: meta.color }} />
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
                ...styles.banner,
                borderColor:
                    qualityMeta.color === 'transparent'
                        ? 'rgba(255,255,255,0.12)'
                        : qualityMeta.color + '55',
            }}
        >
            <div
                style={{
                    ...styles.bannerStep,
                    color: canTap ? '#00ff88' : '#aaa',
                }}
            >
                TAP {step + 1} / 4
            </div>
            <div style={styles.bannerLabel}>{stepInfo.label}</div>
            <div style={styles.qualityRow}>
                {['poor', 'okay', 'good', 'perfect'].map((q) => (
                    <div
                        key={q}
                        style={{
                            ...styles.qualityBar,
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
                    ...styles.bannerHint,
                    color: canTap
                        ? 'rgba(255,255,255,0.9)'
                        : 'rgba(255,200,100,0.85)',
                }}
            >
                {canTap ? stepInfo.hint : qualityMeta.hint}
            </div>
            {!canTap && quality !== 'none' && (
                <div style={styles.lockedMsg}>Hold still for a moment</div>
            )}
        </div>
    );
}

function ResultCard({
    dimensions,
    onConfirm,
    onReset,
    modelLoading,
    modelError,
}) {
    if (!dimensions?.widthCm || !dimensions?.heightCm) return null;
    return (
        <div style={styles.resultCard}>
            {/* model status */}
            {modelLoading && (
                <div style={styles.modelStatus}>
                    <div style={styles.spinner} />
                    Loading 3D model…
                </div>
            )}
            {modelError && (
                <div style={styles.modelStatusError}>{modelError}</div>
            )}

            <div style={styles.resultTitle}>Opening measured</div>
            <div style={styles.resultDims}>
                <div style={styles.dimBox}>
                    <span style={styles.dimValue}>{dimensions.widthCm}</span>
                    <span style={styles.dimUnit}>cm wide</span>
                </div>
                <div style={styles.dimSep}>×</div>
                <div style={styles.dimBox}>
                    <span style={styles.dimValue}>{dimensions.heightCm}</span>
                    <span style={styles.dimUnit}>cm tall</span>
                </div>
            </div>
            <div style={styles.resultButtons}>
                <button style={styles.btnSecondary} onClick={onReset}>
                    Re-measure
                </button>
                <button style={styles.btnPrimary} onClick={onConfirm}>
                    Find matching products
                </button>
            </div>
        </div>
    );
}

function UnsupportedCard({ onBack }) {
    return (
        <div style={styles.unsupportedWrap}>
            <div style={styles.unsupportedIcon}>⚠</div>
            <h2 style={styles.unsupportedTitle}>AR not available</h2>
            <p style={styles.unsupportedText}>
                WebXR AR requires <strong>Android Chrome</strong> on a
                compatible device. iOS and desktop are not supported.
            </p>
            <p style={styles.unsupportedText}>
                You can still enter your measurements manually.
            </p>
            <button style={styles.btnPrimary} onClick={onBack}>
                Enter measurements manually
            </button>
        </div>
    );
}

export default function ARMeasure() {
    const canvasRef = useRef(null);
    const overlayRef = useRef(null);
    const [checked, setChecked] = useState(false);

    const {
        isSupported,
        isActive,
        tapCount,
        dimensions,
        error,
        reticleQuality,
        modelLoading,
        modelError,
        checkSupport,
        startAR,
        stopAR,
        reset,
    } = useWebXR();

    useEffect(() => {
        checkSupport().then(() => setChecked(true));
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

    if (!checked) return <div style={styles.loading}>Checking AR support…</div>;
    if (isSupported === false) return <UnsupportedCard onBack={handleManual} />;

    const qualityMeta = QUALITY_META[reticleQuality] || QUALITY_META.none;
    const canTap = qualityMeta.canTap;

    return (
        <div style={styles.root}>
            <canvas ref={canvasRef} style={styles.canvas} />

            <div ref={overlayRef} style={styles.overlay}>
                {/* top bar */}
                <div style={styles.topBar}>
                    <button style={styles.closeBtn} onClick={stopAR}>
                        ✕ Exit
                    </button>
                    <div style={styles.topBarRight}>
                        <QualityBadge quality={reticleQuality} />
                        <StepIndicator current={tapCount} />
                    </div>
                </div>

                {/* reticle */}
                {isActive && tapCount < 4 && (
                    <div style={styles.reticleGuide}>
                        <div
                            style={{
                                ...styles.reticleRing,
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
                                ...styles.reticleDot,
                                background:
                                    qualityMeta.color === 'transparent'
                                        ? 'rgba(255,255,255,0.4)'
                                        : qualityMeta.color,
                            }}
                        />
                        {!canTap && reticleQuality !== 'none' && (
                            <div style={styles.reticleLock}>
                                <div style={styles.reticleLockIcon}>⊘</div>
                            </div>
                        )}
                    </div>
                )}

                <style>{`
                    @keyframes pulse {
                        0%,100% { transform: translate(-50%,-50%) scale(1);   opacity: 1; }
                        50%     { transform: translate(-50%,-50%) scale(1.15); opacity: 0.75; }
                    }
                    @keyframes spin { to { transform: rotate(360deg); } }
                `}</style>

                {/* instruction banner */}
                {isActive && tapCount < 4 && (
                    <InstructionBanner
                        step={tapCount}
                        quality={reticleQuality}
                    />
                )}

                {/* result card */}
                {dimensions?.widthCm && dimensions?.heightCm && (
                    <ResultCard
                        dimensions={dimensions}
                        onConfirm={handleConfirm}
                        onReset={reset}
                        modelLoading={modelLoading}
                        modelError={modelError}
                    />
                )}

                {error && <div style={styles.errorBanner}>{error}</div>}

                {!isActive && !error && (
                    <div style={styles.startWrap}>
                        <h1 style={styles.startTitle}>Measure</h1>
                        <p style={styles.startText}>
                            Point your camera at the door or window opening and
                            tap each of the 4 corners to measure it.
                        </p>
                        <button style={styles.btnPrimary} onClick={handleStart}>
                            Start AR measurement
                        </button>
                        <button style={styles.btnGhost} onClick={handleManual}>
                            Enter manually instead
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

const styles = {
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
        fontFamily: "'Inter', sans-serif",
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
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
        width: 56,
        height: 56,
    },
    reticleRing: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
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
        transform: 'translate(-50%, -50%)',
        width: 7,
        height: 7,
        borderRadius: '50%',
        transition: 'background 0.25s ease',
    },
    reticleLock: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
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
    resultCard: {
        position: 'absolute',
        bottom: 40,
        left: 20,
        right: 20,
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
    resultButtons: { display: 'flex', gap: 10 },
    btnPrimary: {
        flex: 1,
        padding: '14px 20px',
        background: '#00ff88',
        color: '#000',
        border: 'none',
        borderRadius: 12,
        fontSize: 15,
        fontWeight: 600,
        cursor: 'pointer',
    },
    btnSecondary: {
        flex: 0,
        padding: '14px 18px',
        background: 'rgba(255,255,255,0.1)',
        color: '#fff',
        border: '1px solid rgba(255,255,255,0.2)',
        borderRadius: 12,
        fontSize: 14,
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
