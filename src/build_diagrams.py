"""Gera os diagramas SVG do projeto em docs/diagrams/ (arquitetura, camadas, modelo estrela e autenticação)."""
import re
from html import escape

from config import ROOT

OUT = ROOT / "docs" / "diagrams"
INK, MUTED, LINE, PAPER = "#1f2933", "#617080", "#c9d1d9", "#ffffff"
ORANGE, ORANGE_BG = "#e2761b", "#fff1e3"
BLUE, BLUE_BG = "#2f5fb3", "#e8effb"
GREEN, GREEN_BG = "#1f7a4d", "#e5f4ec"
GRAY, GRAY_BG = "#52606d", "#f1f3f5"
BRONZE, SILVER, GOLD = "#a9693a", "#7b8794", "#c9971c"


class Svg:
    def __init__(self, w, h, title):
        self.w, self.h, self.parts = w, h, []
        self.title = title

    def add(self, s):
        self.parts.append(s)

    def text(self, x, y, s, size=13, weight=400, fill=INK, anchor="start"):
        self.add(f'<text x="{x}" y="{y}" font-size="{size}" font-weight="{weight}" fill="{fill}" '
                 f'text-anchor="{anchor}">{escape(str(s))}</text>')

    def box(self, x, y, w, h, title, lines=(), color=ORANGE, bg=ORANGE_BG, tsize=14, lsize=12.5, lgap=19):
        self.add(f'<rect x="{x+2}" y="{y+3}" width="{w}" height="{h}" rx="10" fill="#000" opacity=".06"/>')
        self.add(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="10" fill="{bg}" stroke="{color}" stroke-width="1.6"/>')
        self.add(f'<rect x="{x}" y="{y}" width="{w}" height="30" rx="10" fill="{color}"/>'
                 f'<rect x="{x}" y="{y+20}" width="{w}" height="10" fill="{color}"/>')
        self.text(x + w / 2, y + 20, title, tsize, 700, "#fff", "middle")
        for i, ln in enumerate(lines):
            self.text(x + 14, y + 52 + i * lgap, ln, lsize, 400, INK)

    def arrow(self, x1, y1, x2, y2, label="", color=MUTED, dash=False, mid=None, label_at=None, route=None):
        """Seta ortogonal: reta quando alinhada, senão com quebras de 90 graus (H-V-H ou V-H-V)."""
        d = ' stroke-dasharray="6 5"' if dash else ""
        if x1 == x2 or y1 == y2:
            path = f"M{x1} {y1} L{x2} {y2}"; lx, ly = (x1 + x2) / 2, (y1 + y2) / 2 - 8
        elif route == "hvh" or (route is None and abs(x2 - x1) >= abs(y2 - y1)):
            m = mid if mid is not None else (x1 + x2) / 2
            path = f"M{x1} {y1} H{m} V{y2} H{x2}"; lx, ly = (x1 + m) / 2, y1 - 8
        else:
            m = mid if mid is not None else (y1 + y2) / 2
            path = f"M{x1} {y1} V{m} H{x2} V{y2}"; lx, ly = (x1 + x2) / 2, m - 6
        self.add(f'<path d="{path}" fill="none" stroke="{color}" stroke-width="2" stroke-linejoin="miter"{d} marker-end="url(#ah)"/>')
        if label:
            if label_at: self.text(label_at[0], label_at[1], label, 11.5, 600, color, label_at[2] if len(label_at) > 2 else "start")
            else: self.text(lx, ly, label, 11.5, 600, color, "middle")

    def save(self, name):
        head = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {self.w} {self.h}" width="{self.w}" height="{self.h}" '
                f'font-family="Inter, Segoe UI, Helvetica, Arial, sans-serif" role="img" aria-label="{escape(self.title)}">'
                f'<defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">'
                f'<path d="M0 0 10 5 0 10z" fill="{MUTED}"/></marker></defs>'
                f'<rect width="{self.w}" height="{self.h}" fill="{PAPER}"/>')
        self.text(30, 38, self.title, 20, 700)
        self.add(f'<rect x="30" y="48" width="64" height="4" rx="2" fill="{ORANGE}"/>')
        (OUT / name).write_text(head + "".join(self.parts) + "</svg>", encoding="utf-8")


def architecture():
    s = Svg(1280, 560, "Arquitetura do projeto: do CSV ao dashboard")
    s.box(30, 100, 190, 120, "Fonte", ["Kaggle: Olist", "9 arquivos CSV", "~126 MB descompactado"], GRAY, GRAY_BG)
    s.box(260, 100, 190, 120, "RAW (data/raw)", ["CSVs originais", "Nunca alterados", "Ignorados pelo Git"], BRONZE, "#f7ece4")
    s.box(490, 100, 230, 120, "Extract (extract.py)", ["Valida presença dos 9 CSVs", "Lê tudo como texto", "Tipagem fica no Transform"], BLUE, BLUE_BG)
    s.box(760, 100, 230, 120, "Transform (transform.py)", ["Limpeza e tipagem (pandas)", "21 regras de qualidade", "Gera docs/data_quality.md"], BLUE, BLUE_BG)
    s.box(1030, 100, 220, 120, "Processed (Parquet)", ["8 tabelas tratadas", "+ products traduzido", "Camada intermediária"], SILVER, "#eef0f2")
    s.arrow(220, 160, 260, 160); s.arrow(450, 160, 490, 160); s.arrow(720, 160, 760, 160); s.arrow(990, 160, 1030, 160)
    s.box(490, 300, 760, 120, "Load (load.py + sql/schema.sql + sql/gold.sql): DuckDB data/warehouse/olist.duckdb",
          ["bronze: CSV bruto em VARCHAR (rastreabilidade)", "silver: tabelas limpas e tipadas", "gold: modelo estrela + fact_orders com métricas"], ORANGE, ORANGE_BG)
    s.arrow(1140, 220, 1140, 300, "Parquet")
    s.add(f'<path d="M375 220 V360 H490" fill="none" stroke="{MUTED}" stroke-width="2" stroke-dasharray="6 5" marker-end="url(#ah)"/>')
    s.text(300, 345, "bronze (cópia fiel)", 11.5, 600, MUTED)
    s.box(30, 460, 330, 80, "Análise (SQL + notebook)", ["analytics.sql + Matplotlib: 5 perguntas", "reports/charts/*.png"], GREEN, GREEN_BG)
    s.box(400, 460, 330, 80, "Export (export_web.py)", ["Agregados da gold em JSON", "api/_data/dashboard.json (privado)"], GREEN, GREEN_BG)
    s.box(770, 460, 480, 80, "Vercel: login + API protegida + dashboard 3D", ["Cookie HttpOnly assinado (HMAC), senha com scrypt", "Chart.js e Three.js no navegador"], GREEN, GREEN_BG)
    s.arrow(540, 420, 200, 460, color=GREEN, mid=434, route="vhv"); s.arrow(640, 420, 565, 460, color=GREEN, mid=446, route="vhv"); s.arrow(730, 500, 770, 500, color=GREEN)
    s.save("architecture.svg")


def medallion():
    s = Svg(1280, 520, "Arquitetura em camadas (medallion) no DuckDB")
    cols = [
        (30, "BRONZE", BRONZE, "#f7ece4", ["Cópia fiel dos 9 CSVs", "Todas as colunas em VARCHAR", "Sem filtros nem correções", "Objetivo: rastreabilidade", "", "Ex.: bronze.orders (99.441)", "bronze.geolocation (1.000.163)"]),
        (460, "SILVER", SILVER, "#eef0f2", ["Dados limpos e tipados", "Datas em TIMESTAMP, valores em DOUBLE", "Duplicidades e nulos tratados", "Categorias traduzidas (EN)", "Flag has_date_inconsistency", "", "Ex.: silver.geolocation (19.010)"]),
        (890, "GOLD", GOLD, "#fbf3dc", ["Modelo estrela para análise", "dim_customer, dim_seller,", "dim_product, dim_date,", "fact_order_items, fact_payments", "fact_orders: tabela derivada", "delivery_days, delay_days, is_late", "Consumida por SQL e API"]),
    ]
    for x, name, c, bg, lines in cols:
        s.box(x, 110, 360, 270, name, lines, c, bg, 18, 15.5, 25)
    s.arrow(390, 245, 460, 245, "limpeza"); s.arrow(820, 245, 890, 245, "modelagem")
    s.box(30, 410, 1220, 80, "Por que camadas?", ["Cada transformação é auditável (bronze x silver x gold), a limpeza é reexecutável e a gold simplifica as consultas,",
                                                 "evitando duplicação de linhas em joins (1 avaliação por pedido, 1 coordenada por CEP)."], ORANGE, ORANGE_BG, 16, 15, 24)
    s.save("medallion.svg")


def table(s, x, y, w, name, cols, color, bg, pk=None):
    h = 48 + len(cols) * 20
    s.box(x, y, w, h, name, [], color, bg, 13)
    for i, c in enumerate(cols):
        key = c.startswith("*")
        s.text(x + 12, y + 52 + i * 20, ("PK " if key else "     ") + c.lstrip("*"), 12, 700 if key else 400, INK)
    return h


def star():
    s = Svg(1280, 800, "Modelo dimensional (estrela) da camada gold")
    # fatos ao centro
    table(s, 500, 90, 280, "fact_orders (derivada)", ["*order_id", "customer_id (FK)", "order_status", "purchase_ts", "delivered_customer_ts", "estimated_delivery_ts", "items_count", "items_revenue", "freight_total", "payment_total", "delivery_days", "delay_days", "is_late", "review_score"], ORANGE, ORANGE_BG)
    table(s, 500, 480, 280, "fact_order_items", ["*order_id, order_item_id", "product_id (FK)", "seller_id (FK)", "customer_id (FK)", "purchase_date (FK)", "order_status", "price", "freight_value", "is_revenue"], ORANGE, ORANGE_BG)
    table(s, 900, 480, 340, "fact_payments", ["*order_id, payment_sequential", "payment_type", "payment_installments", "payment_value"], ORANGE, ORANGE_BG)
    table(s, 30, 90, 300, "dim_customer", ["*customer_id", "customer_unique_id", "zip_code_prefix", "city, state", "lat, lng"], BLUE, BLUE_BG)
    table(s, 30, 480, 300, "dim_product", ["*product_id", "category_pt, category_en", "name_length, description_length", "photos_qty, weight_g", "length_cm, height_cm, width_cm"], BLUE, BLUE_BG)
    table(s, 900, 90, 340, "dim_date", ["*date_key", "year, month, year_month", "day, weekday"], BLUE, BLUE_BG)
    table(s, 900, 250, 340, "dim_seller", ["*seller_id", "zip_code_prefix", "city, state"], BLUE, BLUE_BG)
    s.arrow(330, 150, 500, 150, "customer_id"); s.arrow(330, 540, 500, 540, "product_id")
    s.arrow(500, 600, 330, 600, "customer_id", dash=True)
    s.arrow(780, 520, 900, 140, "purchase_date", dash=True, mid=840, label_at=(846, 225), route="hvh")
    s.arrow(780, 560, 900, 300, "seller_id", dash=True, mid=872, label_at=(878, 440), route="hvh")
    s.arrow(640, 416, 640, 480, "order_id")
    s.arrow(780, 520, 900, 520, "order_id", label_at=(784, 512))
    s.text(30, 775, "Grão: fact_orders = 1 linha por pedido. fact_order_items = 1 por item. fact_payments = 1 por pagamento. Setas tracejadas: relacionamentos secundários.", 12, 400, MUTED)
    s.save("star_schema.svg")


def auth_sequence():
    s = Svg(1280, 520, "Fluxo de autenticação e acesso aos dados")
    actors = [("Navegador", 110), ("/api/login", 470), ("/api/data", 830), ("dashboard.json", 1130)]
    for name, x in actors:
        s.box(x - 80, 80, 160, 46, name, [], BLUE, BLUE_BG, 13)
        s.add(f'<line x1="{x}" y1="126" x2="{x}" y2="490" stroke="{LINE}" stroke-width="1.5" stroke-dasharray="4 5"/>')
    steps = [
        (110, 470, 170, "1. POST usuário e senha"),
        (470, 470, 210, "2. scrypt(senha, salt) vs AUTH_PASS_HASH"),
        (470, 110, 250, "3. Set-Cookie HttpOnly, Secure, SameSite=Strict"),
        (110, 830, 310, "4. GET /api/data com cookie"),
        (830, 830, 350, "5. Verifica HMAC e expiração"),
        (830, 1130, 415, "6. Lê arquivo privado (fora de public/)"),
        (830, 110, 465, "7. 200 JSON (ou 401 sem sessão válida)"),
    ]
    for a, b, y, label in steps:
        if a == b:
            s.add(f'<path d="M{a} {y} h50 v22 h-50" fill="none" stroke="{MUTED}" stroke-width="2" marker-end="url(#ah)"/>')
            s.text(a + 62, y + 15, label, 12.5, 600, INK)
        else:
            s.arrow(a, y, b, y)
            s.text((a + b) / 2, y - 8, label, 12.5, 600, INK, "middle")
    s.save("auth_flow.svg")


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for f in (architecture, medallion, star, auth_sequence):
        f()
    import subprocess
    from PIL import Image
    for svg in OUT.glob("*.svg"):
        w, h = map(int, re.search(r'width="(\d+)" height="(\d+)"', svg.read_text()).groups())
        html = OUT / "_tmp.html"; html.write_text(f"<html><body style='margin:0;overflow:hidden'>{svg.read_text()}</body></html>")
        full = OUT / "_full.png"
        subprocess.run(["google-chrome", "--headless=new", "--no-sandbox", "--hide-scrollbars", f"--window-size={w},{h + 150}", f"--screenshot={full}", f"file://{html}"], check=True, capture_output=True)
        Image.open(full).crop((0, 0, w, h)).save(svg.with_suffix(".png")); html.unlink(); full.unlink()
    print("diagramas em", OUT)
