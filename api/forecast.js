const { readSession } = require("./_auth");
const { project, series, baseline, SCENARIOS } = require("./_forecast");

module.exports = (req, res) => {
  if (!readSession(req)) return res.status(401).json({ error: "Não autenticado" });
  const q = req.query || Object.fromEntries(new URL(req.url, "http://x").searchParams);
  const year = Math.min(2040, Math.max(2018, parseInt(q.year, 10) || 2027));
  const g = Math.min(1, Math.max(-0.5, (parseFloat(q.growth) || 0) / 100));
  res.setHeader("Cache-Control", "private, no-store");
  const strip = (p) => ({ year: p.year, receita: p.receita, pedidos: p.pedidos, frete: p.frete, pago: p.pago });
  const b = baseline();
  res.status(200).json({
    year, growth: g,
    target: strip(project(year, g)),
    scenarios: Object.fromEntries(Object.entries(SCENARIOS).map(([k, v]) => [k, { growth: v, series: series(2017, year, v).map(strip) }])),
    selected: series(2017, year, g).map(strip),
    basis: { monthly: b.monthly, ticket: b.ticket, freteRatio: b.freteRatio, pagoRatio: b.pagoRatio, firstMonth: b.firstMonth, lastMonth: b.lastMonth },
  });
};
