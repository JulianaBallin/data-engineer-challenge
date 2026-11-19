const { verifyPassword, createToken, cookieHeader, TTL_SECONDS, safeEqual } = require("./_auth");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido" });
  const { user, password } = req.body || {};
  const expected = process.env.AUTH_USER || "";
  const okUser = typeof user === "string" && expected && safeEqual(user, expected);
  const okPass = typeof password === "string" && verifyPassword(password);
  if (!(okUser && okPass)) {
    await new Promise((r) => setTimeout(r, 600)); // atrasa tentativas de força bruta
    return res.status(401).json({ error: "Usuário ou senha inválidos" });
  }
  res.setHeader("Set-Cookie", cookieHeader(createToken(user), TTL_SECONDS));
  return res.status(200).json({ ok: true, user });
};
