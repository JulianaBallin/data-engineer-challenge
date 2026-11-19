// Gera hash scrypt e segredo de sessão. Uso: node scripts/make-credentials.js "<senha>"
// Imprime apenas o hash e o segredo (nunca a senha) para serem cadastrados como variáveis de ambiente.
const crypto = require("crypto");
const password = process.argv[2];
if (!password) { console.error("Informe a senha como argumento."); process.exit(1); }
const salt = crypto.randomBytes(16).toString("hex");
console.log("AUTH_PASS_HASH=" + salt + ":" + crypto.scryptSync(password, salt, 64).toString("hex"));
console.log("SESSION_SECRET=" + crypto.randomBytes(32).toString("hex"));
