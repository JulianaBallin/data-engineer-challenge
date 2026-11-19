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
LOGO_W = ROOT / "assets/logo/bemol-digital-logo-branca.png"
SYM = ROOT / "assets/logo/olist-insights-simbolo.png"
DARK, ORANGE, LIGHT, MUTED, WHITE = (RGBColor(0x14, 0x16, 0x18), RGBColor(0xF6, 0x85, 0x1B),
    RGBColor(0xF2, 0xF4, 0xF6), RGBColor(0x6A, 0x73, 0x7D), RGBColor(255, 255, 255))

prs = Presentation()
prs.slide_width, prs.slide_height = Inches(13.333), Inches(7.5)
blank = prs.slide_layouts[6]
n = [0]
LM = 0.7 - 0.7 / 2.54  # margem esquerda reduzida em 0,7 cm


def rect(s, x, y, w, h, color, shape=MSO_SHAPE.RECTANGLE):
    r = s.shapes.add_shape(shape, Inches(x), Inches(y), Inches(w), Inches(h))
    r.fill.solid(); r.fill.fore_color.rgb = color; r.line.fill.background()
    return r


def text(s, x, y, w, h, t, size=18, bold=False, color=DARK, align=PP_ALIGN.LEFT, gap=6, spacing=1.0):
    tb = s.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = tb.text_frame; tf.word_wrap = True
    for i, line in enumerate(t if isinstance(t, list) else [t]):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.text = line; p.alignment = align; p.space_after = Pt(gap); p.line_spacing = spacing
        for r in p.runs:
            r.font.size = Pt(size); r.font.bold = bold; r.font.color.rgb = color; r.font.name = "Calibri"
    return tb


def slide(title, dark=False):
    s = prs.slides.add_slide(blank); n[0] += 1
    rect(s, 0, 0, 13.333, 7.5, DARK if dark else WHITE)
    if not dark:
        rect(s, 0, 0, 0.18, 7.5, ORANGE)
        text(s, LM, 0.4, 11, 0.9, title, 32, True)
        rect(s, LM + 0.12, 1.25, 1.2, 0.06, ORANGE)
        s.shapes.add_picture(str(LOGO), Inches(10.6), Inches(6.85), height=Inches(0.5))
        text(s, LM, 7.0, 6, 0.3, "Olist Insights | Desafio Data Engineer I | Bemol Digital", 10, color=MUTED)
        text(s, 9.2, 7.0, 1.2, 0.3, str(n[0]), 10, color=MUTED, align=PP_ALIGN.RIGHT)
    return s


def bullets(s, items, x=LM, y=1.75, w=11.8, size=20):
    text(s, x, y, w, 5, ["•  " + i for i in items], size, gap=20, spacing=1.15)


def card_grid(s, items, top=1.9, w=3.5, h=1.75, gap=0.4):
    """Grade 3 colunas centralizada na largura do slide."""
    x0 = (13.333 - (3 * w + 2 * gap)) / 2
    for i, (b, t_) in enumerate(items):
        card(s, x0 + (i % 3) * (w + gap), top + (i // 3) * (h + gap), w, h, b, t_)
    return x0, top + 2 * h + gap


def rows(s, items, top=1.65, bottom=6.7, lead_size=21, body_size=15):
    """Linhas de texto com ênfase: número, frase-chave em negrito laranja e detalhe abaixo."""
    gap = 0.16
    h = (bottom - top - gap * (len(items) - 1)) / len(items)
    for i, (lead, body) in enumerate(items):
        y = top + i * (h + gap)
        rect(s, LM + 0.1, y, 12.3, h, LIGHT, MSO_SHAPE.ROUNDED_RECTANGLE)
        rect(s, LM + 0.1, y, 0.09, h, ORANGE)
        c = rect(s, LM + 0.45, y + h / 2 - 0.3, 0.6, 0.6, ORANGE, MSO_SHAPE.OVAL)
        text(s, LM + 0.45, y + h / 2 - 0.27, 0.6, 0.5, str(i + 1), 18, True, WHITE, PP_ALIGN.CENTER)
        text(s, LM + 1.3, y + h / 2 - 0.42 if body else y + h / 2 - 0.25, 10.9, 0.5, lead, lead_size, True, DARK)
        if body:
            text(s, LM + 1.3, y + h / 2 + 0.02, 10.9, h / 2, body, body_size, False, MUTED)


def tool_card(s, x, y, w, h, icon, n, title, body):
    rect(s, x, y, w, h, LIGHT, MSO_SHAPE.ROUNDED_RECTANGLE)
    rect(s, x + 0.12, y + 0.14, 0.9, 0.9, WHITE, MSO_SHAPE.ROUNDED_RECTANGLE)
    s.shapes.add_picture(str(ROOT / f"assets/icons/{icon}.png"), Inches(x + 0.2), Inches(y + 0.22), width=Inches(0.74))
    text(s, x + 1.15, y + 0.08, w - 1.25, 0.4, f"{n}. {title}", 15, True, ORANGE)
    text(s, x + 1.15, y + 0.42, w - 1.25, h - 0.45, body, 12, False, DARK)


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
s.shapes.add_picture(str(LOGO_W), Inches(9.2), Inches(5.95), width=Inches(3.4))

# 2 problema
s = slide("O problema")
rows(s, [("Marketplace com milhares de registros por dia", "A Olist conecta pequenos lojistas a grandes marketplaces."),
         ("Nove CSVs brutos, sem padrão", "Pedidos, itens, pagamentos, avaliações, clientes, vendedores, produtos, geolocalização e tradução."),
         ("Dados com ruído", "Duplicidades, datas inconsistentes, texto sem padrão e coordenadas repetidas aos milhares."),
         ("Objetivo: base confiável e reprodutível", "Responder perguntas de negócio com SQL, gráficos e conclusões claras.")])

# 3 base de dados
s = slide("A base de dados")
x0, bottom = card_grid(s, [("99.441", "pedidos"), ("112.650", "itens vendidos"), ("103.886", "pagamentos"),
                           ("99.224", "avaliações"), ("1.000.163", "linhas de geolocalização"), ("2016 a 2018", "período coberto")])
text(s, 0, bottom + 0.3, 13.333, 0.4, "Fonte: Brazilian E-Commerce Public Dataset by Olist (Kaggle), licença CC BY-NC-SA 4.0.", 12, color=MUTED, align=PP_ALIGN.CENTER)

# 4 qualidade
s = slide("Problemas encontrados e tratamento")
rows(s, [("189 pedidos com cronologia inválida", "Sinalizados e fora das métricas de prazo, sem corrigir datas por suposição."),
         ("981.153 linhas de geolocalização redundantes", "Agregadas em 1 linha por prefixo de CEP."),
         ("814 review_id repetidos", "A Gold usa 1 avaliação por pedido (a mais recente)."),
         ("610 produtos sem categoria", "Rotulados como 'desconhecida', sem inferir informação."),
         ("Integridade referencial verificada em 6 relações", "Nenhuma perda. As 21 regras estão em docs/data_quality.md.")], lead_size=19, body_size=14)

# 4b passo a passo com ferramentas
s = slide("Passo a passo do desenvolvimento")
T = [("kaggle", "Kaggle", "Download dos 9 CSVs brutos do dataset Olist para a camada raw, sem alterar."),
     ("python", "Python", "Extract e Transform: leitura, limpeza, tipagem e 21 regras de qualidade."),
     ("pandas", "pandas", "Padronização, nulos, duplicidades, datas e tabela derivada de prazos."),
     ("apacheparquet", "Parquet", "Camada processada: 8 tabelas tratadas em formato colunar."),
     ("duckdb", "DuckDB e SQL", "Load em bronze, silver e gold, com modelo estrela e fact_orders."),
     ("jupyter", "Jupyter", "Notebook com as 5 consultas SQL, gráficos e conclusões de negócio."),
     ("nodedotjs", "Node.js", "API com login (scrypt, cookie HttpOnly) e rota protegida de dados."),
     ("chartdotjs", "Chart.js e Three.js", "Dashboard com gráficos clicáveis, cadeia 3D e barras 3D."),
     ("vercel", "Vercel", "Deploy do dashboard e da API, com variáveis de ambiente seguras."),
     ("github", "GitHub", "Versionamento com commits convencionais e README profissional."),
     ("claude", "Claude Code (IA)", "Apoio em documentação, interface do dashboard e assistente Olli."),
     ("threedotjs", "Three.js", "Cenas 3D: poliedro do login, supply chain e receita mensal.")]
cw, ch_, gx, gy = 3.95, 1.4, 0.2, 0.16
x0 = (13.333 - (3 * cw + 2 * gx)) / 2
for i, (ic, tt, bd) in enumerate(T):
    tool_card(s, x0 + (i % 3) * (cw + gx), 1.6 + (i // 3) * (ch_ + gy), cw, ch_, ic, i + 1, tt, bd)

# 5 arquitetura
s = slide("Arquitetura da solução")
s.shapes.add_picture(str(ROOT / "docs/diagrams/architecture.png"), Inches(1.2), Inches(1.5), height=Inches(5.2))

# 6 medalhao
s = slide("Camadas Bronze, Silver e Gold")
s.shapes.add_picture(str(ROOT / "docs/diagrams/medallion.png"), Inches(LM), Inches(1.6), width=Inches(7.2))
bullets(s, ["Bronze: cópia fiel dos CSVs, rastreável.", "Silver: limpa, tipada e padronizada.", "Gold: modelo estrela para análise.",
            "Pipeline idempotente: o warehouse é recriado do zero a cada execução."], x=8.2, y=1.7, w=4.7, size=17)

# 7 estrela
s = slide("Modelo estrela na Gold")
s.shapes.add_picture(str(ROOT / "docs/diagrams/star_schema.png"), Inches(1.5), Inches(1.5), height=Inches(5.2))

# 8-9 analises
s = slide("Resultados: indicadores")
card_grid(s, [("R$ 13,49 mi", "receita sem frete (receita não é lucro)"), ("96.096", "clientes únicos"), ("R$ 137,42", "ticket médio"),
              ("6,78 %", "pedidos entregues com atraso"), ("2,27 x 4,29", "nota média com atraso x no prazo"), ("3,04 %", "clientes que compraram mais de uma vez")])

s = slide("Receita por categoria e atraso por estado")
s.shapes.add_picture(str(ROOT / "reports/charts/01_top10_categorias_receita.png"), Inches(0.5), Inches(1.6), width=Inches(6.2))
s.shapes.add_picture(str(ROOT / "reports/charts/02_pct_atraso_uf.png"), Inches(6.8), Inches(1.6), width=Inches(6.2))

s = slide("Atraso, frete e recompra")
s.shapes.add_picture(str(ROOT / "reports/charts/03_nota_media_atraso.png"), Inches(0.5), Inches(1.6), width=Inches(3.9))
s.shapes.add_picture(str(ROOT / "reports/charts/04_frete_medio_uf.png"), Inches(4.6), Inches(1.6), width=Inches(3.9))
s.shapes.add_picture(str(ROOT / "reports/charts/05_clientes_recorrentes.png"), Inches(8.8), Inches(1.6), width=Inches(3.9))
text(s, LM, 5.35, 12, 1.5, ["O atraso derruba a nota em quase 2 pontos.", "Estados do Norte e Nordeste têm frete mais alto e mais atrasos.", "Só 3 % dos clientes recompram."], 15, gap=10)

# 10 dashboard
s = slide("Dashboard protegido por login")
s.shapes.add_picture(str(ROOT / "docs/relatorio/img/dashboard-geral.png"), Inches(LM), Inches(1.5), width=Inches(5.4))
s.shapes.add_picture(str(ROOT / "docs/relatorio/img/dashboard-d3.png"), Inches(6.5), Inches(1.5), width=Inches(5.4))
text(s, LM, 5.6, 12, 1.4, ["9 abas, filtro por estado, busca, tema claro e escuro e gráficos clicáveis.",
                            "Barras 3D da receita mensal (Three.js) e login com poliedro animado.",
                            "Senha com scrypt, cookie HttpOnly assinado com HMAC e dados em arquivo privado."], 15, gap=10)

# 10a projecao
s = slide("Projeção de receita: com cautela")
rows(s, [("Regressão linear nos próximos 12 meses", "Estimativa de R$ 12,9 mi, com faixa de 95% de R$ 8,2 mi a R$ 17,6 mi. Ajuste fraco (R² 0,23)."),
         ("Cenários para anos futuros, sem ML", "Ritmo de R$ 926 mil por mês com crescimento de -5%, 0% ou +15% ao ano. Em 2027: R$ 7,0 mi, R$ 11,1 mi ou R$ 39,1 mi."),
         ("Só 20 meses de histórico", "A margem de erro é grande e cresce com o horizonte. O painel avisa isso em destaque."),
         ("Sem custos nos dados", "Projetamos receita, pedidos, frete e total pago. Gastos e lucro da operação não são possíveis.")], lead_size=19, body_size=14)

# 10c cadeia 3D e Olli
s = slide("Cadeia 3D e assistente Olli")
rows(s, [("Supply chain em 3D", "Vendedor, marketplace, pagamento, distribuição, cliente e avaliação, com caminhão, pacotes e colunas de gasto."),
         ("Frete: cerca de 14% do total pago", "R$ 2,2 mi de R$ 16,0 mi pagos pelos clientes. Só existe o que os dados trazem: sem indústria nem estoque."),
         ("Olli responde só com os dados históricos", "Busca trechos relevantes (RAG) e, se não houver o dado, avisa que não sabe."),
         ("Projeções também na Olli", "Mesmo módulo da aba Projeção, sempre com a ressalva de incerteza.")], lead_size=19, body_size=14)

# 10b deploy, login e IA
s = slide("Deploy, login e uso de IA")
rows(s, [("Deploy na Vercel: data-engineer-challenge.vercel.app", "Frontend estático em public/ e funções Node em api/, publicados a cada push no GitHub (branch main)."),
         ("Login com usuário e senha (ambiente de teste)", "Usuário: bemol    Senha: bemol@2026    Senha verificada com scrypt; sessão em cookie HttpOnly assinado com HMAC."),
         ("Dados protegidos", "O JSON de dados fica em arquivo privado e só sai por /api/data com sessão válida (sem sessão: 401)."),
         ("IA como apoio, com revisão humana", "Claude Code na documentação e na interface do dashboard. A assistente Olli responde só com os dados do histórico.")], lead_size=19, body_size=14)

# 11 conclusoes
s = slide("Conclusões e próximos passos")
rows(s, [("Base confiável", "Regras auditáveis, camadas separadas e nenhum dado inventado."),
         ("Alavancas de negócio", "Reduzir atrasos (impacto direto na nota) e estimular a recompra."),
         ("Próximos passos", "Orquestração (Airflow ou Dagster), testes de dados automatizados e carga incremental."),
         ("Projeção com cautela", "Cenários e regressão linear nos próximos 12 meses, sempre com a margem de erro à vista.")])

# 12 encerramento
s = slide("", dark=True)
s.shapes.add_picture(str(LOGO_W), Inches(4.2), Inches(1.85), width=Inches(4.9))
text(s, 0, 3.8, 13.333, 1, "Obrigada!", 48, True, WHITE, PP_ALIGN.CENTER)
text(s, 0, 4.9, 13.333, 0.8, "Juliana Ballin Lima | github.com/JulianaBallin/data-engineer-challenge", 18, color=ORANGE, align=PP_ALIGN.CENTER)

pptx = OUT / "apresentacao-olist.pptx"
prs.save(pptx)
subprocess.run(["soffice", "--headless", "--convert-to", "pdf", "--outdir", str(OUT), str(pptx)], check=True, capture_output=True)
print("[slides]", pptx, "e PDF")
