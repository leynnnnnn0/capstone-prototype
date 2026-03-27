import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function ARMeasure() {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let camera: THREE.PerspectiveCamera;
        let scene: THREE.Scene;
        let renderer: THREE.WebGLRenderer;

        let reticle: THREE.Mesh;
        let hitTestSource: XRHitTestSource | null = null;
        let localSpace: XRReferenceSpace | null = null;
        let viewerSpace: XRReferenceSpace | null = null;

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

            // 🔵 Light
            const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
            scene.add(light);

            // 🔵 Reticle (placement indicator)
            const geometry = new THREE.RingGeometry(0.1, 0.15, 32).rotateX(
                -Math.PI / 2,
            );
            const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
            reticle = new THREE.Mesh(geometry, material);
            reticle.visible = false;
            scene.add(reticle);

            // 🔵 AR Button
            const button = document.createElement('button');
            button.innerText = 'START AR';
            button.style.position = 'absolute';
            button.style.bottom = '20px';
            button.style.left = '50%';
            button.style.transform = 'translateX(-50%)';
            button.style.padding = '12px 20px';
            containerRef.current?.appendChild(button);

            button.onclick = startAR;
        }

        async function startAR() {
            const session = await navigator.xr!.requestSession('immersive-ar', {
                requiredFeatures: ['hit-test', 'plane-detection'],
            });

            renderer.xr.setSession(session);

            localSpace = await session.requestReferenceSpace('local');
            viewerSpace = await session.requestReferenceSpace('viewer');

            hitTestSource = await session.requestHitTestSource({
                space: viewerSpace,
            });

            session.addEventListener('select', onSelect);

            renderer.setAnimationLoop(render);
        }

        function onSelect() {
            if (reticle.visible) {
                const box = new THREE.Mesh(
                    new THREE.BoxGeometry(0.1, 0.1, 0.1),
                    new THREE.MeshStandardMaterial({ color: 0xff0000 }),
                );

                box.position.setFromMatrixPosition(reticle.matrix);
                box.quaternion.setFromRotationMatrix(reticle.matrix);

                scene.add(box);
            }
        }

        function render(timestamp: number, frame?: XRFrame) {
            if (frame && hitTestSource && localSpace) {
                const hitTestResults = frame.getHitTestResults(hitTestSource);

                if (hitTestResults.length > 0) {
                    const hit = hitTestResults[0];
                    const pose = hit.getPose(localSpace);

                    if (pose) {
                        reticle.visible = true;
                        reticle.matrix.fromArray(pose.transform.matrix);
                    }
                } else {
                    reticle.visible = false;
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
