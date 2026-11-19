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

  // Barras 3D: arrastar para girar, roda do mouse para aproximar, hover mostra o valor.
  function bars(canvas, tipEl, rows, fmt) {
    const css = getComputedStyle(document.documentElement);
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const sun = new THREE.DirectionalLight(0xffffff, 0.9); sun.position.set(8, 14, 10); scene.add(sun);

    const max = Math.max(...rows.map((r) => r.receita)), gap = 1.15, root = new THREE.Group(); scene.add(root);
    const meshes = rows.map((r, i) => {
      const h = Math.max(0.1, (r.receita / max) * 8);
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1, 0.8),
        new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(0.075, 0.9, 0.35 + 0.3 * (r.receita / max)) }));
      m.position.set((i - (rows.length - 1) / 2) * gap, 0, 0); m.userData = { row: r, target: h };
      m.scale.y = 0.01; root.add(m); return m;
    });
    const floor = new THREE.GridHelper(rows.length * gap + 2, rows.length + 2, 0x888888, 0x888888);
    floor.material.opacity = 0.25; floor.material.transparent = true; root.add(floor);

    let rotY = -0.5, rotX = 0.35, dist = 22, auto = true, drag = null;
    canvas.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, y: e.clientY }; auto = false; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener("pointerup", () => (drag = null));
    canvas.addEventListener("wheel", (e) => { e.preventDefault(); dist = Math.min(40, Math.max(10, dist + e.deltaY * 0.02)); }, { passive: false });
    const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
    canvas.addEventListener("pointermove", (e) => {
      if (drag) { rotY += (e.clientX - drag.x) * 0.01; rotX = Math.min(1.2, Math.max(0.05, rotX + (e.clientY - drag.y) * 0.006)); drag = { x: e.clientX, y: e.clientY }; }
      const b = canvas.getBoundingClientRect();
      ptr.set(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1);
      ray.setFromCamera(ptr, camera);
      const hit = ray.intersectObjects(meshes)[0];
      meshes.forEach((m) => m.material.emissive.setHex(m === (hit && hit.object) ? 0x552200 : 0));
      if (hit) { const r = hit.object.userData.row; tipEl.textContent = `${r.mes}: ${fmt(r.receita)} (${r.pedidos.toLocaleString("pt-BR")} pedidos)`;
        tipEl.style.left = e.clientX - b.left + 12 + "px"; tipEl.style.top = e.clientY - b.top + 12 + "px"; tipEl.style.opacity = 1; }
      else tipEl.style.opacity = 0;
    });
    function resize() { const w = canvas.clientWidth, h = canvas.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
    new ResizeObserver(resize).observe(canvas); resize();

    let alive = true;
    (function loop() {
      if (!alive || !canvas.isConnected) return;
      if (canvas.offsetParent !== null) {
        if (auto) rotY += 0.003;
        root.rotation.y = rotY;
        camera.position.set(0, Math.sin(rotX) * dist, Math.cos(rotX) * dist); camera.lookAt(0, 3, 0);
        meshes.forEach((m) => { const t = m.userData.target; m.scale.y += (t - m.scale.y) * 0.07; m.position.y = m.scale.y / 2; });
        renderer.render(scene, camera);
      }
      requestAnimationFrame(loop);
    })();
    return { toggleAuto: () => (auto = !auto), replay: () => meshes.forEach((m) => (m.scale.y = 0.01)) };
  }
  return { hero, bars };
})();
