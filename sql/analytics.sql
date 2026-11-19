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

-- name: q1b_receita_mensal
-- Vendas (1B): como a receita total varia mês a mês? (jan/2017 a ago/2018: meses completos)
SELECT d.year_month AS mes,
       round(sum(f.price), 2) AS receita,
       count(DISTINCT f.order_id) AS pedidos
FROM gold.fact_order_items f
JOIN gold.dim_date d ON d.date_key = f.purchase_date
WHERE f.is_revenue AND d.year_month BETWEEN '2017-01' AND '2018-08'
GROUP BY 1
ORDER BY 1;

-- name: q2a_prazo_uf
-- Logística (2A): qual o tempo médio de entrega, em dias, por estado do cliente?
-- Só pedidos 'delivered' com datas válidas (delivery_days nulo caso contrário).
SELECT c.state AS uf,
       round(avg(o.delivery_days), 1) AS dias,
       count(*) AS pedidos
FROM gold.fact_orders o
JOIN gold.dim_customer c USING (customer_id)
WHERE o.delivery_days IS NOT NULL
GROUP BY 1
ORDER BY dias DESC;

-- name: q3a_distribuicao_notas
-- Satisfação (3A): como se distribuem as notas de 1 a 5? (1 avaliação por pedido, a mais recente)
SELECT review_score AS nota,
       count(*) AS pedidos,
       round(100.0 * count(*) / sum(count(*)) OVER (), 2) AS pct
FROM gold.fact_orders
WHERE review_score IS NOT NULL
GROUP BY 1
ORDER BY 1;

-- name: q4a_receita_share_categoria
-- Financeiro (4A): qual a receita por categoria e sua participação no total?
SELECT p.category_en AS categoria,
       round(sum(f.price), 2) AS receita,
       round(100.0 * sum(f.price) / sum(sum(f.price)) OVER (), 2) AS pct
FROM gold.fact_order_items f
JOIN gold.dim_product p USING (product_id)
WHERE f.is_revenue
GROUP BY 1
ORDER BY receita DESC;

-- name: q5b_meios_pagamento
-- Clientes e pagamentos (5B): quais os meios de pagamento mais usados?
SELECT payment_type AS tipo,
       count(*) AS pagamentos,
       round(100.0 * count(*) / sum(count(*)) OVER (), 2) AS pct,
       round(sum(payment_value), 2) AS valor
FROM gold.fact_payments
GROUP BY 1
ORDER BY pagamentos DESC;

