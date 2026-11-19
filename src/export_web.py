"""Exporta agregados da camada gold para JSON, consumidos pela API protegida do dashboard."""
import json
import re

import duckdb

from config import ROOT, SQL_DIR, WAREHOUSE_PATH

OUT = ROOT / "api" / "_data" / "dashboard.json"

EXTRA = {
    "kpis": """
        SELECT (SELECT count(*) FROM gold.fact_orders) AS pedidos,
               (SELECT round(sum(price), 2) FROM gold.fact_order_items WHERE is_revenue) AS receita,
               (SELECT count(DISTINCT customer_unique_id) FROM gold.dim_customer) AS clientes,
               (SELECT round(sum(price) / count(DISTINCT order_id), 2) FROM gold.fact_order_items WHERE is_revenue) AS ticket_medio,
               (SELECT round(100.0 * count(*) FILTER (WHERE is_late) / count(*), 2) FROM gold.fact_orders WHERE is_late IS NOT NULL) AS pct_atraso,
               (SELECT round(avg(review_score), 2) FROM gold.fact_orders WHERE review_score IS NOT NULL) AS nota_media,
               (SELECT round(avg(delivery_days), 1) FROM gold.fact_orders WHERE delivery_days IS NOT NULL) AS prazo_medio""",
    "receita_mensal": """
        SELECT d.year_month AS mes, round(sum(f.price), 2) AS receita, count(DISTINCT f.order_id) AS pedidos
        FROM gold.fact_order_items f JOIN gold.dim_date d ON d.date_key = f.purchase_date
        WHERE f.is_revenue AND d.year_month BETWEEN '2017-01' AND '2018-08'
        GROUP BY 1 ORDER BY 1""",
    "prazo_uf": """
        SELECT c.state AS uf, round(avg(o.delivery_days), 1) AS dias, count(*) AS pedidos
        FROM gold.fact_orders o JOIN gold.dim_customer c USING (customer_id)
        WHERE o.delivery_days IS NOT NULL GROUP BY 1 ORDER BY dias DESC""",
    "notas": """
        SELECT review_score AS nota, count(*) AS pedidos FROM gold.fact_orders
        WHERE review_score IS NOT NULL GROUP BY 1 ORDER BY 1""",
    "pagamentos": """
        SELECT payment_type AS tipo, count(*) AS pagamentos, round(sum(payment_value), 2) AS valor
        FROM gold.fact_payments GROUP BY 1 ORDER BY pagamentos DESC""",
    "categorias_share": """
        SELECT p.category_en AS categoria, round(sum(f.price), 2) AS receita,
               round(100 * sum(f.price) / sum(sum(f.price)) OVER (), 2) AS pct
        FROM gold.fact_order_items f JOIN gold.dim_product p USING (product_id)
        WHERE f.is_revenue GROUP BY 1 ORDER BY receita DESC LIMIT 10""",
}


def main():
    con = duckdb.connect(str(WAREHOUSE_PATH), read_only=True)
    queries = dict(re.findall(r"-- name: (\w+)\n(.*?)(?=\n-- name:|\Z)",
                              (SQL_DIR / "analytics.sql").read_text(encoding="utf-8"), re.S))
    out = {}
    for name, sql in {**queries, **EXTRA}.items():
        df = con.execute(sql).df().astype(object).where(lambda d: d.notna(), None)
        out[name] = json.loads(df.to_json(orient="records"))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"[export] {OUT.relative_to(ROOT)}: {OUT.stat().st_size / 1024:.1f} KB, {len(out)} conjuntos")


if __name__ == "__main__":
    main()
