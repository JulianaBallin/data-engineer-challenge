// Cenas 3D (Three.js): fundo animado do login e gráfico de barras 3D interativo.
window.OI_scene = (() => {
  const ORANGE = 0xf6851b;

  function hero(canvas) {
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
    camera.position.z = 9;

    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(2.2, 1),
      new THREE.MeshBasicMaterial({ color: ORANGE, wireframe: true, transparent: true, opacity: 0.55 }));
    const inner = new THREE.Mesh(new THREE.IcosahedronGeometry(1.2, 0),
      new THREE.MeshBasicMaterial({ color: 0xffb35c, wireframe: true }));
    const group = new THREE.Group(); group.add(core, inner); group.position.x = 3.2; scene.add(group);

    const N = 420, pos = new Float32Array(N * 3);
    for (let i = 0; i < N * 3; i++) pos[i] = (Math.random() - 0.5) * 26;
    const pg = new THREE.BufferGeometry(); pg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const points = new THREE.Points(pg, new THREE.PointsMaterial({ color: ORANGE, size: 0.06, transparent: true, opacity: 0.8 }));
    scene.add(points);

    const mouse = { x: 0, y: 0 };
    addEventListener("pointermove", (e) => { mouse.x = e.clientX / innerWidth - 0.5; mouse.y = e.clientY / innerHeight - 0.5; });
    function resize() {
      renderer.setSize(innerWidth, innerHeight, false);
      camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
      group.position.x = innerWidth < 800 ? 0 : 3.2; group.position.y = innerWidth < 800 ? 3.2 : 0;
    }
    addEventListener("resize", resize); resize();

    const clock = new THREE.Clock();
    (function loop() {
      const t = clock.getElapsedTime();
      if (!reduce) {
        core.rotation.set(t * 0.18, t * 0.25, 0); inner.rotation.set(-t * 0.3, t * 0.2, 0);
        points.rotation.y = t * 0.02;
        group.scale.setScalar(1 + Math.sin(t * 1.3) * 0.04);
      }
      camera.position.x += (mouse.x * 2 - camera.position.x) * 0.04;
      camera.position.y += (-mouse.y * 2 - camera.position.y) * 0.04;
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera); requestAnimationFrame(loop);
    })();
  }

  return { hero };
})();
