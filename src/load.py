"""Load: carrega bronze (CSV bruto), silver (parquet tratado) e gold (modelo dimensional) no DuckDB."""
import duckdb

from config import PROCESSED_DIR, RAW_DIR, RAW_FILES, SQL_DIR, WAREHOUSE_PATH

SILVER_TABLES = ["orders", "order_items", "order_payments", "order_reviews", "customers",
                 "products", "sellers", "geolocation", "category_translation"]


def load() -> duckdb.DuckDBPyConnection:
    WAREHOUSE_PATH.parent.mkdir(parents=True, exist_ok=True)
    WAREHOUSE_PATH.unlink(missing_ok=True)  # reconstrução completa => pipeline idempotente
    con = duckdb.connect(str(WAREHOUSE_PATH))
    con.execute((SQL_DIR / "schema.sql").read_text(encoding="utf-8"))

    for name, filename in RAW_FILES.items():
        con.execute(f"CREATE TABLE bronze.{name} AS SELECT * FROM read_csv("
                    f"'{RAW_DIR / filename}', all_varchar=true, header=true)")
    for name in SILVER_TABLES:
        con.execute(f"CREATE TABLE silver.{name} AS SELECT * FROM read_parquet("
                    f"'{PROCESSED_DIR / (name + '.parquet')}')")

    con.execute((SQL_DIR / "gold.sql").read_text(encoding="utf-8"))
    for schema in ("bronze", "silver", "gold"):
        for (t,) in con.execute("SELECT table_name FROM information_schema.tables "
                                "WHERE table_schema = ? ORDER BY 1", [schema]).fetchall():
            n = con.execute(f"SELECT count(*) FROM {schema}.{t}").fetchone()[0]
            print(f"[load] {schema}.{t}: {n:,}")
    return con


if __name__ == "__main__":
    load().close()
