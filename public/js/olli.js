// Olli: widget de chat. Só conversa com /api/chat, que responde com base nos dados do histórico.
(() => {
  const ROBOT = `<svg viewBox="0 0 64 64" aria-hidden="true"><line x1="32" y1="6" x2="32" y2="14" stroke="#fff" stroke-width="3" stroke-linecap="round"/><circle cx="32" cy="6" r="3.5" fill="#ffe08a"/><rect x="11" y="14" width="42" height="34" rx="12" fill="#fff"/><rect x="16" y="20" width="32" height="22" rx="8" fill="#24272a"/><circle cx="25" cy="31" r="4.2" fill="#6fe3ff"><animate attributeName="ry" values="4.2;0.6;4.2" dur="4s" repeatCount="indefinite" keyTimes="0;.96;1"/></circle><circle cx="39" cy="31" r="4.2" fill="#6fe3ff"><animate attributeName="ry" values="4.2;0.6;4.2" dur="4s" repeatCount="indefinite" keyTimes="0;.96;1"/></circle><path d="M27 37q5 4 10 0" stroke="#6fe3ff" stroke-width="2" fill="none" stroke-linecap="round"/><rect x="6" y="26" width="5" height="12" rx="2.5" fill="#fff"/><rect x="53" y="26" width="5" height="12" rx="2.5" fill="#fff"/><rect x="22" y="50" width="20" height="9" rx="4" fill="#fff"/><circle cx="32" cy="54.5" r="2" fill="#f6851b"/></svg>`;
  document.querySelectorAll("[data-olli]").forEach((el) => (el.style.display = "contents", el.innerHTML = ROBOT));
  const $ = (id) => document.getElementById(id);
  const panel = $("olliPanel"), msgs = $("olliMsgs"), input = $("olliInput");
  const history = []; let busy = false, started = false;
  const SUG = ["Quais as 10 categorias com maior receita?", "Qual estado tem mais atraso?", "Atraso afeta a nota?", "Qual o meio de pagamento mais usado?", "Quanto os clientes pagam de frete?"];

  function add(text, who, meta) {
    const d = document.createElement("div"); d.className = "msg " + who; d.textContent = text;
    if (meta) { const s = document.createElement("small"); s.textContent = meta; d.appendChild(s); }
    msgs.appendChild(d); msgs.scrollTop = msgs.scrollHeight; return d;
  }
  function open() {
    panel.classList.add("open"); input.focus();
    if (!started) { started = true;
      add("Oi! Eu sou a Olli 🤖 Respondo só com base no histórico da Olist (2016 a 2018): vendas, entregas, notas, pagamentos e clientes. Se eu não tiver o dado, eu aviso.", "bot");
      $("olliChips").innerHTML = SUG.map((s) => `<button type="button">${s}</button>`).join(""); }
  }
  $("olliFab").onclick = () => (panel.classList.contains("open") ? panel.classList.remove("open") : open());
  $("olliClose").onclick = () => panel.classList.remove("open");
  $("olliChips").onclick = (e) => { const b = e.target.closest("button"); if (b) send(b.textContent); };
  $("olliForm").onsubmit = (e) => { e.preventDefault(); send(input.value); };

  async function send(text) {
    text = text.trim(); if (!text || busy) return;
    busy = true; input.value = ""; $("olliChips").innerHTML = "";
    add(text, "me");
    const wait = add("", "bot"); wait.innerHTML = '<span class="typing"><i></i><i></i><i></i></span>';
    try {
      const r = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: text, history }) });
      if (r.status === 401) return (location.href = "/");
      const j = await r.json();
      wait.textContent = j.answer || "Não consegui responder agora.";
      if (j.sources && j.sources.length) { const s = document.createElement("small"); s.textContent = "Baseado em " + j.sources.length + " trecho(s) dos dados" + (j.mode === "llm" ? "" : ""); wait.appendChild(s); }
      history.push({ role: "user", content: text }, { role: "assistant", content: j.answer || "" });
    } catch { wait.textContent = "Tive um problema de conexão. Tente de novo."; }
    busy = false; msgs.scrollTop = msgs.scrollHeight;
  }
})();
