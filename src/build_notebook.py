"""Gera e executa notebooks/exploratory_analysis.ipynb (conclusões calculadas a partir dos dados)."""
import nbformat as nbf
from nbclient import NotebookClient

from config import ROOT

md, code = nbf.v4.new_markdown_cell, nbf.v4.new_code_cell
cells = [
md("""# Análise Exploratória: Olist (Data Warehouse DuckDB)

Dez perguntas, duas por tópico (Vendas, Logística, Satisfação, Financeiro, Clientes e pagamentos), cada uma com **consulta SQL**,
**gráfico** e **conclusão de negócio**. As consultas ficam em `sql/analytics.sql` e rodam sobre a camada **gold**.
Os textos de conclusão são gerados a partir dos resultados, para nunca divergirem dos dados.

**Receita = soma de `price` (sem frete) de pedidos não cancelados/indisponíveis. Receita não é lucro: o dataset não tem custos.**

> Para executar do zero: `make run` (cria o ambiente, instala as dependências, roda o ETL e este notebook) ou abra no Jupyter/Colab
> depois de `python src/pipeline.py`."""),

md("""## Justificativa da modelagem

O warehouse tem **três camadas** (bronze, silver e gold) e a gold é um **modelo estrela**:

- **Bronze** guarda a cópia fiel dos 9 CSVs (tudo `VARCHAR`), para rastrear qualquer número até a origem.
- **Silver** limpa e tipa (datas, valores, duplicidades, categorias traduzidas) com 21 regras documentadas em `docs/data_quality.md`.
- **Gold** organiza em **fatos** (`fact_order_items`, `fact_payments` e a derivada `fact_orders`, com `delivery_days`, `delay_days` e `is_late`)
  e **dimensões** (`dim_customer`, `dim_seller`, `dim_product`, `dim_date`).

**Por quê:** separar as camadas torna cada transformação auditável e reexecutável. O modelo estrela simplifica as consultas
(poucos joins, nomes de negócio) e evita erros de duplicação de linhas, como a avaliação repetida por pedido ou várias coordenadas por CEP."""),

code("""import re, sys
from pathlib import Path
import duckdb, matplotlib.pyplot as plt
from IPython.display import Markdown, display

ROOT = Path.cwd().parent if Path.cwd().name == "notebooks" else Path.cwd()
CHARTS = ROOT / "reports" / "charts"; CHARTS.mkdir(parents=True, exist_ok=True)
con = duckdb.connect(str(ROOT / "data/warehouse/olist.duckdb"), read_only=True)
QUERIES = dict(re.findall(r"-- name: (\\w+)\\n(.*?)(?=\\n-- name:|\\Z)", (ROOT / "sql/analytics.sql").read_text(), re.S))
plt.rcParams.update({"figure.figsize": (9, 4.5), "axes.spines.top": False, "axes.spines.right": False})

def q(name):
    sql = QUERIES[name]; print(sql.strip()); return con.execute(sql).df()
def save(fig, name):
    fig.tight_layout(); fig.savefig(CHARTS / f"{name}.png", dpi=130); plt.show()
def conclusao(*linhas):
    display(Markdown(("**Conclusão de negócio**\\n\\n" + "\\n".join(f"- {l}" for l in linhas)).replace("$", "\\\\$")))"""),

# ---------------- Tópico 1: Vendas ----------------
md("## Tópico 1: Vendas\n\n### 1a. Quais são as 10 categorias com maior receita?"),
code("""df = q("q1_top10_categorias_receita"); display(df)
fig, ax = plt.subplots(); ax.barh(df.categoria[::-1], df.receita[::-1], color="#2a6f97")
ax.set_xlabel("Receita (R$)"); ax.set_title("Top 10 categorias por receita"); save(fig, "01a_top10_categorias_receita")
tot = con.execute("SELECT sum(price) FROM gold.fact_order_items WHERE is_revenue").fetchone()[0]
top3 = df.receita.head(3).sum()
conclusao(f"A categoria líder é **{df.categoria[0]}**, com R$ {df.receita[0]:,.0f}.",
          f"As 3 maiores categorias somam {100*top3/float(tot):.1f}% da receita total (R$ {float(tot):,.0f}).",
          "A receita é concentrada em poucas categorias: ações de estoque e marketing devem priorizá-las.")"""),

md("### 1b. Como a receita total varia mês a mês?"),
code("""df = q("q1b_receita_mensal"); display(df)
fig, ax = plt.subplots(figsize=(11, 4.5)); ax.plot(df.mes, df.receita, marker="o", color="#2a6f97")
ax.fill_between(df.mes, df.receita, alpha=.12, color="#2a6f97"); ax.set_ylabel("Receita (R$)"); ax.set_title("Receita mensal (jan/2017 a ago/2018)")
ax.tick_params(axis="x", rotation=60); save(fig, "01b_receita_mensal")
pico = df.loc[df.receita.idxmax()]; h = df.query("mes >= '2018-01'")
conclusao(f"A receita cresceu de R$ {df.receita.iloc[0]:,.0f} em {df.mes.iloc[0]} para R$ {df.receita.iloc[-1]:,.0f} em {df.mes.iloc[-1]}.",
          f"O pico foi em **{pico.mes}** (R$ {pico.receita:,.0f}), mês da Black Friday.",
          f"Em 2018 a receita se estabiliza em torno de R$ {h.receita.mean():,.0f} por mês: o ritmo de expansão desacelerou.")"""),

# ---------------- Tópico 2: Logística ----------------
md("## Tópico 2: Logística\n\n### 2a. Qual o tempo médio de entrega, em dias, por estado?"),
code("""df = q("q2a_prazo_uf"); display(df)
fig, ax = plt.subplots(figsize=(11, 4.5)); ax.bar(df.uf, df.dias, color="#2a9d8f")
ax.axhline(float(con.execute("SELECT avg(delivery_days) FROM gold.fact_orders").fetchone()[0]), color="k", ls="--", label="Média geral")
ax.set_ylabel("Dias até a entrega"); ax.set_title("Tempo médio de entrega por UF do cliente"); ax.legend(); save(fig, "02a_prazo_medio_uf")
geral = float(con.execute("SELECT avg(delivery_days) FROM gold.fact_orders").fetchone()[0])
conclusao(f"O prazo médio nacional é de {geral:.1f} dias.",
          f"A entrega mais lenta é em **{df.uf.iloc[0]}** ({df.dias.iloc[0]:.1f} dias) e a mais rápida em **{df.uf.iloc[-1]}** ({df.dias.iloc[-1]:.1f} dias).",
          "Estados distantes dos centros de distribuição esperam bem mais; vale avaliar centros regionais ou transportadoras locais.")"""),

md("### 2b. Qual a porcentagem de pedidos entregues com atraso?"),
code("""df = q("q2_pct_atraso"); display(df)
g = df[df.uf.notna()].sort_values("pct_atraso", ascending=False)
glob = df[df.uf.isna()].iloc[0]
fig, ax = plt.subplots(figsize=(11, 4.5)); ax.bar(g.uf, g.pct_atraso, color="#c1121f")
ax.axhline(glob.pct_atraso, color="k", ls="--", label=f"Média geral {glob.pct_atraso:.1f}%")
ax.set_ylabel("% pedidos com atraso"); ax.set_title("Pedidos entregues com atraso, por UF do cliente")
ax.legend(); save(fig, "02b_pct_atraso_uf")
conclusao(f"{glob.pct_atraso:.1f}% dos {int(glob.pedidos_entregues):,} pedidos entregues chegaram após a data estimada.",
          f"A UF com maior atraso é **{g.uf.iloc[0]}** ({g.pct_atraso.iloc[0]:.1f}%); a menor é **{g.uf.iloc[-1]}** ({g.pct_atraso.iloc[-1]:.1f}%).",
          "Estados com atraso acima da média pedem revisão de transportadoras ou de prazos prometidos.")"""),

# ---------------- Tópico 3: Satisfação ----------------
md("## Tópico 3: Satisfação do cliente\n\n### 3a. Como se distribuem as notas de 1 a 5?"),
code("""df = q("q3a_distribuicao_notas"); display(df)
fig, ax = plt.subplots(figsize=(7, 4.5)); b = ax.bar(df.nota.astype(str), df.pedidos, color=["#c1121f", "#e76f51", "#e9c46a", "#8ab17d", "#2a9d8f"])
for r, p in zip(b, df.pct): ax.text(r.get_x() + r.get_width() / 2, r.get_height(), f"{p:.1f}%", ha="center", va="bottom")
ax.set_xlabel("Nota"); ax.set_ylabel("Pedidos"); ax.set_title("Distribuição das notas de avaliação"); save(fig, "03a_distribuicao_notas")
pc = df.set_index("nota").pct
conclusao(f"A nota 5 é a mais comum ({pc[5]:.1f}% das avaliações) e a nota 4 vem em seguida ({pc[4]:.1f}%).",
          f"A distribuição tem formato de J: a maioria está satisfeita, mas {pc[1]+pc[2]:.1f}% dos clientes deram nota 1 ou 2.",
          "Entender as causas das notas 1 (atraso, produto errado) é o caminho mais curto para subir a média.")"""),

md("### 3b. Pedidos atrasados têm nota média menor que os entregues no prazo?"),
code("""df = q("q3_nota_atraso"); display(df)
fig, ax = plt.subplots(figsize=(5, 4.5)); ax.bar(df.situacao, df.nota_media, color=["#c1121f", "#2a9d8f"])
ax.set_ylim(0, 5); ax.set_ylabel("Nota média (1 a 5)"); ax.set_title("Nota média: atraso vs. no prazo")
for i, v in enumerate(df.nota_media): ax.text(i, v + .05, f"{v:.2f}", ha="center")
save(fig, "03b_nota_media_atraso")
a = df.set_index("situacao").nota_media
conclusao(f"Pedidos com atraso têm nota média {a['Com atraso']:.2f} contra {a['No prazo']:.2f} dos entregues no prazo "
          f"(diferença de {a['No prazo']-a['Com atraso']:.2f} ponto(s)).",
          "O atraso está associado a pior satisfação; é correlação, outros fatores também influenciam a nota.",
          "Reduzir atrasos é uma alavanca direta para melhorar a avaliação dos clientes.")"""),

# ---------------- Tópico 4: Financeiro ----------------
md("## Tópico 4: Financeiro\n\n### 4a. Qual a receita por categoria e sua participação no total?"),
code("""df = q("q4a_receita_share_categoria"); display(df.head(15))
top = df.head(10).copy(); outras = df.iloc[10:]
top.loc[len(top)] = ["outras categorias", outras.receita.sum(), outras.pct.sum()]
fig, ax = plt.subplots(figsize=(10, 5)); cores = ["#2a6f97"] * 10 + ["#adb5bd"]
b = ax.barh(top.categoria[::-1], top.pct[::-1], color=cores[::-1])
for r, p, v in zip(b, top.pct[::-1], top.receita[::-1]): ax.text(r.get_width() + .2, r.get_y() + r.get_height() / 2, f"{p:.1f}%  (R$ {v/1e6:.2f} mi)", va="center", fontsize=8)
ax.set_xlabel("Participação na receita total (%)"); ax.set_xlim(0, top.pct.max() * 1.35); ax.set_title("Receita por categoria e participação no total"); save(fig, "04a_receita_share_categoria")
conclusao(f"As 10 maiores categorias respondem por {df.pct.head(10).sum():.1f}% da receita; as outras {len(df)-10} dividem {outras.pct.sum():.1f}%.",
          f"Nenhuma categoria passa de {df.pct.iloc[0]:.1f}% do total: a receita é pulverizada, sem dependência de um único segmento.",
          "A cauda longa de categorias pequenas sugere priorizar sortimento e estoque nas 10 primeiras, sem abandonar as demais.")"""),

md("### 4b. Qual o valor médio do frete por estado do cliente?"),
code("""df = q("q4_frete_medio_uf"); display(df)
fig, ax = plt.subplots(figsize=(11, 4.5)); ax.bar(df.uf, df.frete_medio, color="#e9a820")
ax.set_ylabel("Frete médio por item (R$)"); ax.set_title("Frete médio por UF do cliente"); save(fig, "04b_frete_medio_uf")
conclusao(f"O frete médio mais alto é em **{df.uf.iloc[0]}** (R$ {df.frete_medio.iloc[0]:.2f}) e o mais baixo em **{df.uf.iloc[-1]}** (R$ {df.frete_medio.iloc[-1]:.2f}).",
          "Diferença regional relevante no custo de entrega pode afetar conversão e competitividade nesses estados.",
          "Frete é valor por item; não é custo logístico real da operação.")"""),

# ---------------- Tópico 5: Clientes e pagamentos ----------------
md("## Tópico 5: Clientes e pagamentos\n\n### 5a. Qual a porcentagem de clientes que compraram mais de uma vez?"),
code("""df = q("q5_clientes_recorrentes"); display(df)
fig, ax = plt.subplots(figsize=(5, 5)); ax.pie(df.clientes, labels=df.perfil, autopct="%1.1f%%", colors=["#2a6f97", "#e9a820"])
ax.set_title("Clientes por recorrência de compra"); save(fig, "05a_clientes_recorrentes")
r = df.set_index("perfil").pct
conclusao(f"Apenas {r['Mais de uma compra']:.1f}% dos clientes compraram mais de uma vez.",
          "A base é dominada por compradores de uma única compra: há pouca retenção.",
          "Campanhas de recompra e pós-venda têm grande espaço de crescimento.")"""),

md("### 5b. Quais os meios de pagamento mais usados?"),
code("""df = q("q5b_meios_pagamento"); display(df)
fig, ax = plt.subplots(figsize=(8, 4.5)); b = ax.bar(df.tipo, df.pagamentos, color=["#2a6f97", "#e9a820", "#2a9d8f", "#c3a2ff", "#8b929a"][:len(df)])
for r, p in zip(b, df.pct): ax.text(r.get_x() + r.get_width() / 2, r.get_height(), f"{p:.1f}%", ha="center", va="bottom")
ax.set_ylabel("Pagamentos"); ax.set_title("Meios de pagamento mais usados"); save(fig, "05b_meios_pagamento")
conclusao(f"O meio mais usado é **{df.tipo[0]}**, com {df.pct[0]:.1f}% dos pagamentos, seguido de **{df.tipo[1]}** ({df.pct[1]:.1f}%).",
          f"Juntos, os dois somam {df.pct[0]+df.pct[1]:.1f}% dos pagamentos; voucher e débito são marginais.",
          "A forte presença do cartão de crédito indica importância do parcelamento e de acordos com adquirentes.")"""),

md("""## Limitações dos dados

- Não há **custo do produto** nem margem: toda análise é de **receita**, nunca de lucro.
- O dataset é uma amostra de um marketplace (2016 a 2018), não a operação completa de um varejista.
- Valores ausentes não foram imputados; pedidos sem data de entrega ficam sem prazo.
- Detalhes das regras de qualidade: `docs/data_quality.md`."""),
]
nb = nbf.v4.new_notebook(cells=cells, metadata={"kernelspec": {"name": "python3", "display_name": "Python 3", "language": "python"}})
path = ROOT / "notebooks" / "exploratory_analysis.ipynb"
NotebookClient(nb, timeout=300, resources={"metadata": {"path": str(path.parent)}}).execute()
nbf.write(nb, path)
print("notebook salvo em", path)
