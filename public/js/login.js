const $ = (id) => document.getElementById(id);
window.OI_scene.hero($("hero3d"));

fetch("/api/me").then((r) => r.ok && (location.href = "/app")).catch(() => {});

$("toggle").onclick = () => {
  const show = $("pass").type === "password";
  $("pass").type = show ? "text" : "password";
  $("toggle").textContent = show ? "Ocultar" : "Mostrar";
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
