const $ = (id) => document.getElementById(id);
const brl = (v, d = 0) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: d, minimumFractionDigits: d });
const num = (v, d = 0) => Number(v).toLocaleString("pt-BR", { maximumFractionDigits: d, minimumFractionDigits: d });
const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const charts = {}; let D, scene3d;

function toast(msg) { const t = $("toast"); t.textContent = msg; t.classList.add("show"); setTimeout(() => t.classList.remove("show"), 2200); }

function countUp(el, to, fmt, ms = 1200) {
  const t0 = performance.now();
  (function tick(t) { const p = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - p, 3); el.textContent = fmt(to * e); if (p < 1) requestAnimationFrame(tick); })(t0);
}

function insight(id, lines) { $(id).innerHTML = "<b>Conclusão de negócio</b><ul>" + lines.map((l) => `<li>${l}</li>`).join("") + "</ul>"; }

function chart(id, cfg) {
  charts[id]?.destroy();
  Chart.defaults.color = css("--muted"); Chart.defaults.font.family = "inherit";
  const scales = cfg.type === "doughnut" ? {} : { x: { grid: { display: false }, ...(cfg.options?.scales?.x || {}) }, y: { grid: { color: css("--border") }, ...(cfg.options?.scales?.y || {}) } };
  charts[id] = new Chart($(id), { ...cfg, options: { ...cfg.options, responsive: true, maintainAspectRatio: false, animation: { duration: 900 }, plugins: { legend: { display: cfg.type === "doughnut" }, ...(cfg.options?.plugins || {}) }, scales } });
  return charts[id];
}

function render() {
  const O = css("--primary"), G = css("--good"), R = css("--bad"), BLUE = "#4b7bec";
  const k = D.kpis[0];
  const tiles = [["Pedidos", num(k.pedidos)], ["Clientes únicos", num(k.clientes)], ["Ticket médio", brl(k.ticket_medio, 2)],
    ["Entregas atrasadas", num(k.pct_atraso, 1) + "%"], ["Nota média", num(k.nota_media, 2) + " / 5"], ["Prazo médio", num(k.prazo_medio, 1) + " dias"]];
  $("kpis").innerHTML = tiles.map(([a, b]) => `<div class="card kpi"><div class="k">${a}</div><div class="v mono">${b}</div></div>`).join("");

  const m = D.receita_mensal;
  chart("c-mensal", { type: "line", data: { labels: m.map((r) => r.mes), datasets: [{ data: m.map((r) => r.receita), borderColor: O, backgroundColor: O + "33", fill: true, tension: .35, pointRadius: 3 }] },
    options: { plugins: { tooltip: { callbacks: { label: (c) => brl(c.parsed.y) } } }, scales: { y: { ticks: { callback: (v) => "R$ " + v / 1000 + " mil" } } } } });

  const t = D.q1_top10_categorias_receita, share = D.categorias_share, total = D.kpis[0].receita;
  chart("c-top10", { type: "bar", data: { labels: t.map((r) => r.categoria), datasets: [{ data: t.map((r) => r.receita), backgroundColor: O, borderRadius: 6 }] },
    options: { indexAxis: "y", plugins: { tooltip: { callbacks: { label: (c) => brl(c.parsed.x) } } } } });
  const top3 = t.slice(0, 3).reduce((s, r) => s + r.receita, 0);
  insight("i-vendas", [`A categoria líder é <b style="display:inline">${t[0].categoria}</b>, com ${brl(t[0].receita)}.`, `As 3 maiores somam ${num(100 * top3 / total, 1)}% da receita total.`, "A receita é concentrada em poucas categorias: estoque e marketing devem priorizá-las."]);
  const drawShare = () => { const q = $("search").value.toLowerCase(); $("t-share").innerHTML = share.filter((r) => r.categoria.toLowerCase().includes(q)).map((r) => `<tr><td>${r.categoria}</td><td class="num mono">${brl(r.receita)}</td><td class="num mono">${num(r.pct, 2)}%</td></tr>`).join("") || `<tr><td colspan="3">Nada encontrado</td></tr>`; };
  $("search").oninput = drawShare; drawShare();

  const a = D.q2_pct_atraso, glob = a.find((r) => r.uf === null), ufs = a.filter((r) => r.uf).sort((x, y) => y.pct_atraso - x.pct_atraso);
  const bar = chart("c-atraso", { type: "bar", data: { labels: ufs.map((r) => r.uf), datasets: [{ data: ufs.map((r) => r.pct_atraso), backgroundColor: ufs.map((r) => r.pct_atraso > glob.pct_atraso ? R : G), borderRadius: 4 }] },
    options: { plugins: { tooltip: { callbacks: { label: (c) => num(c.parsed.y, 2) + "% atrasados" } } }, onClick: (_, els) => els[0] && selectUF(ufs[els[0].index].uf) } });
  insight("i-log", [`${num(glob.pct_atraso, 1)}% dos ${num(glob.pedidos_entregues)} pedidos entregues chegaram após a data estimada.`, `Maior atraso: <b style="display:inline">${ufs[0].uf}</b> (${num(ufs[0].pct_atraso, 1)}%). Menor: <b style="display:inline">${ufs.at(-1).uf}</b> (${num(ufs.at(-1).pct_atraso, 1)}%).`, "Barras vermelhas estão acima da média geral e pedem revisão de transportadoras ou prazos."]);
  $("uf").innerHTML = ufs.map((r) => `<option>${r.uf}</option>`).join("");
  const selectUF = (uf) => { $("uf").value = uf; const r = ufs.find((x) => x.uf === uf), p = D.prazo_uf.find((x) => x.uf === uf);
    $("uf-stats").innerHTML = `<div><span>% com atraso</span><b>${num(r.pct_atraso, 1)}%</b></div><div><span>Entregues</span><b>${num(r.pedidos_entregues)}</b></div><div><span>Prazo médio</span><b>${p ? num(p.dias, 1) + " d" : "n/d"}</b></div>`; };
  $("uf").onchange = (e) => selectUF(e.target.value); selectUF(ufs[0].uf);
  const pz = D.prazo_uf;
  chart("c-prazo", { type: "bar", data: { labels: pz.map((r) => r.uf), datasets: [{ data: pz.map((r) => r.dias), backgroundColor: BLUE, borderRadius: 4 }] } });

  const n = D.q3_nota_atraso;
  chart("c-nota-atraso", { type: "bar", data: { labels: n.map((r) => r.situacao), datasets: [{ data: n.map((r) => r.nota_media), backgroundColor: n.map((r) => r.situacao === "No prazo" ? G : R), borderRadius: 8 }] }, options: { scales: { y: { min: 0, max: 5 } } } });
  const nm = Object.fromEntries(n.map((r) => [r.situacao, r.nota_media]));
  insight("i-sat", [`Pedidos com atraso têm nota média ${num(nm["Com atraso"], 2)} contra ${num(nm["No prazo"], 2)} dos entregues no prazo.`, "O atraso está associado a pior satisfação (correlação, não causalidade).", "Reduzir atrasos é uma alavanca direta para melhorar a avaliação."]);
  chart("c-notas", { type: "bar", data: { labels: D.notas.map((r) => r.nota + " ★"), datasets: [{ data: D.notas.map((r) => r.pedidos), backgroundColor: O, borderRadius: 6 }] } });

  const f = D.q4_frete_medio_uf;
  chart("c-frete", { type: "bar", data: { labels: f.map((r) => r.uf), datasets: [{ data: f.map((r) => r.frete_medio), backgroundColor: O, borderRadius: 4 }] }, options: { plugins: { tooltip: { callbacks: { label: (c) => brl(c.parsed.y, 2) } } } } });
  insight("i-fin", [`Frete médio mais alto em <b style="display:inline">${f[0].uf}</b> (${brl(f[0].frete_medio, 2)}) e mais baixo em <b style="display:inline">${f.at(-1).uf}</b> (${brl(f.at(-1).frete_medio, 2)}).`, "A diferença regional pode afetar conversão e competitividade.", "Frete é valor cobrado por item, não custo logístico real."]);

  const r = D.q5_clientes_recorrentes, rm = Object.fromEntries(r.map((x) => [x.perfil, x.pct]));
  chart("c-rec", { type: "doughnut", data: { labels: r.map((x) => x.perfil), datasets: [{ data: r.map((x) => x.clientes), backgroundColor: [BLUE, O], borderColor: css("--surface") }] }, options: { cutout: "62%" } });
  insight("i-cli", [`Apenas ${num(rm["Mais de uma compra"], 1)}% dos clientes compraram mais de uma vez.`, "A base é dominada por compradores de uma única compra: pouca retenção.", "Campanhas de recompra e pós-venda têm grande espaço de crescimento."]);
  const pg = D.pagamentos;
  chart("c-pag", { type: "doughnut", data: { labels: pg.map((x) => x.tipo), datasets: [{ data: pg.map((x) => x.pagamentos), backgroundColor: [O, BLUE, G, "#c3a2ff", "#8b929a"], borderColor: css("--surface") }] }, options: { cutout: "55%" } });
}

function show3d() {
  if (scene3d) return;
  scene3d = window.OI_scene.bars($("bars3d"), $("tip3d"), D.receita_mensal, (v) => brl(v));
  $("auto3d").onclick = () => { const on = scene3d.toggleAuto(); $("auto3d").textContent = on ? "Pausar rotação" : "Retomar rotação"; };
  $("replay3d").onclick = () => scene3d.replay();
}

$("tabs").addEventListener("click", (e) => {
  const b = e.target.closest(".action"); if (!b) return;
  document.querySelectorAll(".action, .panel").forEach((x) => x.classList.remove("active"));
  b.classList.add("active"); $(b.dataset.tab).classList.add("active");
  if (b.dataset.tab === "d3") show3d();
  Object.values(charts).forEach((c) => c.resize());
});

$("theme").onclick = () => {
  const cur = document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  const next = cur === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next; try { localStorage.setItem("oi-theme", next); } catch {}
  if (D) render();
};
$("logout").onclick = async () => { await fetch("/api/logout", { method: "POST" }); location.href = "/"; };
$("account").onclick = () => { navigator.clipboard?.writeText($("who").textContent); toast("Sessão copiada"); };

(async () => {
  const me = await fetch("/api/me");
  if (!me.ok) return (location.href = "/");
  $("who").textContent = (await me.json()).user;
  const r = await fetch("/api/data");
  if (!r.ok) return (location.href = "/");
  D = await r.json(); render();
  countUp($("balance"), D.kpis[0].receita, (v) => brl(v, 2));
  $("balance-sub").textContent = `${num(D.kpis[0].pedidos)} pedidos analisados`;
})();
