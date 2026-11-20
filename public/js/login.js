const $ = (id) => document.getElementById(id);
// Com sessão ativa, mostra o login com um aviso (em vez de pular direto para o painel).
fetch("/api/me").then(async (r) => {
  if (!r.ok) return; const u = (await r.json()).user;
  $("sessionUser").textContent = u; $("sessionNote").hidden = false;
  $("otherAcc").onclick = async () => { await fetch("/api/logout", { method: "POST" }); $("sessionNote").hidden = true; $("user").focus(); };
}).catch(() => {});

const EYE = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>`;
const EYE_OFF = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 5.2A10.6 10.6 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1"/><path d="M6.6 6.7C3.9 8.4 2 12 2 12s3.6 7 10 7c1.6 0 3-.4 4.3-1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>`;
$("toggle").onclick = () => {
  const show = $("pass").type === "password";
  $("pass").type = show ? "text" : "password";
  $("toggle").innerHTML = show ? EYE_OFF : EYE;
  $("toggle").setAttribute("aria-label", show ? "Ocultar senha" : "Mostrar senha");
  $("toggle").title = show ? "Ocultar senha" : "Mostrar senha";
  $("pass").focus();
};

$("form").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("error").textContent = "";
  $("submit").disabled = true; $("submit").textContent = "Verificando...";
  try {
    const r = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user: $("user").value, password: $("pass").value }) });
    if (r.ok) { $("submit").textContent = "Conectado"; location.href = "/app"; return; }
    $("error").textContent = (await r.json()).error || "Falha no login";
  } catch { $("error").textContent = "Sem conexão com o servidor"; }
  const card = $("form"); card.classList.remove("shake"); void card.offsetWidth; card.classList.add("shake");
  $("submit").disabled = false; $("submit").textContent = "Entrar";
});

// A cena 3D de fundo é opcional: se o WebGL falhar, o login continua funcionando.
try { window.OI_scene.hero($("hero3d")); } catch (e) { console.warn("Cena 3D indisponível:", e); $("hero3d").remove(); }
