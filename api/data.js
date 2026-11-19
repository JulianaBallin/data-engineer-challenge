const fs = require("fs");
const path = require("path");
const { readSession } = require("./_auth");

module.exports = (req, res) => {
  if (!readSession(req)) return res.status(401).json({ error: "Não autenticado" });
  const file = path.join(__dirname, "_data", "dashboard.json");
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.status(200).send(fs.readFileSync(file, "utf-8"));
};
