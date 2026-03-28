/**
 * WallHitTest.tsx
 *
 * React + Three.js WebXR AR — places virtual panels on detected walls.
 *
 * Reticle behaviour:
 *  - An HTML crosshair is always shown at the center of the screen
 *  - It turns CYAN when the hit-test detects a wall surface under the center
 *  - It stays WHITE/dim when no surface is detected
 *  - Tapping while the reticle is cyan places a panel on the wall
 */

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

const MAX_WALL_OBJECTS = 15;

type ARState = "checking" | "supported" | "unsupported" | "active" | "error";

export default function ARMeasure() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  const [arState, setArState] = useState<ARState>("checking");
  const [errorMsg, setErrorMsg] = useState("");

  // Drives the center-screen reticle color — updated every XR frame
  const [wallDetected, setWallDetected] = useState(false);

  // ------------------------------------------------------------------
  // Check AR support on mount
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!navigator.xr) { setArState("unsupported"); return; }
    navigator.xr
      .isSessionSupported("immersive-ar")
      .then((ok) => setArState(ok ? "supported" : "unsupported"))
      .catch(() => setArState("unsupported"));
  }, []);

  // ------------------------------------------------------------------
  // Build Three.js renderer once the canvas is mounted
  // ------------------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
    rendererRef.current = renderer;
    const onResize = () => renderer.setSize(window.innerWidth, window.innerHeight);
    window.addEventListener("resize", onResize);
    return () => { window.removeEventListener("resize", onResize); renderer.dispose(); };
  }, []);

  // ------------------------------------------------------------------
  // Reference space helper — tries "local" then falls back to "local-floor"
  // ------------------------------------------------------------------
  async function requestRefSpace(session: XRSession): Promise<XRReferenceSpace> {
    try { return await session.requestReferenceSpace("local"); }
    catch { return await session.requestReferenceSpace("local-floor"); }
  }

  // ------------------------------------------------------------------
  // startAR — must be called from a user gesture (button tap)
  // ------------------------------------------------------------------
  async function startAR() {
    if (!navigator.xr || !rendererRef.current) return;
    const renderer = rendererRef.current;

    // ---- Scene ----
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(1, 2, 1);
    scene.add(dir);

    // ---- Invisible 3D hit-point marker (no visible mesh — we use HTML reticle instead) ----
    // We still track the pose in 3D so we know WHERE to place the panel on tap.
    const hitPoint = new THREE.Object3D();
    let hitPointValid = false; // true when a wall surface is under the center ray
    scene.add(hitPoint);

    const wallObjects: THREE.Group[] = [];

    function createPanel(): THREE.Group {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(
        new THREE.BoxGeometry(0.25, 0.35, 0.01),
        new THREE.MeshStandardMaterial({ color: 0x4488ff, emissive: 0x112244, roughness: 0.4, metalness: 0.3 })
      ));
      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(0.27, 0.37, 0.008),
        new THREE.MeshStandardMaterial({ color: 0xddaa55, roughness: 0.6, metalness: 0.7 })
      );
      frame.position.z = -0.006;
      g.add(frame);
      return g;
    }

    // ---- Select: place panel at the last valid hit point ----
    function onSelect() {
      if (!hitPointValid) return;
      const panel = createPanel();
      panel.position.copy(hitPoint.position);
      panel.quaternion.copy(hitPoint.quaternion);
      scene.add(panel);
      wallObjects.push(panel);
      if (wallObjects.length > MAX_WALL_OBJECTS) {
        const old = wallObjects.shift()!;
        scene.remove(old);
        old.traverse((c) => {
          if (c instanceof THREE.Mesh) {
            c.geometry.dispose();
            (Array.isArray(c.material) ? c.material : [c.material]).forEach((m) => m.dispose());
          }
        });
      }
    }

    try {
      const session = await navigator.xr.requestSession("immersive-ar", {
        requiredFeatures: ["hit-test"],
        optionalFeatures: ["local", "local-floor", "plane-detection"],
      });

      await renderer.xr.setSession(session as unknown as THREE.XRSession);
      session.addEventListener("select", onSelect as EventListener);

      const xrRefSpace    = await requestRefSpace(session);
      const xrViewerSpace = await session.requestReferenceSpace("viewer");

      // Hit-test source shoots a ray from the device camera center every frame
      const xrHitTestSource = await session.requestHitTestSource({
        space: xrViewerSpace,
        entityTypes: ["plane"],
      });

      setArState("active");

      // ---- Per-frame loop ----
      renderer.setAnimationLoop((_t: number, frame: unknown) => {
        const xrFrame = frame as XRFrame | null;
        if (!xrFrame) return;

        const hits = xrFrame.getHitTestResults(xrHitTestSource);
        if (hits.length > 0) {
          const pose = hits[0].getPose(xrRefSpace);
          if (pose) {
            // Store 3D position+orientation so onSelect knows where to place the panel
            const m = new THREE.Matrix4().fromArray(pose.transform.matrix);
            m.decompose(hitPoint.position, hitPoint.quaternion, new THREE.Vector3());
            hitPointValid = true;
            // Tell React to light up the HTML reticle
            setWallDetected(true);
          } else {
            hitPointValid = false;
            setWallDetected(false);
          }
        } else {
          hitPointValid = false;
          setWallDetected(false);
        }

        renderer.render(scene, camera);
      });

      session.addEventListener("end", () => {
        xrHitTestSource.cancel();
        renderer.setAnimationLoop(null);
        hitPointValid = false;
        setWallDetected(false);
        setArState("supported");
      });

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
      setArState("error");
    }
  }

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh", background: "#000", overflow: "hidden" }}>

      {/* Three.js canvas — always mounted */}
      <canvas ref={canvasRef} style={{ display: "block", width: "100%", height: "100%" }} />

      {/* ── CENTER RETICLE — only shown while AR is active ── */}
      {arState === "active" && (
        <div style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          pointerEvents: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}>
          {/* Outer ring */}
          <div style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            border: `2px solid ${wallDetected ? "#00ffff" : "rgba(255,255,255,0.4)"}`,
            boxShadow: wallDetected ? "0 0 12px #00ffff, 0 0 24px #00ffff44" : "none",
            transition: "border-color 0.15s, box-shadow 0.15s",
            position: "absolute",
          }} />
          {/* Inner dot */}
          <div style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: wallDetected ? "#00ffff" : "rgba(255,255,255,0.5)",
            boxShadow: wallDetected ? "0 0 8px #00ffff" : "none",
            transition: "background 0.15s, box-shadow 0.15s",
          }} />
          {/* Cross hairs */}
          <div style={{ position: "absolute", width: 16, height: 1, background: wallDetected ? "#00ffff" : "rgba(255,255,255,0.4)", transition: "background 0.15s" }} />
          <div style={{ position: "absolute", width: 1, height: 16, background: wallDetected ? "#00ffff" : "rgba(255,255,255,0.4)", transition: "background 0.15s" }} />
        </div>
      )}

      {/* ── Label below reticle ── */}
      {arState === "active" && (
        <div style={{
          position: "absolute",
          top: "calc(50% + 44px)",
          width: "100%",
          textAlign: "center",
          pointerEvents: "none",
          fontFamily: "sans-serif",
          fontSize: 13,
          letterSpacing: 1,
          color: wallDetected ? "#00ffff" : "rgba(255,255,255,0.4)",
          textShadow: wallDetected ? "0 0 8px #00ffff" : "none",
          transition: "color 0.15s",
        }}>
          {wallDetected ? "WALL DETECTED · TAP TO PLACE" : "POINT AT A WALL"}
        </div>
      )}

      {/* ── Overlays ── */}
      {arState === "checking" && <Overlay><p style={s.hint}>Checking AR support…</p></Overlay>}

      {arState === "unsupported" && (
        <Overlay>
          <p style={s.title}>AR Not Available</p>
          <p style={s.hint}>Try Chrome on Android (ARCore) or Safari on iOS 16+.</p>
        </Overlay>
      )}

      {arState === "supported" && (
        <Overlay>
          <p style={s.title}>Wall Hit Test</p>
          <p style={s.hint}>Point your camera at a wall. The reticle turns cyan when a surface is detected. Tap to place.</p>
          <button style={s.btn} onClick={startAR}>Start AR</button>
        </Overlay>
      )}

      {arState === "error" && (
        <Overlay>
          <p style={s.title}>Error</p>
          <p style={s.hint}>{errorMsg}</p>
          <button style={s.btn} onClick={() => setArState("supported")}>Try Again</button>
        </Overlay>
      )}
    </div>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div style={s.overlay}>
      <div style={s.card}>{children}</div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  overlay: { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.55)" },
  card: { background: "rgba(10,10,20,0.85)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 16, padding: "32px 28px", maxWidth: 320, textAlign: "center", color: "#fff", fontFamily: "sans-serif", backdropFilter: "blur(8px)" },
  title: { fontSize: 22, fontWeight: 700, marginBottom: 12 },
  hint: { fontSize: 14, color: "#aaa", lineHeight: 1.6, marginBottom: 24 },
  btn: { padding: "14px 36px", background: "#00aaff", color: "#fff", border: "none", borderRadius: 50, fontSize: 16, fontWeight: 600, cursor: "pointer" },
};