import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function ARScene() {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let camera: THREE.PerspectiveCamera;
        let scene: THREE.Scene;
        let renderer: THREE.WebGLRenderer;

        let reticle: THREE.Mesh;
        let localSpace: XRReferenceSpace | null = null;

        let transientHitTestSource: XRTransientInputHitTestSource | null = null;

        init();

        async function init() {
            scene = new THREE.Scene();
            camera = new THREE.PerspectiveCamera();

            renderer = new THREE.WebGLRenderer({
                antialias: true,
                alpha: true,
            });

            renderer.setSize(window.innerWidth, window.innerHeight);
            renderer.xr.enabled = true;

            containerRef.current?.appendChild(renderer.domElement);

            // Light
            const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
            scene.add(light);

            // Reticle
            const geometry = new THREE.RingGeometry(0.1, 0.15, 32).rotateX(
                -Math.PI / 2,
            );
            const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
            reticle = new THREE.Mesh(geometry, material);
            reticle.visible = false;
            scene.add(reticle);

            // Button
            const button = document.createElement('button');
            button.innerText = 'START AR';
            Object.assign(button.style, {
                position: 'absolute',
                bottom: '20px',
                left: '50%',
                transform: 'translateX(-50%)',
                padding: '12px 20px',
            });

            containerRef.current?.appendChild(button);
            button.onclick = startAR;
        }

        async function startAR() {
            const session = await navigator.xr!.requestSession('immersive-ar', {
                requiredFeatures: ['hit-test', 'local-floor'],
            });

            renderer.xr.setSession(session);

            localSpace = await session.requestReferenceSpace('local');

            // ✅ Transient (tap-based) hit test
            transientHitTestSource =
                await session.requestHitTestSourceForTransientInput({
                    profile: 'generic-touchscreen',
                });

            renderer.setAnimationLoop(render);
        }

        function render(timestamp: number, frame?: XRFrame) {
            if (frame && transientHitTestSource && localSpace) {
                const results = frame.getHitTestResultsForTransientInput(
                    transientHitTestSource,
                );

                for (const result of results) {
                    if (result.results.length > 0) {
                        const hit = result.results[0];
                        const pose = hit.getPose(localSpace);

                        if (pose) {
                            reticle.visible = true;
                            reticle.matrix.fromArray(pose.transform.matrix);

                            // 🔴 Place object immediately on tap
                            const box = new THREE.Mesh(
                                new THREE.BoxGeometry(0.1, 0.1, 0.1),
                                new THREE.MeshStandardMaterial({
                                    color: 0xff0000,
                                }),
                            );

                            box.position.setFromMatrixPosition(reticle.matrix);
                            box.quaternion.setFromRotationMatrix(
                                reticle.matrix,
                            );

                            scene.add(box);
                        }
                    }
                }
            }

            renderer.render(scene, camera);
        }

        return () => {
            renderer?.dispose();
        };
    }, []);

    return <div ref={containerRef} />;
}
