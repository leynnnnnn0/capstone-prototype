import { useRef, useState, useCallback } from 'react'

export function useWebXR() {
    const sessionRef       = useRef(null)
    const rendererRef      = useRef(null)
    const sceneRef         = useRef(null)
    const cameraRef        = useRef(null)
    const hitTestSourceRef = useRef(null)
    const refSpaceRef      = useRef(null)
    const reticleRef       = useRef(null)
    const latestHitRef     = useRef(null)
    const anchorsRef       = useRef([])
    const dotMeshesRef     = useRef([])
    const lineMeshesRef    = useRef([])
    const animFrameRef     = useRef(null)

    const [isSupported,  setIsSupported]  = useState(null)
    const [isActive,     setIsActive]     = useState(false)
    const [tapCount,     setTapCount]     = useState(0)
    const [dimensions,   setDimensions]   = useState(null)
    const [error,        setError]        = useState(null)

    // ── check support ───────────────────────────────────────────────────────
    const checkSupport = useCallback(async () => {
        if (!navigator.xr) { setIsSupported(false); return false }
        const ok = await navigator.xr.isSessionSupported('immersive-ar')
        setIsSupported(ok)
        return ok
    }, [])

    // ── 3-D distance → cm ───────────────────────────────────────────────────
    function dist3D(a, b) {
        return Math.sqrt(
            Math.pow(b.x - a.x, 2) +
            Math.pow(b.y - a.y, 2) +
            Math.pow(b.z - a.z, 2)
        ) * 100
    }

    function calcDimensions([tl, tr, bl, br]) {
        const topW    = dist3D(tl, tr)
        const botW    = dist3D(bl, br)
        const leftH   = dist3D(tl, bl)
        const rightH  = dist3D(tr, br)
        return {
            widthCm:  ((topW  + botW)   / 2).toFixed(1),
            heightCm: ((leftH + rightH) / 2).toFixed(1),
        }
    }

    // ── draw a small sphere dot at a world position ─────────────────────────
    function addDot(THREE, position, index) {
        const colors = [0x00ff88, 0x00ccff, 0xff6600, 0xff0066]
        const geo  = new THREE.SphereGeometry(0.012, 16, 16)
        const mat  = new THREE.MeshBasicMaterial({ color: colors[index] })
        const mesh = new THREE.Mesh(geo, mat)
        mesh.position.set(position.x, position.y, position.z)
        sceneRef.current.add(mesh)
        dotMeshesRef.current.push(mesh)
    }

    // ── draw a line between two world positions ──────────────────────────────
    function addLine(THREE, a, b) {
        const points = [
            new THREE.Vector3(a.x, a.y, a.z),
            new THREE.Vector3(b.x, b.y, b.z),
        ]
        const geo  = new THREE.BufferGeometry().setFromPoints(points)
        const mat  = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 })
        const line = new THREE.Line(geo, mat)
        sceneRef.current.add(line)
        lineMeshesRef.current.push(line)
    }

    // ── handle a tap ─────────────────────────────────────────────────────────
    const handleTap = useCallback((THREE) => {
        if (!latestHitRef.current) return
        const anchors = anchorsRef.current
        if (anchors.length >= 4) return

        const pos = latestHitRef.current
        anchors.push({ x: pos.x, y: pos.y, z: pos.z })
        addDot(THREE, pos, anchors.length - 1)

        // draw lines as corners are added
        if (anchors.length === 2) addLine(THREE, anchors[0], anchors[1])
        if (anchors.length === 3) addLine(THREE, anchors[0], anchors[2])
        if (anchors.length === 4) {
            addLine(THREE, anchors[1], anchors[3])
            addLine(THREE, anchors[2], anchors[3])
            const dims = calcDimensions(anchors)
            setDimensions(dims)
        }

        setTapCount(anchors.length)
    }, [])

    // ── start AR session ─────────────────────────────────────────────────────
    const startAR = useCallback(async (canvasEl, overlayEl) => {
        try {
            setError(null)
            setDimensions(null)
            setTapCount(0)
            anchorsRef.current   = []
            dotMeshesRef.current = []
            lineMeshesRef.current = []

            // dynamic import so Three.js is only loaded when AR starts
            const THREE = await import('three')

            // renderer
            const renderer = new THREE.WebGLRenderer({
                canvas: canvasEl,
                alpha: true,
                antialias: true,
            })
            renderer.setPixelRatio(window.devicePixelRatio)
            renderer.setSize(window.innerWidth, window.innerHeight)
            renderer.xr.enabled = true
            rendererRef.current = renderer

            // scene + camera
            const scene  = new THREE.Scene()
            const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20)
            sceneRef.current  = scene
            cameraRef.current = camera

            // reticle (ring shown where surface is detected)
            const reticleGeo = new THREE.RingGeometry(0.03, 0.04, 32).rotateX(-Math.PI / 2)
            const reticleMat = new THREE.MeshBasicMaterial({ color: 0x00ff88, side: THREE.DoubleSide })
            const reticle    = new THREE.Mesh(reticleGeo, reticleMat)
            reticle.matrixAutoUpdate = false
            reticle.visible = false
            scene.add(reticle)
            reticleRef.current = reticle

            // ambient light
            scene.add(new THREE.AmbientLight(0xffffff, 1))

            // XR session
            const session = await navigator.xr.requestSession('immersive-ar', {
                requiredFeatures: ['hit-test'],
                optionalFeatures: ['dom-overlay'],
                domOverlay: { root: overlayEl },
            })
            sessionRef.current = session
            renderer.xr.setReferenceSpaceType('local')
            await renderer.xr.setSession(session)

            const refSpace      = await session.requestReferenceSpace('local')
            const viewerSpace   = await session.requestReferenceSpace('viewer')
            const hitTestSource = await session.requestHitTestSource({ space: viewerSpace })
            refSpaceRef.current      = refSpace
            hitTestSourceRef.current = hitTestSource

            // tap handler
            const onSelect = () => handleTap(THREE)
            session.addEventListener('select', onSelect)

            // render loop
            renderer.setAnimationLoop((_, frame) => {
                if (!frame) return
                const results = frame.getHitTestResults(hitTestSource)
                if (results.length > 0) {
                    const pose = results[0].getPose(refSpace)
                    reticle.visible = true
                    reticle.matrix.fromArray(pose.transform.matrix)
                    latestHitRef.current = {
                        x: pose.transform.position.x,
                        y: pose.transform.position.y,
                        z: pose.transform.position.z,
                    }
                } else {
                    reticle.visible = false
                }
                renderer.render(scene, camera)
            })

            session.addEventListener('end', () => {
                setIsActive(false)
                renderer.setAnimationLoop(null)
            })

            setIsActive(true)
        } catch (err) {
            setError(err.message || 'Failed to start AR session')
            console.error('WebXR error:', err)
        }
    }, [handleTap])

    // ── stop AR session ──────────────────────────────────────────────────────
    const stopAR = useCallback(async () => {
        if (sessionRef.current) {
            await sessionRef.current.end()
            sessionRef.current = null
        }
        if (rendererRef.current) {
            rendererRef.current.setAnimationLoop(null)
            rendererRef.current.dispose()
            rendererRef.current = null
        }
        setIsActive(false)
    }, [])

    // ── reset anchors to re-measure ──────────────────────────────────────────
    const reset = useCallback(() => {
        anchorsRef.current = []
        dotMeshesRef.current.forEach(m => sceneRef.current?.remove(m))
        lineMeshesRef.current.forEach(l => sceneRef.current?.remove(l))
        dotMeshesRef.current  = []
        lineMeshesRef.current = []
        setTapCount(0)
        setDimensions(null)
    }, [])

    return {
        isSupported,
        isActive,
        tapCount,
        dimensions,
        error,
        checkSupport,
        startAR,
        stopAR,
        reset,
    }
}
