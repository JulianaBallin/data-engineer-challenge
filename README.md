# Desafio Técnico — Data Engineer I | Bemol Digital

Pipeline ETL e análise exploratória do [Brazilian E-Commerce Public Dataset by Olist](https://www.kaggle.com/datasets/olistbr/brazilian-ecommerce/data),
com mini Data Warehouse em DuckDB.

## Como executar

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# 1. Baixe o dataset no Kaggle e extraia os 9 CSVs em data/raw/ (os arquivos originais nunca são alterados)
# 2. Rode o pipeline (Extract -> Transform -> Load)
python src/pipeline.py
# 3. Gere e execute o notebook (consultas SQL + gráficos + conclusões)
python src/build_notebook.py
```

O pipeline é idempotente: o warehouse é reconstruído do zero a cada execução.

## Estrutura

| Caminho | Conteúdo |
|---|---|
| `data/raw/` | CSVs originais (RAW), intocados e ignorados pelo Git |
| `data/processed/` | Tabelas tratadas em Parquet (saída do Transform) |
| `data/warehouse/olist.duckdb` | Data Warehouse |
| `src/extract.py` `transform.py` `load.py` `pipeline.py` | Pipeline ETL |
| `src/build_notebook.py` | Gera e executa `notebooks/exploratory_analysis.ipynb` |
| `sql/schema.sql` `gold.sql` | DDL das camadas e carga da camada gold |
| `sql/analytics.sql` | Consultas das 5 análises |
| `reports/charts/` | Gráficos (PNG) |
| `docs/data_quality.md` | Regras de qualidade (gerado a cada execução) |

## Modelagem (Opção B + modelo dimensional na Gold)

Arquitetura em camadas no DuckDB:

- **bronze**: cópia fiel dos CSVs (tudo `VARCHAR`), para rastreabilidade.
- **silver**: dados limpos e tipados (datas, valores numéricos, duplicidades, categorias traduzidas).
- **gold**: modelo estrela pronto para análise — `dim_customer`, `dim_seller`, `dim_product`, `dim_date`,
  `fact_order_items`, `fact_payments` e `fact_orders` (**tabela derivada** com `delivery_days`, `delay_days`, `is_late`,
  `items_revenue`, `review_score`).

**Justificativa:** camadas separam preservação, limpeza e consumo, e tornam cada transformação auditável.
A gold em estrela simplifica as consultas e evita erros de duplicação de linhas em joins
(ex.: 1 avaliação por pedido, 1 coordenada por CEP).

## Decisões principais

- Receita = soma de `price` (sem frete) de pedidos não cancelados/indisponíveis. Receita não é lucro.
- Prazo/atraso só são calculados para pedidos `delivered` com data de entrega e cronologia válida; nenhuma data é inventada.
- Cliente = `customer_unique_id` (o `customer_id` muda a cada pedido).
- Valores ausentes ficam nulos; a única exceção é a categoria de produto ausente, rotulada `desconhecida`.
- Detalhes, contagens e justificativas de cada regra: [docs/data_quality.md](docs/data_quality.md).

## Uso de Inteligência Artificial

Foi utilizado o **Claude Code (Anthropic)** como apoio na estruturação do projeto, escrita do código do pipeline, SQL e
documentação, e testado em dados sintéticos no mesmo esquema do Olist. O código, as regras de negócio e os resultados
devem ser revisados e validados pela autora antes da entrega.

Desenvolvido por: Juliana Ballin Lima.
