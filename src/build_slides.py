"""Gera a apresentação (PPTX e PDF) do desafio."""
import subprocess
from pathlib import Path
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "docs/apresentacao"
LOGO = ROOT / "assets/logo/bemol-digital-logo.png"
SYM = ROOT / "assets/logo/olist-insights-simbolo.png"
DARK, ORANGE, LIGHT, MUTED, WHITE = (RGBColor(0x14, 0x16, 0x18), RGBColor(0xF6, 0x85, 0x1B),
    RGBColor(0xF2, 0xF4, 0xF6), RGBColor(0x6A, 0x73, 0x7D), RGBColor(255, 255, 255))

prs = Presentation()
prs.slide_width, prs.slide_height = Inches(13.333), Inches(7.5)
blank = prs.slide_layouts[6]
n = [0]


def rect(s, x, y, w, h, color, shape=MSO_SHAPE.RECTANGLE):
    r = s.shapes.add_shape(shape, Inches(x), Inches(y), Inches(w), Inches(h))
    r.fill.solid(); r.fill.fore_color.rgb = color; r.line.fill.background()
    return r


def text(s, x, y, w, h, t, size=18, bold=False, color=DARK, align=PP_ALIGN.LEFT):
    tb = s.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = tb.text_frame; tf.word_wrap = True
    for i, line in enumerate(t if isinstance(t, list) else [t]):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.text = line; p.alignment = align; p.space_after = Pt(6)
        for r in p.runs:
            r.font.size = Pt(size); r.font.bold = bold; r.font.color.rgb = color; r.font.name = "Calibri"
    return tb


def slide(title, dark=False):
    s = prs.slides.add_slide(blank); n[0] += 1
    rect(s, 0, 0, 13.333, 7.5, DARK if dark else WHITE)
    if not dark:
        rect(s, 0, 0, 0.18, 7.5, ORANGE)
        text(s, 0.7, 0.4, 11, 0.9, title, 32, True)
        rect(s, 0.72, 1.25, 1.2, 0.06, ORANGE)
        s.shapes.add_picture(str(LOGO), Inches(11.55), Inches(6.7), height=Inches(0.55))
        text(s, 0.7, 7.0, 6, 0.3, "Olist Insights | Desafio Data Engineer I | Bemol Digital", 10, color=MUTED)
        text(s, 10.2, 7.0, 1.2, 0.3, str(n[0]), 10, color=MUTED, align=PP_ALIGN.RIGHT)
    return s


def bullets(s, items, x=0.7, y=1.6, w=11.5, size=20):
    text(s, x, y, w, 5, ["•  " + i for i in items], size)


def card(s, x, y, w, h, big, small):
    rect(s, x, y, w, h, LIGHT, MSO_SHAPE.ROUNDED_RECTANGLE)
    text(s, x + 0.2, y + 0.2, w - 0.4, 0.9, big, 30, True, ORANGE)
    text(s, x + 0.2, y + 1.15, w - 0.4, h - 1.2, small, 14, color=MUTED)


# 1 capa
s = slide("", dark=True)
rect(s, 0, 5.2, 13.333, 0.12, ORANGE)
s.shapes.add_picture(str(SYM), Inches(0.9), Inches(1.3), height=Inches(1.5))
text(s, 3.0, 1.3, 9.5, 1, "Olist Insights", 54, True, WHITE)
text(s, 3.0, 2.4, 9.5, 1.2, "Pipeline ETL, Data Warehouse em DuckDB e dashboard de e-commerce", 24, color=RGBColor(0xA7, 0xAD, 0xB4))
text(s, 3.0, 3.8, 9.5, 0.6, "DESAFIO TÉCNICO | DATA ENGINEER I", 16, True, ORANGE)
text(s, 0.9, 5.6, 7, 1, ["Juliana Ballin Lima", "Novembro de 2026"], 16, color=WHITE)
rect(s, 10.0, 5.55, 2.7, 1.5, WHITE, MSO_SHAPE.ROUNDED_RECTANGLE)
s.shapes.add_picture(str(LOGO), Inches(10.2), Inches(5.65), height=Inches(1.3))

# 2 problema
s = slide("O problema")
bullets(s, ["A Olist conecta pequenos lojistas a marketplaces e gera milhares de registros por dia.",
            "Nove CSVs brutos: pedidos, itens, pagamentos, avaliações, clientes, vendedores, produtos, geolocalização e tradução.",
            "Dados com duplicidades, datas inconsistentes, texto sem padrão e coordenadas repetidas aos milhares.",
            "Objetivo: tornar a base confiável, reprodutível e pronta para responder perguntas de negócio."])

# 3 base de dados
s = slide("A base de dados")
for i, (b, t) in enumerate([("99.441", "pedidos"), ("112.650", "itens vendidos"), ("103.886", "pagamentos"),
                            ("99.224", "avaliações"), ("1.000.163", "linhas de geolocalização"), ("2016 a 2018", "período coberto")]):
    card(s, 0.7 + (i % 3) * 4.1, 1.7 + (i // 3) * 2.4, 3.8, 2.1, b, t)
text(s, 0.7, 6.5, 10, 0.4, "Fonte: Brazilian E-Commerce Public Dataset by Olist (Kaggle), licença CC BY-NC-SA 4.0.", 12, color=MUTED)

# 4 qualidade
s = slide("Problemas encontrados e tratamento")
bullets(s, ["189 pedidos com cronologia inválida: sinalizados e fora das métricas de prazo, sem corrigir datas por suposição.",
            "981.153 linhas de geolocalização redundantes: agregadas em 1 linha por prefixo de CEP.",
            "814 review_id repetidos: a Gold usa 1 avaliação por pedido (a mais recente).",
            "610 produtos sem categoria: rotulados 'desconhecida', sem inferir informação.",
            "Integridade referencial verificada em 6 relações, sem perdas.",
            "21 regras documentadas com contagem e justificativa em docs/data_quality.md."], size=19)

# 5 arquitetura
s = slide("Arquitetura da solução")
s.shapes.add_picture(str(ROOT / "docs/diagrams/architecture.png"), Inches(1.2), Inches(1.5), height=Inches(5.2))

# 6 medalhao
s = slide("Camadas Bronze, Silver e Gold")
s.shapes.add_picture(str(ROOT / "docs/diagrams/medallion.png"), Inches(0.7), Inches(1.6), width=Inches(7.2))
bullets(s, ["Bronze: cópia fiel dos CSVs, rastreável.", "Silver: limpa, tipada e padronizada.", "Gold: modelo estrela para análise.",
            "Pipeline idempotente: o warehouse é recriado do zero a cada execução."], x=8.2, y=1.7, w=4.7, size=17)

# 7 estrela
s = slide("Modelo estrela na Gold")
s.shapes.add_picture(str(ROOT / "docs/diagrams/star_schema.png"), Inches(1.5), Inches(1.5), height=Inches(5.2))

# 8-9 analises
s = slide("Resultados: indicadores")
for i, (b, t) in enumerate([("R$ 13,49 mi", "receita sem frete (receita não é lucro)"), ("96.096", "clientes únicos"), ("R$ 137,42", "ticket médio"),
                            ("6,78 %", "pedidos entregues com atraso"), ("2,27 x 4,29", "nota média com atraso x no prazo"), ("3,04 %", "clientes que compraram mais de uma vez")]):
    card(s, 0.7 + (i % 3) * 4.1, 1.7 + (i // 3) * 2.4, 3.8, 2.1, b, t)

s = slide("Receita por categoria e atraso por estado")
s.shapes.add_picture(str(ROOT / "reports/charts/01_top10_categorias_receita.png"), Inches(0.5), Inches(1.6), width=Inches(6.2))
s.shapes.add_picture(str(ROOT / "reports/charts/02_pct_atraso_uf.png"), Inches(6.8), Inches(1.6), width=Inches(6.2))

s = slide("Atraso, frete e recompra")
s.shapes.add_picture(str(ROOT / "reports/charts/03_nota_media_atraso.png"), Inches(0.5), Inches(1.6), width=Inches(3.9))
s.shapes.add_picture(str(ROOT / "reports/charts/04_frete_medio_uf.png"), Inches(4.6), Inches(1.6), width=Inches(3.9))
s.shapes.add_picture(str(ROOT / "reports/charts/05_clientes_recorrentes.png"), Inches(8.8), Inches(1.6), width=Inches(3.9))
text(s, 0.7, 5.4, 12, 1.3, ["O atraso derruba a nota em quase 2 pontos.", "Estados do Norte e Nordeste têm frete mais alto e mais atrasos.", "Só 3 % dos clientes recompram."], 15)

# 10 dashboard
s = slide("Dashboard protegido por login")
s.shapes.add_picture(str(ROOT / "docs/relatorio/img/dashboard-geral.png"), Inches(0.7), Inches(1.5), width=Inches(5.4))
s.shapes.add_picture(str(ROOT / "docs/relatorio/img/dashboard-d3.png"), Inches(6.5), Inches(1.5), width=Inches(5.4))
text(s, 0.7, 5.65, 12, 1.2, ["7 abas, filtro por estado, busca, tema claro e escuro e gráficos clicáveis.",
                            "Barras 3D da receita mensal (Three.js) e login com poliedro animado.",
                            "Senha com scrypt, cookie HttpOnly assinado com HMAC e dados em arquivo privado."], 15)

# 11 conclusoes
s = slide("Conclusões e próximos passos")
bullets(s, ["Base confiável: regras auditáveis, camadas separadas e nenhum dado inventado.",
            "Alavancas de negócio: reduzir atrasos (impacto direto na nota) e estimular a recompra.",
            "Próximos passos: orquestração (Airflow ou Dagster), testes de dados automatizados e carga incremental.",
            "IA (Claude Code) usada para documentação e apoio ao frontend e à interface de apresentação do dashboard."], size=20)

# 12 encerramento
s = slide("", dark=True)
rect(s, 4.9, 1.4, 3.5, 1.9, WHITE, MSO_SHAPE.ROUNDED_RECTANGLE)
s.shapes.add_picture(str(LOGO), Inches(5.1), Inches(1.5), height=Inches(1.7))
text(s, 0, 3.8, 13.333, 1, "Obrigada!", 48, True, WHITE, PP_ALIGN.CENTER)
text(s, 0, 4.9, 13.333, 0.8, "Juliana Ballin Lima | github.com/JulianaBallin/data-engineer-challenge", 18, color=ORANGE, align=PP_ALIGN.CENTER)

pptx = OUT / "apresentacao-olist.pptx"
prs.save(pptx)
subprocess.run(["soffice", "--headless", "--convert-to", "pdf", "--outdir", str(OUT), str(pptx)], check=True, capture_output=True)
print("[slides]", pptx, "e PDF")
