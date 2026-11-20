const $ = (id) => document.getElementById(id);
const brl = (v, d = 0) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: d, minimumFractionDigits: d });
const num = (v, d = 0) => Number(v).toLocaleString("pt-BR", { maximumFractionDigits: d, minimumFractionDigits: d });
const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const charts = {}; let D, chain3d;

function toast(msg) { const t = $("toast"); t.textContent = msg; t.classList.add("show"); setTimeout(() => t.classList.remove("show"), 2200); }

function countUp(el, to, fmt, ms = 1200) {
  const t0 = performance.now();
  (function tick(t) { const p = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - p, 3); el.textContent = fmt(to * e); if (p < 1) requestAnimationFrame(tick); })(t0);
}

function insight(id, lines) { $(id).innerHTML = "<b>Conclusão de negócio</b><ul>" + lines.map((l) => `<li>${l}</li>`).join("") + "</ul>"; }

function chart(id, cfg) {
  charts[id]?.destroy();
  Chart.defaults.color = css("--muted"); Chart.defaults.font.family = "inherit";
  const scales = cfg.type === "doughnut" ? {} : { x: { grid: { display: false }, ...(cfg.options?.scales?.x || {}) }, y: { grid: { color: css("--grid") || "rgba(128,128,128,.12)", drawBorder: false }, border: { display: false }, ...(cfg.options?.scales?.y || {}) } };
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

function showSupply() {
  if (chain3d) return;
  const k = D.kpis[0], pago = D.pagamentos.reduce((a, x) => a + x.valor, 0), pq = D.pagamentos.reduce((a, x) => a + x.pagamentos, 0);
  const frete = D.q4_frete_medio_uf.reduce((a, x) => a + x.frete_medio * x.itens, 0), fr = D.q4_frete_medio_uf, pz = [...D.prazo_uf].sort((a, b) => b.dias - a.dias);
  const nt = D.notas.reduce((a, x) => a + x.pedidos, 0), n5 = D.notas.find((x) => x.nota === 5).pedidos;
  const [ca, np] = [D.q3_nota_atraso.find((x) => x.situacao === "Com atraso"), D.q3_nota_atraso.find((x) => x.situacao === "No prazo")];
  const PAGN = { credit_card: "Cartão de crédito", boleto: "Boleto", voucher: "Voucher", debit_card: "Cartão de débito" };
  const S = [
    { model: "vendedor", name: "Vendedores", kicker: "Etapa 1", metric: "3.095", short: "vendedores", cost: k.receita / pago, costLabel: brl(k.receita), share: k.receita / pago,
      about: "Lojistas que anunciam no marketplace e despacham os produtos. Aqui nasce a receita de itens da cadeia.",
      facts: [["Vendedores ativos", "3.095"], ["Itens vendidos", "112.650"], ["Receita de itens", brl(k.receita)], ["Receita por vendedor", brl(k.receita / 3095)]] },
    { model: "marketplace", name: "Marketplace", kicker: "Etapa 2", metric: num(k.pedidos), short: "pedidos", 
      about: "Onde o cliente escolhe, compra e acompanha o pedido. Concentra o catálogo e a vitrine das categorias.",
      facts: [["Pedidos", num(k.pedidos)], ["Ticket médio", brl(k.ticket_medio, 2)], ["Clientes únicos", num(k.clientes)], ["Categoria líder", `${D.q1_top10_categorias_receita[0].categoria} (${num(D.categorias_share[0].pct, 1)}%)`]] },
    { model: "pagamento", name: "Pagamento", kicker: "Etapa 3", metric: brl(pago / 1e6, 1).replace(",0", "") + " mi", short: "pagos pelos clientes", cost: 1, costLabel: brl(pago), share: 1,
      about: "Cobrança do pedido: itens mais frete. O cartão de crédito domina, seguido pelo boleto.",
      facts: [["Total pago", brl(pago)], ...D.pagamentos.slice(0, 3).map((x) => [PAGN[x.tipo] || x.tipo, `${num(x.pagamentos)} (${num((x.pagamentos / pq) * 100, 1)}%)`])] },
    { model: "distribuicao", name: "Distribuição e frete", kicker: "Etapa 4", metric: brl(frete / 1e6, 1).replace(",0", "") + " mi", short: "de frete (estimado)", cost: frete / pago, costLabel: brl(frete), share: frete / pago,
      about: "Centro de distribuição que separa, embala e despacha. O frete representa uma fatia relevante do total pago.",
      facts: [["Frete estimado", brl(frete)], ["Fatia do total pago", num((frete / pago) * 100, 1) + "%"], ["Frete mais caro", `${fr[0].uf}: ${brl(fr[0].frete_medio, 2)}`], ["Frete mais barato", `${fr.at(-1).uf}: ${brl(fr.at(-1).frete_medio, 2)}`]] },
    { model: "cliente", name: "Entrega ao cliente", kicker: "Etapa 5", metric: num(k.prazo_medio, 1) + " dias", short: "prazo médio de entrega",
      about: "O último trecho: do despacho até a porta do cliente. É onde os atrasos acontecem e a satisfação é decidida.",
      facts: [["Prazo médio", num(k.prazo_medio, 1) + " dias"], ["Pedidos atrasados", num(k.pct_atraso, 2) + "%"], ["Entrega mais lenta", `${pz[0].uf}: ${num(pz[0].dias, 1)} dias`], ["Recompra", num(D.q5_clientes_recorrentes.find((x) => x.perfil.startsWith("Mais")).pct, 2) + "%"]] },
    { model: "avaliacao", name: "Avaliação", kicker: "Etapa 6", metric: num(k.nota_media, 2), short: "nota média (de 5)",
      about: "O cliente avalia a experiência. A nota cai quase 2 pontos quando o pedido chega atrasado.",
      facts: [["Nota média", num(k.nota_media, 2)], ["Notas 5 estrelas", num((n5 / nt) * 100, 1) + "%"], ["No prazo", num(np.nota_media, 2)], ["Com atraso", num(ca.nota_media, 2)]] },
  ];
  const info = $("stageInfo");
  const intro = () => { info.innerHTML = `<div class="kicker">Mapa da cadeia</div><h3>Do vendedor ao cliente</h3>${note ? `<p class="hint"><small>${note} Mostrando a versão 2D. GPU detectada: ${gpu()}.</small></p>` : ""}<p class="hint">Clique em uma etapa do mapa para ver os números dela.<br><br>As <b>pilhas de moedas</b> mostram quanto dinheiro passa por cada ponto: receita de itens, total pago e frete.<br><br>Só existe o que os dados trazem: não há indústria, produção nem estoque.</p>`; };
  const detail = (i) => { const s = S[i]; info.innerHTML = `<div class="kicker">${s.kicker}</div><h3>${s.name}</h3><div class="big mono">${s.metric}</div><div class="hint">${s.short}</div><p class="about">${s.about}</p><dl>${s.facts.map(([a, b]) => `<div><dt>${a}</dt><dd class="mono">${b}</dd></div>`).join("")}</dl>${s.share ? `<p class="hint" style="margin-top:16px">Fatia do total pago: <b>${num(s.share * 100, 1)}%</b></p><div class="bar"><i style="width:${s.share * 100}%"></i></div>` : ""}`; };
  const stageEl = $("supply3d").parentElement; let map = null, mode = null, note = "", triedLight = false;
  const gpu = () => { try { const gl = document.createElement("canvas").getContext("webgl"); if (!gl) return "WebGL indisponível"; const e = gl.getExtension("WEBGL_debug_renderer_info"); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.VERSION); } catch { return "WebGL indisponível"; } };
  const hasGL = () => { try { const c = document.createElement("canvas"); return !!(c.getContext("webgl") || c.getContext("experimental-webgl")); } catch { return false; } };
  const freshCanvas = () => { const old = $("supply3d"), c = document.createElement("canvas"); c.id = "supply3d"; old.replaceWith(c); return c; };
  const handler = (i, err) => {
    if (i === -2 && !triedLight) { triedLight = true; console.warn("3D sem imagem: tentando o modo leve"); use3d(true); return; }
    if (i === -1 || i === -2) { note = i === -2 ? "O 3D não desenhou nada neste navegador." : "O 3D não pôde iniciar neste navegador."; console.warn(note, err); use2d(); intro(); }
    else if (i == null) intro(); else detail(i);
  };
  function use2d() {
    if (map && mode === "2d") return;
    $("supply3d").style.display = "none";
    map = window.OI_chain2d.mount(stageEl, $("tipSup"), S, handler); mode = "2d"; $("supMode").textContent = "Tentar o 3D"; $("supMode").style.display = "";
  }
  function use3d(light) {
    if (map && mode === "2d") map.destroy();
    const canvas = freshCanvas(); canvas.style.display = "";
    try { if (!hasGL()) throw new Error("WebGL indisponível"); map = chain3d = window.OI_chain.mount(canvas, $("tipSup"), S, handler, { light: !!light }); mode = "3d"; $("supMode").textContent = "Ver em 2D"; $("supMode").style.display = ""; }
    catch (e) { note = "O 3D não está disponível neste navegador (" + gpu() + ")."; console.warn(e); mode = null; use2d(); }
  }
  $("supMode").onclick = () => { note = ""; triedLight = false; if (mode === "3d") { $("supply3d").style.display = "none"; map = null; mode = null; use2d(); intro(); } else { map = null; mode = null; use3d(); intro(); } };
  use3d(); intro();
  $("supReset").onclick = () => map && map.reset();
}

async function showForecast(force) {
  const O = css("--primary"), BLUE = "#4b7bec", year = $("fy").value || 2027, g = $("fg").value;
  const r = await fetch(`/api/forecast?year=${year}&growth=${g}`); if (!r.ok) return (location.href = "/");
  const F = await r.json(), ml = F.ml, hist = D.receita_mensal;
  const labels = [...hist.map((x) => x.mes), ...ml.points.map((p) => p.mes)], pad = (n) => Array(n).fill(null);
  const fitStart = hist.length - ml.window, line = (v) => [...pad(hist.length), ...v];
  chart("c-ml", { type: "line", data: { labels, datasets: [
    { label: "Histórico", data: [...hist.map((x) => x.receita), ...pad(12)], borderColor: O, backgroundColor: O + "22", tension: .3, pointRadius: 3 },
    { label: "Limite inferior (95%)", data: line(ml.points.map((p) => p.lo)), borderColor: "transparent", pointRadius: 0, fill: false },
    { label: "Intervalo de 95%", data: line(ml.points.map((p) => p.hi)), borderColor: "transparent", backgroundColor: BLUE + "30", pointRadius: 0, fill: "-1" },
    { label: "Projeção (regressão)", data: [...pad(hist.length - 1), hist.at(-1).receita, ...ml.points.map((p) => p.yhat)], borderColor: BLUE, borderDash: [6, 5], tension: 0, pointRadius: 2 } ] },
    options: { plugins: { legend: { display: true, labels: { filter: (i) => i.text !== "Limite inferior (95%)" } }, tooltip: { callbacks: { label: (c) => c.parsed.y == null ? "" : `${c.dataset.label}: ${brl(c.parsed.y)}` } } }, scales: { y: { ticks: { callback: (v) => "R$ " + v / 1000 + " mil" } } } } });
  $("ml-stats").innerHTML = [["Tendência", `${ml.slope >= 0 ? "+" : ""}${brl(ml.slope)} por mês`], ["Ajuste (R²)", num(ml.r2, 2) + " (baixo: o modelo explica pouco)"], ["Total em 12 meses", brl(ml.total12)], ["Faixa de 95%", `${brl(ml.lo12)} a ${brl(ml.hi12)}`]].map(([a, b]) => `<div><span>${a}</span><b>${b}</b></div>`).join("");

  const T = F.target;
  $("f-cards").innerHTML = [[`Receita em ${T.year}`, brl(T.receita)], ["Pedidos estimados", num(T.pedidos)], ["Frete estimado", brl(T.frete)], ["Total pago pelos clientes", brl(T.pago)]].map(([a, b]) => `<div class="card kpi"><div class="k">${a}</div><div class="v mono" style="font-size:20px">${b}</div></div>`).join("");
  const yrs = F.selected.map((x) => String(x.year) + (x.year === 2017 ? " (real)" : x.year === 2018 ? " (real + estim.)" : ""));
  chart("c-scen", { type: "bar", data: { labels: yrs, datasets: [
    { label: `Seu cenário (${g}% ao ano)`, data: F.selected.map((x) => x.receita), backgroundColor: F.selected.map((x) => (x.year <= 2018 ? "#8b929a" : O)), borderRadius: 6 },
    { type: "line", label: "Conservador (-5%)", data: F.scenarios.conservador.series.map((x) => x.receita), borderColor: "#d73847", borderDash: [5, 4], pointRadius: 2 },
    { type: "line", label: "Otimista (+15%)", data: F.scenarios.otimista.series.map((x) => x.receita), borderColor: "#1c8c4b", borderDash: [5, 4], pointRadius: 2 } ] },
    options: { plugins: { legend: { display: true }, tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${brl(c.parsed.y)}` } } }, scales: { y: { ticks: { callback: (v) => "R$ " + v / 1e6 + " mi" } } } } });
}
let forecastReady = false;
function initForecast() {
  if (forecastReady) return; forecastReady = true;
  $("fy").innerHTML = Array.from({ length: 12 }, (_, i) => `<option value="${2019 + i}"${2019 + i === 2027 ? " selected" : ""}>${2019 + i}</option>`).join("");
  $("fy").onchange = () => showForecast(); $("fg").oninput = () => { $("fgv").textContent = $("fg").value + "%"; clearTimeout(initForecast.t); initForecast.t = setTimeout(showForecast, 150); };
  showForecast();
}

const NAMES = { forecast: "Projeção", geral: "Visão geral", vendas: "Vendas", logistica: "Logística", satisfacao: "Satisfação", financeiro: "Financeiro", clientes: "Clientes" };
let lastDash = "geral";
function goTab(tab) {
  if (tab === "dash") tab = lastDash;
  const supply = tab === "supply";
  document.querySelectorAll(".action, .panel").forEach((x) => x.classList.remove("active"));
  $(tab).classList.add("active");
  if (!supply) { lastDash = tab; const b = document.querySelector(`.action[data-tab="${tab}"]`); if (b) b.classList.add("active"); $("crumb").textContent = NAMES[tab]; }
  document.body.classList.toggle("view-supply", supply);
  document.querySelectorAll("#menu [data-go]").forEach((x) => x.classList.toggle("on", (x.dataset.go === "supply") === supply));
  if (tab === "forecast") initForecast(); if (supply) showSupply();
  Object.values(charts).forEach((c) => c.resize());
}
$("tabs").addEventListener("click", (e) => { const b = e.target.closest(".action"); if (b) goTab(b.dataset.tab); });
document.addEventListener("click", (e) => { const g = e.target.closest("[data-go]"); if (g) { e.preventDefault(); goTab(g.dataset.go); scrollTo({ top: 0, behavior: "smooth" }); } });

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
