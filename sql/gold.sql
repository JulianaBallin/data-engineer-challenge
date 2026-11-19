-- Popula a camada GOLD a partir da SILVER. Executado por src/load.py após schema.sql.

INSERT INTO gold.dim_customer
SELECT c.customer_id, c.customer_unique_id, c.customer_zip_code_prefix,
       c.customer_city, c.customer_state, g.geolocation_lat, g.geolocation_lng
FROM silver.customers c
LEFT JOIN silver.geolocation g ON g.geolocation_zip_code_prefix = c.customer_zip_code_prefix;

INSERT INTO gold.dim_seller
SELECT seller_id, seller_zip_code_prefix, seller_city, seller_state FROM silver.sellers;

INSERT INTO gold.dim_product
SELECT product_id, product_category_name, product_category_name_english,
       product_name_length::INTEGER, product_description_length::INTEGER, product_photos_qty::INTEGER,
       product_weight_g, product_length_cm, product_height_cm, product_width_cm
FROM silver.products;

INSERT INTO gold.dim_date
SELECT d::DATE, year(d), month(d), strftime(d, '%Y-%m'), day(d), isodow(d)
FROM (SELECT unnest(generate_series(
        (SELECT min(order_purchase_timestamp)::DATE FROM silver.orders),
        (SELECT max(order_purchase_timestamp)::DATE FROM silver.orders),
        INTERVAL 1 DAY)) AS d);

INSERT INTO gold.fact_order_items
SELECT i.order_id, i.order_item_id, i.product_id, i.seller_id, o.customer_id,
       o.order_purchase_timestamp::DATE, o.order_status, i.price, i.freight_value,
       o.order_status NOT IN ('canceled', 'unavailable')
FROM silver.order_items i
JOIN silver.orders o USING (order_id);

INSERT INTO gold.fact_payments
SELECT p.order_id, p.payment_sequential, p.payment_type, p.payment_installments, p.payment_value
FROM silver.order_payments p
JOIN silver.orders o USING (order_id);

INSERT INTO gold.fact_orders
WITH items AS (
    SELECT order_id, count(*) AS items_count, sum(price) AS items_revenue, sum(freight_value) AS freight_total
    FROM silver.order_items GROUP BY order_id
), pays AS (
    SELECT order_id, sum(payment_value) AS payment_total FROM silver.order_payments GROUP BY order_id
), last_review AS (   -- 1 avaliação por pedido: a mais recente
    SELECT order_id, review_score FROM silver.order_reviews
    QUALIFY row_number() OVER (PARTITION BY order_id
            ORDER BY review_answer_timestamp DESC NULLS LAST, review_creation_date DESC) = 1
), base AS (
    SELECT o.*,
           (o.order_status = 'delivered' AND o.order_delivered_customer_date IS NOT NULL
            AND NOT o.has_date_inconsistency) AS has_valid_delivery
    FROM silver.orders o
)
SELECT b.order_id, b.customer_id, b.order_status, b.order_purchase_timestamp,
       b.order_delivered_customer_date, b.order_estimated_delivery_date,
       coalesce(i.items_count, 0), i.items_revenue, i.freight_total, p.payment_total,
       CASE WHEN b.has_valid_delivery THEN
            date_diff('day', b.order_purchase_timestamp::DATE, b.order_delivered_customer_date::DATE) END,
       date_diff('day', b.order_purchase_timestamp::DATE, b.order_estimated_delivery_date::DATE),
       CASE WHEN b.has_valid_delivery THEN
            greatest(0, date_diff('day', b.order_estimated_delivery_date::DATE,
                                         b.order_delivered_customer_date::DATE)) END,
       CASE WHEN b.has_valid_delivery THEN
            b.order_delivered_customer_date::DATE > b.order_estimated_delivery_date::DATE END,
       r.review_score
FROM base b
LEFT JOIN items i USING (order_id)
LEFT JOIN pays p USING (order_id)
LEFT JOIN last_review r USING (order_id);
