// Cadeia de valor do pedido em 3D (supply chain): vendedor, marketplace, pagamento,
// distribuição, transporte, cliente e avaliação. Mostra o fluxo físico (caminhão e pacotes)
// e onde está o dinheiro (colunas proporcionais). Feito só com primitivas do Three.js.
window.OI_chain = (() => {
  const box = (w, h, d, color, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, roughness: 0.7 }));
    m.position.set(x, y + h / 2, z); return m;
  };
  const cyl = (rt, rb, h, color, x = 0, y = 0, z = 0, seg = 16) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), new THREE.MeshStandardMaterial({ color, roughness: 0.6 }));
    m.position.set(x, y + h / 2, z); return m;
  };

  function label(text, sub) {
    const c = document.createElement("canvas"); c.width = 512; c.height = 160;
    const g = c.getContext("2d");
    g.fillStyle = "rgba(20,22,24,.86)"; g.beginPath(); g.roundRect(4, 4, 504, 152, 28); g.fill();
    g.strokeStyle = "#f6851b"; g.lineWidth = 4; g.stroke();
    g.fillStyle = "#fff"; g.font = "bold 46px Inter, Arial, sans-serif"; g.textAlign = "center"; g.fillText(text, 256, 70);
    g.fillStyle = "#f6a45b"; g.font = "36px Inter, Arial, sans-serif"; g.fillText(sub, 256, 122);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false }));
    s.scale.set(5.2, 1.62, 1); return s;
  }

  // ----- construção de cada estação -----
  const build = {
    vendedor() {
      const g = new THREE.Group();
      g.add(box(3, 1.5, 2, 0x8b949e), box(1, 2.6, 1, 0xa7adb4, -0.8, 0, -0.2));
      const ch1 = cyl(0.22, 0.28, 2.2, 0x5a6470, 0.6, 1.5, 0), ch2 = cyl(0.22, 0.28, 1.7, 0x5a6470, 1.1, 1.5, 0);
      g.add(ch1, ch2, box(3, 0.2, 2.2, 0xf6851b, 0, 1.5, 0));
      g.userData.smoke = [ch1, ch2]; return g;
    },
    marketplace() {
      const g = new THREE.Group();
      g.add(box(2, 4.2, 2, 0x2a2e32), box(2.1, 0.3, 2.1, 0xf6851b, 0, 4.2, 0));
      for (let y = 0.5; y < 4; y += 0.7) { g.add(box(1.5, 0.18, 0.05, 0xffb35c, 0, y, 1.03)); }
      return g;
    },
    pagamento() {
      const g = new THREE.Group();
      for (let i = 0; i < 4; i++) for (let j = 0; j < 3 - (i % 2); j++) g.add(cyl(0.55, 0.55, 0.22, 0xe8b923, (j - 1) * 0.95 + (i % 2) * 0.4, i * 0.24, (i % 2) * 0.5 - 0.2, 24));
      g.add(box(2.6, 0.2, 2, 0x5a6470, 0, -0.2, 0.2)); return g;
    },
    distribuicao() {
      const g = new THREE.Group();
      g.add(box(4, 1.8, 2.8, 0xc9a27a));
      const roof = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 2.9, 3, 1, false), new THREE.MeshStandardMaterial({ color: 0x5a6470 }));
      roof.rotation.set(Math.PI / 2, 0, Math.PI / 2); roof.scale.set(1, 1, 0.5); roof.position.set(0, 2.2, 0); g.add(roof);
      for (let i = -1; i <= 1; i++) g.add(box(0.9, 1.2, 0.08, 0x24272a, i * 1.2, 0, 1.42)); return g;
    },
    cliente() {
      const g = new THREE.Group();
      g.add(box(2.4, 1.6, 2, 0xf2f4f6));
      const roof = new THREE.Mesh(new THREE.ConeGeometry(2, 1.3, 4), new THREE.MeshStandardMaterial({ color: 0xd73847 }));
      roof.rotation.y = Math.PI / 4; roof.position.y = 2.25; g.add(roof, box(0.5, 0.9, 0.08, 0x8a6a4a, 0, 0, 1.03)); return g;
    },
    avaliacao() {
      const g = new THREE.Group(), pts = [];
      for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.5 : 1.15, a = (i / 10) * Math.PI * 2 + Math.PI / 2; pts.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r)); }
      const star = new THREE.Mesh(new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: 0.35, bevelEnabled: false }), new THREE.MeshStandardMaterial({ color: 0xf6c21b, emissive: 0x553a00 }));
      star.position.set(0, 1.9, -0.17); g.add(star, cyl(0.12, 0.12, 1.3, 0x5a6470)); g.userData.star = star; return g;
    },
  };

  function truck() {
    const g = new THREE.Group();
    g.add(box(2.2, 1.3, 1.1, 0xf2f4f6, -0.6, 0.35), box(0.9, 0.95, 1.05, 0xf6851b, 1.0, 0.35));
    g.add(box(0.05, 0.5, 0.9, 0x6fb7ff, 1.48, 0.95));
    [[-1.1, 0.6], [0.2, 0.6], [1.0, 0.6], [-1.1, -0.6], [0.2, -0.6], [1.0, -0.6]].forEach(([x, z]) => {
      const w = cyl(0.32, 0.32, 0.22, 0x141618, x, 0.02, z, 14); w.rotation.x = Math.PI / 2; w.position.y = 0.32; g.add(w);
    });
    return g;
  }

  function mount(canvas, tipEl, stages, onSelect) {
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(42, 1, 0.1, 300);
    scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    const sun = new THREE.DirectionalLight(0xffffff, 0.9); sun.position.set(-10, 18, 14); scene.add(sun);

    const root = new THREE.Group(); scene.add(root);
    const span = 5, x0 = -((stages.length - 1) * span) / 2;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(stages.length * span + 6, 9), new THREE.MeshStandardMaterial({ color: 0x2f353b, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02; root.add(ground);
    for (let i = 0; i < stages.length * 4; i++) { const d = box(0.7, 0.02, 0.14, 0xffffff, x0 - 2.5 + i * (span / 4), 0, 2.4); d.material.emissive.setHex(0x333333); root.add(d); }

    const holders = stages.map((s, i) => {
      const g = build[s.model](); g.position.set(x0 + i * span, 0, -1.2); g.scale.setScalar(0);
      Object.assign(g.userData, { stage: s, i }); root.add(g);
      const l = label(s.name, s.metric); l.position.set(g.position.x, 6.6, -1.2); root.add(l);
      g.traverse((o) => { if (o.isMesh) o.userData.holder = g; });
      if (s.cost) {  // coluna de dinheiro proporcional
        const h = Math.max(0.4, s.cost * 5.2);
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, h, 20), new THREE.MeshStandardMaterial({ color: 0xf6851b, transparent: true, opacity: 0.55, emissive: 0x6a3300 }));
        col.position.set(g.position.x + 2.2, h / 2, 1.1); root.add(col);
        const cl = label(s.costLabel, "gasto"); cl.scale.set(2.7, 0.85, 1); cl.position.set(col.position.x, h + 0.9, 1.1); root.add(cl);
      }
      return g;
    });

    const tr = truck(); tr.position.set(0, 0, 2.4); root.add(tr);
    const pk = []; for (let i = 0; i < 9; i++) { const p = box(0.4, 0.4, 0.4, 0xc9a27a, 0, 0.1, 2.4); p.userData.t = i / 9; root.add(p); pk.push(p); }
    const smoke = []; for (let i = 0; i < 14; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), new THREE.MeshBasicMaterial({ color: 0xcfd3d8, transparent: true, opacity: 0.5 })); m.userData.t = i / 14; root.add(m); smoke.push(m); }

    let rotY = -0.25, rotX = 0.4, dist = 30, auto = false, drag = null, sel = null;
    canvas.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, y: e.clientY }; auto = false; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener("pointerup", () => (drag = null));
    canvas.addEventListener("wheel", (e) => { e.preventDefault(); dist = Math.min(50, Math.max(14, dist + e.deltaY * 0.02)); }, { passive: false });
    const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
    const pick = (e) => { const b = canvas.getBoundingClientRect(); ptr.set(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1); ray.setFromCamera(ptr, camera);
      const h = ray.intersectObjects(root.children, true).find((x) => x.object.userData.holder); return { hit: h && h.object.userData.holder, b }; };
    canvas.addEventListener("pointermove", (e) => {
      if (drag) { rotY += (e.clientX - drag.x) * 0.008; rotX = Math.min(1.1, Math.max(0.12, rotX + (e.clientY - drag.y) * 0.005)); drag = { x: e.clientX, y: e.clientY }; }
      const { hit, b } = pick(e);
      canvas.style.cursor = hit ? "pointer" : drag ? "grabbing" : "grab";
      if (hit) { const s = hit.userData.stage; tipEl.innerHTML = `<b>${s.name}</b><br>${s.detail}`; tipEl.style.left = e.clientX - b.left + 14 + "px"; tipEl.style.top = e.clientY - b.top + 14 + "px"; tipEl.style.opacity = 1; } else tipEl.style.opacity = 0;
    });
    canvas.addEventListener("click", (e) => { const { hit } = pick(e); if (hit) select(hit.userData.i); });
    function select(i) { sel = i; onSelect && onSelect(i); }
    function resize() { const w = canvas.clientWidth, h = canvas.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); dist = Math.max(dist, w < 600 ? 44 : 14); }
    new ResizeObserver(resize).observe(canvas); resize();

    const clock = new THREE.Clock(); let t0 = 0;
    (function loop() {
      if (!canvas.isConnected) return;
      if (canvas.offsetParent !== null) {
        const t = clock.getElapsedTime(); if (!t0) t0 = t;
        if (auto) rotY += 0.0025;
        root.rotation.y = rotY; camera.position.set(0, Math.sin(rotX) * dist, Math.cos(rotX) * dist); camera.lookAt(0, 2, 0);
        holders.forEach((g, i) => { const k = Math.min(1, Math.max(0, (t - t0 - i * 0.18) / 0.6)), e = 1 - Math.pow(1 - k, 3);
          g.scale.setScalar(e * (sel === i ? 1.12 : 1)); if (g.userData.star) g.userData.star.rotation.y = t * 1.5; });
        const L = (stages.length - 1) * span;
        pk.forEach((p) => { const u = ((reduce ? p.userData.t : (t * 0.06 + p.userData.t)) % 1); p.position.x = x0 + u * L; p.rotation.y = u * 6; });
        const tu = reduce ? 0.7 : (Math.sin(t * 0.4) + 1) / 2; tr.position.x = x0 + 3 * span + tu * (L - 3 * span); tr.rotation.y = Math.cos(t * 0.4) > 0 ? 0 : Math.PI;
        const sm = holders[0].userData.smoke; if (holders[0].scale.x > 0.5) smoke.forEach((m, i) => { const u = reduce ? 0.3 : ((t * 0.25 + m.userData.t) % 1); const c = sm[i % 2];
          m.position.set(holders[0].position.x + (i % 2 ? 1.1 : 0.6) + u * 0.8, 3.7 + u * 2.4, -1.2); m.scale.setScalar(0.6 + u * 1.6); m.material.opacity = 0.5 * (1 - u); });
        renderer.render(scene, camera);
      }
      requestAnimationFrame(loop);
    })();
    return { select, toggleAuto: () => (auto = !auto) };
  }
  return { mount };
})();
