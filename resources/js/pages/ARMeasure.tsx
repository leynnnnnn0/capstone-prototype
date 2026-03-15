import { useEffect, useRef, useState } from 'react';
import { router } from '@inertiajs/react';
import { useWebXR } from '../hooks/useWebXR';

// ─── Google Fonts injected once ───────────────────────────────────────────────
const FONT_LINK = `@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Playfair+Display:ital,wght@0,700;1,700&display=swap');`;

// ── product catalog ───────────────────────────────────────────────────────────
const MODELS = [
    { id: 'window1',  name: 'Window 1',  type: 'window', file: '/models/window.glb'  },
    { id: 'window2',  name: 'Window 2',  type: 'window', file: '/models/window2.glb' },
    { id: 'door1',    name: 'Door 1',    type: 'door',   file: '/models/door1.glb'   },
    { id: 'door2',    name: 'Door 2',    type: 'door',   file: '/models/door2.glb'   },
];

const STEPS = [
    { label: 'Top-left corner',     hint: 'Tap the top-left corner of the opening'    },
    { label: 'Top-right corner',    hint: 'Tap the top-right corner'                  },
    { label: 'Bottom-left corner',  hint: 'Tap the bottom-left corner'                },
    { label: 'Bottom-right corner', hint: 'Tap the bottom-right corner — done!'       },
];

const QUALITY_META = {
    none:    { color: 'transparent', label: '',        hint: 'Searching for surface…',          canTap: false },
    poor:    { color: '#ef4444',     label: 'Poor',    hint: 'Move slowly — finding surface',   canTap: false },
    okay:    { color: '#f59e0b',     label: 'Okay',    hint: 'Almost ready — keep still',       canTap: false },
    good:    { color: '#3b82f6',     label: 'Good',    hint: 'Surface locked — tap to place',   canTap: true  },
    perfect: { color: '#10b981',     label: 'Perfect', hint: 'Surface locked — tap to place',   canTap: true  },
};

// ── ModelThumb ─────────────────────────────────────────────────────────────────
function ModelThumb({ file, size = 100 }) {
    const canvasRef = useRef(null);
    const rafRef    = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        let renderer, scene, camera, model, alive = true;

        async function init() {
            const THREE = await import('three');
            renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            renderer.setSize(size, size);
            scene  = new THREE.Scene();
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
                const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
                const loader = new GLTFLoader();
                const gltf   = await new Promise((res, rej) => loader.load(file, res, undefined, rej));
                model         = gltf.scene;
                const box     = new THREE.Box3().setFromObject(model);
                const size3   = new THREE.Vector3();
                const center  = new THREE.Vector3();
                box.getSize(size3); box.getCenter(center);
                const maxDim  = Math.max(size3.x, size3.y, size3.z);
                model.scale.setScalar(1.6 / maxDim);
                model.position.sub(center.multiplyScalar(1.6 / maxDim));
                scene.add(model);
            } catch (_) {
                const geo = new THREE.BoxGeometry(1, 1.4, 0.1);
                const mat = new THREE.MeshStandardMaterial({ color: 0x1a56db });
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
        return () => { alive = false; cancelAnimationFrame(rafRef.current); renderer?.dispose(); };
    }, [file]);

    return <canvas ref={canvasRef} width={size} height={size} style={{ display: 'block', borderRadius: 10 }} />;
}

// ── ModelSelector ──────────────────────────────────────────────────────────────
function ModelSelector({ selected, onSelect }) {
    return (
        <div style={s.selectorWrap}>
            <div style={s.selectorTitle}>Choose a product</div>
            <div style={s.selectorRow}>
                {MODELS.map((m) => {
                    const isSel = selected?.id === m.id;
                    return (
                        <button
                            key={m.id}
                            style={{
                                ...s.modelCard,
                                borderColor:    isSel ? '#1a56db' : 'rgba(26,86,219,0.15)',
                                background:     isSel ? 'rgba(26,86,219,0.07)' : '#fff',
                                transform:      isSel ? 'scale(1.04)' : 'scale(1)',
                                boxShadow:      isSel ? '0 4px 20px rgba(26,86,219,0.18)' : '0 1px 6px rgba(0,0,0,0.06)',
                            }}
                            onClick={() => onSelect(m)}
                        >
                            <div style={s.thumbWrap}>
                                <ModelThumb file={m.file} size={86} />
                            </div>
                            <div style={{
                                ...s.typePill,
                                background: m.type === 'window' ? 'rgba(59,130,246,0.1)' : 'rgba(245,158,11,0.1)',
                                color:      m.type === 'window' ? '#1a56db'               : '#b45309',
                                border:     `1px solid ${m.type === 'window' ? 'rgba(26,86,219,0.2)' : 'rgba(180,83,9,0.2)'}`,
                            }}>
                                {m.type}
                            </div>
                            <div style={{ ...s.modelName, color: isSel ? '#1a56db' : '#1e293b' }}>
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

// ── SelectedBadge ─────────────────────────────────────────────────────────────
function SelectedBadge({ model }) {
    if (!model) return null;
    return <div style={s.selectedBadge}>{model.name}</div>;
}

// ── StepIndicator ─────────────────────────────────────────────────────────────
function StepIndicator({ current }) {
    return (
        <div style={s.stepRow}>
            {STEPS.map((_, i) => (
                <div key={i} style={{
                    ...s.stepDot,
                    background: i < current ? '#1a56db' : i === current ? '#fff' : 'rgba(255,255,255,0.3)',
                    transform:  i === current ? 'scale(1.35)' : 'scale(1)',
                }} />
            ))}
        </div>
    );
}

// ── QualityBadge ──────────────────────────────────────────────────────────────
function QualityBadge({ quality }) {
    const meta = QUALITY_META[quality] || QUALITY_META.none;
    if (quality === 'none') return null;
    return (
        <div style={{
            ...s.qualityBadge,
            background: meta.color + '18',
            border:     `1px solid ${meta.color}55`,
            color:      meta.color,
        }}>
            <div style={{ ...s.qualityDot, background: meta.color }} />
            {meta.label}
        </div>
    );
}

// ── InstructionBanner ─────────────────────────────────────────────────────────
function InstructionBanner({ step, quality }) {
    const stepInfo    = STEPS[step];
    const qualityMeta = QUALITY_META[quality] || QUALITY_META.none;
    const canTap      = qualityMeta.canTap;
    return (
        <div style={{
            ...s.banner,
            borderColor: qualityMeta.color === 'transparent' ? 'rgba(255,255,255,0.15)' : qualityMeta.color + '55',
        }}>
            {/* step number pill */}
            <div style={{ ...s.bannerPill, background: canTap ? '#1a56db' : 'rgba(255,255,255,0.12)' }}>
                STEP {step + 1} / 4
            </div>
            <div style={s.bannerLabel}>{stepInfo.label}</div>

            {/* quality bar row */}
            <div style={s.qualityRow}>
                {['poor','okay','good','perfect'].map((q, i) => {
                    const levels = ['poor','okay','good','perfect'];
                    const currentIdx = levels.indexOf(quality);
                    const isActive   = i <= currentIdx && quality !== 'none';
                    return (
                        <div key={q} style={{
                            ...s.qualityBar,
                            background: isActive ? QUALITY_META[q].color : 'rgba(255,255,255,0.15)',
                        }} />
                    );
                })}
            </div>
            <div style={{ ...s.bannerHint, color: canTap ? 'rgba(255,255,255,0.95)' : 'rgba(255,210,120,0.9)' }}>
                {canTap ? stepInfo.hint : qualityMeta.hint}
            </div>
            {!canTap && quality !== 'none' && (
                <div style={s.lockedMsg}>Hold still for a moment</div>
            )}
        </div>
    );
}

// ── GestureHint ───────────────────────────────────────────────────────────────
function GestureHint({ onDismiss }) {
    useEffect(() => { const t = setTimeout(onDismiss, 5000); return () => clearTimeout(t); }, []);
    return (
        <div style={s.gestureHint}>
            <div style={s.gestureTitle}>Adjust the model</div>
            <div style={s.gestureRows}>
                <div style={s.gestureRow}><span style={s.gi}>☝</span><span style={s.gt}>1 finger drag — move</span></div>
                <div style={s.gestureRow}><span style={s.gi}>✌</span><span style={s.gt}>2 finger drag up/down — push / pull</span></div>
            </div>
            <button style={s.gestureOk} onClick={onDismiss}>Got it</button>
        </div>
    );
}

// ── ResultCard ────────────────────────────────────────────────────────────────
function ResultCard({ dimensions, selectedModel, onConfirm, onReset, onResetPos, onSwap, modelLoading, modelError, modelPlaced }) {
    if (!dimensions?.widthCm || !dimensions?.heightCm) return null;
    return (
        <div style={s.resultCard}>
            {modelLoading && (
                <div style={s.modelStatus}><div style={s.spinner} />Loading model…</div>
            )}
            {modelError && <div style={s.modelStatusError}>{modelError}</div>}

            {/* header */}
            <div style={s.resultHeader}>
                <div style={s.resultIcon}>📐</div>
                <div>
                    <div style={s.resultTitle}>Opening Measured</div>
                    <div style={s.resultSub}>Ready to find matching products</div>
                </div>
            </div>

            {/* dims */}
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

            {/* swap row */}
            {modelPlaced && (
                <div style={s.swapRow}>
                    <div style={s.swapLabel}>Showing: <strong style={{ color: '#1a56db' }}>{selectedModel?.name}</strong></div>
                    <button style={s.swapBtn} onClick={onSwap}>Swap model</button>
                </div>
            )}

            <div style={s.resultButtons}>
                <button style={s.btnSecondary} onClick={onReset}>Re-measure</button>
                {modelPlaced && <button style={s.btnSecondary} onClick={onResetPos}>↺ Reset</button>}
                <button style={s.btnPrimary} onClick={onConfirm}>Find products →</button>
            </div>
        </div>
    );
}

// ── SwapSheet ─────────────────────────────────────────────────────────────────
function SwapSheet({ selected, onSelect, onClose }) {
    return (
        <div style={s.swapSheetBg} onClick={onClose}>
            <div style={s.swapSheet} onClick={(e) => e.stopPropagation()}>
                <div style={s.swapSheetHandle} />
                <div style={s.swapSheetTitle}>Try another product</div>
                <div style={s.swapSheetSub}>Your measurement stays — no need to re-tap.</div>
                <div style={s.selectorRow}>
                    {MODELS.map((m) => {
                        const isSel = selected?.id === m.id;
                        return (
                            <button key={m.id} style={{
                                ...s.modelCard,
                                borderColor: isSel ? '#1a56db' : 'rgba(26,86,219,0.15)',
                                background:  isSel ? 'rgba(26,86,219,0.07)' : '#fff',
                                boxShadow:   isSel ? '0 4px 20px rgba(26,86,219,0.15)' : '0 1px 4px rgba(0,0,0,0.05)',
                            }} onClick={() => { onSelect(m); onClose(); }}>
                                <div style={s.thumbWrap}><ModelThumb file={m.file} size={80} /></div>
                                <div style={{
                                    ...s.typePill,
                                    background: m.type === 'window' ? 'rgba(59,130,246,0.1)' : 'rgba(245,158,11,0.1)',
                                    color:      m.type === 'window' ? '#1a56db' : '#b45309',
                                    border:     `1px solid ${m.type === 'window' ? 'rgba(26,86,219,0.2)' : 'rgba(180,83,9,0.2)'}`,
                                }}>{m.type}</div>
                                <div style={{ ...s.modelName, color: isSel ? '#1a56db' : '#1e293b' }}>{m.name}</div>
                                {isSel && <div style={s.selectedMark}>✓</div>}
                            </button>
                        );
                    })}
                </div>
                <button style={{ ...s.btnOutline, marginTop: 12, width: '100%' }} onClick={onClose}>Cancel</button>
            </div>
        </div>
    );
}

// ── UnsupportedCard ───────────────────────────────────────────────────────────
function UnsupportedCard({ onBack }) {
    return (
        <div style={s.unsupportedWrap}>
            <style>{FONT_LINK}</style>
            {/* Logo */}
            <a href='/' style={s.logoRow}>
                <div style={s.logoMark}>G</div>
                <span style={s.logoText}>Glass<span style={{ color: '#1a56db' }}>Viz</span></span>
            </a>
            <div style={s.unsupportedCard}>
                <div style={s.unsupportedIcon}>⚠️</div>
                <h2 style={s.unsupportedTitle}>AR Not Available</h2>
                <p style={s.unsupportedText}>
                    WebXR AR requires <strong>Android Chrome</strong> on a compatible device.
                </p>
                <p style={s.unsupportedText}>You can still enter your measurements manually.</p>
                <button style={s.btnPrimary} onClick={onBack}>Enter measurements manually</button>
            </div>
        </div>
    );
}

// ── main page ─────────────────────────────────────────────────────────────────
export default function ARMeasure() {
    const canvasRef   = useRef(null);
    const overlayRef  = useRef(null);
    const gestureRef  = useRef(null);

    const [checked,        setChecked]        = useState(false);
    const [hintDismissed,  setHintDismissed]  = useState(false);
    const [selectedModel,  setSelectedModel]  = useState(MODELS[0]);
    const [showSwapSheet,  setShowSwapSheet]  = useState(false);
    const [debugLog,       setDebugLog]       = useState([]);

    const {
        isSupported, isActive, tapCount, dimensions, error,
        reticleQuality, modelLoading, modelError, modelPlaced,
        checkSupport, startAR, stopAR, reset, resetModelTransform,
        setSelectedModel: setHookModel, swapModel,
    } = useWebXR();

    const dbg = (msg) => setDebugLog((prev) => [...prev.slice(-8), msg]);

    useEffect(() => {
        const t = setInterval(() => {
            if (window.__dbg?.length) {
                setDebugLog((prev) => {
                    const combined = [...prev, ...window.__dbg].slice(-8);
                    window.__dbg = [];
                    return combined;
                });
            }
        }, 500);
        return () => clearInterval(t);
    }, []);

    useEffect(() => { checkSupport().then(() => setChecked(true)); }, []);
    useEffect(() => { if (modelPlaced) setHintDismissed(false); }, [modelPlaced]);
    useEffect(() => { setHookModel(selectedModel.file); }, [selectedModel]);

    // ── gesture listeners ──────────────────────────────────────────────────────
    useEffect(() => {
        const el = gestureRef.current;
        if (!el) return;
        let lastX = 0, lastY = 0, lastMidY = 0, intent = null;

        function onStart(e) {
            if (!window.__arModel) return;
            intent = null;
            if (e.touches.length === 1) { lastX = e.touches[0].clientX; lastY = e.touches[0].clientY; intent = 'move'; }
            else if (e.touches.length === 2) { lastMidY = (e.touches[0].clientY + e.touches[1].clientY) / 2; intent = 'depth'; }
        }
        function onMove(e) {
            const model = window.__arModel, camera = window.__arCamera;
            if (!model || !camera) return;
            e.preventDefault();
            if (intent === 'move' && e.touches.length === 1) {
                const dx = (e.touches[0].clientX - lastX) / window.innerWidth;
                const dy = (e.touches[0].clientY - lastY) / window.innerHeight;
                const m = camera.matrixWorld.elements, S = 2.0;
                model.position.x += dx * m[0] * S - dy * m[4] * S;
                model.position.y += dx * m[1] * S - dy * m[5] * S;
                model.position.z += dx * m[2] * S - dy * m[6] * S;
                lastX = e.touches[0].clientX; lastY = e.touches[0].clientY;
            } else if (intent === 'depth' && e.touches.length === 2) {
                const newMid = (e.touches[0].clientY + e.touches[1].clientY) / 2;
                const dy = (newMid - lastMidY) / window.innerHeight;
                const m = camera.matrixWorld.elements, S = 1.5;
                model.position.x += dy * -m[8] * S; model.position.y += dy * -m[9] * S; model.position.z += dy * -m[10] * S;
                lastMidY = newMid;
            }
        }
        function onEnd(e) {
            if (e.touches.length === 0) intent = null;
            else if (e.touches.length === 1) { lastX = e.touches[0].clientX; lastY = e.touches[0].clientY; intent = 'move'; }
        }
        el.addEventListener('touchstart', onStart, { passive: true });
        el.addEventListener('touchmove',  onMove,  { passive: false });
        el.addEventListener('touchend',   onEnd,   { passive: true });
        return () => { el.removeEventListener('touchstart', onStart); el.removeEventListener('touchmove', onMove); el.removeEventListener('touchend', onEnd); };
    }, []);

    const handleSwapSelect = async (newModel) => {
        dbg('swap start: ' + newModel.name);
        setSelectedModel(newModel);
        setHookModel(newModel.file);
        setShowSwapSheet(false);
        try { await swapModel(newModel.file); dbg('swap done: ' + newModel.name); }
        catch (e) { dbg('swap ERROR: ' + e.message); }
    };

    const handleStart   = () => startAR(canvasRef.current, overlayRef.current);
    const handleManual  = () => router.visit('/measure/manual');
    const handleConfirm = () => { if (!dimensions) return; stopAR(); router.visit('/products', { data: { w: dimensions.widthCm, h: dimensions.heightCm } }); };
    const handleReset   = () => { setHintDismissed(false); reset(); };
    const handleResetPos = () => resetModelTransform();

    if (!checked) return (
        <div style={s.loadingWrap}>
            <style>{FONT_LINK}</style>
            <div style={s.logoRow}><div style={s.logoMark}>G</div><span style={s.logoText}>Glass<span style={{ color:'#1a56db' }}>Viz</span></span></div>
            <div style={s.loadingSpinner} />
            <div style={s.loadingText}>Checking AR support…</div>
        </div>
    );
    if (isSupported === false) return <UnsupportedCard onBack={handleManual} />;

    const qualityMeta = QUALITY_META[reticleQuality] || QUALITY_META.none;
    const canTap      = qualityMeta.canTap;
    const showReticle = isActive && tapCount < 4 && !modelPlaced;
    const showHint    = modelPlaced && !hintDismissed && !modelLoading;

    return (
        <div style={s.root}>
            <style>{FONT_LINK}{`
                @keyframes pulse  { 0%,100%{transform:translate(-50%,-50%) scale(1);opacity:1;} 50%{transform:translate(-50%,-50%) scale(1.18);opacity:.7;} }
                @keyframes spin   { to{transform:rotate(360deg);} }
                @keyframes fadeIn { from{opacity:0;transform:translateY(10px);} to{opacity:1;transform:translateY(0);} }
                @keyframes slideUp{ from{opacity:0;transform:translateY(50px);} to{opacity:1;transform:translateY(0);} }
                @keyframes shimmer{ 0%{background-position:-200% 0;} 100%{background-position:200% 0;} }
            `}</style>

            <canvas ref={canvasRef} style={s.canvas} />

            {/* debug overlay */}
            <div style={s.debugOverlay}>
                <div style={s.debugLine}>DBG | placed:{modelPlaced?'Y':'N'} loading:{modelLoading?'Y':'N'} swap:{showSwapSheet?'Y':'N'}</div>
                {debugLog.map((l, i) => <div key={i} style={s.debugEntry}>{l}</div>)}
            </div>

            {/* gesture layer */}
            <div ref={gestureRef} style={{ ...s.gestureLayer, pointerEvents: modelPlaced ? 'auto' : 'none' }} />

            {/* XR DOM overlay */}
            <div ref={overlayRef} style={s.overlay}>

                {/* ── top bar ── */}
                <div style={s.topBar}>
                    <button style={s.closeBtn} onClick={stopAR}>
                        <span style={s.closeBtnX}>✕</span> Exit AR
                    </button>
                    <div style={s.topBarRight}>
                        {isActive && <SelectedBadge model={selectedModel} />}
                        <QualityBadge quality={reticleQuality} />
                        {!modelPlaced && <StepIndicator current={tapCount} />}
                    </div>
                </div>

                {/* ── reticle ── */}
                {showReticle && (
                    <div style={s.reticleGuide}>
                        <div style={{
                            ...s.reticleRing,
                            borderColor: qualityMeta.color === 'transparent' ? 'rgba(255,255,255,0.4)' : qualityMeta.color,
                            boxShadow:   canTap ? `0 0 16px ${qualityMeta.color}66` : 'none',
                            animation:   canTap ? 'pulse 1.2s ease-in-out infinite' : 'none',
                        }} />
                        <div style={{ ...s.reticleDot, background: qualityMeta.color === 'transparent' ? 'rgba(255,255,255,0.5)' : qualityMeta.color }} />
                        {!canTap && reticleQuality !== 'none' && (
                            <div style={s.reticleLock}><div style={s.reticleLockIcon}>⊘</div></div>
                        )}
                    </div>
                )}

                {/* ── instruction banner ── */}
                {isActive && !modelPlaced && tapCount < 4 && (
                    <InstructionBanner step={tapCount} quality={reticleQuality} />
                )}

                {/* ── gesture hint ── */}
                {showHint && <GestureHint onDismiss={() => setHintDismissed(true)} />}

                {/* ── result card ── */}
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

                {/* ── swap sheet ── */}
                {showSwapSheet && (
                    <SwapSheet selected={selectedModel} onSelect={handleSwapSelect} onClose={() => setShowSwapSheet(false)} />
                )}

                {/* ── error banner ── */}
                {error && <div style={s.errorBanner}>{error}</div>}

                {/* ── start screen ── */}
                {!isActive && !error && (
                    <div style={s.startWrap}>
                        {/* brand strip */}
                        <div style={s.startBrand}>
                            <div style={s.logoMark}>G</div>
                            <div>
                                <div style={s.startBrandName}>Glass<span style={{ color:'#1a56db' }}>Viz</span></div>
                                <div style={s.startBrandSub}>AR Measurement</div>
                            </div>
                        </div>

                        <div style={s.startDivider} />

                        <h1 style={s.startTitle}>Measure Your Opening</h1>
                        <p style={s.startText}>
                            Pick a product below, then tap all 4 corners of the opening to measure and preview it in augmented reality.
                        </p>

                        {/* step preview pills */}
                        <div style={s.startSteps}>
                            {['Choose product','Tap 4 corners','See it in AR','Get a quote'].map((label, i) => (
                                <div key={label} style={s.startStep}>
                                    <div style={s.startStepNum}>{i + 1}</div>
                                    <div style={s.startStepLabel}>{label}</div>
                                </div>
                            ))}
                        </div>

                        <ModelSelector selected={selectedModel} onSelect={setSelectedModel} />

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
        position: 'relative', width: '100vw', height: '100vh',
        overflow: 'hidden', background: '#000', fontFamily: FONT,
    },
    canvas: {
        position: 'absolute', top: 0, left: 0,
        width: '100%', height: '100%', zIndex: 1,
    },
    gestureLayer: {
        position: 'absolute', top: 0, left: 0,
        width: '100%', height: '100%', zIndex: 5,
    },
    overlay: {
        position: 'absolute', top: 0, left: 0,
        width: '100%', height: '100%',
        pointerEvents: 'none',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        fontFamily: FONT, zIndex: 10,
    },

    // ── debug ──
    debugOverlay: {
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 99999,
        background: 'rgba(0,0,0,0.88)', padding: '6px 10px', pointerEvents: 'none',
    },
    debugLine:  { color: '#4ade80', fontSize: 10, fontFamily: 'monospace' },
    debugEntry: { color: '#fde047', fontSize: 10, fontFamily: 'monospace' },

    // ── loading / unsupported ──
    loadingWrap: {
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', minHeight: '100vh', background: '#f0f4ff',
        gap: 20, fontFamily: FONT,
    },
    loadingSpinner: {
        width: 36, height: 36,
        border: '3px solid rgba(26,86,219,0.15)',
        borderTopColor: '#1a56db', borderRadius: '50%',
        animation: 'spin 0.9s linear infinite',
    },
    loadingText: { fontSize: 15, color: '#64748b', fontWeight: 500 },

    logoRow: { display: 'flex', alignItems: 'center', gap: 10 },
    logoMark: {
        width: 36, height: 36, borderRadius: 10,
        background: 'linear-gradient(135deg,#1a56db,#3b82f6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontWeight: 900, fontSize: 18,
    },
    logoText: { fontWeight: 700, fontSize: 20, color: '#1e293b', fontFamily: FONT },

    unsupportedWrap: {
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', minHeight: '100vh',
        background: '#f0f4ff', padding: '32px 24px',
        gap: 20, fontFamily: FONT,
    },
    unsupportedCard: {
        background: '#fff', borderRadius: 24, padding: '32px 24px',
        border: '1px solid rgba(26,86,219,0.1)',
        boxShadow: '0 8px 32px rgba(26,86,219,0.08)',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 12, maxWidth: 340, width: '100%', textAlign: 'center',
    },
    unsupportedIcon:  { fontSize: 44 },
    unsupportedTitle: { fontSize: 20, fontWeight: 700, color: '#1e293b', margin: 0 },
    unsupportedText:  { fontSize: 14, color: '#64748b', lineHeight: 1.6, margin: 0 },

    // ── top bar ──
    topBar: {
        width: '100%', display: 'flex',
        alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 18px', pointerEvents: 'auto',
    },
    closeBtn: {
        display: 'flex', alignItems: 'center', gap: 6,
        background: 'rgba(255,255,255,0.15)',
        backdropFilter: 'blur(12px)',
        color: '#fff', border: '1px solid rgba(255,255,255,0.25)',
        borderRadius: 10, padding: '8px 14px',
        fontSize: 13, fontWeight: 600, cursor: 'pointer',
        fontFamily: FONT,
    },
    closeBtnX: { fontSize: 12, opacity: 0.7 },
    topBarRight: { display: 'flex', alignItems: 'center', gap: 8 },

    qualityBadge: {
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '5px 11px', borderRadius: 20,
        fontSize: 11, fontWeight: 700, letterSpacing: 0.3,
        transition: 'all 0.3s ease',
        backdropFilter: 'blur(8px)',
    },
    qualityDot: { width: 6, height: 6, borderRadius: '50%' },

    selectedBadge: {
        background: 'rgba(26,86,219,0.2)',
        backdropFilter: 'blur(8px)',
        color: '#fff', border: '1px solid rgba(59,130,246,0.4)',
        borderRadius: 20, padding: '5px 12px',
        fontSize: 11, fontWeight: 600,
    },
    stepRow: { display: 'flex', gap: 7, alignItems: 'center' },
    stepDot: {
        width: 8, height: 8, borderRadius: '50%',
        transition: 'all 0.25s ease',
    },

    // ── reticle ──
    reticleGuide: {
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%,-50%)',
        pointerEvents: 'none', width: 58, height: 58,
    },
    reticleRing: {
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%,-50%)',
        width: 54, height: 54, borderRadius: '50%',
        border: '2.5px solid',
        transition: 'border-color 0.25s, box-shadow 0.25s',
    },
    reticleDot: {
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%,-50%)',
        width: 6, height: 6, borderRadius: '50%',
        transition: 'background 0.25s',
    },
    reticleLock: {
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%,-50%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
    },
    reticleLockIcon: { fontSize: 18, color: 'rgba(255,255,255,0.45)', lineHeight: 1 },

    // ── instruction banner ──
    banner: {
        position: 'absolute', bottom: 170,
        left: '50%', transform: 'translateX(-50%)',
        background: 'rgba(15,23,42,0.85)',
        backdropFilter: 'blur(16px)',
        borderRadius: 18, padding: '18px 26px',
        textAlign: 'center', minWidth: 280,
        border: '1px solid',
        pointerEvents: 'none',
        transition: 'border-color 0.3s ease',
    },
    bannerPill: {
        display: 'inline-block',
        padding: '3px 10px', borderRadius: 20,
        fontSize: 10, fontWeight: 700, letterSpacing: 2,
        color: '#fff', marginBottom: 8,
        transition: 'background 0.3s',
    },
    bannerLabel: { fontSize: 17, fontWeight: 700, color: '#f1f5f9', marginBottom: 10 },
    qualityRow: { display: 'flex', gap: 4, justifyContent: 'center', marginBottom: 8 },
    qualityBar: { width: 34, height: 3, borderRadius: 2, transition: 'background 0.3s ease' },
    bannerHint: { fontSize: 13, lineHeight: 1.4, transition: 'color 0.3s ease' },
    lockedMsg: { marginTop: 6, fontSize: 11, color: 'rgba(251,191,36,0.7)', letterSpacing: 0.4 },

    // ── gesture hint ──
    gestureHint: {
        position: 'absolute', bottom: 280,
        left: 20, right: 20, zIndex: 100,
        background: 'rgba(15,23,42,0.94)',
        backdropFilter: 'blur(20px)',
        borderRadius: 20, padding: '18px 22px',
        border: '1px solid rgba(59,130,246,0.35)',
        pointerEvents: 'auto',
        animation: 'fadeIn 0.3s ease',
    },
    gestureTitle: {
        color: '#3b82f6', fontSize: 11, fontWeight: 700,
        letterSpacing: 1.8, textTransform: 'uppercase',
        marginBottom: 12, textAlign: 'center',
    },
    gestureRows: { display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 },
    gestureRow:  { display: 'flex', alignItems: 'center', gap: 10 },
    gi: { fontSize: 18, width: 24, textAlign: 'center', flexShrink: 0 },
    gt: { fontSize: 13, color: 'rgba(241,245,249,0.75)' },
    gestureOk: {
        width: '100%', padding: '11px',
        background: 'linear-gradient(135deg,#1a56db,#3b82f6)',
        color: '#fff', border: 'none', borderRadius: 12,
        fontSize: 14, fontWeight: 700, cursor: 'pointer',
        fontFamily: FONT,
    },

    // ── model selector ──
    selectorWrap: { width: '100%', marginBottom: 6 },
    selectorTitle: {
        fontSize: 11, fontWeight: 700, color: '#94a3b8',
        letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10,
    },
    selectorRow: {
        display: 'flex', gap: 10, overflowX: 'auto',
        paddingBottom: 4, WebkitOverflowScrolling: 'touch',
    },
    modelCard: {
        flexShrink: 0, width: 110, borderRadius: 16,
        padding: '10px 8px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        cursor: 'pointer', transition: 'all 0.2s ease',
        pointerEvents: 'auto', position: 'relative',
        border: '1.5px solid',
    },
    thumbWrap: {
        width: 86, height: 86, borderRadius: 10, overflow: 'hidden',
        background: '#f1f5f9',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
    },
    typePill: {
        fontSize: 9, fontWeight: 700, letterSpacing: 1.2,
        textTransform: 'uppercase', padding: '2px 8px', borderRadius: 20,
    },
    modelName: { fontSize: 12, fontWeight: 600, textAlign: 'center', transition: 'color 0.2s' },
    selectedMark: {
        position: 'absolute', top: 6, right: 8,
        fontSize: 11, color: '#1a56db', fontWeight: 800,
    },

    // ── result card ──
    resultCard: {
        position: 'absolute', bottom: 32,
        left: 16, right: 16, zIndex: 50,
        background: 'rgba(255,255,255,0.97)',
        backdropFilter: 'blur(24px)',
        borderRadius: 24, padding: '20px',
        border: '1px solid rgba(26,86,219,0.15)',
        boxShadow: '0 20px 60px rgba(15,23,42,0.25)',
        pointerEvents: 'auto',
        animation: 'slideUp 0.3s ease',
    },
    resultHeader: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 },
    resultIcon: {
        width: 44, height: 44, borderRadius: 12,
        background: 'linear-gradient(135deg,#1a56db,#3b82f6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 20, flexShrink: 0,
    },
    resultTitle: { fontSize: 15, fontWeight: 700, color: '#1e293b' },
    resultSub:   { fontSize: 12, color: '#64748b', marginTop: 2 },
    resultDims: {
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 12, marginBottom: 16,
        padding: '14px', borderRadius: 14,
        background: 'rgba(26,86,219,0.05)',
        border: '1px solid rgba(26,86,219,0.1)',
    },
    dimBox:  { display: 'flex', flexDirection: 'column', alignItems: 'center' },
    dimValue: { fontSize: 38, fontWeight: 800, color: '#1e293b', lineHeight: 1 },
    dimUnit:  { fontSize: 11, color: '#94a3b8', marginTop: 4, fontWeight: 500 },
    dimSep:   { fontSize: 24, color: '#cbd5e1' },

    swapRow: {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 12, padding: '8px 12px',
        background: '#f8fafc', borderRadius: 10,
        border: '1px solid #e2e8f0',
    },
    swapLabel: { fontSize: 12, color: '#64748b' },
    swapBtn: {
        fontSize: 11, fontWeight: 700, color: '#1a56db',
        background: 'transparent',
        border: '1px solid rgba(26,86,219,0.25)',
        borderRadius: 8, padding: '4px 10px', cursor: 'pointer',
        fontFamily: FONT,
    },
    resultButtons: { display: 'flex', gap: 8 },

    // ── buttons ──
    btnPrimary: {
        flex: 1, padding: '14px 12px',
        background: 'linear-gradient(135deg,#1a56db,#3b82f6)',
        color: '#fff', border: 'none', borderRadius: 12,
        fontSize: 14, fontWeight: 700, cursor: 'pointer',
        fontFamily: FONT, letterSpacing: 0.2,
        boxShadow: '0 4px 16px rgba(26,86,219,0.3)',
    },
    btnSecondary: {
        flex: 0, padding: '14px 12px',
        background: '#f1f5f9', color: '#475569',
        border: '1px solid #e2e8f0',
        borderRadius: 12, fontSize: 13,
        cursor: 'pointer', whiteSpace: 'nowrap',
        fontFamily: FONT,
    },
    btnOutline: {
        padding: '14px 20px',
        background: 'transparent',
        color: '#64748b',
        border: '1px solid #cbd5e1',
        borderRadius: 12, fontSize: 14,
        cursor: 'pointer', width: '100%',
        fontFamily: FONT,
    },

    // ── swap sheet ──
    swapSheetBg: {
        position: 'absolute', inset: 0,
        background: 'rgba(15,23,42,0.55)',
        backdropFilter: 'blur(4px)',
        zIndex: 200,
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
        pointerEvents: 'auto',
    },
    swapSheet: {
        background: '#fff',
        borderRadius: '24px 24px 0 0',
        padding: '8px 20px 44px',
        boxShadow: '0 -8px 40px rgba(15,23,42,0.15)',
        animation: 'slideUp 0.25s ease',
    },
    swapSheetHandle: {
        width: 36, height: 4, borderRadius: 2,
        background: '#e2e8f0', margin: '12px auto 16px',
    },
    swapSheetTitle: { color: '#1e293b', fontSize: 17, fontWeight: 700, textAlign: 'center', marginBottom: 4 },
    swapSheetSub:   { color: '#94a3b8', fontSize: 12, textAlign: 'center', marginBottom: 16 },

    errorBanner: {
        position: 'absolute', bottom: 36,
        left: 16, right: 16,
        background: '#fef2f2',
        border: '1px solid #fecaca',
        borderRadius: 14, padding: '14px 18px',
        color: '#dc2626', fontSize: 13,
        textAlign: 'center', pointerEvents: 'auto',
        fontWeight: 500,
    },

    // ── model status ──
    modelStatus: {
        display: 'flex', alignItems: 'center', gap: 8,
        fontSize: 12, color: '#64748b',
        marginBottom: 10, justifyContent: 'center',
    },
    modelStatusError: { fontSize: 12, color: '#dc2626', marginBottom: 10, textAlign: 'center' },
    spinner: {
        width: 13, height: 13,
        border: '2px solid rgba(26,86,219,0.15)',
        borderTopColor: '#1a56db',
        borderRadius: '50%', animation: 'spin 0.8s linear infinite',
    },

    // ── start screen ──
    startWrap: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: '#fff',
        borderRadius: '26px 26px 0 0',
        padding: '0 20px 44px',
        pointerEvents: 'auto',
        display: 'flex', flexDirection: 'column', gap: 14,
        maxHeight: '88vh', overflowY: 'auto',
        boxShadow: '0 -8px 40px rgba(15,23,42,0.12)',
    },
    startBrand: {
        display: 'flex', alignItems: 'center', gap: 12,
        paddingTop: 24,
    },
    startBrandName: { fontSize: 18, fontWeight: 700, color: '#1e293b', lineHeight: 1 },
    startBrandSub:  { fontSize: 11, color: '#94a3b8', marginTop: 2, letterSpacing: 0.5, textTransform: 'uppercase' },
    startDivider: { height: 1, background: '#f1f5f9', margin: '0 -20px' },
    startTitle: { fontSize: 22, fontWeight: 800, color: '#1e293b', margin: 0, lineHeight: 1.2 },
    startText:  { fontSize: 14, color: '#64748b', lineHeight: 1.6, margin: 0 },

    startSteps: {
        display: 'flex', gap: 8, overflowX: 'auto',
        paddingBottom: 2, WebkitOverflowScrolling: 'touch',
    },
    startStep: {
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 6, flexShrink: 0,
        background: '#f8faff', borderRadius: 12,
        padding: '10px 12px', border: '1px solid rgba(26,86,219,0.1)',
        minWidth: 78,
    },
    startStepNum: {
        width: 26, height: 26, borderRadius: 8,
        background: 'linear-gradient(135deg,#1a56db,#3b82f6)',
        color: '#fff', fontSize: 12, fontWeight: 800,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
    },
    startStepLabel: { fontSize: 10, fontWeight: 600, color: '#475569', textAlign: 'center', lineHeight: 1.3 },
};