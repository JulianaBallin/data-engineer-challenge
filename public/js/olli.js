// Olli: widget de chat. Só conversa com /api/chat, que responde com base nos dados do histórico.
(() => {
  const ROBOT = `<svg viewBox="0 0 64 64" aria-hidden="true"><line x1="32" y1="6" x2="32" y2="14" stroke="#fff" stroke-width="3" stroke-linecap="round"/><circle cx="32" cy="6" r="3.5" fill="#ffe08a"/><rect x="11" y="14" width="42" height="34" rx="12" fill="#fff"/><rect x="16" y="20" width="32" height="22" rx="8" fill="#24272a"/><circle cx="25" cy="31" r="4.2" fill="#6fe3ff"><animate attributeName="ry" values="4.2;0.6;4.2" dur="4s" repeatCount="indefinite" keyTimes="0;.96;1"/></circle><circle cx="39" cy="31" r="4.2" fill="#6fe3ff"><animate attributeName="ry" values="4.2;0.6;4.2" dur="4s" repeatCount="indefinite" keyTimes="0;.96;1"/></circle><path d="M27 37q5 4 10 0" stroke="#6fe3ff" stroke-width="2" fill="none" stroke-linecap="round"/><rect x="6" y="26" width="5" height="12" rx="2.5" fill="#fff"/><rect x="53" y="26" width="5" height="12" rx="2.5" fill="#fff"/><rect x="22" y="50" width="20" height="9" rx="4" fill="#fff"/><circle cx="32" cy="54.5" r="2" fill="#f6851b"/></svg>`;
  document.querySelectorAll("[data-olli]").forEach((el) => (el.style.display = "contents", el.innerHTML = ROBOT));
  const $ = (id) => document.getElementById(id);
  const panel = $("olliPanel"), msgs = $("olliMsgs"), input = $("olliInput");
  let history = [], busy = false, started = false;
  const SUG = ["Quais as 10 categorias com maior receita?", "Qual estado tem mais atraso?", "Atraso afeta a nota?", "Quanto vamos faturar em 2027?", "Sobre o que é o dataset?"];
  const HELLO = "Oi! Eu sou a Olli, a assistente de dados do Olist Insights. Respondo só com base no histórico da Olist (2016 a 2018): vendas, entregas, notas, pagamentos e clientes. Se eu não tiver o dado, eu aviso. Por onde começamos?";

  // texto seguro: escapa HTML e aceita apenas **negrito** e quebras de linha
  const fmt = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\n/g, "<br>");
  const scroll = () => (msgs.scrollTop = msgs.scrollHeight);
  const clearChips = () => msgs.querySelectorAll(".chips-inline").forEach((e) => e.remove());

  function add(text, who) {
    const d = document.createElement("div"); d.className = "msg " + who; d.innerHTML = fmt(text); msgs.appendChild(d); scroll(); return d;
  }
  function chips(list) {
    clearChips(); if (!list || !list.length) return;
    const c = document.createElement("div"); c.className = "chips-inline";
    list.forEach((s) => { const b = document.createElement("button"); b.type = "button"; b.textContent = s; b.onclick = () => send(s); c.appendChild(b); });
    msgs.appendChild(c); scroll();
  }
  function welcome() { msgs.innerHTML = ""; history = []; add(HELLO, "bot"); chips(SUG); }
  function open() { panel.classList.add("open"); input.focus(); if (!started) { started = true; welcome(); } }
  const close = () => panel.classList.remove("open");

  $("olliFab").onclick = () => (panel.classList.contains("open") ? close() : open());
  $("olliClose").onclick = close;
  $("olliClear").onclick = () => { if (!busy) welcome(); };
  addEventListener("keydown", (e) => { if (e.key === "Escape" && panel.classList.contains("open")) close(); });
  $("olliForm").onsubmit = (e) => { e.preventDefault(); send(input.value); };

  async function send(text) {
    text = text.trim(); if (!text || busy) return;
    busy = true; input.value = ""; clearChips(); $("olliForm").classList.add("busy");
    add(text, "me");
    const wait = add("", "bot"); wait.innerHTML = '<span class="typing"><i></i><i></i><i></i></span>';
    try {
      const r = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: text, history }) });
      if (r.status === 401) return (location.href = "/");
      const j = await r.json(), answer = j.answer || "Não consegui responder agora. Tente de novo em instantes.";
      wait.innerHTML = fmt(answer);
      if (j.sources && j.sources.length) { const s = document.createElement("small"); s.textContent = "Baseado em " + j.sources.length + " trecho(s) dos dados"; wait.appendChild(s); }
      history.push({ role: "user", content: text }, { role: "assistant", content: answer });
      chips(j.suggestions);
    } catch { wait.textContent = "Tive um problema de conexão. Tente de novo."; }
    busy = false; $("olliForm").classList.remove("busy"); input.focus(); scroll();
  }
})();
