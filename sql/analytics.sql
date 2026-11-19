-- Consultas da análise exploratória (camada GOLD). Cada bloco "-- name:" é lido pelo notebook.

-- name: q1_top10_categorias_receita
-- Vendas (1A): quais são as 10 categorias com maior receita?
SELECT p.category_en AS categoria,
       round(sum(f.price), 2) AS receita,
       count(DISTINCT f.order_id) AS pedidos
FROM gold.fact_order_items f
JOIN gold.dim_product p USING (product_id)
WHERE f.is_revenue
GROUP BY 1
ORDER BY receita DESC
LIMIT 10;

-- name: q2_pct_atraso
-- Logística (2B): qual a porcentagem de pedidos entregues com atraso (global e por UF)?
SELECT c.state AS uf,
       count(*) AS pedidos_entregues,
       count(*) FILTER (WHERE o.is_late) AS pedidos_atrasados,
       round(100.0 * count(*) FILTER (WHERE o.is_late) / count(*), 2) AS pct_atraso
FROM gold.fact_orders o
JOIN gold.dim_customer c USING (customer_id)
WHERE o.is_late IS NOT NULL
GROUP BY ROLLUP (c.state)
ORDER BY uf NULLS FIRST;

-- name: q3_nota_atraso
-- Satisfação (3B): pedidos atrasados têm nota média menor que os entregues no prazo?
SELECT CASE WHEN is_late THEN 'Com atraso' ELSE 'No prazo' END AS situacao,
       count(*) AS pedidos,
       round(avg(review_score), 2) AS nota_media
FROM gold.fact_orders
WHERE is_late IS NOT NULL AND review_score IS NOT NULL
GROUP BY 1
ORDER BY 1;

-- name: q4_frete_medio_uf
-- Financeiro (4B): qual o valor médio do frete por estado do cliente?
SELECT c.state AS uf,
       round(avg(f.freight_value), 2) AS frete_medio,
       count(*) AS itens
FROM gold.fact_order_items f
JOIN gold.dim_customer c USING (customer_id)
WHERE f.is_revenue
GROUP BY 1
ORDER BY frete_medio DESC;

-- name: q5_clientes_recorrentes
-- Clientes (5A): qual a porcentagem de clientes que compraram mais de uma vez?
-- Cliente = customer_unique_id (customer_id muda a cada pedido).
WITH por_cliente AS (
    SELECT c.customer_unique_id, count(DISTINCT o.order_id) AS pedidos
    FROM gold.fact_orders o
    JOIN gold.dim_customer c USING (customer_id)
    WHERE o.order_status NOT IN ('canceled', 'unavailable')
    GROUP BY 1
)
SELECT CASE WHEN pedidos > 1 THEN 'Mais de uma compra' ELSE 'Uma compra' END AS perfil,
       count(*) AS clientes,
       round(100.0 * count(*) / sum(count(*)) OVER (), 2) AS pct
FROM por_cliente
GROUP BY 1
ORDER BY 1;
