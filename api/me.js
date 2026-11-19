const { readSession } = require("./_auth");

module.exports = (req, res) => {
  const s = readSession(req);
  if (!s) return res.status(401).json({ error: "Não autenticado" });
  res.status(200).json({ user: s.u });
};
