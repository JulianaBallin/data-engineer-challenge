# Olist Insights: pipeline ETL, Data Warehouse, notebook e dashboard.
# Uso: `make run` cria o ambiente, instala as dependências e executa tudo de uma vez.
PY      := .venv/bin/python
PIP     := .venv/bin/pip
RAW     := data/raw
DATASET := olistbr/brazilian-ecommerce
CSVS    := olist_customers_dataset olist_geolocation_dataset olist_order_items_dataset olist_order_payments_dataset olist_order_reviews_dataset olist_orders_dataset olist_products_dataset olist_sellers_dataset product_category_name_translation

.PHONY: run help venv install data pipeline notebook export docs test dev clean

help:  ## lista os comandos
	@grep -E '^[a-z-]+:.*##' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  make %-10s %s\n", $$1, $$2}'

run: install data pipeline notebook export  ## tudo de uma vez: venv, dependências, dados, ETL, notebook e JSON do dashboard
	@echo "Pronto. Warehouse: data/warehouse/olist.duckdb | Notebook: notebooks/exploratory_analysis.ipynb"

venv:  ## cria o ambiente virtual
	@test -d .venv || python3 -m venv .venv

install: venv  ## instala as dependências
	$(PIP) install --quiet --upgrade pip
	$(PIP) install --quiet -r requirements.txt

data:  ## confere os 9 CSVs em data/raw (baixa do Kaggle se a CLI estiver configurada)
	@missing=0; for f in $(CSVS); do test -f $(RAW)/$$f.csv || missing=1; done; \
	if [ $$missing -eq 1 ]; then \
	  if [ -f $$HOME/.kaggle/kaggle.json ] || [ -n "$$KAGGLE_USERNAME" ]; then \
	    echo "Baixando $(DATASET) do Kaggle..."; $(PIP) install --quiet kaggle; .venv/bin/kaggle datasets download -d $(DATASET) -p $(RAW) --unzip; \
	  else \
	    echo "Faltam CSVs em $(RAW)/. Baixe https://www.kaggle.com/datasets/$(DATASET) e extraia os 9 arquivos aqui,"; \
	    echo "ou configure o Kaggle (~/.kaggle/kaggle.json) e rode 'make data' de novo."; exit 1; \
	  fi; \
	fi

pipeline: install data  ## Extract, Transform e Load (Bronze, Silver, Gold)
	$(PY) src/pipeline.py

notebook: pipeline  ## gera e executa o notebook com as 10 análises
	$(PY) src/build_notebook.py

export: pipeline  ## exporta os agregados da gold para o dashboard
	$(PY) src/export_web.py

docs: install  ## regenera diagramas, relatório e apresentação
	$(PY) src/build_diagrams.py && $(PY) src/build_report.py && $(PY) src/build_slides.py

test:  ## testes de API (precisa do servidor: make dev)
	BASE=$${BASE:-http://localhost:3000} node scripts/test-api.js

dev:  ## dashboard local em http://localhost:3000 (defina AUTH_USER, AUTH_PASS_HASH e SESSION_SECRET)
	node scripts/dev-server.js

clean:  ## apaga o warehouse e os dados processados (os CSVs brutos ficam)
	find data/warehouse data/processed -type f ! -name .gitkeep -delete
