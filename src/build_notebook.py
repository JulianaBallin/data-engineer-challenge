"""Gera e executa notebooks/exploratory_analysis.ipynb (conclusões calculadas a partir dos dados)."""
import nbformat as nbf
from nbclient import NotebookClient

from config import ROOT

md, code = nbf.v4.new_markdown_cell, nbf.v4.new_code_cell
cells = [
md("""# Análise Exploratória — Olist (Data Warehouse DuckDB)

Cinco perguntas, uma por tópico. As consultas SQL ficam em `sql/analytics.sql` e rodam sobre a camada **gold**.
Os textos de conclusão são gerados a partir dos resultados, para nunca divergirem dos dados.
**Receita = soma de `price` (sem frete) de pedidos não cancelados/indisponíveis; não é lucro.**"""),
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
    display(Markdown("**Conclusão de negócio**\\n\\n" + "\\n".join(f"- {l}" for l in linhas)))"""),

md("## 1. Vendas — Quais são as 10 categorias com maior receita?"),
code("""df = q("q1_top10_categorias_receita"); display(df)
fig, ax = plt.subplots(); ax.barh(df.categoria[::-1], df.receita[::-1], color="#2a6f97")
ax.set_xlabel("Receita (R$)"); ax.set_title("Top 10 categorias por receita"); save(fig, "01_top10_categorias_receita")
tot = con.execute("SELECT sum(price) FROM gold.fact_order_items WHERE is_revenue").fetchone()[0]
top3 = df.receita.head(3).sum()
conclusao(f"A categoria líder é **{df.categoria[0]}**, com R$ {df.receita[0]:,.0f}.",
          f"As 3 maiores categorias somam {100*top3/float(tot):.1f}% da receita total (R$ {float(tot):,.0f}).",
          "A receita é concentrada em poucas categorias: ações de estoque e marketing devem priorizá-las.")"""),

md("## 2. Logística — Qual a porcentagem de pedidos entregues com atraso?"),
code("""df = q("q2_pct_atraso"); display(df)
g = df[df.uf.notna()].sort_values("pct_atraso", ascending=False)
glob = df[df.uf.isna()].iloc[0]
fig, ax = plt.subplots(figsize=(11, 4.5)); ax.bar(g.uf, g.pct_atraso, color="#c1121f")
ax.axhline(glob.pct_atraso, color="k", ls="--", label=f"Média geral {glob.pct_atraso:.1f}%")
ax.set_ylabel("% pedidos com atraso"); ax.set_title("Pedidos entregues com atraso, por UF do cliente")
ax.legend(); save(fig, "02_pct_atraso_uf")
conclusao(f"{glob.pct_atraso:.1f}% dos {int(glob.pedidos_entregues):,} pedidos entregues chegaram após a data estimada.",
          f"A UF com maior atraso é **{g.uf.iloc[0]}** ({g.pct_atraso.iloc[0]:.1f}%); a menor é **{g.uf.iloc[-1]}** ({g.pct_atraso.iloc[-1]:.1f}%).",
          "Estados com atraso acima da média pedem revisão de transportadoras ou de prazos prometidos.")"""),

md("## 3. Satisfação — Pedidos atrasados têm nota média menor?"),
code("""df = q("q3_nota_atraso"); display(df)
fig, ax = plt.subplots(figsize=(5, 4.5)); ax.bar(df.situacao, df.nota_media, color=["#c1121f", "#2a9d8f"])
ax.set_ylim(0, 5); ax.set_ylabel("Nota média (1–5)"); ax.set_title("Nota média: atraso vs. no prazo")
for i, v in enumerate(df.nota_media): ax.text(i, v + .05, f"{v:.2f}", ha="center")
save(fig, "03_nota_media_atraso")
a = df.set_index("situacao").nota_media
conclusao(f"Pedidos com atraso têm nota média {a['Com atraso']:.2f} contra {a['No prazo']:.2f} dos entregues no prazo "
          f"(diferença de {a['No prazo']-a['Com atraso']:.2f} ponto(s)).",
          "O atraso está associado a pior satisfação; é correlação, outros fatores também influenciam a nota.",
          "Reduzir atrasos é uma alavanca direta para melhorar a avaliação dos clientes.")"""),

md("## 4. Financeiro — Qual o valor médio do frete por estado do cliente?"),
code("""df = q("q4_frete_medio_uf"); display(df)
fig, ax = plt.subplots(figsize=(11, 4.5)); ax.bar(df.uf, df.frete_medio, color="#e9a820")
ax.set_ylabel("Frete médio por item (R$)"); ax.set_title("Frete médio por UF do cliente"); save(fig, "04_frete_medio_uf")
conclusao(f"O frete médio mais alto é em **{df.uf.iloc[0]}** (R$ {df.frete_medio.iloc[0]:.2f}) e o mais baixo em **{df.uf.iloc[-1]}** (R$ {df.frete_medio.iloc[-1]:.2f}).",
          "Diferença regional relevante no custo de entrega pode afetar conversão e competitividade nesses estados.",
          "Frete é valor por item; não é custo logístico real da operação.")"""),

md("## 5. Clientes — Qual a porcentagem de clientes que compraram mais de uma vez?"),
code("""df = q("q5_clientes_recorrentes"); display(df)
fig, ax = plt.subplots(figsize=(5, 5)); ax.pie(df.clientes, labels=df.perfil, autopct="%1.1f%%", colors=["#2a6f97", "#e9a820"])
ax.set_title("Clientes por recorrência de compra"); save(fig, "05_clientes_recorrentes")
r = df.set_index("perfil").pct
conclusao(f"Apenas {r['Mais de uma compra']:.1f}% dos clientes compraram mais de uma vez.",
          "A base é dominada por compradores de uma única compra: há pouca retenção.",
          "Campanhas de recompra e pós-venda têm grande espaço de crescimento.")"""),
]
nb = nbf.v4.new_notebook(cells=cells, metadata={"kernelspec": {"name": "python3", "display_name": "Python 3", "language": "python"}})
path = ROOT / "notebooks" / "exploratory_analysis.ipynb"
NotebookClient(nb, timeout=300, resources={"metadata": {"path": str(path.parent)}}).execute()
nbf.write(nb, path)
print("notebook salvo em", path)
