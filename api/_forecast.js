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
module.exports = { project, series, baseline, SCENARIOS, LAST_YEAR };
