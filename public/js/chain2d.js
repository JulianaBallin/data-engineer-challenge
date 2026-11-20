// Mapa 2D (SVG) da cadeia do pedido: mesma lógica do 3D (circuito fechado, caminhão que para em cada etapa,
// pilhas de moedas e clique para ver só a etapa escolhida), mas sem depender de WebGL.
window.OI_chain2d = (() => {
  const NS = "http://www.w3.org/2000/svg", W = 1000, H = 600, K = 9.3, CX = 500, CY = 318;
  const px = ([x, z]) => [CX + x * K, CY + z * K];
  const ROAD = [[-30, 2], [-25, -8], [-12, -12], [2, -12], [14, -10], [26, -9], [31, -1], [27, 6], [14, 9], [2, 10], [-10, 9], [-22, 8]].map(px);
  const SPOT = { vendedor: [-40, 2], marketplace: [-22, -19], pagamento: [2, -21], distribuicao: [28, -17], cliente: [38, 7], avaliacao: [-12, 19] };

  // curva fechada suave (Catmull-Rom convertida em Bézier)
  function closedPath(p) {
    const n = p.length; let d = `M${p[0][0]},${p[0][1]}`;
    for (let i = 0; i < n; i++) {
      const p0 = p[(i - 1 + n) % n], p1 = p[i], p2 = p[(i + 1) % n], p3 = p[(i + 2) % n];
      d += ` C${p1[0] + (p2[0] - p0[0]) / 6},${p1[1] + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6},${p2[1] - (p3[1] - p1[1]) / 6} ${p2[0]},${p2[1]}`;
    }
    return d + "Z";
  }
  const GLYPH = {
    vendedor: `<rect x="-50" y="-6" width="92" height="36" rx="3" fill="#b7bec6"/><path d="M-50,-6 L-36,-24 L-36,-6 L-22,-24 L-22,-6 L-8,-24 L-8,-6 L6,-24 L6,-6 L20,-24 L20,-6Z" fill="#8a949e"/><rect x="-64" y="-26" width="22" height="56" rx="2" fill="#eef0f3"/><rect x="-64" y="-30" width="22" height="6" fill="#f6851b"/><rect x="22" y="-52" width="9" height="46" fill="#e9e6df"/><rect x="22" y="-40" width="9" height="6" fill="#c8372d"/><rect x="22" y="-26" width="9" height="6" fill="#c8372d"/><rect x="36" y="-42" width="9" height="36" fill="#e9e6df"/><rect x="36" y="-30" width="9" height="6" fill="#c8372d"/><circle cx="26" cy="-60" r="6" class="smoke"/><circle cx="40" cy="-52" r="5" class="smoke s2"/>`,
    marketplace: `<rect x="-52" y="14" width="104" height="10" rx="3" fill="#dde1e6"/><rect x="-44" y="-34" width="28" height="48" fill="url(#win)"/><rect x="-44" y="-38" width="28" height="5" fill="#f6851b"/><rect x="-12" y="-62" width="30" height="76" fill="url(#win)"/><rect x="-12" y="-66" width="30" height="5" fill="#f6851b"/><rect x="22" y="-22" width="26" height="36" fill="url(#win)"/><rect x="22" y="-26" width="26" height="5" fill="#f6851b"/>`,
    pagamento: `<rect x="-52" y="20" width="104" height="8" fill="#c9c3b6"/><rect x="-46" y="14" width="92" height="7" fill="#d8d2c5"/><rect x="-40" y="-18" width="80" height="32" fill="#f0ebdf"/>${[-34, -20, -6, 8, 22, 34].map((x) => `<rect x="${x}" y="-18" width="5" height="32" fill="#e2dccf"/>`).join("")}<path d="M-46,-18 L0,-44 L46,-18Z" fill="#e9e3d6"/><circle cx="0" cy="-26" r="8" fill="#e9b423" stroke="#b98a10" stroke-width="2"/>`,
    distribuicao: `<rect x="-56" y="-14" width="112" height="46" rx="3" fill="#d2d8de"/><path d="M-60,-14 L-48,-32 L48,-32 L60,-14Z" fill="#586470"/>${[-40, -16, 8, 32].map((x) => `<rect x="${x}" y="6" width="18" height="26" fill="#8e98a2"/><path d="M${x},12h18M${x},18h18M${x},24h18" stroke="#6b747d" stroke-width="1"/>`).join("")}<rect x="-56" y="-14" width="112" height="4" fill="#f6851b"/><rect x="40" y="36" width="30" height="14" rx="2" fill="#f5f6f8"/><rect x="66" y="38" width="10" height="12" rx="2" fill="#f6851b"/>`,
    cliente: [[-48, 6, "#f3ece1", "#b5473a"], [-8, -10, "#e3ecf2", "#4a5d73"], [32, 8, "#f1e7d3", "#6e4b3a"]].map(([x, y, w, r]) => `<g transform="translate(${x},${y})"><rect x="-17" y="-4" width="34" height="26" fill="${w}"/><path d="M-22,-4 L0,-24 L22,-4Z" fill="${r}"/><rect x="-4" y="8" width="8" height="14" fill="#70492e"/><rect x="-14" y="2" width="7" height="7" fill="#9ed0ff"/><rect x="7" y="2" width="7" height="7" fill="#9ed0ff"/></g>`).join(""),
    avaliacao: `<ellipse cx="0" cy="22" rx="46" ry="14" fill="#c9ced4"/><ellipse cx="0" cy="16" rx="34" ry="10" fill="#dfe3e8"/><rect x="-7" y="-8" width="14" height="26" fill="#eceff2"/><polygon class="star" points="0,-52 7.5,-34 26,-32 12,-20 16,-2 0,-12 -16,-2 -12,-20 -26,-32 -7.5,-34" fill="#f6c21b" stroke="#c99a0a" stroke-width="2"/>`,
  };
  const el = (name, attrs = {}, html = "") => { const e = document.createElementNS(NS, name); for (const k in attrs) e.setAttribute(k, attrs[k]); if (html) e.innerHTML = html; return e; };

  function mount(host, tipEl, stages, onSelect) {
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, class: "map2d", role: "img", "aria-label": "Mapa da cadeia do pedido" });
    svg.innerHTML = `<defs><pattern id="win" width="8" height="9" patternUnits="userSpaceOnUse"><rect width="8" height="9" fill="#516a86"/><rect x="1.5" y="1.5" width="4" height="5" fill="#ffe9a8" opacity=".85"/></pattern>
      <pattern id="grass" width="40" height="40" patternUnits="userSpaceOnUse"><rect width="40" height="40" fill="#6f9f45"/><circle cx="8" cy="9" r="7" fill="#7aab4e" opacity=".5"/><circle cx="29" cy="27" r="9" fill="#639338" opacity=".45"/><circle cx="31" cy="6" r="4" fill="#82b356" opacity=".5"/></pattern>
      <filter id="sh" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="5" stdDeviation="4" flood-opacity=".28"/></filter></defs>
      <rect width="${W}" height="${H}" fill="url(#grass)"/>
      <path d="M-20,60 C200,30 380,90 600,50 S900,30 1020,70 L1020,120 C860,90 700,130 520,100 S200,70 -20,108Z" fill="#4f9bd9" opacity=".9"/>
      <ellipse cx="70" cy="470" rx="90" ry="52" fill="#4f9bd9" opacity=".9"/>`;
    // árvores (determinísticas, longe da estrada e das estações)
    let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    const trees = el("g"); const spots = Object.values(SPOT).map(px);
    for (let i = 0, k = 0; k < 70 && i < 900; i++) {
      const x = 20 + rnd() * 960, y = 20 + rnd() * 560; if (y < 130 && y > 30) continue; if (x < 170 && y > 410 && y < 530) continue;
      if (spots.some(([a, b]) => (a - x) ** 2 + (b - y) ** 2 < 120 ** 2)) continue;
      if (ROAD.some(([a, b]) => (a - x) ** 2 + (b - y) ** 2 < 70 ** 2)) continue;
      const r = 9 + rnd() * 9; trees.appendChild(el("g", { transform: `translate(${x},${y})` }, `<ellipse cx="3" cy="${r * 0.9}" rx="${r}" ry="${r * 0.4}" fill="#000" opacity=".15"/><circle r="${r}" fill="${["#3f7d3a", "#4c8f43", "#2f6a35"][k % 3]}"/><circle cx="${-r * 0.25}" cy="${-r * 0.3}" r="${r * 0.55}" fill="#fff" opacity=".12"/>`)); k++;
    }
    svg.appendChild(trees);

    // estrada em circuito fechado
    const d = closedPath(ROAD);
    svg.appendChild(el("path", { d, fill: "none", stroke: "#c9cdd2", "stroke-width": 46, "stroke-linejoin": "round" }));
    const road = el("path", { d, fill: "none", stroke: "#34393f", "stroke-width": 40 }); svg.appendChild(road);
    svg.appendChild(el("path", { d, fill: "none", stroke: "#f4f1e4", "stroke-width": 2.4, "stroke-dasharray": "14 12" }));
    const L = road.getTotalLength();
    const near = (x, y) => { let b = 1e12, s = 0; for (let k = 0; k < 600; k++) { const p = road.getPointAtLength((k / 600) * L), dd = (p.x - x) ** 2 + (p.y - y) ** 2; if (dd < b) { b = dd; s = (k / 600) * L; } } return s; };

    // estações
    const stops = [], groups = [];
    stages.forEach((s, i) => {
      const [x, y] = px(SPOT[s.model]), sl = near(x, y), pt = road.getPointAtLength(sl);
      svg.appendChild(el("line", { x1: pt.x, y1: pt.y, x2: x, y2: y, stroke: "#34393f", "stroke-width": 26, "stroke-linecap": "round" }));
      const g = el("g", { class: "st", transform: `translate(${x},${y})`, tabindex: 0, role: "button", "aria-label": s.name });
      g.innerHTML = `<ellipse class="ring" cx="0" cy="12" rx="78" ry="52"/><rect x="-74" y="-30" width="148" height="86" rx="14" fill="#8d949c" opacity=".55"/><g filter="url(#sh)">${GLYPH[s.model]}</g>`;
      const txt = `${s.name}`, sub = `${s.metric} ${s.short || ""}`.trim(), w = Math.max(txt.length * 7.4, sub.length * 6) + 28;
      g.innerHTML += `<g class="lab" transform="translate(0,-84)"><rect x="${-w / 2}" y="-20" width="${w}" height="40" rx="12" fill="#fff" stroke="#f6851b" stroke-width="1.6" filter="url(#sh)"/><circle cx="${-w / 2}" cy="-20" r="11" fill="#f6851b" stroke="#fff" stroke-width="2"/><text x="${-w / 2}" y="-15.5" text-anchor="middle" font-size="12" font-weight="800" fill="#fff">${i + 1}</text><text y="-2" text-anchor="middle" font-size="13" font-weight="700" fill="#1d2125">${txt}</text><text y="13" text-anchor="middle" font-size="10.5" font-weight="600" fill="#e2761b">${sub}</text></g>`;
      if (s.cost) { const nn = Math.max(3, Math.round(s.cost * 16)); let coins = ""; for (let c = 0; c < nn; c++) coins += `<ellipse cx="0" cy="${-c * 4}" rx="15" ry="6" fill="#e9b423" stroke="#b98a10" stroke-width="1"/>`;
        const side = x > CX ? -1 : 1; g.innerHTML += `<g transform="translate(${side * 86},40)">${coins}<g transform="translate(0,${-nn * 4 - 16})"><rect x="-38" y="-12" width="76" height="22" rx="8" fill="#fff" stroke="#e9b423"/><text y="3" text-anchor="middle" font-size="10.5" font-weight="700" fill="#1d2125">${s.costLabel}</text></g></g>`; }
      g.addEventListener("click", () => select(i)); g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(i); } });
      g.addEventListener("pointermove", (e) => { const b = host.getBoundingClientRect(); tipEl.innerHTML = `<b>${s.name}</b><br>${s.metric} ${s.short || ""}<br><small>Clique para ver os detalhes</small>`; tipEl.style.left = e.clientX - b.left + 14 + "px"; tipEl.style.top = e.clientY - b.top + 14 + "px"; tipEl.style.opacity = 1; });
      g.addEventListener("pointerleave", () => (tipEl.style.opacity = 0));
      svg.appendChild(g); groups.push(g); stops.push(sl);
    });

    // caminhão: ordem da cadeia, parando em cada etapa
    const truck = el("g", { class: "truck" }, `<ellipse cx="0" cy="11" rx="26" ry="5" fill="#000" opacity=".2"/><rect x="-26" y="-9" width="34" height="18" rx="3" fill="#f5f6f8" stroke="#cfd4da"/><rect x="-26" y="-2" width="34" height="5" fill="#f6851b"/><rect x="9" y="-8" width="16" height="16" rx="3" fill="#f6851b"/><rect x="19" y="-6" width="5" height="12" rx="1" fill="#7fb6e8"/><circle cx="-16" cy="10" r="3.4" fill="#15171a"/><circle cx="2" cy="10" r="3.4" fill="#15171a"/><circle cx="17" cy="10" r="3.4" fill="#15171a"/>`);
    const crate = el("rect", { width: 12, height: 12, rx: 2, fill: "#c9a27a", stroke: "#8a6a4a", visibility: "hidden" });
    svg.appendChild(truck); svg.appendChild(crate); host.appendChild(svg);

    const WAIT = 3, VMAX = 70; const run = { s: stops[0], next: 1, wait: WAIT, at: 0, left: 0, last: 0 }; let sel = null, alive = true;
    function frame(ms) {
      if (!alive || !svg.isConnected) return; const t = ms / 1000, dt = Math.min(0.05, t - run.last); run.last = t;
      if (host.offsetParent !== null) {
        if (reduce) { run.s = stops[2]; run.wait = WAIT * 0.4; run.at = 2; }
        else if (run.wait > 0) { run.wait -= dt; if (run.wait <= 0) run.left = 0; }
        else { const target = stops[run.next], arc = (target - run.s + L) % L, v = VMAX * Math.min(1, Math.max(0.12, arc / 70)) * Math.min(1, 0.2 + run.left / 60), step = v * dt; run.left += step;
          if (arc <= step + 0.5) { run.s = target; run.at = run.next; run.next = (run.next + 1) % stops.length; run.wait = WAIT; } else run.s = (run.s + step) % L; }
        const p = road.getPointAtLength(run.s), q = road.getPointAtLength((run.s + 2) % L), a = Math.atan2(q.y - p.y, q.x - p.x), nx = -Math.sin(a) * 8, ny = Math.cos(a) * 8;
        truck.setAttribute("transform", `translate(${p.x + nx},${p.y + ny}) rotate(${(a * 180) / Math.PI})`);
        const stopped = run.wait > 0, wp = stopped ? 1 - run.wait / WAIT : 1;
        groups.forEach((g, i) => g.classList.toggle("active", stopped && run.at === i));
        if (stopped && wp < 0.6) { const sPt = groups[run.at].getAttribute("transform").match(/-?[\d.]+/g).map(Number), u = Math.min(1, wp / 0.55);
          crate.setAttribute("visibility", "visible"); crate.setAttribute("x", p.x + nx + (sPt[0] - p.x - nx) * u - 6); crate.setAttribute("y", p.y + ny + (sPt[1] - p.y - ny) * u - 6 - Math.sin(Math.PI * u) * 34); } else crate.setAttribute("visibility", "hidden");
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    function select(i) { sel = i; groups.forEach((g, k) => g.classList.toggle("sel", k === i)); onSelect && onSelect(i); }
    function reset() { sel = null; groups.forEach((g) => g.classList.remove("sel")); onSelect && onSelect(null); }
    return { select, reset, destroy: () => { alive = false; svg.remove(); } };
  }
  return { mount };
})();
