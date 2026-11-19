"""Caminhos e constantes compartilhados pelo pipeline."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = ROOT / "data" / "raw"
PROCESSED_DIR = ROOT / "data" / "processed"
WAREHOUSE_PATH = ROOT / "data" / "warehouse" / "olist.duckdb"
SQL_DIR = ROOT / "sql"
DOCS_DIR = ROOT / "docs"
CHARTS_DIR = ROOT / "reports" / "charts"

# nome lógico da tabela -> arquivo CSV original do Olist
RAW_FILES = {
    "orders": "olist_orders_dataset.csv",
    "order_items": "olist_order_items_dataset.csv",
    "order_payments": "olist_order_payments_dataset.csv",
    "order_reviews": "olist_order_reviews_dataset.csv",
    "customers": "olist_customers_dataset.csv",
    "products": "olist_products_dataset.csv",
    "sellers": "olist_sellers_dataset.csv",
    "geolocation": "olist_geolocation_dataset.csv",
    "category_translation": "product_category_name_translation.csv",
}

# Caixa delimitadora aproximada do Brasil (lat/lng) para validar geolocalização
BRAZIL_LAT = (-34.0, 6.0)
BRAZIL_LNG = (-74.0, -34.0)
