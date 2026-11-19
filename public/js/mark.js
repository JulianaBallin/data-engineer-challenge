// Marca do projeto (a mesma do README): pilha de camadas, reutilizada no login, dashboard e favicon.
window.OI_MARK = `<svg viewBox="0 0 64 64" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M32 6L56 18L32 30L8 18Z" fill="#f6851b" stroke="#f6851b" stroke-width="2.4"/><path d="M8 29L32 41L56 29" stroke="#c9a27a" stroke-width="3"/><path d="M8 40L32 52L56 40" stroke="#8b949e" stroke-width="3"/><circle cx="32" cy="18" r="3" fill="#141618"/></svg>`;
document.querySelectorAll("[data-mark]").forEach((el) => (el.innerHTML = window.OI_MARK));
(() => { try { const t = localStorage.getItem("oi-theme"); if (t) document.documentElement.dataset.theme = t; } catch {} })();
