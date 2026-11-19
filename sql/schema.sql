-- Camadas do Data Warehouse (DuckDB): bronze (cópia fiel dos CSVs), silver (tratada),
-- gold (modelo dimensional estrela + tabelas derivadas).
CREATE SCHEMA IF NOT EXISTS bronze;
CREATE SCHEMA IF NOT EXISTS silver;
CREATE SCHEMA IF NOT EXISTS gold;

-- ============================ GOLD: DIMENSÕES ============================
CREATE OR REPLACE TABLE gold.dim_customer (
    customer_id        VARCHAR PRIMARY KEY,
    customer_unique_id VARCHAR NOT NULL,   -- identifica a pessoa; customer_id muda a cada pedido
    zip_code_prefix    VARCHAR,
    city               VARCHAR,
    state              VARCHAR,
    lat                DOUBLE,
    lng                DOUBLE
);

CREATE OR REPLACE TABLE gold.dim_seller (
    seller_id       VARCHAR PRIMARY KEY,
    zip_code_prefix VARCHAR,
    city            VARCHAR,
    state           VARCHAR
);

CREATE OR REPLACE TABLE gold.dim_product (
    product_id            VARCHAR PRIMARY KEY,
    category_pt           VARCHAR,
    category_en           VARCHAR,
    name_length           INTEGER,
    description_length    INTEGER,
    photos_qty            INTEGER,
    weight_g              DOUBLE,
    length_cm             DOUBLE,
    height_cm             DOUBLE,
    width_cm              DOUBLE
);

CREATE OR REPLACE TABLE gold.dim_date (
    date_key   DATE PRIMARY KEY,
    year       INTEGER,
    month      INTEGER,
    year_month VARCHAR,   -- AAAA-MM
    day        INTEGER,
    weekday    INTEGER    -- 1=segunda ... 7=domingo
);

-- ============================== GOLD: FATOS ==============================
-- Grão: 1 linha por item de pedido
CREATE OR REPLACE TABLE gold.fact_order_items (
    order_id         VARCHAR NOT NULL,
    order_item_id    INTEGER NOT NULL,
    product_id       VARCHAR,
    seller_id        VARCHAR,
    customer_id      VARCHAR,
    purchase_date    DATE,
    order_status     VARCHAR,
    price            DECIMAL(12,2),
    freight_value    DECIMAL(12,2),
    is_revenue       BOOLEAN,   -- FALSE para pedidos cancelados/indisponíveis
    PRIMARY KEY (order_id, order_item_id)
);

-- Grão: 1 linha por pagamento
CREATE OR REPLACE TABLE gold.fact_payments (
    order_id             VARCHAR NOT NULL,
    payment_sequential   INTEGER NOT NULL,
    payment_type         VARCHAR,
    payment_installments INTEGER,
    payment_value        DECIMAL(12,2),
    PRIMARY KEY (order_id, payment_sequential)
);

-- Grão: 1 linha por pedido. TABELA DERIVADA com métricas calculadas.
CREATE OR REPLACE TABLE gold.fact_orders (
    order_id              VARCHAR PRIMARY KEY,
    customer_id           VARCHAR,
    order_status          VARCHAR,
    purchase_ts           TIMESTAMP,
    delivered_customer_ts TIMESTAMP,
    estimated_delivery_ts TIMESTAMP,
    items_count           INTEGER,
    items_revenue         DECIMAL(12,2),
    freight_total         DECIMAL(12,2),
    payment_total         DECIMAL(12,2),
    delivery_days         INTEGER,   -- compra -> entrega (NULL se não entregue / datas inconsistentes)
    estimated_days        INTEGER,   -- compra -> data estimada
    delay_days            INTEGER,   -- dias de atraso vs. estimativa (0 se no prazo)
    is_late               BOOLEAN,   -- TRUE se entregue após a data estimada
    review_score          INTEGER    -- avaliação mais recente do pedido
);
