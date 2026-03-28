import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function ARMeasure() {
    const containerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        let camera: THREE.PerspectiveCamera;
        let scene: THREE.Scene;
        let renderer: THREE.WebGLRenderer;

        let controller: THREE.Group;

        init();
        animate();

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

            // Light
            const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
            scene.add(light);

            // Controller (for tap)
            controller = renderer.xr.getController(0);
            controller.addEventListener('select', onSelect);
            scene.add(controller);

            // AR button
            const button = document.createElement('button');
            button.innerText = 'START AR';
            button.style.position = 'absolute';
            button.style.bottom = '20px';
            button.style.left = '50%';
            button.style.transform = 'translateX(-50%)';
            button.style.padding = '12px 20px';

            button.onclick = async () => {
                if ((navigator as any).xr) {
                    const session = await (navigator as any).xr.requestSession(
                        'immersive-ar',
                        {
                            requiredFeatures: ['hit-test'],
                        },
                    );
                    renderer.xr.setSession(session);
                }
            };

            document.body.appendChild(button);
        }

        function onSelect() {
            // Create a cube where user taps
            const geometry = new THREE.BoxGeometry(0.05, 0.05, 0.05);
            const material = new THREE.MeshStandardMaterial({
                color: 0x00ff00,
            });
            const mesh = new THREE.Mesh(geometry, material);

            mesh.position.set(0, 0, -0.5).applyMatrix4(controller.matrixWorld);

            scene.add(mesh);
        }

        function animate() {
            renderer.setAnimationLoop(render);
        }

        function render() {
            renderer.render(scene, camera);
        }

        return () => {
            renderer.dispose();
        };
    }, []);

    return <div ref={containerRef} />;
};

