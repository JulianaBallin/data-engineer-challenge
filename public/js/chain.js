// Mapa 3D da cadeia do pedido (Three.js r128): terreno, estrada sinuosa, rio, árvores e seis
// estações com modelos detalhados (fábrica, torres, banco, galpão, casas e monumento).
// Cada etapa pode ser clicada: a câmera voa até ela e o painel ao lado mostra só aquela etapa.
window.OI_chain = (() => {
  const T = THREE;
  const std = (color, o = {}) => new T.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.04, ...o });
  const rand = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

  function shadow(m) { m.castShadow = true; m.receiveShadow = true; return m; }
  function box(w, h, d, mat, x = 0, y = 0, z = 0) { const m = shadow(new T.Mesh(new T.BoxGeometry(w, h, d), mat)); m.position.set(x, y + h / 2, z); return m; }
  function cyl(rt, rb, h, mat, x = 0, y = 0, z = 0, seg = 24) { const m = shadow(new T.Mesh(new T.CylinderGeometry(rt, rb, h, seg), mat)); m.position.set(x, y + h / 2, z); return m; }
  function prism(w, h, d, mat, x = 0, y = 0, z = 0) {   // telhado de duas águas: base w, altura h, comprimento d (eixo z)
    const sh = new T.Shape([new T.Vector2(-w / 2, 0), new T.Vector2(w / 2, 0), new T.Vector2(0, h)]);
    const g = new T.ExtrudeGeometry(sh, { depth: d, bevelEnabled: false }); g.translate(0, 0, -d / 2);
    const m = shadow(new T.Mesh(g, mat)); m.position.set(x, y, z); return m;
  }

  // ---------- texturas geradas em canvas ----------
  function canvasTex(w, h, draw, repeat) {
    const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h);
    const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.anisotropy = 8;
    if (repeat) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
    return t;
  }
  const R = rand(7);
  const grassTex = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = "#6f9f45"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) { const l = 38 + R() * 20; g.fillStyle = `hsla(${88 + R() * 18},${40 + R() * 25}%,${l}%,${0.18 + R() * 0.25})`; g.beginPath(); g.arc(R() * w, R() * h, 2 + R() * 14, 0, 6.3); g.fill(); }
  }, [10, 6]);
  function windowTex(lit) {
    return canvasTex(128, 256, (g, w, h) => {
      g.fillStyle = "#516a86"; g.fillRect(0, 0, w, h);
      for (let y = 8; y < h - 8; y += 20) for (let x = 8; x < w - 8; x += 20) {
        const on = R() < lit; g.fillStyle = on ? "#ffe9a8" : "#8fb4d8"; g.fillRect(x, y, 12, 13);
      }
    }, null);
  }
  const winTex = windowTex(0.35);
  const asphaltTex = canvasTex(64, 256, (g, w, h) => { g.fillStyle = "#34393f"; g.fillRect(0, 0, w, h); for (let i = 0; i < 700; i++) { g.fillStyle = `rgba(${R() < 0.5 ? 255 : 0},${R() < 0.5 ? 255 : 0},255,${R() * 0.05})`; g.fillRect(R() * w, R() * h, 2, 2); } }, null);
  const dashTex = canvasTex(16, 64, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = "#f4f1e4"; g.fillRect(0, 6, w, 30); }, null);

  function label(text, sub) {
    const c = document.createElement("canvas"); c.width = 600; c.height = 170;
    const g = c.getContext("2d");
    g.shadowColor = "rgba(0,0,0,.25)"; g.shadowBlur = 14; g.shadowOffsetY = 4;
    g.fillStyle = "#ffffff"; g.beginPath(); g.roundRect(14, 10, 572, 130, 36); g.fill();
    g.shadowColor = "transparent"; g.fillStyle = "#f6851b"; g.beginPath(); g.roundRect(14, 10, 14, 130, 7); g.fill();
    g.fillStyle = "#1d2125"; g.font = "bold 50px Inter, Arial, sans-serif"; g.textAlign = "center"; g.fillText(text, 306, 70);
    g.fillStyle = "#e2761b"; g.font = "600 36px Inter, Arial, sans-serif"; g.fillText(sub, 306, 114);
    const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding;
    const s = new T.Sprite(new T.SpriteMaterial({ map: t, transparent: true, depthTest: false })); s.scale.set(10.5, 3, 1); s.renderOrder = 10; return s;
  }

  // ---------- modelos ----------
  const build = {
    vendedor() {
      const g = new T.Group(), wall = std(0xb7bec6), dark = std(0x59636e), orange = std(0xf6851b);
      g.add(box(8, 2.8, 5, wall));
      for (let i = 0; i < 4; i++) g.add(prism(2, 1, 5.1, dark, -3 + i * 2, 2.8, 0));
      g.add(box(7.2, 0.6, 0.06, std(0x86c3ff, { emissive: 0x2a4a6b, roughness: 0.2, metalness: 0.4 }), 0, 1.2, 2.53));
      g.add(box(2.2, 3.8, 2.4, std(0xeef0f3), -4.8, 0, 2.4), box(2.3, 0.3, 2.5, orange, -4.8, 3.8, 2.4));
      const wm = new T.MeshStandardMaterial({ map: winTex, roughness: 0.3, metalness: 0.3 }); g.add(box(2.22, 3.2, 2.42, wm, -4.8, 0.3, 2.4));
      [[2.6, 6.2], [4, 5.1]].forEach(([x, h]) => { g.add(cyl(0.42, 0.55, h, std(0xe9e6df), x, 2.8, -1.4));
        for (let b = 0; b < 3; b++) g.add(cyl(0.45 - b * 0.02, 0.5 - b * 0.02, 0.55, std(0xc8372d), x, 2.8 + 1.2 + b * 1.4, -1.4)); g.add(cyl(0.5, 0.45, 0.2, dark, x, 2.8 + h, -1.4)); });
      [[5.2, 2.4], [6.7, 2.4]].forEach(([x, z]) => { g.add(cyl(0.9, 0.9, 2.6, std(0xd4dbe2, { metalness: 0.7, roughness: 0.3 }), x, 0, z)); const dm = new T.Mesh(new T.SphereGeometry(0.9, 20, 12, 0, 6.3, 0, 1.57), std(0xd4dbe2, { metalness: 0.7, roughness: 0.3 })); dm.position.set(x, 2.6, z); dm.castShadow = true; g.add(dm); });
      g.add(box(1.8, 0.45, 2.2, std(0x30353a), 4, 0, 3.6));
      g.userData.smoke = [[2.6, 9.1, -1.4], [4, 8, -1.4]]; return g;
    },
    marketplace() {
      const g = new T.Group(), glassMat = (tint) => new T.MeshStandardMaterial({ map: winTex, color: tint, roughness: 0.22, metalness: 0.55 });
      g.add(box(11, 0.7, 6, std(0xdde1e6)), box(10.4, 0.25, 5.4, std(0xc4cad1), 0, 0.7, 0));
      [[-3.4, 7.4, 2.5, 0xbcd4ff], [0, 10.6, 2.8, 0xffffff], [3.4, 6, 2.5, 0xcfe0ff]].forEach(([x, h, w, c], i) => {
        g.add(box(w, h, w, glassMat(c), x, 0.95, i === 1 ? -0.6 : 0.3)); g.add(box(w + 0.15, 0.35, w + 0.15, std(0xf6851b), x, 0.95 + h, i === 1 ? -0.6 : 0.3)); });
      g.add(cyl(0.05, 0.05, 2, std(0x777f88), 0, 11.5, -0.6, 8), box(3.2, 0.4, 1, std(0xf6851b, { emissive: 0x7a3a00 }), 0, 0.95, 2.6));
      g.add(box(4, 0.15, 1.6, std(0x2d3238), 0, 2.5, 3.1));
      return g;
    },
    pagamento() {
      const g = new T.Group(), stone = std(0xf0ebdf, { roughness: 0.55 }), gold = std(0xe9b423, { metalness: 0.9, roughness: 0.25, emissive: 0x3a2800 });
      g.add(box(7.4, 0.3, 5.4, std(0xc9c3b6)), box(6.8, 0.3, 4.8, std(0xd8d2c5), 0, 0.3, 0), box(6, 3.4, 3.6, stone, 0, 0.6, -0.3));
      for (let i = 0; i < 6; i++) g.add(cyl(0.26, 0.28, 3.4, stone, -2.5 + i, 0.6, 1.85, 16));
      g.add(box(6.2, 0.4, 3.9, std(0xe2dccf), 0, 4, 0.1), prism(6.6, 1.5, 3.9, std(0xe9e3d6), 0, 4.4, 0.1));
      g.add(box(1.5, 2.2, 0.1, std(0x6b5a3a, { metalness: 0.5 }), 0, 0.6, 1.5));
      const coin = new T.Group(); const c = shadow(new T.Mesh(new T.CylinderGeometry(1.1, 1.1, 0.3, 40), gold)); c.rotation.x = Math.PI / 2; coin.add(c);
      const rim = shadow(new T.Mesh(new T.TorusGeometry(0.85, 0.06, 10, 40), gold)); rim.position.z = 0.17; coin.add(rim);
      coin.position.set(0, 7.6, 0); g.add(coin, cyl(0.12, 0.2, 1.6, std(0x777f88), 0, 5.9, 0, 10)); g.userData.spin = coin; return g;
    },
    distribuicao() {
      const g = new T.Group(), wall = std(0xd2d8de), door = std(0x8e98a2, { metalness: 0.5, roughness: 0.4 });
      g.add(box(10.5, 3.4, 5.6, wall)); const roof = prism(5.9, 1.3, 10.7, std(0x586470, { metalness: 0.3 }), 0, 3.4, 0); roof.rotation.y = Math.PI / 2; g.add(roof);
      for (let i = 0; i < 4; i++) { g.add(box(1.8, 2.5, 0.08, door, -3.6 + i * 2.4, 0, 2.85)); for (let r = 0; r < 6; r++) g.add(box(1.8, 0.04, 0.1, std(0x6b747d), -3.6 + i * 2.4, 0.35 + r * 0.4, 2.9)); }
      g.add(box(10.8, 0.55, 1.8, std(0x9aa3ab), 0, 0, 3.7), box(10.8, 0.25, 0.4, std(0xf6851b), 0, 3.4, 2.95));
      for (let i = 0; i < 7; i++) g.add(box(0.8, 0.8, 0.8, std(i % 2 ? 0xc9a27a : 0xb58a5b), 4.6 + (i % 2) * 0.9, 0, 4.6 + Math.floor(i / 2) * 0.9));
      const trailer = new T.Group(); trailer.add(box(4.6, 2, 1.9, std(0xf5f6f8)), box(4.62, 0.4, 1.92, std(0xf6851b), 0, 0.5, 0)); trailer.position.set(-2.2, 0.6, 5.7); g.add(trailer);
      return g;
    },
    cliente() {
      const g = new T.Group(); const R2 = rand(3);
      [[-4.2, -0.6, 0xf3ece1, 0xb5473a], [0.2, 1.4, 0xe3ecf2, 0x4a5d73], [4.4, -0.2, 0xf1e7d3, 0x6e4b3a]].forEach(([x, z, wall, roof], i) => {
        const h = new T.Group(); h.add(box(3.2, 2, 3, std(wall)), prism(3.8, 1.7, 3.3, std(roof), 0, 2, 0), box(0.5, 1.1, 0.5, std(0x8a5a44), 0.9, 2.2, -0.6));
        h.add(box(0.7, 1.2, 0.08, std(0x70492e), 0, 0, 1.52)); h.add(box(0.7, 0.7, 0.08, std(0x9ed0ff, { emissive: 0x294b68 }), -1, 0.9, 1.52), box(0.7, 0.7, 0.08, std(0x9ed0ff, { emissive: 0x294b68 }), 1, 0.9, 1.52));
        h.add(box(3.6, 0.04, 0.9, std(0xcfc8bb), 0, 0, 2.3)); h.position.set(x, 0, z); h.rotation.y = (i - 1) * 0.18; g.add(h);
        const mb = box(0.3, 0.7, 0.4, std(0xf6851b), x + 1.9, 0, z + 2.7); g.add(mb); });
      g.add(box(0.5, 0.5, 0.5, std(0xc9a27a, { roughness: 0.9 }), 1.4, 0.7, 3.4));
      return g;
    },
    avaliacao() {
      const g = new T.Group(), gold = std(0xf6c21b, { metalness: 0.8, roughness: 0.28, emissive: 0x4a3400 });
      g.add(cyl(3, 3.2, 0.4, std(0xc9ced4)), cyl(2.4, 2.6, 0.4, std(0xdfe3e8), 0, 0.4, 0), cyl(0.5, 0.6, 2.6, std(0xeceff2), 0, 0.8, 0));
      const pts = []; for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.8 : 1.9, a = (i / 10) * Math.PI * 2 + Math.PI / 2; pts.push(new T.Vector2(Math.cos(a) * r, Math.sin(a) * r)); }
      const star = shadow(new T.Mesh(new T.ExtrudeGeometry(new T.Shape(pts), { depth: 0.55, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 2 }), gold)); star.position.set(0, 5.4, -0.27); g.add(star); g.userData.spin = star;
      const orbit = new T.Group(); for (let i = 0; i < 5; i++) { const s = shadow(new T.Mesh(new T.SphereGeometry(0.22, 12, 12), gold)); const a = (i / 5) * 6.28; s.position.set(Math.cos(a) * 3.1, 5.4, Math.sin(a) * 3.1); orbit.add(s); } g.add(orbit); g.userData.orbit = orbit;
      return g;
    },
  };

  function truck() {
    const g = new T.Group(), white = std(0xf5f6f8, { roughness: 0.4 }), orange = std(0xf6851b, { roughness: 0.4 }), black = std(0x15171a, { roughness: 0.8 }), glass = std(0x7fb6e8, { roughness: 0.08, metalness: 0.7 });
    g.add(box(4.4, 0.25, 1.7, black, -0.9, 0.5, 0), box(4.5, 2, 1.9, white, -1, 0.72, 0), box(4.52, 0.35, 1.92, orange, -1, 1.2, 0));
    g.add(box(1.7, 1.55, 1.8, orange, 1.8, 0.62, 0), box(0.12, 0.8, 1.5, glass, 2.68, 1.35, 0), box(0.5, 0.7, 1.7, orange, 2.35, 0.62, 0), box(0.2, 0.3, 1.8, std(0x2a2d31), 2.7, 0.45, 0));
    [-0.7, 0.7].forEach((z) => { const l = new T.Mesh(new T.BoxGeometry(0.06, 0.2, 0.3), new T.MeshStandardMaterial({ color: 0xfff3b0, emissive: 0xffe58a, emissiveIntensity: 0.9 })); l.position.set(2.62, 0.7, z * 0.9); g.add(l); });
    [[-2.5, 1], [-1.4, 1], [1.9, 1], [-2.5, -1], [-1.4, -1], [1.9, -1]].forEach(([x, s]) => {
      const w = cyl(0.45, 0.45, 0.34, black, x, 0, s * 0.85, 22); w.rotation.x = Math.PI / 2; w.position.y = 0.45; g.add(w);
      const rim = cyl(0.24, 0.24, 0.36, std(0xb7bcc2, { metalness: 0.8, roughness: 0.3 }), x, 0, s * 0.86, 14); rim.rotation.x = Math.PI / 2; rim.position.y = 0.45; g.add(rim); });
    g.scale.setScalar(0.85); return g;
  }

  // posições no mapa (x, z) e quanto cada estação "olha" para a estrada
  const ROAD = [[-44, 10], [-33, 8], [-24, 2], [-17, -6], [-8, -8], [0, -3], [6, 4], [14, 8], [22, 4], [29, -4], [38, -6], [46, -2]];
  const SPOT = { vendedor: [-36, -1], marketplace: [-12, -20], pagamento: [8, -17], distribuicao: [6, 17], cliente: [31, 14], avaliacao: [40, -17] };

  function mount(canvas, tipEl, stages, onSelect) {
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.outputEncoding = T.sRGBEncoding; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.92;
    const scene = new T.Scene(), camera = new T.PerspectiveCamera(38, 1, 0.5, 400);
    scene.add(new T.HemisphereLight(0xdff0ff, 0x6f8f55, 0.55));
    const sun = new T.DirectionalLight(0xfff1d6, 0.95); sun.position.set(-40, 62, 34); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 50, bottom: -50, near: 10, far: 180 }); sun.shadow.bias = -0.0004; scene.add(sun);
    const world = new T.Group(); scene.add(world);

    // terreno
    const ground = new T.Mesh(new T.PlaneGeometry(150, 96), new T.MeshStandardMaterial({ map: grassTex, roughness: 1 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; world.add(ground);
    // rio e lago
    const water = new T.MeshStandardMaterial({ color: 0x3d8fd1, roughness: 0.15, metalness: 0.3, transparent: true, opacity: 0.92 });
    const river = new T.CatmullRomCurve3([[-70, -32], [-40, -30], [-10, -36], [20, -33], [50, -36], [75, -30]].map(([x, z]) => new T.Vector3(x, 0.02, z)));
    function ribbon(curve, width, mat, y, n = 160, vscale = 1) {
      const pos = [], uv = [], idx = [], L = curve.getLength();
      for (let i = 0; i <= n; i++) { const u = i / n, p = curve.getPointAt(u), t = curve.getTangentAt(u), nx = -t.z, nz = t.x, l = Math.hypot(nx, nz) || 1;
        pos.push(p.x + (nx / l) * width / 2, y, p.z + (nz / l) * width / 2, p.x - (nx / l) * width / 2, y, p.z - (nz / l) * width / 2); uv.push(0, u * L * vscale, 1, u * L * vscale);
        if (i < n) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
      const g = new T.BufferGeometry(); g.setAttribute("position", new T.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
      mat.side = T.DoubleSide; const m = new T.Mesh(g, mat); m.receiveShadow = true; return m;
    }
    world.add(ribbon(river, 9, water, 0.04));
    const lake = new T.Mesh(new T.CircleGeometry(7, 40), water); lake.rotation.x = -Math.PI / 2; lake.position.set(-52, 0.05, 16); lake.scale.set(1.3, 1, 0.8); world.add(lake);

    // estrada
    const road = new T.CatmullRomCurve3(ROAD.map(([x, z]) => new T.Vector3(x, 0, z)), false, "catmullrom", 0.5);
    asphaltTex.wrapS = asphaltTex.wrapT = T.RepeatWrapping; asphaltTex.repeat.set(1, 20); dashTex.wrapS = dashTex.wrapT = T.RepeatWrapping;
    world.add(ribbon(road, 4.4, new T.MeshStandardMaterial({ map: asphaltTex, roughness: 0.95 }), 0.05, 220, 0.12));
    world.add(ribbon(road, 4.9, std(0xc9cdd2, { roughness: 1 }), 0.045, 220));
    dashTex.repeat.set(1, 1); const dashes = ribbon(road, 0.22, new T.MeshBasicMaterial({ map: dashTex, transparent: true }), 0.07, 220, 0.5); world.add(dashes);

    // estações
    const holders = stages.map((s, i) => {
      const g = build[s.model](); const [x, z] = SPOT[s.model];
      let best = 1e9, bp = null; for (let k = 0; k <= 200; k++) { const p = road.getPointAt(k / 200), d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < best) { best = d; bp = p; } }
      const slab = box(12.6, 0.14, 11, std(0x8d949c, { roughness: 1 }), 0, -0.02, 0.4); g.add(slab); // piso de concreto
      g.position.set(x, 0, z); g.rotation.y = Math.atan2(bp.x - x, bp.z - z);
      Object.assign(g.userData, { i, s, home: new T.Vector3(x, 0, z), scale0: 0 }); g.scale.setScalar(0.001); world.add(g);
      g.traverse((o) => { if (o.isMesh) o.userData.holder = g; });
      const l = label(s.name, s.metric + (s.short ? " " + s.short : "")); l.position.set(x, 14.5, z); world.add(l); g.userData.label = l;
      // pilha de moedas proporcional ao gasto
      if (s.cost) { const n = Math.max(3, Math.round(s.cost * 34)), stack = new T.Group();
        for (let k = 0; k < n; k++) { const c = shadow(new T.Mesh(new T.CylinderGeometry(1.1, 1.1, 0.22, 24), std(0xe9b423, { metalness: 0.9, roughness: 0.28, emissive: 0x3a2800 }))); c.position.y = 0.11 + k * 0.23; stack.add(c); }
        const off = new T.Vector3(Math.sin(g.rotation.y + Math.PI / 2), 0, Math.cos(g.rotation.y + Math.PI / 2)).multiplyScalar(8.6);
        stack.position.set(x + off.x, 0, z + off.z); world.add(stack); g.userData.stack = stack; stack.scale.setScalar(0.001);
        const cl = label(s.costLabel, "gasto"); cl.scale.set(7, 2, 1); cl.position.set(stack.position.x, n * 0.23 + 2.2, stack.position.z); world.add(cl); }
      return g;
    });

    // árvores e arbustos
    const trunk = std(0x6b4a2f), foliage = [std(0x3f7d3a), std(0x4c8f43), std(0x2f6a35)];
    const placed = [...holders.map((h) => h.position)]; const RT = rand(21);
    for (let k = 0, tries = 0; k < 120 && tries < 2500; tries++) {
      const x = (RT() - 0.5) * 138, z = (RT() - 0.5) * 84; if (z < -28 && Math.abs(z + 33) < 6) continue;
      if (placed.some((p) => (p.x - x) ** 2 + (p.z - z) ** 2 < 150)) continue;
      let near = false; for (let q = 0; q <= 60; q++) { const p = road.getPointAt(q / 60); if ((p.x - x) ** 2 + (p.z - z) ** 2 < 28) { near = true; break; } } if (near) continue;
      const s = 0.8 + RT() * 0.9, t = new T.Group(); t.add(cyl(0.18 * s, 0.26 * s, 1.5 * s, trunk, 0, 0, 0, 8));
      const f = foliage[k % 3]; t.add(shadow(new T.Mesh(new T.ConeGeometry(1.5 * s, 2.8 * s, 9), f)).translateY(2.7 * s), shadow(new T.Mesh(new T.ConeGeometry(1.1 * s, 2.2 * s, 9), f)).translateY(4 * s));
      t.position.set(x, 0, z); world.add(t); placed.push(t.position); k++; }

    // fluxo: pacotes na estrada, caminhão, fumaça
    const pk = []; for (let i = 0; i < 10; i++) { const p = box(0.9, 0.9, 0.9, std(0xc9a27a, { roughness: 0.9 }), 0, 0.25, 0); p.userData.t = i / 10; world.add(p); pk.push(p); }
    const tr = truck(); world.add(tr);
    const smokeMat = () => new T.MeshBasicMaterial({ color: 0xe6e9ed, transparent: true, opacity: 0.5, depthWrite: false });
    const smoke = []; for (let i = 0; i < 18; i++) { const m = new T.Mesh(new T.SphereGeometry(0.5, 10, 10), smokeMat()); m.userData.t = i / 18; world.add(m); smoke.push(m); }

    // câmera orbital com foco animado
    const MAP_C = new T.Vector3(3, 0, -1), target = MAP_C.clone(), tgtGoal = MAP_C.clone();
    let rotY = 0.35, rotX = 0.78, dist = 96, distGoal = 96, auto = !reduce, drag = null, sel = null, hover = null, ready = false;
    const MAP_DIST = 96;
    canvas.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, y: e.clientY, moved: 0 }; auto = false; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener("pointerup", (e) => { const was = drag; drag = null; if (was && was.moved < 5) { const h = pick(e).hit; if (h) select(h.userData.i); } });
    canvas.addEventListener("wheel", (e) => { e.preventDefault(); distGoal = Math.min(150, Math.max(14, distGoal + e.deltaY * 0.06)); }, { passive: false });
    const ray = new T.Raycaster(), ptr = new T.Vector2();
    function pick(e) { const b = canvas.getBoundingClientRect(); ptr.set(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1); ray.setFromCamera(ptr, camera);
      const h = ray.intersectObjects(world.children, true).find((x) => x.object.userData.holder); return { hit: h && h.object.userData.holder, b }; }
    canvas.addEventListener("pointermove", (e) => {
      if (drag) { const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.moved += Math.abs(dx) + Math.abs(dy); rotY -= dx * 0.006; rotX = Math.min(1.35, Math.max(0.22, rotX + dy * 0.005)); drag.x = e.clientX; drag.y = e.clientY; }
      const { hit, b } = pick(e); hover = hit || null; canvas.style.cursor = hit ? "pointer" : drag ? "grabbing" : "grab";
      if (hit) { const s = hit.userData.s; tipEl.innerHTML = `<b>${s.name}</b><br>${s.metric} ${s.short || ""}<br><small>Clique para ver os detalhes</small>`; tipEl.style.left = e.clientX - b.left + 14 + "px"; tipEl.style.top = e.clientY - b.top + 14 + "px"; tipEl.style.opacity = 1; } else tipEl.style.opacity = 0; });
    function select(i) { sel = i; auto = false; tgtGoal.copy(holders[i].position).setY(2); distGoal = 30; onSelect && onSelect(i); }
    function reset() { sel = null; tgtGoal.copy(MAP_C); distGoal = MAP_DIST; rotX = 0.78; onSelect && onSelect(null); }
    function resize() { const w = canvas.clientWidth, h = canvas.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); const f = w / h < 0.8 ? 2.2 : w / h < 1.2 ? 1.5 : 1; distGoal = sel == null ? MAP_DIST * f : distGoal; if (sel == null) dist = distGoal; }
    new ResizeObserver(resize).observe(canvas); resize();

    const clock = new T.Clock(); let t0 = 0; const tmp = new T.Vector3();
    (function loop() {
      if (!canvas.isConnected) return;
      if (canvas.offsetParent !== null) {
        const t = clock.getElapsedTime(); if (!t0) t0 = t;
        if (auto) rotY += 0.0012;
        target.lerp(tgtGoal, 0.06); dist += (distGoal - dist) * 0.06;
        camera.position.set(target.x + Math.sin(rotY) * Math.cos(rotX) * dist, target.y + Math.sin(rotX) * dist, target.z + Math.cos(rotY) * Math.cos(rotX) * dist); camera.lookAt(target);
        holders.forEach((g, i) => { const k = Math.min(1, Math.max(0, (t - t0 - i * 0.22) / 0.7)), e = 1 - Math.pow(1 - k, 3);
          const pulse = (sel === i || hover === g) ? 1.04 : 1; g.scale.setScalar(Math.max(0.001, e * pulse)); if (g.userData.stack) g.userData.stack.scale.setScalar(Math.max(0.001, e));
          g.userData.label.visible = e > 0.9 && (sel === null || sel === i);
          if (g.userData.spin) g.userData.spin.rotation.y = t * (g.userData.s.model === "pagamento" ? 1.2 : 0.8); if (g.userData.orbit) g.userData.orbit.rotation.y = -t * 0.6; });
        pk.forEach((p) => { const u = (reduce ? p.userData.t : (t * 0.018 + p.userData.t)) % 1, pt = road.getPointAt(u), tn = road.getTangentAt(u); p.position.set(pt.x + tn.z * 0.8, 0.5, pt.z - tn.x * 0.8); p.rotation.y = Math.atan2(tn.x, tn.z); });
        const u0 = 0.46, tu = reduce ? 0.8 : u0 + ((Math.sin(t * 0.22) + 1) / 2) * (0.96 - u0), fwd = Math.cos(t * 0.22) >= 0;
        const pt = road.getPointAt(tu), tn = road.getTangentAt(tu); tr.position.set(pt.x - tn.z * 0.9, 0.05, pt.z + tn.x * 0.9); tr.rotation.y = Math.atan2(-tn.z, tn.x) + (fwd ? 0 : Math.PI) - (fwd ? 0 : 0);
        const f = holders[0]; if (f.scale.x > 0.5) { const src = f.userData.smoke; smoke.forEach((m, i) => { const [sx, sy, sz] = src[i % 2], u = reduce ? 0.3 : ((t * 0.2 + m.userData.t) % 1); tmp.set(sx, sy, sz).applyMatrix4(f.matrixWorld);
          m.position.set(tmp.x + u * 2.2, tmp.y + u * 5, tmp.z + u * 0.6); m.scale.setScalar(0.8 + u * 2.4); m.material.opacity = 0.55 * (1 - u); }); }
        renderer.render(scene, camera);
      }
      requestAnimationFrame(loop);
    })();
    return { select, reset, toggleAuto: () => (auto = !auto) };
  }
  return { mount };
})();
