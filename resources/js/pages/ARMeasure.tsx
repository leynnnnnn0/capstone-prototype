/**
 * WallHitTest.tsx
 *
 * A React + Three.js WebXR component that detects vertical surfaces (walls)
 * using the WebXR Hit Test API, then places a virtual object on the wall
 * when the user taps (selects).
 *
 * Key differences from the original floor-based hit test:
 *  - Uses XRPlane orientation filtering ("vertical") to target walls
 *  - Placed object is a flat panel (picture frame) that faces out from the wall
 *  - Three.js replaces the custom WebGL renderer from the original example
 */

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Type augmentation — the standard @types/webxr typings are sometimes
// incomplete. We extend the global interfaces we need here.
// ---------------------------------------------------------------------------

declare global {
    interface XRSessionInit {
        requiredFeatures?: string[];
        optionalFeatures?: string[];
    }
    interface XRSession {
        requestHitTestSource(options: {
            space: XRSpace;
            entityTypes?: string[];
        }): Promise<XRHitTestSource>;
        requestAnimationFrame(callback: XRFrameRequestCallback): number;
        updateRenderState(state: { baseLayer?: XRWebGLLayer }): void;
        requestReferenceSpace(
            type: XRReferenceSpaceType,
        ): Promise<XRReferenceSpace>;
        addEventListener(
            type: string,
            listener: EventListenerOrEventListenerObject,
        ): void;
        end(): Promise<void>;
    }
    interface XRFrame {
        getViewerPose(referenceSpace: XRReferenceSpace): XRViewerPose | null;
        getHitTestResults(source: XRHitTestSource): XRHitTestResult[];
        session: XRSession;
    }
    interface XRHitTestResult {
        getPose(baseSpace: XRReferenceSpace): XRPose | null;
    }
    interface XRHitTestSource {
        cancel(): void;
    }
    interface XRViewerPose {
        views: XRView[];
    }
    interface XRView {
        eye: 'left' | 'right' | 'none';
        projectionMatrix: Float32Array;
        transform: XRRigidTransform;
        recommendedViewportScale?: number;
    }
    interface XRWebGLLayer {
        framebuffer: WebGLFramebuffer;
        getViewport(view: XRView): XRViewport | null;
    }
    interface XRViewport {
        x: number;
        y: number;
        width: number;
        height: number;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const XRWebGLLayer: any;
}

// ---------------------------------------------------------------------------
// Max number of wall objects allowed in the scene at once.
// Oldest objects are removed when the limit is exceeded.
// ---------------------------------------------------------------------------
const MAX_WALL_OBJECTS = 15;

export default function ARMeasure() {
    // Ref to the <canvas> element that Three.js renders into
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        // -----------------------------------------------------------------------
        // Guard: exit early if the browser does not support WebXR at all
        // -----------------------------------------------------------------------
        if (!navigator.xr) {
            console.warn('WebXR not supported in this browser.');
            return;
        }

        const canvas = canvasRef.current!;

        // -----------------------------------------------------------------------
        // THREE.js RENDERER SETUP
        // We use WebGLRenderer with xrCompatible:true so it can share the GL
        // context with the WebXR session. alpha:true keeps the background
        // transparent so the real-world camera feed shows through in AR.
        // -----------------------------------------------------------------------
        const renderer = new THREE.WebGLRenderer({
            canvas,
            alpha: true, // transparent background → shows camera feed
            antialias: true,
        });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.xr.enabled = true; // MUST be true to enter an XR session

        // -----------------------------------------------------------------------
        // SCENE + CAMERA
        // PerspectiveCamera values don't matter much in XR because the headset /
        // phone overrides them, but Three.js still requires a camera object.
        // -----------------------------------------------------------------------
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(
            70,
            window.innerWidth / window.innerHeight,
            0.01,
            20,
        );

        // -----------------------------------------------------------------------
        // AMBIENT + DIRECTIONAL LIGHT
        // Provides basic shading so the placed objects look grounded.
        // -----------------------------------------------------------------------
        scene.add(new THREE.AmbientLight(0xffffff, 0.6));
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(1, 2, 1);
        scene.add(dirLight);

        // -----------------------------------------------------------------------
        // RETICLE — the targeting indicator shown on the wall surface
        //
        // We use a thin torus (ring) that lies flat on the wall. Its orientation
        // will be updated every frame to match the detected wall surface normal.
        // -----------------------------------------------------------------------
        const reticleGeometry = new THREE.TorusGeometry(0.08, 0.012, 8, 24);
        const reticleMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
        });
        const reticle = new THREE.Mesh(reticleGeometry, reticleMaterial);
        reticle.visible = false; // hidden until a wall surface is detected
        // Rotate reticle so it lies in the XZ plane (facing out of the wall)
        reticle.rotation.x = Math.PI / 2;
        scene.add(reticle);

        // -----------------------------------------------------------------------
        // WALL OBJECT FACTORY
        // Creates a flat rectangular panel (like a framed picture) that will be
        // placed flush against the detected wall surface.
        // -----------------------------------------------------------------------
        function createWallPanel(): THREE.Group {
            const group = new THREE.Group();

            // Main panel face — a slightly emissive colored rectangle
            const faceGeo = new THREE.BoxGeometry(0.25, 0.35, 0.01);
            const faceMat = new THREE.MeshStandardMaterial({
                color: 0x4488ff,
                emissive: 0x112244,
                roughness: 0.4,
                metalness: 0.3,
            });
            const face = new THREE.Mesh(faceGeo, faceMat);
            group.add(face);

            // Thin border frame around the panel
            const frameGeo = new THREE.BoxGeometry(0.27, 0.37, 0.008);
            const frameMat = new THREE.MeshStandardMaterial({
                color: 0xddaa55,
                roughness: 0.6,
                metalness: 0.7,
            });
            const frame = new THREE.Mesh(frameGeo, frameMat);
            frame.position.z = -0.006; // push frame slightly behind the face
            group.add(frame);

            return group;
        }

        // Keeps references to placed panels so we can remove the oldest ones
        const wallObjects: THREE.Group[] = [];

        // -----------------------------------------------------------------------
        // XR SESSION STATE
        // These are populated once the XR session starts and cleaned up on end.
        // -----------------------------------------------------------------------
        let xrRefSpace: XRReferenceSpace | null = null; // 'local' space — world anchor
        let xrViewerSpace: XRReferenceSpace | null = null; // viewer (device) space — for ray casting
        let xrHitTestSource: XRHitTestSource | null = null; // produces hit test results each frame

        // -----------------------------------------------------------------------
        // START AR SESSION
        //
        // We request:
        //   • 'local'     — a stable world reference space
        //   • 'hit-test'  — permission to cast rays and get surface intersections
        //
        // 'plane-detection' is listed as optional; when available it improves
        // wall detection accuracy on supported devices (e.g. ARCore).
        // -----------------------------------------------------------------------
        async function startAR() {
            try {
                const session = await navigator.xr!.requestSession(
                    'immersive-ar',
                    {
                        requiredFeatures: ['local', 'hit-test'],
                        optionalFeatures: ['plane-detection'],
                    },
                );

                // Hand the session to Three.js so it manages the render loop
                renderer.xr.setSession(session as unknown as THREE.XRSession);

                // Listen for the 'select' event (screen tap / controller trigger)
                // to place an object on the wall
                session.addEventListener('select', onSelect as EventListener);

                // 'viewer' reference space: origin follows the device itself.
                // We use this as the origin of our hit-test ray (straight ahead).
                xrViewerSpace = await session.requestReferenceSpace('viewer');

                // Request a hit test source that:
                //   • originates from the viewer (device camera direction)
                //   • targets "plane" entity types with "vertical" orientation → walls
                xrHitTestSource = await session.requestHitTestSource({
                    space: xrViewerSpace,
                    // 'entityTypes' with "plane" + orientation hint focuses on walls.
                    // Note: full plane-orientation filtering may require plane-detection
                    // feature; without it the browser still attempts best-effort hits.
                    entityTypes: ['plane'],
                });

                // 'local' reference space: a fixed world origin, used to place
                // objects and to read back hit-test poses in world coordinates.
                xrRefSpace = await session.requestReferenceSpace('local');

                // Kick off the XR render loop via Three.js
                renderer.setAnimationLoop(onXRFrame);

                // Clean up everything when the session ends
                session.addEventListener('end', () => {
                    xrHitTestSource?.cancel();
                    xrHitTestSource = null;
                    xrRefSpace = null;
                    xrViewerSpace = null;
                    renderer.setAnimationLoop(null);
                });
            } catch (err) {
                console.error('Failed to start AR session:', err);
            }
        }

        // -----------------------------------------------------------------------
        // SELECT HANDLER (screen tap / controller trigger)
        //
        // When the user taps while the reticle is visible, we clone the current
        // reticle transform and place a new wall panel there.
        // -----------------------------------------------------------------------
        function onSelect() {
            if (!reticle.visible) return;

            // Clone the reticle's world-space position and quaternion
            const panel = createWallPanel();
            panel.position.copy(reticle.position);
            panel.quaternion.copy(reticle.quaternion);

            // The hit-test matrix places the object's +Z axis along the wall normal.
            // Our panel faces +Z by default (BoxGeometry), so no extra rotation needed.

            scene.add(panel);
            wallObjects.push(panel);

            // -----------------------------------------------------------------------
            // PERFORMANCE GUARD: remove the oldest panel if we exceed the limit.
            // This keeps the scene from growing unboundedly on a long AR session.
            // -----------------------------------------------------------------------
            if (wallObjects.length > MAX_WALL_OBJECTS) {
                const oldest = wallObjects.shift()!;
                scene.remove(oldest);
                // Dispose geometries and materials to free GPU memory
                oldest.traverse((child) => {
                    if (child instanceof THREE.Mesh) {
                        child.geometry.dispose();
                        if (Array.isArray(child.material)) {
                            child.material.forEach((m) => m.dispose());
                        } else {
                            child.material.dispose();
                        }
                    }
                });
            }
        }

        // -----------------------------------------------------------------------
        // PER-FRAME XR RENDER CALLBACK
        //
        // Three.js calls this every animation frame while the XR session is active.
        // `timestamp` is the DOMHighResTimeStamp; `frame` is the XRFrame.
        // -----------------------------------------------------------------------
        function onXRFrame(_timestamp: number, frame: XRFrame) {
            if (!frame) return;

            // Hide the reticle; we'll re-show it only if a hit is found this frame
            reticle.visible = false;

            if (xrHitTestSource && xrRefSpace) {
                // Ask the XR system for all surface intersections this frame
                const hitTestResults = frame.getHitTestResults(xrHitTestSource);

                if (hitTestResults.length > 0) {
                    // Use the closest (first) result — the one the device considers best
                    const hit = hitTestResults[0];
                    const pose = hit.getPose(xrRefSpace);

                    if (pose) {
                        // ---------------------------------------------------------------
                        // Apply the hit pose to the reticle.
                        //
                        // pose.transform.matrix is a column-major Float32Array (16 values)
                        // representing the surface position AND orientation.
                        // For a wall, the matrix's +Z column points away from the wall.
                        //
                        // THREE.Matrix4.fromArray expects a column-major flat array —
                        // exactly what WebXR gives us.
                        // ---------------------------------------------------------------
                        const hitMatrix = new THREE.Matrix4();
                        hitMatrix.fromArray(pose.transform.matrix);

                        // Decompose into position + quaternion so we can set them
                        // independently on the reticle mesh
                        hitMatrix.decompose(
                            reticle.position,
                            reticle.quaternion,
                            new THREE.Vector3(), // scale — we don't use it
                        );

                        // Keep the reticle ring flat against the wall by rotating it
                        // so it faces out along the wall normal (+Z after decompose)
                        // We already rotated it 90° on X at creation; the quaternion from
                        // the hit pose will align it to the wall plane automatically.
                        reticle.visible = true;
                    }
                }
            }

            // Render the scene through the XR camera
            renderer.render(scene, camera);
        }

        // -----------------------------------------------------------------------
        // RESPONSIVE RESIZE
        // Keeps the renderer sized correctly if the viewport changes
        // (e.g. device orientation change before entering AR).
        // -----------------------------------------------------------------------
        function onResize() {
            renderer.setSize(window.innerWidth, window.innerHeight);
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
        }
        window.addEventListener('resize', onResize);

        // Start the AR session immediately
        startAR();

        // -----------------------------------------------------------------------
        // CLEANUP on React component unmount
        // -----------------------------------------------------------------------
        return () => {
            window.removeEventListener('resize', onResize);
            renderer.setAnimationLoop(null);
            renderer.dispose();
        };
    }, []);

    // --------------------------------------------------------------------------
    // RENDER — just a fullscreen canvas. The AR session fills it entirely.
    // The overlay button and hint text are simple HTML on top.
    // --------------------------------------------------------------------------
    return (
        <div
            style={{
                position: 'relative',
                width: '100vw',
                height: '100vh',
                background: '#000',
            }}
        >
            {/* The canvas Three.js renders into. Must be full-screen for AR. */}
            <canvas
                ref={canvasRef}
                style={{ display: 'block', width: '100%', height: '100%' }}
            />

            {/*
             * Overlay UI — shown on top of the AR canvas.
             * In a real app you would also add an "Enter AR" button here
             * that calls startAR() on press (browsers require a user gesture).
             */}
            <div
                style={{
                    position: 'absolute',
                    bottom: 32,
                    width: '100%',
                    textAlign: 'center',
                    color: '#fff',
                    fontFamily: 'sans-serif',
                    fontSize: 14,
                    pointerEvents: 'none',
                    textShadow: '0 1px 4px rgba(0,0,0,0.8)',
                }}
            >
                Point at a wall · Tap to place a panel
            </div>
        </div>
    );
}
