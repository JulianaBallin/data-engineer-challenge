// Servidor local que imita o Vercel (public/ estático + api/*). Uso: node scripts/dev-server.js
const http = require("http"), fs = require("fs"), path = require("path");
process.env.NODE_ENV = "development";
const root = path.join(__dirname, "..");
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json" };

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname.startsWith("/api/")) {
    const name = url.pathname.slice(5);
    const file = path.join(root, "api", name + ".js");
    if (name.startsWith("_") || !fs.existsSync(file)) { res.statusCode = 404; return res.end("{}"); }
    let body = ""; for await (const c of req) body += c;
    try { req.body = body ? JSON.parse(body) : {}; } catch { req.body = {}; }
    res.status = (c) => { res.statusCode = c; return res; };
    res.json = (o) => { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(o)); };
    res.send = (s) => res.end(s);
    return require(file)(req, res);
  }
  let p = path.join(root, "public", url.pathname === "/" ? "index.html" : url.pathname);
  if (!path.extname(p) && fs.existsSync(p + ".html")) p += ".html"; // imita cleanUrls do Vercel
  if (!p.startsWith(path.join(root, "public")) || !fs.existsSync(p)) { res.statusCode = 404; return res.end("not found"); }
  res.setHeader("Content-Type", types[path.extname(p)] || "application/octet-stream");
  res.end(fs.readFileSync(p));
}).listen(3000, () => console.log("http://localhost:3000"));
