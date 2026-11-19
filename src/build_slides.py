"""Gera a apresentação (PPTX e PDF) do desafio."""
import json
import subprocess
from pathlib import Path
from PIL import Image
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "docs/apresentacao"
LOGO = ROOT / "assets/logo/bemol-digital-logo.png"
LOGO_W = ROOT / "assets/logo/bemol-digital-logo-branca.png"
SYM = ROOT / "assets/logo/olist-insights-simbolo.png"
DEPLOY = "https://data-engineer-challenge.vercel.app"
REPO = "https://github.com/JulianaBallin/data-engineer-challenge"
D = json.loads((ROOT / "api/_data/dashboard.json").read_text(encoding="utf-8"))
DARK, ORANGE, LIGHT, MUTED, WHITE = (RGBColor(0x14, 0x16, 0x18), RGBColor(0xF6, 0x85, 0x1B),
    RGBColor(0xF2, 0xF4, 0xF6), RGBColor(0x6A, 0x73, 0x7D), RGBColor(255, 255, 255))

prs = Presentation()
prs.slide_width, prs.slide_height = Inches(13.333), Inches(7.5)
blank = prs.slide_layouts[6]
n = [0]
LM = 0.7 - 0.7 / 2.54  # margem esquerda reduzida em 0,7 cm
CW = 13.333 - 2 * LM   # largura útil (margens simétricas)


def rect(s, x, y, w, h, color, shape=MSO_SHAPE.RECTANGLE):
    r = s.shapes.add_shape(shape, Inches(x), Inches(y), Inches(w), Inches(h))
    r.fill.solid(); r.fill.fore_color.rgb = color; r.line.fill.background()
    r.shadow.inherit = False
    return r


def text(s, x, y, w, h, t, size=18, bold=False, color=DARK, align=PP_ALIGN.LEFT, gap=6, spacing=1.0, anchor=MSO_ANCHOR.TOP, link=None):
    tb = s.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = tb.text_frame; tf.word_wrap = True; tf.vertical_anchor = anchor
    tf.margin_top = tf.margin_bottom = 0
    for i, line in enumerate(t if isinstance(t, list) else [t]):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.text = line; p.alignment = align; p.space_after = Pt(gap); p.line_spacing = spacing
        for r in p.runs:
            r.font.size = Pt(size); r.font.bold = bold; r.font.color.rgb = color; r.font.name = "Calibri"
    if link: tb.click_action.hyperlink.address = link
    return tb


def two_line(s, x, y, w, h, lead, body, lead_size, body_size, lead_color=DARK, body_color=MUTED):
    """Bloco com frase-chave e detalhe, centralizado verticalmente na altura h."""
    tb = s.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = tb.text_frame; tf.word_wrap = True; tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    tf.margin_top = tf.margin_bottom = 0
    p = tf.paragraphs[0]; p.text = lead; p.space_after = Pt(3)
    for r in p.runs: r.font.size = Pt(lead_size); r.font.bold = True; r.font.color.rgb = lead_color; r.font.name = "Calibri"
    if body:
        q = tf.add_paragraph(); q.text = body
        for r in q.runs: r.font.size = Pt(body_size); r.font.color.rgb = body_color; r.font.name = "Calibri"
    return tb


def badge(s, x, y, d, label, size=18):
    o = rect(s, x, y, d, d, ORANGE, MSO_SHAPE.OVAL)
    tf = o.text_frame; tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    p = tf.paragraphs[0]; p.text = str(label); p.alignment = PP_ALIGN.CENTER
    for r in p.runs: r.font.size = Pt(size); r.font.bold = True; r.font.color.rgb = WHITE; r.font.name = "Calibri"


def slide(title, dark=False):
    s = prs.slides.add_slide(blank); n[0] += 1
    rect(s, 0, 0, 13.333, 7.5, DARK if dark else WHITE)
    if not dark:
        rect(s, 0, 0, 0.18, 7.5, ORANGE)
        text(s, LM, 0.4, 11.5, 0.9, title, 30, True)
        rect(s, LM + 0.12, 1.25, 1.2, 0.06, ORANGE)
        s.shapes.add_picture(str(LOGO), Inches(10.6), Inches(6.85), height=Inches(0.5))
        text(s, LM, 7.0, 6, 0.3, "Olist Insights | Desafio Data Engineer I | Bemol Digital", 10, color=MUTED)
        text(s, 9.2, 7.0, 1.2, 0.3, str(n[0]), 10, color=MUTED, align=PP_ALIGN.RIGHT)
    return s


def rows(s, items, top=1.65, bottom=6.7, lead_size=21, body_size=15):
    """Linhas com ênfase: selo numerado, frase-chave em negrito e detalhe, tudo centralizado na linha."""
    gap = 0.16
    h = (bottom - top - gap * (len(items) - 1)) / len(items)
    d = min(0.6, h - 0.3)
    for i, (lead, body) in enumerate(items):
        y = top + i * (h + gap)
        rect(s, LM + 0.1, y, CW - 0.2, h, LIGHT, MSO_SHAPE.ROUNDED_RECTANGLE)
        rect(s, LM + 0.1, y, 0.09, h, ORANGE)
        badge(s, LM + 0.45, y + (h - d) / 2, d, i + 1)
        two_line(s, LM + 1.3, y, CW - 1.7, h, lead, body, lead_size, body_size)


def stat_card(s, x, y, w, h, big, small):
    rect(s, x, y, w, h, LIGHT, MSO_SHAPE.ROUNDED_RECTANGLE)
    two_line(s, x + 0.3, y, w - 0.5, h, big, small, 30, 14, ORANGE, MUTED)


def card_grid(s, items, top=1.9, w=3.6, h=1.45, gap=0.35):
    x0 = (13.333 - (3 * w + 2 * gap)) / 2
    for i, (b, t_) in enumerate(items):
        stat_card(s, x0 + (i % 3) * (w + gap), top + (i // 3) * (h + gap), w, h, b, t_)
    return top + 2 * h + gap


def tool_card(s, x, y, w, h, icon, num, title, body):
    rect(s, x, y, w, h, LIGHT, MSO_SHAPE.ROUNDED_RECTANGLE)
    ib = 0.95
    rect(s, x + 0.18, y + (h - ib) / 2, ib, ib, WHITE, MSO_SHAPE.ROUNDED_RECTANGLE)
    s.shapes.add_picture(str(ROOT / f"assets/icons/{icon}.png"), Inches(x + 0.18 + 0.1), Inches(y + (h - ib) / 2 + 0.1), width=Inches(ib - 0.2))
    two_line(s, x + 1.3, y, w - 1.45, h, f"{num}. {title}", body, 15, 12, ORANGE, DARK)


def chart_slide(title, img, lead, lines):
    s = slide(title)
    im = Image.open(ROOT / img); r = im.width / im.height
    w = min(8.4, 5.1 * r); h = w / r
    s.shapes.add_picture(str(ROOT / img), Inches(LM + 0.1), Inches(1.65 + (5.1 - h) / 2), width=Inches(w))
    x = LM + 0.1 + w + 0.4; pw = 13.333 - LM - 0.1 - x
    pn = rect(s, x, 1.65, pw, 5.1, LIGHT, MSO_SHAPE.ROUNDED_RECTANGLE); pn.adjustments[0] = 0.04; rect(s, x, 1.65, 0.09, 5.1, ORANGE)
    text(s, x + 0.35, 1.95, pw - 0.6, 1.2, lead, 20, True, DARK)
    text(s, x + 0.35, 3.0, pw - 0.6, 3.6, lines, 15, False, MUTED, gap=12, spacing=1.1)


def fig_slide(title, img, caption=None, top=1.45, max_h=5.35, max_w=None):
    s = slide(title)
    max_w = max_w or CW
    im = Image.open(ROOT / img); r = im.width / im.height
    h = min(max_h, max_w / r); w = h * r
    s.shapes.add_picture(str(ROOT / img), Inches((13.333 - w) / 2), Inches(top), width=Inches(w))
    if caption: text(s, LM, top + h + 0.1, CW, 0.4, caption, 15, True, DARK, PP_ALIGN.CENTER)
    return s


# 1 capa
s = slide("", dark=True)
rect(s, 0, 5.2, 13.333, 0.12, ORANGE)
s.shapes.add_picture(str(SYM), Inches(0.9), Inches(1.3), height=Inches(1.5))
text(s, 3.0, 1.3, 9.5, 1, "Olist Insights", 54, True, WHITE)
text(s, 3.0, 2.4, 9.5, 1.2, "Pipeline ETL, Data Warehouse em DuckDB e dashboard de e-commerce", 24, color=RGBColor(0xA7, 0xAD, 0xB4))
text(s, 3.0, 3.8, 9.5, 0.6, "DESAFIO TÉCNICO | DATA ENGINEER I", 16, True, ORANGE)
text(s, 0.9, 5.6, 7, 1, ["Juliana Ballin Lima", "Novembro de 2026"], 16, color=WHITE)
s.shapes.add_picture(str(LOGO_W), Inches(9.2), Inches(5.95), width=Inches(3.4))

# 2 problema
s = slide("O problema")
rows(s, [("Marketplace com milhares de registros por dia", "A Olist conecta pequenos lojistas a grandes marketplaces."),
         ("Nove CSVs brutos, sem padrão", "Pedidos, itens, pagamentos, avaliações, clientes, vendedores, produtos, geolocalização e tradução."),
         ("Dados com ruído", "Duplicidades, datas inconsistentes, texto sem padrão e coordenadas repetidas aos milhares."),
         ("Objetivo: base confiável e reprodutível", "Responder perguntas de negócio com SQL, gráficos e conclusões claras.")])

# 3 base de dados
s = slide("A base de dados")
b = card_grid(s, [("99.441", "pedidos"), ("112.650", "itens vendidos"), ("103.886", "pagamentos"),
                  ("99.224", "avaliações"), ("1.000.163", "linhas de geolocalização"), ("2016 a 2018", "período coberto")])
text(s, 0, b + 0.3, 13.333, 0.4, "Fonte: Brazilian E-Commerce Public Dataset by Olist (Kaggle), licença CC BY-NC-SA 4.0.", 12, color=MUTED, align=PP_ALIGN.CENTER)

# 4 qualidade
s = slide("Problemas encontrados e tratamento")
rows(s, [("189 pedidos com cronologia inválida", "Sinalizados e fora das métricas de prazo, sem corrigir datas por suposição."),
         ("981.153 linhas de geolocalização redundantes", "Agregadas em 1 linha por prefixo de CEP."),
         ("814 review_id repetidos", "A Gold usa 1 avaliação por pedido (a mais recente)."),
         ("610 produtos sem categoria", "Rotulados como 'desconhecida', sem inferir informação."),
         ("Integridade referencial verificada em 6 relações", "Nenhuma perda. As 21 regras estão em docs/data_quality.md.")], lead_size=19, body_size=14)

# 5 stack
s = slide("Pipeline e stack: do dado bruto ao deploy")
T = [("kaggle", "Kaggle", "Download dos 9 CSVs brutos do dataset Olist para a camada raw, sem alterar."),
     ("python", "Python", "Extract e Transform: leitura, limpeza, tipagem e 21 regras de qualidade."),
     ("pandas", "pandas", "Padronização, nulos, duplicidades, datas e tabela derivada de prazos."),
     ("apacheparquet", "Parquet", "Camada processada: 8 tabelas tratadas em formato colunar."),
     ("duckdb", "DuckDB e SQL", "Load em bronze, silver e gold, com modelo estrela e fact_orders."),
     ("jupyter", "Jupyter", "Notebook com as 5 consultas SQL, gráficos e conclusões de negócio."),
     ("nodedotjs", "Node.js", "API com login (scrypt, cookie HttpOnly) e rota protegida de dados."),
     ("chartdotjs", "Chart.js", "Dashboard com gráficos clicáveis, filtros e tema claro e escuro."),
     ("threedotjs", "Three.js", "Cenas 3D: poliedro do login, supply chain e receita mensal."),
     ("vercel", "Vercel", "Deploy do dashboard e da API, com variáveis de ambiente seguras."),
     ("github", "GitHub", "Versionamento com commits convencionais e README profissional."),
     ("claude", "Claude Code (IA)", "Apoio em documentação, interface do dashboard e assistente Olli.")]
cw, chh, gx, gy = 3.95, 1.3, 0.2, 0.18
x0 = (13.333 - (3 * cw + 2 * gx)) / 2
for i, (ic, tt, bd) in enumerate(T):
    tool_card(s, x0 + (i % 3) * (cw + gx), 1.6 + (i // 3) * (chh + gy), cw, chh, ic, i + 1, tt, bd)

# 6 arquitetura / 7 camadas / 8 estrela
fig_slide("Arquitetura da solução", "docs/diagrams/architecture.png", max_h=5.3)
fig_slide("Camadas Bronze, Silver e Gold", "docs/diagrams/medallion.png", "Pipeline idempotente: o warehouse é recriado do zero a cada execução.", max_h=5.0)
star = Image.open(ROOT / "docs/diagrams/star_schema.png"); star.crop((15, 66, 1265, 762)).save(OUT / "img/star_crop.png")
fig_slide("Modelo estrela na Gold", "docs/apresentacao/img/star_crop.png", max_h=5.45, top=1.4)

# 9 notebook
s = slide("Análise no Jupyter Notebook")
Image.open(OUT / "img/jupyter-notebook.png").crop((0, 0, 1790, 1000)).save(OUT / "img/jupyter_crop.png")
im = Image.open(OUT / "img/jupyter_crop.png"); r = im.width / im.height
h = 4.6; w = h * r
s.shapes.add_picture(str(OUT / "img/jupyter_crop.png"), Inches((13.333 - w) / 2), Inches(1.5), height=Inches(h))
text(s, LM, 6.4, CW, 0.4, "Notebook executado no Jupyter: consulta SQL no DuckDB, tabela de resultado e gráfico gerado com Matplotlib.", 14, True, DARK, PP_ALIGN.CENTER)

# 10 indicadores
s = slide("Resultados: indicadores")
card_grid(s, [("R$ 13,49 mi", "receita sem frete (receita não é lucro)"), ("96.096", "clientes únicos"), ("R$ 137,42", "ticket médio"),
              ("6,78 %", "pedidos entregues com atraso"), ("2,27 x 4,29", "nota média com atraso x no prazo"), ("3,04 %", "clientes que compraram mais de uma vez")])

# 11 a 15 graficos, um por slide
top = D["categorias_share"]; uf = sorted([r for r in D["q2_pct_atraso"] if r["uf"] and r["pedidos_entregues"] >= 200], key=lambda r: -r["pct_atraso"])
fr = D["q4_frete_medio_uf"]
chart_slide("Vendas: 10 categorias com maior receita", "reports/charts/01_top10_categorias_receita.png",
            "Receita concentrada em poucas categorias",
            [f"A líder, health_beauty, fatura R$ {top[0]['receita']/1e6:.2f} mi ({top[0]['pct']:.1f}% do total).".replace(".", ",", 2) if False else f"A líder, health_beauty, soma {top[0]['pct']:.1f}% da receita total.".replace(".", ","),
             f"As 3 maiores somam {sum(x['pct'] for x in top[:3]):.1f}% da receita.".replace(".", ","),
             "Estoque e marketing devem priorizar essas categorias."])
chart_slide("Logística: pedidos entregues com atraso por estado", "reports/charts/02_pct_atraso_uf.png",
            "Atraso é regional",
            [f"Alagoas ({uf[0]['pct_atraso']:.1f}%) e Maranhão ({uf[1]['pct_atraso']:.1f}%) lideram os atrasos.".replace(".", ","),
             f"Média nacional: {D['kpis'][0]['pct_atraso']:.2f}%.".replace(".", ","),
             "Norte e Nordeste pedem revisão de rotas e prazos prometidos."])
chart_slide("Satisfação: nota média com atraso x no prazo", "reports/charts/03_nota_media_atraso.png",
            "O atraso derruba a nota em quase 2 pontos",
            ["Pedidos no prazo: nota média 4,29.", "Pedidos atrasados: nota média 2,27.", "Cumprir o prazo é a maior alavanca de satisfação."])
chart_slide("Financeiro: frete médio por estado", "reports/charts/04_frete_medio_uf.png",
            "Frete mais caro nos estados mais distantes",
            [f"{fr[0]['uf']} paga R$ {fr[0]['frete_medio']:.2f} por item, o maior frete.".replace(".", ","),
             f"{fr[-1]['uf']} paga R$ {fr[-1]['frete_medio']:.2f}, o menor.".replace(".", ","),
             "A diferença regional pode afetar a conversão de vendas."])
chart_slide("Clientes: recompra", "reports/charts/05_clientes_recorrentes.png",
            "Só 3,04% compraram mais de uma vez",
            ["2.888 clientes compraram mais de uma vez.", "92.102 compraram uma única vez.", "Há grande espaço para campanhas de recompra e pós-venda."])

# 16 dashboard
s = slide("Dashboard protegido por login")
s.shapes.add_picture(str(ROOT / "docs/relatorio/img/dashboard-geral.png"), Inches(LM + 0.1), Inches(1.5), width=Inches(5.5))
s.shapes.add_picture(str(ROOT / "docs/relatorio/img/dashboard-d3.png"), Inches(7.0), Inches(1.5), width=Inches(5.5))
text(s, LM + 0.1, 5.65, CW - 0.2, 1.2, ["9 abas, filtro por estado, busca, tema claro e escuro e gráficos clicáveis.",
                            "Barras 3D da receita mensal (Three.js) e login com poliedro animado.",
                            "Senha com scrypt, cookie HttpOnly assinado com HMAC e dados em arquivo privado."], 15, gap=10)

# 17 cadeia 3D e Olli
s = slide("Cadeia 3D e assistente Olli")
rows(s, [("Supply chain em 3D", "Vendedor, marketplace, pagamento, distribuição, cliente e avaliação, com caminhão, pacotes e colunas de gasto."),
         ("Frete: cerca de 14% do total pago", "R$ 2,2 mi de R$ 16,0 mi pagos pelos clientes. Só existe o que os dados trazem: sem indústria nem estoque."),
         ("Olli responde só com os dados históricos", "Busca trechos relevantes (RAG) e, se não houver o dado, avisa que não sabe."),
         ("Projeções também na Olli", "Regressão linear e cenários, sempre com a ressalva de incerteza.")], lead_size=19, body_size=14)

# 18 deploy, login e IA
s = slide("Deploy, login e uso de IA")
rows(s, [("Deploy na Vercel: data-engineer-challenge.vercel.app", "Frontend estático em public/ e funções Node em api/, publicados a cada push no GitHub (branch main)."),
         ("Login com usuário e senha (ambiente de teste)", "Usuário: bemol    Senha: bemol@2026    Senha verificada com scrypt; sessão em cookie HttpOnly assinado com HMAC."),
         ("Dados protegidos", "O JSON de dados fica em arquivo privado e só sai por /api/data com sessão válida (sem sessão: 401)."),
         ("IA como apoio, com revisão humana", "Claude Code na documentação e na interface do dashboard. A assistente Olli responde só com os dados do histórico.")], lead_size=19, body_size=14)

# 19 conclusoes
s = slide("Conclusões e próximos passos")
rows(s, [("Base confiável", "Regras auditáveis, camadas separadas e nenhum dado inventado."),
         ("Alavancas de negócio", "Reduzir atrasos (impacto direto na nota) e estimular a recompra."),
         ("Próximos passos", "Orquestração (Airflow ou Dagster), testes de dados automatizados e carga incremental."),
         ("Projeção com cautela", "Cenários e regressão linear nos próximos 12 meses, sempre com a margem de erro à vista.")])

# 20 encerramento
s = slide("", dark=True)
s.shapes.add_picture(str(LOGO_W), Inches(4.4), Inches(1.0), width=Inches(4.5))
text(s, 0, 2.9, 13.333, 1, "Obrigada!", 48, True, WHITE, PP_ALIGN.CENTER)
text(s, 0, 4.1, 13.333, 0.5, "Dashboard online", 14, True, ORANGE, PP_ALIGN.CENTER)
text(s, 0, 4.5, 13.333, 0.5, DEPLOY, 22, True, WHITE, PP_ALIGN.CENTER, link=DEPLOY)
text(s, 0, 5.15, 13.333, 0.4, "Login de teste: bemol  |  Senha: bemol@2026", 14, False, RGBColor(0xA7, 0xAD, 0xB4), PP_ALIGN.CENTER)
text(s, 0, 5.8, 13.333, 0.5, "Código: github.com/JulianaBallin/data-engineer-challenge", 16, False, ORANGE, PP_ALIGN.CENTER, link=REPO)
text(s, 0, 6.4, 13.333, 0.4, "Juliana Ballin Lima", 14, False, WHITE, PP_ALIGN.CENTER)

pptx = OUT / "apresentacao-olist.pptx"
prs.save(pptx)
subprocess.run(["soffice", "--headless", "--convert-to", "pdf", "--outdir", str(OUT), str(pptx)], check=True, capture_output=True)
print("[slides]", pptx, "e PDF")
