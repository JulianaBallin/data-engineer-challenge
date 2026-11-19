// Autenticação por cookie assinado (HMAC-SHA256). Segredos ficam em variáveis de ambiente:
// AUTH_USER, AUTH_PASS_HASH (formato "salt:hash" em hex, gerado com scrypt) e SESSION_SECRET.
const crypto = require("crypto");

const COOKIE = "oi_session";
const TTL_SECONDS = 60 * 60 * 8;

const b64 = (s) => Buffer.from(s).toString("base64url");
const sign = (payload) => crypto.createHmac("sha256", process.env.SESSION_SECRET || "").update(payload).digest("base64url");
const safeEqual = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

function verifyPassword(password) {
  const [salt, hash] = (process.env.AUTH_PASS_HASH || "").split(":");
  if (!salt || !hash) return false;
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return safeEqual(derived, hash);
}

function createToken(user) {
  const payload = b64(JSON.stringify({ u: user, exp: Math.floor(Date.now() / 1000) + TTL_SECONDS }));
  return `${payload}.${sign(payload)}`;
}

function readSession(req) {
  if (!process.env.SESSION_SECRET) return null;
  const cookie = (req.headers.cookie || "").split(/;\s*/).find((c) => c.startsWith(COOKIE + "="));
  if (!cookie) return null;
  const [payload, sig] = cookie.slice(COOKIE.length + 1).split(".");
  if (!payload || !sig || !safeEqual(sig, sign(payload))) return null;
  const data = JSON.parse(Buffer.from(payload, "base64url").toString());
  return data.exp > Date.now() / 1000 ? data : null;
}

function cookieHeader(value, maxAge) {
  const secure = process.env.NODE_ENV === "development" ? "" : "; Secure";
  return `${COOKIE}=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secure}`;
}

module.exports = { verifyPassword, createToken, readSession, cookieHeader, TTL_SECONDS, safeEqual };
