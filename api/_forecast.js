// Projeção simples e transparente (cenários, não previsão estatística): o dataset tem só 20 meses,
// então usamos o ritmo médio dos últimos 6 meses como base e uma taxa de crescimento anual como hipótese.
const fs = require("fs");
const path = require("path");

let D; const data = () => (D ||= JSON.parse(fs.readFileSync(path.join(__dirname, "_data", "dashboard.json"), "utf-8")));
const SCENARIOS = { conservador: -0.05, estavel: 0, otimista: 0.15 };
const LAST_YEAR = 2018;

function baseline() {
  const d = data(), m = d.receita_mensal, k = d.kpis[0];
  const last = m.slice(-6), mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
  const rev = mean(last.map((x) => x.receita));
  const inYear = m.filter((x) => x.mes.startsWith(String(LAST_YEAR)));
  const pago = d.pagamentos.reduce((s, x) => s + x.valor, 0);
  const frete = d.q4_frete_medio_uf.reduce((s, x) => s + x.frete_medio * x.itens, 0);
  return { monthly: rev, ticket: k.ticket_medio, receitaTotal: k.receita, freteRatio: frete / k.receita, pagoRatio: pago / k.receita,
    actualYtd: inYear.reduce((s, x) => s + x.receita, 0), monthsYtd: inYear.length, lastMonth: m.at(-1).mes, firstMonth: m[0].mes };
}

function annualRevenue(year, g, b = baseline()) {
  if (year < 2017) return null;
  if (year === 2017) return data().receita_mensal.filter((x) => x.mes.startsWith("2017")).reduce((s, x) => s + x.receita, 0);
  if (year === LAST_YEAR) return b.actualYtd + (12 - b.monthsYtd) * b.monthly;
  return 12 * b.monthly * Math.pow(1 + g, year - LAST_YEAR);
}

function project(year, g) {
  const b = baseline(), receita = annualRevenue(year, g, b);
  return { year, growth: g, receita, pedidos: receita / b.ticket, frete: receita * b.freteRatio, pago: receita * b.pagoRatio, base: b };
}

function series(fromYear, toYear, g) {
  return Array.from({ length: toYear - fromYear + 1 }, (_, i) => project(fromYear + i, g));
}
// Regressão linear (mínimos quadrados) sobre os últimos 12 meses, com intervalo de predição de 95%.
// É um modelo estatístico simples: serve para os próximos 12 meses e tem margem de erro grande.
const T975 = { 8: 2.306, 9: 2.262, 10: 2.228, 11: 2.201, 12: 2.179 };
function nextMonth(ym, i) { const [y, m] = ym.split("-").map(Number), d = new Date(Date.UTC(y, m - 1 + i, 1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`; }
function regression(window = 12, ahead = 12) {
  const m = data().receita_mensal.slice(-window), n = m.length, xs = m.map((_, i) => i), ys = m.map((r) => r.receita);
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  const sxx = xs.reduce((a, x) => a + (x - mx) ** 2, 0), sxy = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0);
  const slope = sxy / sxx, intercept = my - slope * mx;
  const fit = xs.map((x) => intercept + slope * x), sse = ys.reduce((a, y, i) => a + (y - fit[i]) ** 2, 0), sst = ys.reduce((a, y) => a + (y - my) ** 2, 0);
  const se = Math.sqrt(sse / (n - 2)), t = T975[n - 2] || 2.2;
  const points = Array.from({ length: ahead }, (_, k) => { const x = n + k, yhat = intercept + slope * x, w = t * se * Math.sqrt(1 + 1 / n + (x - mx) ** 2 / sxx);
    return { mes: nextMonth(m.at(-1).mes, k + 1), yhat: Math.max(0, yhat), lo: Math.max(0, yhat - w), hi: yhat + w }; });
  return { window: n, from: m[0].mes, to: m.at(-1).mes, slope, intercept, r2: 1 - sse / sst, se, points,
    total12: points.reduce((a, p) => a + p.yhat, 0), lo12: points.reduce((a, p) => a + p.lo, 0), hi12: points.reduce((a, p) => a + p.hi, 0) };
}
const brlf = (v) => v >= 1e6 ? `R$ ${(v / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi` : `R$ ${Math.round(v).toLocaleString("pt-BR")}`;
const intf = (v) => Math.round(v).toLocaleString("pt-BR");
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const lbl = (ym) => `${MESES[+ym.slice(5) - 1]}/${ym.slice(0, 4)}`;

// Detecta pedidos de projeção na pergunta e devolve trechos (já com avisos de incerteza).
function forecastChunks(q) {
  const s = q.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const ask = /proje[cç]|prev(er|isao|eja)|estim|futur|daqui a|proximo|crescer|crescimento|cenario|tendencia/.test(s) || /\b20(19|[2-3]\d)\b/.test(s);
  if (!ask || !/(receita|gast|faturamento|frete|pedido|venda|pago|custo|lucro|cresc|cenario|tendencia|projec|previs)/.test(s)) return [];
  const out = [], yr = (s.match(/\b(20(?:19|[2-3]\d))\b/) || [])[1];
  const wantsMonths = /(proximos? (12 )?mes|proximo ano|12 meses|ano que vem|mes que vem)/.test(s);
  if (wantsMonths || !yr) {
    const r = regression();
    out.push({ id: "projecao-12m", score: 99, text: `Projeção estatística (regressão linear nos últimos 12 meses, ${lbl(r.from)} a ${lbl(r.to)}): para os próximos 12 meses (${lbl(r.points[0].mes)} a ${lbl(r.points.at(-1).mes)}) a receita estimada é ${brlf(r.total12)}, com faixa de 95% de ${brlf(r.lo12)} a ${brlf(r.hi12)}. A tendência é de ${r.slope >= 0 ? "alta" : "queda"} de cerca de ${brlf(Math.abs(r.slope))} por mês, mas o ajuste é fraco (R² ${r.r2.toFixed(2).replace(".", ",")}): a margem de erro é grande.` });
  }
  if (yr || !wantsMonths) {
    const y = +(yr || 2027);
    const L = Object.entries(SCENARIOS).map(([k, g]) => { const p = project(y, g); return `${k === "estavel" ? "estável" : k} (${g >= 0 ? "+" : ""}${Math.round(g * 100)}% ao ano): receita ${brlf(p.receita)}, ${intf(p.pedidos)} pedidos, frete ${brlf(p.frete)}, total pago pelos clientes ${brlf(p.pago)}`; });
    out.push({ id: `cenarios-${y}`, score: 98, text: `Cenários para ${y}, partindo do ritmo médio mensal dos últimos 6 meses (${brlf(baseline().monthly)} por mês): ${L.join("; ")}. São hipóteses de crescimento, não previsões: o histórico tem só 20 meses e a incerteza aumenta muito com o horizonte.` });
  }
  if (/(gast|custo|lucro|despesa|margem)/.test(s)) out.push({ id: "aviso-custos", score: 97, text: "O dataset não tem custos nem despesas da empresa, só receita, frete e valores pagos pelos clientes. Por isso não é possível projetar gastos ou lucro da operação; as projeções cobrem receita, pedidos, frete e total pago." });
  return out;
}
module.exports = { forecastChunks, regression, project, series, baseline, SCENARIOS, LAST_YEAR };
