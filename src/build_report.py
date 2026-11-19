"""Gera o relatório técnico em PDF (HTML renderizado pelo Chrome headless), com sumário paginado em duas passadas."""
import base64
import json
import re
import subprocess
from html import escape

from config import CHARTS_DIR, DOCS_DIR, ROOT, SQL_DIR

REL = DOCS_DIR / "relatorio"
HTML, PDF = REL / "relatorio-tecnico-olist.html", REL / "relatorio-tecnico-olist.pdf"
D = json.loads((ROOT / "api" / "_data" / "dashboard.json").read_text(encoding="utf-8"))
brl = lambda v, d=0: f"R$ {v:,.{d}f}".replace(",", "X").replace(".", ",").replace("X", ".")
num = lambda v, d=0: f"{v:,.{d}f}".replace(",", "X").replace(".", ",").replace("X", ".")


def img(path, cap, width="100%"):
    b = base64.b64encode(path.read_bytes()).decode()
    mime = "image/svg+xml" if path.suffix == ".svg" else "image/png"
    return f'<figure><img src="data:{mime};base64,{b}" style="width:{width}"><figcaption>{escape(cap)}</figcaption></figure>'


def dq_rows():
    rows = []
    for line in (DOCS_DIR / "data_quality.md").read_text(encoding="utf-8").splitlines():
        m = re.match(r"\| (\d+) \| (.+?) \| (.+?) \| (.+?) \| ([\d,]+) \| (.+?) \|$", line)
        if m:
            rows.append(m.groups())
    return rows


def volumes():
    rows = []
    for line in (DOCS_DIR / "data_quality.md").read_text(encoding="utf-8").splitlines():
        m = re.match(r"\| (\w+) \| ([\d,]+) \| ([\d,]+) \| ([\d,]+) \|$", line)
        if m:
            rows.append(m.groups())
    return rows


def table(head, rows, cls=""):
    th = "".join(f"<th>{escape(h)}</th>" for h in head)
    tr = "".join("<tr>" + "".join(f"<td>{escape(str(c))}</td>" for c in r) + "</tr>" for r in rows)
    return f'<table class="{cls}"><thead><tr>{th}</tr></thead><tbody>{tr}</tbody></table>'


def sql_of(name):
    m = re.search(rf"-- name: {name}\n(.*?)(?=\n-- name:|\Z)", (SQL_DIR / "analytics.sql").read_text(encoding="utf-8"), re.S)
    return f"<pre>{escape(m.group(1).strip())}</pre>"


def build_sections():
    k = D["kpis"][0]
    t = D["q1_top10_categorias_receita"]; share = D["categorias_share"]
    a = D["q2_pct_atraso"]; glob = next(r for r in a if r["uf"] is None)
    ufs = sorted((r for r in a if r["uf"]), key=lambda r: -r["pct_atraso"])
    n = {r["situacao"]: r["nota_media"] for r in D["q3_nota_atraso"]}
    f = D["q4_frete_medio_uf"]
    rec = {r["perfil"]: r for r in D["q5_clientes_recorrentes"]}
    pg = D["pagamentos"]; tot_pg = sum(p["pagamentos"] for p in pg)
    top3 = sum(r["receita"] for r in t[:3])
    pay_top = pg[0]
    ch = lambda n_, c: img(CHARTS_DIR / n_, c, "88%")
    dq = dq_rows()
    S = []  # (id, titulo, html)

    S.append(("s1", "1 Introdução", f"""
<p>O comércio eletrônico brasileiro gera grandes volumes de dados sobre pedidos, pagamentos, entregas e avaliações. Para que esses dados sustentem decisões, eles precisam ser organizados, limpos e documentados. Este relatório apresenta o desenvolvimento de um pipeline ETL reproduzível sobre o <i>Brazilian E-Commerce Public Dataset by Olist</i>, com um mini Data Warehouse em DuckDB, cinco análises exploratórias e um dashboard web protegido por login.</p>
<p>O trabalho foi realizado como desafio técnico para a vaga de Data Engineer I na Bemol Digital. A solução cobre extração, transformação, carga, regras de qualidade, modelagem em camadas, visualização e publicação.</p>"""))

    S.append(("s2", "2 Problema e objetivos", f"""
<h3>2.1 Problema</h3>
<p>Os nove arquivos CSV do Olist chegam sem tipagem, com duplicidades, datas em texto, categorias em português sem tradução completa e coordenadas repetidas milhares de vezes. Como transformar esse material bruto em informação confiável, rastreável e pronta para responder perguntas de negócio?</p>
<h3>2.2 Objetivo geral</h3>
<p>Construir um pipeline de engenharia de dados simples, organizado e reproduzível, que parta dos arquivos originais e entregue tabelas analíticas, gráficos e conclusões de negócio.</p>
<h3>2.3 Objetivos específicos</h3>
<ul><li>Preservar os dados originais em uma camada RAW.</li><li>Tratar nulos, duplicidades, tipos, datas e inconsistências, documentando cada decisão.</li><li>Traduzir as categorias de produtos.</li><li>Criar ao menos uma tabela derivada com métricas calculadas.</li><li>Carregar um mini Data Warehouse com modelagem justificada.</li><li>Responder uma pergunta de cada um dos cinco tópicos, com SQL, resultado, gráfico e conclusão.</li><li>Publicar um dashboard interativo com autenticação.</li></ul>
<h3>2.4 Escopo</h3>
<p>Dentro do escopo: pipeline, warehouse, qualidade, análises e dashboard. Fora do escopo: previsão, modelos de machine learning e qualquer inferência de lucro, pois o dataset não possui custos.</p>"""))

    S.append(("s3", "3 Fonte de dados", f"""
<p>O dataset é público, disponibilizado no Kaggle pela Olist (licença CC BY-NC-SA 4.0). Ele cobre pedidos de 2016 a 2018 em marketplaces brasileiros.</p>
{table(["Arquivo", "Conteúdo", "Linhas"], [("olist_orders_dataset", "Pedidos, status e datas", "99.441"), ("olist_order_items_dataset", "Itens, preço e frete", "112.650"), ("olist_order_payments_dataset", "Pagamentos", "103.886"), ("olist_order_reviews_dataset", "Avaliações", "99.224"), ("olist_customers_dataset", "Clientes", "99.441"), ("olist_products_dataset", "Produtos", "32.951"), ("olist_sellers_dataset", "Vendedores", "3.095"), ("olist_geolocation_dataset", "Coordenadas por CEP", "1.000.163"), ("product_category_name_translation", "Tradução das categorias", "71")])}
<p>Fonte: https://www.kaggle.com/datasets/olistbr/brazilian-ecommerce</p>"""))

    S.append(("s4", "4 Arquitetura", f"""
<p>O fluxo vai do CSV original até o dashboard. A camada RAW nunca é alterada; o Transform produz tabelas tratadas em Parquet; o Load constrói o warehouse DuckDB com as camadas bronze, silver e gold; análises e dashboard consomem a gold.</p>
{img(DOCS_DIR / "diagrams" / "architecture.svg", "Figura 1: arquitetura geral do projeto.")}
<h3>4.1 Tecnologias</h3>
{table(["Tecnologia", "Aplicação"], [("Python 3.12 e pandas", "Extração, limpeza e transformação"), ("DuckDB", "Data Warehouse analítico em arquivo único"), ("SQL", "Modelagem e consultas analíticas"), ("Matplotlib e Jupyter", "Análise exploratória e gráficos"), ("Chart.js e Three.js", "Dashboard e cenas 3D no navegador"), ("Vercel Functions (Node.js)", "Login e API protegida"), ("Git e GitHub", "Versionamento e hospedagem")])}"""))

    S.append(("s5", "5 Implementação do pipeline", f"""
<h3>5.1 Extract</h3>
<p>O módulo <code>extract.py</code> valida a presença dos nove arquivos e os lê integralmente como texto. A tipagem fica explícita no Transform, o que evita conversões silenciosas e preserva o dado original.</p>
<h3>5.2 Transform</h3>
<p>O módulo <code>transform.py</code> aplica uma função de limpeza por tabela e registra cada correção em um objeto <code>QualityLog</code>, que gera automaticamente o documento de regras de qualidade a cada execução. Isso garante rastreabilidade: o documento nunca diverge do código.</p>
<h3>5.3 Load</h3>
<p>O módulo <code>load.py</code> recria o warehouse do zero (pipeline idempotente), executa <code>sql/schema.sql</code> e <code>sql/gold.sql</code>, carrega a bronze a partir dos CSVs e a silver a partir dos arquivos Parquet.</p>
<h3>5.4 Volumetria</h3>
{table(["Tabela", "Linhas RAW", "Linhas silver", "Removidas"], volumes())}
<p>A redução da geolocalização (de 1.000.163 para 19.010 linhas) vem da agregação em uma linha por prefixo de CEP. Nas demais tabelas, as remoções foram mínimas e justificadas na seção 7.</p>"""))

    S.append(("s6", "6 Modelagem", f"""
<p>Foi adotada a <b>arquitetura em camadas (opção B)</b>, com um <b>modelo dimensional em estrela na camada gold</b>.</p>
{img(DOCS_DIR / "diagrams" / "medallion.svg", "Figura 2: camadas bronze, silver e gold.")}
<h3>6.1 Justificativa</h3>
<ul><li><b>Bronze</b> preserva o dado original e permite auditar qualquer transformação.</li><li><b>Silver</b> concentra a limpeza e a tipagem, reexecutável a qualquer momento.</li><li><b>Gold</b> expõe um modelo simples para análise, evitando duplicação de linhas em joins (uma avaliação por pedido, uma coordenada por CEP).</li></ul>
{img(DOCS_DIR / "diagrams" / "star_schema.svg", "Figura 3: modelo estrela da camada gold.")}
<h3>6.2 Tabela derivada</h3>
<p>A tabela <code>gold.fact_orders</code> possui uma linha por pedido e métricas calculadas: <code>delivery_days</code> (compra até entrega), <code>estimated_days</code>, <code>delay_days</code> (dias de atraso, zero se no prazo), <code>is_late</code>, <code>items_revenue</code>, <code>freight_total</code>, <code>payment_total</code> e <code>review_score</code> (avaliação mais recente do pedido). As métricas de prazo só existem para pedidos entregues, com data de entrega e cronologia válida. Nenhuma data é inventada.</p>"""))

    rows = "".join(f"<tr><td>{r[0]}</td><td>{escape(r[1])}</td><td>{escape(r[2])}</td><td>{escape(r[3])}</td><td class='n'>{r[4]}</td><td>{escape(r[5])}</td></tr>" for r in dq)
    S.append(("s7", "7 Qualidade dos dados", f"""
<p>Foram registradas {len(dq)} regras. Cada uma informa o problema, o tratamento, os registros afetados e a justificativa. O documento completo é gerado em <code>docs/data_quality.md</code>.</p>
<table class="dq"><thead><tr><th>#</th><th>Tabela</th><th>Problema</th><th>Tratamento</th><th>Reg.</th><th>Justificativa</th></tr></thead><tbody>{rows}</tbody></table>
<h3>7.1 Principais decisões</h3>
<ul><li><b>Sem imputação.</b> Nulos permanecem nulos. A única exceção é a categoria ausente, rotulada <i>desconhecida</i>.</li><li><b>Cronologia inconsistente</b> (189 pedidos) é sinalizada e excluída das métricas de prazo, sem correção por suposição.</li><li><b>Avaliações:</b> o <code>review_id</code> se repete em pedidos distintos; a gold usa uma avaliação por pedido (a mais recente).</li><li><b>Integridade referencial:</b> seis relacionamentos verificados, todos sem registros órfãos.</li></ul>"""))

    S.append(("s8", "8 Análise exploratória", f"""
<p>Foi escolhida uma pergunta por tópico. Receita é a soma de <code>price</code> (sem frete) de pedidos não cancelados ou indisponíveis e não deve ser lida como lucro. Os números abaixo vêm do warehouse e as conclusões são geradas pelo notebook a partir dos mesmos resultados.</p>
<h3>8.1 Vendas (1A): quais são as 10 categorias com maior receita?</h3>
{sql_of("q1_top10_categorias_receita")}
{ch("01_top10_categorias_receita.png", "Figura 4: top 10 categorias por receita.")}
{table(["Categoria", "Receita", "% do total"], [(r["categoria"], brl(r["receita"]), num(r["pct"], 2) + "%") for r in share])}
<p class="concl"><b>Conclusão.</b> A categoria líder é <i>{t[0]["categoria"]}</i> ({brl(t[0]["receita"])}). As três maiores somam {num(100*top3/k["receita"],1)}% da receita de {brl(k["receita"])}. A receita é concentrada em poucas categorias, o que orienta prioridades de estoque e marketing.</p>
<h3>8.2 Logística (2B): qual a porcentagem de pedidos entregues com atraso?</h3>
{sql_of("q2_pct_atraso")}
{ch("02_pct_atraso_uf.png", "Figura 5: pedidos atrasados por UF do cliente.")}
<p class="concl"><b>Conclusão.</b> {num(glob["pct_atraso"],1)}% dos {num(glob["pedidos_entregues"])} pedidos entregues chegaram após a data estimada. A UF com maior atraso é {ufs[0]["uf"]} ({num(ufs[0]["pct_atraso"],1)}%) e a menor é {ufs[-1]["uf"]} ({num(ufs[-1]["pct_atraso"],1)}%). Estados acima da média pedem revisão de transportadoras ou de prazos prometidos.</p>
<h3>8.3 Satisfação (3B): pedidos atrasados têm nota média menor?</h3>
{sql_of("q3_nota_atraso")}
{ch("03_nota_media_atraso.png", "Figura 6: nota média por situação de entrega.")}
<p class="concl"><b>Conclusão.</b> Pedidos com atraso têm nota média {num(n["Com atraso"],2)} contra {num(n["No prazo"],2)} dos entregues no prazo, diferença de {num(n["No prazo"]-n["Com atraso"],2)} ponto. O atraso está associado a pior satisfação (correlação, não causalidade). Reduzir atrasos é uma alavanca direta de avaliação.</p>
<h3>8.4 Financeiro (4B): qual o valor médio do frete por estado do cliente?</h3>
{sql_of("q4_frete_medio_uf")}
{ch("04_frete_medio_uf.png", "Figura 7: frete médio por item e UF.")}
<p class="concl"><b>Conclusão.</b> O frete médio é mais alto em {f[0]["uf"]} ({brl(f[0]["frete_medio"],2)}) e mais baixo em {f[-1]["uf"]} ({brl(f[-1]["frete_medio"],2)}). A diferença regional pode afetar conversão e competitividade. Frete é valor cobrado por item e não o custo logístico real.</p>
<h3>8.5 Clientes e pagamentos (5A): qual a porcentagem de clientes que compraram mais de uma vez?</h3>
{sql_of("q5_clientes_recorrentes")}
{ch("05_clientes_recorrentes.png", "Figura 8: clientes por recorrência (customer_unique_id).")}
<p class="concl"><b>Conclusão.</b> Apenas {num(rec["Mais de uma compra"]["pct"],1)}% dos clientes compraram mais de uma vez. A base é dominada por compras únicas, o que indica baixa retenção. O meio de pagamento mais usado é {pay_top["tipo"]} ({num(100*pay_top["pagamentos"]/tot_pg,1)}% dos pagamentos). Campanhas de recompra têm grande espaço de crescimento.</p>"""))

    S.append(("s9", "9 Dashboard e autenticação", f"""
<p>Os resultados do warehouse foram exportados para JSON e expostos em um dashboard interativo, com tema escuro e claro, abas por tópico, filtros, detalhamento por estado, contadores animados e um gráfico de barras 3D (Three.js) com rotação, zoom e dica ao passar o mouse.</p>
{img(REL / "img" / "dashboard-geral.png", "Figura 9: visão geral do dashboard.", "92%")}
{img(REL / "img" / "dashboard-d3.png", "Figura 10: receita mensal em barras 3D.", "92%")}
{img(REL / "img" / "dashboard-login.png", "Figura 11: tela de login com cena 3D.", "70%")}
<h3>9.1 Autenticação</h3>
<p>O Vercel hospeda apenas arquivos estáticos e funções; por isso um login feito só no navegador não protegeria os dados. A solução usa funções serverless: a senha é verificada com scrypt contra um hash guardado em variável de ambiente, e a sessão é um cookie HttpOnly, Secure e SameSite=Strict assinado com HMAC-SHA256 e expiração de 8 horas. Os dados ficam em arquivo privado (<code>api/_data</code>), fora da pasta pública, e só são entregues pela rota <code>/api/data</code> com sessão válida.</p>
{img(DOCS_DIR / "diagrams" / "auth_flow.svg", "Figura 12: fluxo de autenticação e acesso aos dados.")}"""))

    S.append(("s9b", "10 Projeção, cadeia 3D e assistente Olli", """
<h2>10.1 Projeção de receita</h2>
<p>A aba <b>Projeção</b> combina duas abordagens, ambas com o aviso explícito de que o histórico tem apenas 20 meses (jan/2017 a ago/2018).</p>
<ul><li><b>Regressão linear (próximos 12 meses):</b> mínimos quadrados sobre os últimos 12 meses, com intervalo de predição de 95%. O ajuste é fraco (R² de 0,23) e a faixa é larga: cerca de R$ 8,2 mi a R$ 17,6 mi no período, com estimativa central de R$ 12,9 mi.</li>
<li><b>Cenários anuais (não é aprendizado de máquina):</b> ritmo médio dos últimos 6 meses (cerca de R$ 926 mil por mês) com crescimento anual de -5%, 0% ou +15%. Para 2027 resultam em R$ 7,0 mi, R$ 11,1 mi e R$ 39,1 mi de receita, respectivamente. Pedidos, frete e total pago saem de razões observadas nos dados.</li></ul>
<p>O dataset não possui custos da empresa, portanto não se projetam gastos nem lucro: apenas receita, pedidos, frete e valor pago pelos clientes.</p>
<h2>10.2 Cadeia produtiva em 3D</h2>
<p>A aba <b>Cadeia 3D</b> representa o caminho do pedido (vendedor, marketplace, pagamento, distribuição, cliente e avaliação) com caminhão e pacotes em movimento e colunas proporcionais ao gasto (itens, total pago e frete estimado, cerca de 14% do pago). Só existe o que os dados trazem: não há indústria, produção nem estoque.</p>
<h2>10.3 Olli, assistente de dados (RAG)</h2>
<p>A Olli é um chat que responde apenas com base nos dados históricos. A API recupera os trechos mais relevantes dos agregados (base de conhecimento em <code>api/_kb.js</code>) e, se não houver o dado, informa que não sabe. Com a variável <code>ANTHROPIC_API_KEY</code> o Claude redige a resposta usando somente os trechos recuperados; sem ela, a Olli devolve os próprios trechos. Perguntas sobre projeção usam o mesmo módulo da aba Projeção e sempre trazem a ressalva de incerteza.</p>"""))

    S.append(("s10", "11 Testes e validação", f"""
{table(["Verificação", "Resultado"], [
 ("Pipeline completo com os dados reais (extract, transform, load)", "Executado sem erros; warehouse reconstruído do zero"),
 ("Integridade referencial (6 relacionamentos)", "0 registros órfãos"),
 ("Contagens bronze x silver x gold", "Consistentes com a volumetria da seção 5.4"),
 ("Notebook executado de ponta a ponta", "5 consultas e 5 gráficos gerados"),
 ("API sem cookie", "401 Não autenticado"),
 ("Login com senha incorreta", "401, com atraso contra força bruta"),
 ("Login correto", "200 e cookie HttpOnly assinado"),
 ("Cookie adulterado", "401"),
 ("Acesso direto ao arquivo de dados", "404"),
 ("Suíte de API (scripts/test-api.js): autenticação, dados, projeção e 12 perguntas à Olli", "28 verificações aprovadas, localmente e em produção"),
 ("Olli com perguntas fora do escopo (clima, esportes, injeção de instruções)", "Responde que não tem o dado"),
 ("Dashboard em Chrome headless (9 abas, incluindo WebGL), temas claro e escuro, desktop e celular", "Sem erros de JavaScript e sem rolagem horizontal")])}
<p>Antes de obter os dados reais, o pipeline também foi testado com dados sintéticos no mesmo esquema, que foram descartados.</p>"""))

    S.append(("s11", "12 Como executar", """
<pre>python3 -m venv .venv &amp;&amp; source .venv/bin/activate
pip install -r requirements.txt
kaggle datasets download -d olistbr/brazilian-ecommerce -p data/raw --unzip
python src/pipeline.py          # Extract, Transform e Load
python src/build_notebook.py    # análises e gráficos
python src/export_web.py        # JSON do dashboard
python src/build_diagrams.py    # diagramas
python src/build_report.py      # este relatório</pre>
<p>Para o dashboard local: <code>node scripts/dev-server.js</code> com as variáveis <code>AUTH_USER</code>, <code>AUTH_PASS_HASH</code> e <code>SESSION_SECRET</code> (gere o hash com <code>scripts/make-credentials.js</code>).</p>"""))

    S.append(("s12", "13 Limitações", """
<ul><li>O dataset é uma amostra pública de marketplace (2016 a 2018), não toda a operação de um varejista.</li><li>Receita não é lucro: não há custos de produtos.</li><li>Pedidos sem data de entrega não recebem prazo.</li><li>Os dados exportados ao dashboard são um instantâneo; não há atualização contínua.</li><li>A autenticação protege o acesso, mas há um único usuário e não há recuperação de senha.</li><li>A diferença de nota entre atrasados e no prazo é correlação, não prova de causa.</li></ul>"""))

    S.append(("s13", "14 Conclusão", f"""
<p>O projeto transformou {num(k["pedidos"])} pedidos brutos em um warehouse confiável, com {len(dq)} regras de qualidade documentadas, uma tabela derivada de métricas, cinco análises respondidas e um dashboard protegido. Os achados principais são a concentração de receita em poucas categorias ({num(100*top3/k["receita"],1)}% nas três maiores), o impacto do atraso na satisfação (nota {num(n["Com atraso"],2)} contra {num(n["No prazo"],2)}) e a baixa recompra ({num(rec["Mais de uma compra"]["pct"],1)}%).</p>
<p>Como próximos passos, sugerem-se testes automatizados de qualidade (por exemplo com dbt ou Great Expectations), orquestração agendada e um segundo usuário com perfis de acesso.</p>"""))

    S.append(("sref", "Referências", """
<ul><li>OLIST. Brazilian E-Commerce Public Dataset by Olist. Kaggle. Disponível em: https://www.kaggle.com/datasets/olistbr/brazilian-ecommerce.</li><li>DUCKDB. DuckDB Documentation. Disponível em: https://duckdb.org/docs.</li><li>KIMBALL, R.; ROSS, M. The Data Warehouse Toolkit. 3. ed. Wiley, 2013.</li><li>DATABRICKS. Medallion Architecture. Disponível em: https://www.databricks.com/glossary/medallion-architecture.</li><li>VERCEL. Vercel Functions. Disponível em: https://vercel.com/docs/functions.</li></ul>"""))

    S.append(("sapa", "Apêndice A: Uso de Inteligência Artificial", """
<p>Foi utilizado o <b>Claude Code (Anthropic)</b> como apoio à estruturação do projeto, à escrita do código do pipeline, das consultas SQL, do frontend, dos diagramas e da documentação, e à execução dos testes descritos na seção 10. As decisões técnicas, as regras de negócio e os resultados devem ser compreendidos e revisados pela autora antes da entrega.</p>"""))
    return S


CSS = """
@page { size: A4; margin: 22mm 18mm 20mm 18mm;
  @top-left { content: "Olist Data Engineering | Relatório técnico"; font: 8.5pt Helvetica, Arial, sans-serif; color: #7b8794; }
  @top-right { content: "Desafio Data Engineer I"; font: 8.5pt Helvetica, Arial, sans-serif; color: #7b8794; }
  @bottom-left { content: ""; background: url("@@LOGO@@") left center / contain no-repeat; width: 42mm; }
  @bottom-right { content: "Página " counter(page); font: 8.5pt Helvetica, Arial, sans-serif; color: #7b8794; } }
@page :first { margin: 0; @top-left { content: none } @top-right { content: none } @bottom-left { content: none } @bottom-right { content: none } }
* { box-sizing: border-box; }
body { font: 10.5pt/1.55 Helvetica, Arial, sans-serif; color: #1f2933; margin: 0; }
h1 { font-size: 19pt; color: #1f2933; border-bottom: 3px solid #e2761b; padding-bottom: 6px; margin: 22px 0 14px; } section.pb h1 { page-break-before: always; margin-top: 0; }
h1, h3 { break-after: avoid; } h2 { font-size: 14pt; } h3 { font-size: 11.5pt; color: #b85a0e; margin: 16px 0 6px; }
p { margin: 6px 0 9px; text-align: justify; } ul { margin: 4px 0 10px; padding-left: 20px; } li { margin: 2px 0; }
code { background: #f1f3f5; padding: 1px 4px; border-radius: 3px; font-size: 9pt; }
pre { background: #1f2933; color: #f1f3f5; padding: 10px 12px; border-radius: 6px; font: 8.2pt/1.45 "DejaVu Sans Mono", monospace; white-space: pre-wrap; page-break-inside: avoid; }
table { width: 100%; border-collapse: collapse; margin: 8px 0 12px; font-size: 9pt; page-break-inside: auto; }
th { background: #1f2933; color: #fff; text-align: left; padding: 5px 7px; } td { padding: 4px 7px; border-bottom: 1px solid #d9dee3; vertical-align: top; }
tr { page-break-inside: avoid; } tbody tr:nth-child(even) { background: #f7f8fa; }
table.dq { font-size: 7.6pt; } td.n { text-align: right; }
figure { margin: 10px 0; text-align: center; page-break-inside: avoid; } figure img { max-width: 100%; border: 1px solid #e1e5e9; border-radius: 4px; }
figcaption { font-size: 8.5pt; color: #617080; margin-top: 4px; }
.concl { background: #fff1e3; border-left: 4px solid #e2761b; padding: 8px 12px; border-radius: 4px; }
.cover { height: 297mm; position: relative; page-break-after: always; }
.cover .band { background: #1f2933; color: #fff; padding: 62mm 22mm 22mm; height: 190mm; }
.cover .kicker { letter-spacing: .25em; font-size: 9pt; color: #f6a45b; font-weight: 700; }
.cover h1b { display: block; font-size: 44pt; font-weight: 700; margin: 12mm 0 4mm; border-bottom: 4px solid #e2761b; padding-bottom: 6mm; width: 62%; }
.cover .sub { font-size: 17pt; margin-top: 8mm; max-width: 140mm; }
.cover .stripe { height: 7mm; background: #e2761b; }
.cover .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8mm 14mm; padding: 14mm 22mm; background: #fdf3e8; height: 100mm; }
.cover .meta b { display: block; font-size: 7.5pt; letter-spacing: .18em; color: #b85a0e; margin-bottom: 1mm; }
.toc { page-break-before: always; font-size: 10pt; } .toc h1 { margin-top: 0; }
.toc a { display: flex; color: inherit; text-decoration: none; padding: 3px 0; border-bottom: 1px dotted #c9d1d9; } .toc a span:first-child { flex: 1; } .toc a.sub { padding-left: 18px; font-size: 9.5pt; color: #52606d; }
"""


PB = {"s1", "s4", "s6", "s7", "s8", "s9", "sref"}


def logo_uri(white=False):
    import base64
    return "data:image/png;base64," + base64.b64encode((ROOT / ("assets/logo/bemol-digital-logo-branca.png" if white else "assets/logo/bemol-digital-logo.png")).read_bytes()).decode()


def render(pages):
    S = build_sections()
    toc = ""
    for sid, title, html in S:
        toc += f'<a href="#{sid}"><span>{escape(title)}</span><span>{pages.get(sid, "")}</span></a>'
    body = "".join(f'<section id="{sid}" class="{"pb" if sid in PB else ""}"><h1>{escape(title)}</h1>{html}</section>' for sid, title, html in S)
    return f"""<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório técnico: Olist Data Engineering</title><style>{CSS.replace("@@LOGO@@", logo_uri())}</style></head><body>
<div class="cover"><div class="band"><div style="width:58mm;position:absolute;top:16mm;right:22mm"><img src="{logo_uri(True)}" style="width:100%;display:block" alt="Bemol"></div><div class="kicker">RELATÓRIO TÉCNICO &nbsp;|&nbsp; DESAFIO DATA ENGINEER I</div>
<span class="h1b" style="display:block;font-size:40pt;font-weight:700;margin:12mm 0 4mm;border-bottom:4px solid #e2761b;padding-bottom:6mm;width:78%">Olist Data Engineering</span>
<div class="sub">Pipeline ETL, mini Data Warehouse em DuckDB, análise exploratória e dashboard 3D com autenticação</div></div><div class="stripe"></div>
<div class="meta"><div><b>EMPRESA</b>Bemol Digital</div><div><b>AUTORA</b>Juliana Ballin Lima</div><div><b>VAGA</b>Data Engineer I</div><div><b>DATASET</b>Brazilian E-Commerce Public Dataset by Olist</div><div><b>TECNOLOGIAS</b>Python, pandas, DuckDB, SQL, Chart.js, Three.js, Vercel</div><div><b>DATA</b>Novembro de 2026</div></div></div>
<div class="toc"><h1>Sumário</h1>{toc}</div>{body}</body></html>"""


def to_pdf():
    subprocess.run(["google-chrome", "--headless=new", "--no-sandbox", "--disable-gpu", "--no-pdf-header-footer",
                    f"--print-to-pdf={PDF}", f"file://{HTML}"], check=True, capture_output=True)


def find_pages(titles):
    pages = {}
    n = int(re.search(r"Pages:\s+(\d+)", subprocess.run(["pdfinfo", str(PDF)], capture_output=True, text=True).stdout).group(1))
    for p in range(3, n + 1):  # pula capa e sumário
        txt = subprocess.run(["pdftotext", "-f", str(p), "-l", str(p), str(PDF), "-"], capture_output=True, text=True).stdout
        lines = [l.strip() for l in txt.splitlines()]
        for sid, title in titles:
            if sid not in pages and title in lines:
                pages[sid] = p
    return pages


if __name__ == "__main__":
    HTML.write_text(render({}), encoding="utf-8"); to_pdf()
    pages = find_pages([(sid, t) for sid, t, _ in build_sections()])
    HTML.write_text(render(pages), encoding="utf-8"); to_pdf()
    print(f"[report] {PDF.relative_to(ROOT)} ({len(pages)} seções paginadas)")
