// Marca própria do projeto (hexágono com facetas), reutilizada no login e no dashboard.
window.OI_MARK = `<svg viewBox="0 0 48 48" aria-hidden="true"><defs><linearGradient id="g1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffb35c"/><stop offset="1" stop-color="#e2761b"/></linearGradient></defs><path d="M24 3 42 13.5v21L24 45 6 34.5v-21z" fill="url(#g1)"/><path d="M24 3 42 13.5 24 24 6 13.5z" fill="#fff" opacity=".28"/><path d="M24 24v21L6 34.5v-21z" fill="#000" opacity=".12"/><circle cx="24" cy="24" r="5" fill="#fff"/></svg>`;
document.querySelectorAll("[data-mark]").forEach((el) => (el.innerHTML = window.OI_MARK));
(() => { try { const t = localStorage.getItem("oi-theme"); if (t) document.documentElement.dataset.theme = t; } catch {} })();
