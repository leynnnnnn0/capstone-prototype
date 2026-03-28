import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function ARMeasure() {
    const containerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        let camera: THREE.PerspectiveCamera;
        let scene: THREE.Scene;
        let renderer: THREE.WebGLRenderer;

        let controller: THREE.Group;

        let hitTestSource: XRHitTestSource | null = null;
        let localSpace: XRReferenceSpace | null = null;
        let viewerSpace: XRReferenceSpace | null = null;

        function init() {
            scene = new THREE.Scene();

            camera = new THREE.PerspectiveCamera(
                70,
                window.innerWidth / window.innerHeight,
                0.01,
                20,
            );

            renderer = new THREE.WebGLRenderer({
                antialias: true,
                alpha: true,
            });

            renderer.setSize(window.innerWidth, window.innerHeight);
            renderer.xr.enabled = true;

            containerRef.current?.appendChild(renderer.domElement);

            // LIGHT
            const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
            scene.add(light);

            // CONTROLLER
            controller = renderer.xr.getController(0);
            controller.addEventListener('select', onSelect);
            scene.add(controller);

            // BUTTON
            const btn = document.createElement('button');
            btn.innerText = 'START AR';
            btn.style.position = 'absolute';
            btn.style.bottom = '20px';
            btn.style.left = '50%';
            btn.style.transform = 'translateX(-50%)';
            btn.style.padding = '12px 20px';

            btn.onclick = startAR;

            document.body.appendChild(btn);
        }

        async function startAR() {
            if (!(navigator as any).xr) {
                alert('WebXR not supported');
                return;
            }

            const session = await (navigator as any).xr.requestSession(
                'immersive-ar',
                {
                    requiredFeatures: ['hit-test', 'local-floor'],
                },
            );

            renderer.xr.setSession(session);

            // ✅ FIX: proper WebXR layer (this removes black screen)
            const gl = renderer.getContext();
            session.updateRenderState({
                baseLayer: new XRWebGLLayer(session, gl),
            });

            // Reference spaces
            localSpace = await session.requestReferenceSpace('local');
            viewerSpace = await session.requestReferenceSpace('viewer');

            // Hit test
            hitTestSource = await session.requestHitTestSource({
                space: viewerSpace,
            });

            renderer.setAnimationLoop(render);
        }

        function onSelect() {
            if (!hitTestSource || !localSpace) return;

            // Place cube in front if no hit yet
            const geometry = new THREE.BoxGeometry(0.05, 0.05, 0.05);
            const material = new THREE.MeshStandardMaterial();
            const mesh = new THREE.Mesh(geometry, material);

            mesh.position.set(0, 0, -0.5);
            scene.add(mesh);
        }

        function render(time: number, frame?: XRFrame) {
            if (frame && hitTestSource && localSpace) {
                const hitTestResults = frame.getHitTestResults(hitTestSource);

                if (hitTestResults.length > 0) {
                    const pose = hitTestResults[0].getPose(localSpace);

                    // Optional: you could place a reticle here
                    // console.log("Surface detected", pose.transform.position);
                }
            }

            renderer.render(scene, camera);
        }

        init();

        return () => {
            renderer.dispose();
        };
    }, []);

    return <div ref={containerRef} />;
};


