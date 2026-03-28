import { useEffect, useRef, useState, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type SurfaceType = 'floor' | 'wall' | 'ceiling' | 'unknown';

interface PlacedMarker {
    id: number;
    matrix: Float32Array;
    surface: SurfaceType;
}

interface ReticleState {
    visible: boolean;
    matrix: Float32Array | null;
    surface: SurfaceType;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Infer surface type from the hit pose transform matrix.
 * The matrix is column-major (WebGL convention).
 * Column 1 (indices 4,5,6) is the "up" vector of the hit surface normal.
 * - Floor:   up.y ≈ +1  (surface faces up)
 * - Ceiling: up.y ≈ -1  (surface faces down)
 * - Wall:    up.y ≈  0  (surface faces sideways)
 */
function detectSurface(matrix: Float32Array): SurfaceType {
    // Column-major: up vector is col[1] = [m[4], m[5], m[6]]
    const upY = matrix[5];
    if (upY > 0.7) return 'floor';
    if (upY < -0.7) return 'ceiling';
    if (Math.abs(upY) < 0.3) return 'wall';
    return 'unknown';
}

const SURFACE_COLORS: Record<SurfaceType, string> = {
    floor: '#22c55e', // green
    wall: '#3b82f6', // blue
    ceiling: '#f59e0b', // amber
    unknown: '#a855f7', // purple
};

const SURFACE_LABELS: Record<SurfaceType, string> = {
    floor: 'Floor',
    wall: 'Wall',
    ceiling: 'Ceiling',
    unknown: 'Surface',
};

// ─── WebGL helpers ────────────────────────────────────────────────────────────

function createShader(gl: WebGLRenderingContext, type: number, src: string) {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    return shader;
}

function createProgram(
    gl: WebGLRenderingContext,
    vs: string,
    fs: string,
): WebGLProgram {
    const prog = gl.createProgram()!;
    gl.attachShader(prog, createShader(gl, gl.VERTEX_SHADER, vs));
    gl.attachShader(prog, createShader(gl, gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(prog);
    return prog;
}

// Simple vertex + fragment shaders for colored geometry
const VS = `
  attribute vec3 aPos;
  uniform mat4 uModel;
  uniform mat4 uViewProj;
  void main() {
    gl_Position = uViewProj * uModel * vec4(aPos, 1.0);
  }
`;

const FS = `
  precision mediump float;
  uniform vec4 uColor;
  void main() {
    gl_FragColor = uColor;
  }
`;

/** Multiply two 4x4 column-major matrices */
function mat4Multiply(a: Float32Array, b: Float32Array): Float32Array {
    const out = new Float32Array(16);
    for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 4; col++) {
            let sum = 0;
            for (let k = 0; k < 4; k++) sum += a[row + k * 4] * b[k + col * 4];
            out[row + col * 4] = sum;
        }
    }
    return out;
}

function mat4Identity(): Float32Array {
    const m = new Float32Array(16);
    m[0] = m[5] = m[10] = m[15] = 1;
    return m;
}

function hexToVec4(hex: string, alpha = 1): [number, number, number, number] {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return [r, g, b, alpha];
}

/** Build vertices for a flat disc (reticle) lying on XZ plane */
function buildDisc(radius: number, segments: number): Float32Array {
    const verts: number[] = [];
    for (let i = 0; i < segments; i++) {
        const a0 = (i / segments) * Math.PI * 2;
        const a1 = ((i + 1) / segments) * Math.PI * 2;
        verts.push(0, 0, 0);
        verts.push(Math.cos(a0) * radius, 0, Math.sin(a0) * radius);
        verts.push(Math.cos(a1) * radius, 0, Math.sin(a1) * radius);
    }
    return new Float32Array(verts);
}

/** Build a small pin: disc base + vertical stem */
function buildPin(baseRadius: number, height: number): Float32Array {
    const disc = buildDisc(baseRadius, 16);
    // stem: two triangles forming a thin vertical quad
    const hw = baseRadius * 0.15;
    const stem = new Float32Array([
        -hw,
        0,
        0,
        hw,
        0,
        0,
        0,
        height,
        0,
        -hw,
        0,
        0,
        0,
        height,
        0,
        hw,
        0,
        0,
    ]);
    const merged = new Float32Array(disc.length + stem.length);
    merged.set(disc, 0);
    merged.set(stem, disc.length);
    return merged;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ARMeasure() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const stateRef = useRef({
        session: null as XRSession | null,
        refSpace: null as XRReferenceSpace | null,
        viewerSpace: null as XRReferenceSpace | null,
        hitTestSource: null as XRHitTestSource | null,
        gl: null as WebGLRenderingContext | null,
        program: null as WebGLProgram | null,
        reticleMatrix: null as Float32Array | null,
        reticleSurface: 'unknown' as SurfaceType,
        reticleVisible: false,
        markers: [] as PlacedMarker[],
        markerIdCounter: 0,
        discVerts: null as Float32Array | null,
        discBuf: null as WebGLBuffer | null,
        pinVerts: null as WebGLBuffer | null,
        pinVertCount: 0,
        animFrameId: 0,
    });

    const [arSupported, setArSupported] = useState<boolean | null>(null);
    const [sessionActive, setSessionActive] = useState(false);
    const [reticle, setReticle] = useState<ReticleState>({
        visible: false,
        matrix: null,
        surface: 'unknown',
    });
    const [markers, setMarkers] = useState<PlacedMarker[]>([]);
    const [statusMsg, setStatusMsg] = useState('Point at a surface');

    // Check AR support
    useEffect(() => {
        if (!navigator.xr) {
            setArSupported(false);
            return;
        }
        navigator.xr
            .isSessionSupported('immersive-ar')
            .then(setArSupported)
            .catch(() => setArSupported(false));
    }, []);

    const startAR = useCallback(async () => {
        if (!navigator.xr || !canvasRef.current) return;
        const s = stateRef.current;

        try {
            const session = await navigator.xr.requestSession('immersive-ar', {
                requiredFeatures: ['local', 'hit-test'],
                optionalFeatures: ['plane-detection'],
            });
            s.session = session;
            setSessionActive(true);

            // WebGL context
            const gl = canvasRef.current.getContext('webgl', {
                xrCompatible: true,
            }) as WebGLRenderingContext;
            s.gl = gl;

            // Shader program
            const prog = createProgram(gl, VS, FS);
            s.program = prog;

            // Geometry buffers
            const discVerts = buildDisc(0.08, 32);
            s.discVerts = discVerts;
            const discBuf = gl.createBuffer()!;
            gl.bindBuffer(gl.ARRAY_BUFFER, discBuf);
            gl.bufferData(gl.ARRAY_BUFFER, discVerts, gl.STATIC_DRAW);
            s.discBuf = discBuf;

            const pinVerts = buildPin(0.04, 0.12);
            s.pinVertCount = pinVerts.length / 3;
            const pinBuf = gl.createBuffer()!;
            gl.bindBuffer(gl.ARRAY_BUFFER, pinBuf);
            gl.bufferData(gl.ARRAY_BUFFER, pinVerts, gl.STATIC_DRAW);
            s.pinVerts = pinBuf;

            session.updateRenderState({
                baseLayer: new XRWebGLLayer(session, gl),
            });

            // Reference spaces
            const viewerSpace = await session.requestReferenceSpace('viewer');
            s.viewerSpace = viewerSpace;

            const hitTestSource = await session.requestHitTestSource!({
                space: viewerSpace,
            });
            s.hitTestSource = hitTestSource;

            const refSpace = await session.requestReferenceSpace('local');
            s.refSpace = refSpace;

            session.addEventListener('end', () => {
                s.session = null;
                s.hitTestSource = null;
                setSessionActive(false);
                setReticle({
                    visible: false,
                    matrix: null,
                    surface: 'unknown',
                });
                setMarkers([]);
                setStatusMsg('Point at a surface');
            });

            session.addEventListener('select', () => {
                if (!s.reticleVisible || !s.reticleMatrix) return;
                const newMarker: PlacedMarker = {
                    id: ++s.markerIdCounter,
                    matrix: new Float32Array(s.reticleMatrix),
                    surface: s.reticleSurface,
                };
                s.markers.push(newMarker);
                setMarkers([...s.markers]);
            });

            session.requestAnimationFrame(onXRFrame);
        } catch (err) {
            console.error('AR session failed:', err);
            setStatusMsg('Failed to start AR');
        }
    }, []);

    const stopAR = useCallback(() => {
        const s = stateRef.current;
        if (s.hitTestSource) {
            s.hitTestSource.cancel();
            s.hitTestSource = null;
        }
        if (s.session) {
            s.session.end();
        }
    }, []);

    const clearMarkers = useCallback(() => {
        stateRef.current.markers = [];
        setMarkers([]);
    }, []);

    function onXRFrame(t: number, frame: XRFrame) {
        const s = stateRef.current;
        if (!s.session || !s.refSpace || !s.gl || !s.program) return;

        const session = frame.session;
        const pose = frame.getViewerPose(s.refSpace);
        const gl = s.gl;
        const prog = s.program;
        const layer = session.renderState.baseLayer!;

        s.reticleVisible = false;

        // ── Hit test from screen center ──────────────────────────────────────────
        if (s.hitTestSource && pose) {
            const results = frame.getHitTestResults(s.hitTestSource);
            if (results.length > 0) {
                const hitPose = results[0].getPose(s.refSpace);
                if (hitPose) {
                    s.reticleVisible = true;
                    s.reticleMatrix = hitPose.transform.matrix as Float32Array;
                    s.reticleSurface = detectSurface(s.reticleMatrix);
                    const surface = s.reticleSurface;
                    setReticle({
                        visible: true,
                        matrix: s.reticleMatrix,
                        surface,
                    });
                    setStatusMsg(
                        `${SURFACE_LABELS[surface]} detected — tap to mark`,
                    );
                }
            } else {
                setReticle({
                    visible: false,
                    matrix: null,
                    surface: 'unknown',
                });
                setStatusMsg('Point at a surface');
            }
        }

        // ── WebGL rendering ──────────────────────────────────────────────────────
        gl.bindFramebuffer(gl.FRAMEBUFFER, layer.framebuffer);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        if (!pose) {
            session.requestAnimationFrame(onXRFrame);
            return;
        }

        gl.useProgram(prog);
        const aPos = gl.getAttribLocation(prog, 'aPos');
        const uModel = gl.getUniformLocation(prog, 'uModel');
        const uViewProj = gl.getUniformLocation(prog, 'uViewProj');
        const uColor = gl.getUniformLocation(prog, 'uColor');

        for (const view of pose.views) {
            const vp = layer.getViewport(view)!;
            gl.viewport(vp.x, vp.y, vp.width, vp.height);

            const vMat = view.transform.inverse.matrix as Float32Array;
            const pMat = view.projectionMatrix as Float32Array;
            const viewProj = mat4Multiply(pMat, vMat);
            gl.uniformMatrix4fv(uViewProj, false, viewProj);

            // ── Draw reticle ────────────────────────────────────────────────────
            if (s.reticleVisible && s.reticleMatrix && s.discBuf) {
                gl.bindBuffer(gl.ARRAY_BUFFER, s.discBuf);
                gl.enableVertexAttribArray(aPos);
                gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);

                const color = SURFACE_COLORS[s.reticleSurface];
                const [r, g, b] = hexToVec4(color);

                // Outer ring (slightly transparent fill)
                gl.uniformMatrix4fv(uModel, false, s.reticleMatrix);
                gl.uniform4f(uColor, r, g, b, 0.5);
                gl.drawArrays(gl.TRIANGLES, 0, s.discVerts!.length / 3);

                // Pulsing inner ring (scale by time)
                const pulse = 0.5 + 0.5 * Math.sin(t * 0.003);
                const innerScale = 0.4 + 0.2 * pulse;
                const scaled = new Float32Array(s.reticleMatrix);
                // Uniform scale the X/Z columns
                scaled[0] *= innerScale;
                scaled[1] *= innerScale;
                scaled[2] *= innerScale;
                scaled[8] *= innerScale;
                scaled[9] *= innerScale;
                scaled[10] *= innerScale;
                gl.uniformMatrix4fv(uModel, false, scaled);
                gl.uniform4f(uColor, r, g, b, 0.9);
                gl.drawArrays(gl.TRIANGLES, 0, s.discVerts!.length / 3);
            }

            // ── Draw placed markers ─────────────────────────────────────────────
            if (s.pinVerts) {
                gl.bindBuffer(gl.ARRAY_BUFFER, s.pinVerts);
                gl.enableVertexAttribArray(aPos);
                gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);

                for (const marker of s.markers) {
                    const color = SURFACE_COLORS[marker.surface];
                    const [r, g, b] = hexToVec4(color);
                    gl.uniformMatrix4fv(uModel, false, marker.matrix);
                    gl.uniform4f(uColor, r, g, b, 1.0);
                    gl.drawArrays(gl.TRIANGLES, 0, s.pinVertCount);
                }
            }
        }

        session.requestAnimationFrame(onXRFrame);
    }

    // ─── UI ────────────────────────────────────────────────────────────────────

    const surfaceColor = SURFACE_COLORS[reticle.surface];

    return (
        <div
            style={{
                fontFamily: 'system-ui, sans-serif',
                maxWidth: 480,
                margin: '0 auto',
                padding: 24,
            }}
        >
            <h2 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 500 }}>
                AR Surface Hit-Test
            </h2>
            <p style={{ margin: '0 0 20px', color: '#666', fontSize: 14 }}>
                Detects floors, walls &amp; ceilings. Tap to leave a 3D marker
                at each surface.
            </p>

            {/* Status badge */}
            {sessionActive && (
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: 16,
                        padding: '8px 12px',
                        borderRadius: 8,
                        background: '#f1f5f9',
                        fontSize: 14,
                    }}
                >
                    <span
                        style={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            background: reticle.visible
                                ? surfaceColor
                                : '#94a3b8',
                            flexShrink: 0,
                            transition: 'background 0.3s',
                        }}
                    />
                    <span style={{ color: '#334155' }}>{statusMsg}</span>
                </div>
            )}

            {/* Surface legend */}
            <div
                style={{
                    display: 'flex',
                    gap: 12,
                    marginBottom: 20,
                    flexWrap: 'wrap',
                }}
            >
                {(['floor', 'wall', 'ceiling'] as SurfaceType[]).map((s) => (
                    <div
                        key={s}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            fontSize: 13,
                        }}
                    >
                        <span
                            style={{
                                width: 12,
                                height: 12,
                                borderRadius: 3,
                                background: SURFACE_COLORS[s],
                                flexShrink: 0,
                            }}
                        />
                        <span
                            style={{
                                color: '#475569',
                                textTransform: 'capitalize',
                            }}
                        >
                            {s}
                        </span>
                    </div>
                ))}
            </div>

            {/* Canvas (hidden — AR renders to XRWebGLLayer framebuffer) */}
            <canvas ref={canvasRef} style={{ display: 'none' }} />

            {/* AR not supported */}
            {arSupported === false && (
                <div
                    style={{
                        padding: 16,
                        borderRadius: 10,
                        background: '#fef2f2',
                        color: '#991b1b',
                        fontSize: 14,
                        marginBottom: 16,
                    }}
                >
                    WebXR immersive-ar is not supported on this device or
                    browser. Try Chrome on Android with ARCore.
                </div>
            )}

            {/* Buttons */}
            <div style={{ display: 'flex', gap: 10 }}>
                {!sessionActive ? (
                    <button
                        onClick={startAR}
                        disabled={arSupported === false || arSupported === null}
                        style={{
                            padding: '10px 20px',
                            borderRadius: 8,
                            border: 'none',
                            background: arSupported ? '#2563eb' : '#93c5fd',
                            color: '#fff',
                            fontSize: 15,
                            fontWeight: 500,
                            cursor: arSupported ? 'pointer' : 'not-allowed',
                        }}
                    >
                        {arSupported === null ? 'Checking…' : 'Start AR'}
                    </button>
                ) : (
                    <>
                        <button
                            onClick={stopAR}
                            style={{
                                padding: '10px 20px',
                                borderRadius: 8,
                                border: 'none',
                                background: '#ef4444',
                                color: '#fff',
                                fontSize: 15,
                                fontWeight: 500,
                                cursor: 'pointer',
                            }}
                        >
                            Exit AR
                        </button>
                        {markers.length > 0 && (
                            <button
                                onClick={clearMarkers}
                                style={{
                                    padding: '10px 20px',
                                    borderRadius: 8,
                                    border: '1px solid #e2e8f0',
                                    background: '#fff',
                                    color: '#475569',
                                    fontSize: 15,
                                    cursor: 'pointer',
                                }}
                            >
                                Clear markers
                            </button>
                        )}
                    </>
                )}
            </div>

            {/* Marker list */}
            {markers.length > 0 && (
                <div style={{ marginTop: 20 }}>
                    <p
                        style={{
                            fontSize: 13,
                            color: '#64748b',
                            margin: '0 0 8px',
                        }}
                    >
                        {markers.length} marker{markers.length !== 1 ? 's' : ''}{' '}
                        placed
                    </p>
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 6,
                        }}
                    >
                        {markers.map((m) => (
                            <div
                                key={m.id}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 10,
                                    padding: '8px 12px',
                                    borderRadius: 8,
                                    background: '#f8fafc',
                                    border: '1px solid #e2e8f0',
                                    fontSize: 13,
                                }}
                            >
                                <span
                                    style={{
                                        width: 10,
                                        height: 10,
                                        borderRadius: '50%',
                                        background: SURFACE_COLORS[m.surface],
                                        flexShrink: 0,
                                    }}
                                />
                                <span style={{ color: '#334155', flex: 1 }}>
                                    Marker #{m.id} — {SURFACE_LABELS[m.surface]}
                                </span>
                                <span
                                    style={{ color: '#94a3b8', fontSize: 11 }}
                                >
                                    [{m.matrix[12].toFixed(2)},{' '}
                                    {m.matrix[13].toFixed(2)},{' '}
                                    {m.matrix[14].toFixed(2)}]
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* How it works */}
            <details style={{ marginTop: 24, fontSize: 13, color: '#64748b' }}>
                <summary
                    style={{
                        cursor: 'pointer',
                        fontWeight: 500,
                        color: '#475569',
                    }}
                >
                    How surface detection works
                </summary>
                <div style={{ marginTop: 8, lineHeight: 1.6 }}>
                    <p>
                        The hit-test ray is cast from the{' '}
                        <strong>center of the viewer space</strong>, so the
                        reticle always tracks the middle of your screen.
                    </p>
                    <p>
                        Each hit result includes a 4×4 pose matrix. The{' '}
                        <strong>Y-axis of that matrix</strong> (column 1) is the
                        surface normal:
                    </p>
                    <ul style={{ paddingLeft: 16 }}>
                        <li>Normal pointing up (Y ≈ +1) → floor</li>
                        <li>Normal pointing down (Y ≈ −1) → ceiling</li>
                        <li>Normal pointing sideways (|Y| &lt; 0.3) → wall</li>
                    </ul>
                    <p>
                        Tap/click to drop a color-coded pin at that position.
                        Pins persist for the session and their world-space
                        coordinates are logged in the list below.
                    </p>
                </div>
            </details>
        </div>
    );
}
