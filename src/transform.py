"""Transform: limpeza, padronização e registro das regras de qualidade.

Cada correção é registrada em um `QualityLog`, que alimenta docs/data_quality.md
(problema, tratamento, registros afetados e justificativa).
"""
import unicodedata
from dataclasses import dataclass, field

import duckdb
import pandas as pd

from config import BRAZIL_LAT, BRAZIL_LNG, DOCS_DIR, PROCESSED_DIR

ORDER_DATE_COLS = [
    "order_purchase_timestamp",
    "order_approved_at",
    "order_delivered_carrier_date",
    "order_delivered_customer_date",
    "order_estimated_delivery_date",
]

# Categorias presentes em products mas ausentes no arquivo de tradução oficial.
MANUAL_TRANSLATIONS = {
    "pc_gamer": "pc_gaming",
    "portateis_cozinha_e_preparadores_de_alimentos": "portable_kitchen_and_food_preparers",
}
UNKNOWN_CATEGORY = "desconhecida"


@dataclass
class QualityLog:
    rows: list = field(default_factory=list)

    def add(self, table, problem, treatment, affected, justification):
        self.rows.append(
            dict(tabela=table, problema=problem, tratamento=treatment,
                 registros=int(affected), justificativa=justification)
        )

    def to_markdown(self, volumes: dict) -> str:
        out = [
            "# Regras de Qualidade de Dados",
            "",
            "> Documento gerado automaticamente por `src/transform.py` a cada execução do pipeline.",
            "> Os valores de *registros* refletem a última execução.",
            "",
            "## Volumetria (entrada → saída da camada Silver)",
            "",
            "| Tabela | Linhas RAW | Linhas Silver | Removidas |",
            "|---|---:|---:|---:|",
        ]
        for t, (a, b) in volumes.items():
            out.append(f"| {t} | {a:,} | {b:,} | {a - b:,} |")
        out += ["", "## Regras aplicadas", "",
                "| # | Tabela | Problema identificado | Tratamento aplicado | Registros | Justificativa |",
                "|--:|---|---|---|--:|---|"]
        for i, r in enumerate(self.rows, 1):
            out.append(f"| {i} | {r['tabela']} | {r['problema']} | {r['tratamento']} | "
                       f"{r['registros']:,} | {r['justificativa']} |")
        out += [
            "", "## Premissas e limitações", "",
            "- Valores ausentes **não são imputados**: permanecem nulos (ex.: datas de entrega, "
            "dimensões de produtos, comentários de avaliação).",
            "- Pedidos sem data efetiva de entrega não recebem prazo de entrega.",
            "- Receita = soma de `price` dos itens (sem frete) de pedidos não cancelados/indisponíveis. "
            "Receita **não** é lucro: o dataset não tem custos.",
            "- Registros com problemas de integridade referencial são **sinalizados** nos logs, "
            "mas mantidos quando o problema não invalida a própria linha.",
            "- O dataset é uma amostra pública de um marketplace (2016 a 2018), não toda a operação de um varejista.",
        ]
        return "\n".join(out) + "\n"


def _strip_accents(s):
    if pd.isna(s):
        return s
    return "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))


def _clean_text(series: pd.Series, case="lower") -> pd.Series:
    s = series.str.strip().str.replace(r"\s+", " ", regex=True)
    return s.str.lower() if case == "lower" else s.str.upper()


def _dedup(df, subset, log, table, desc, justification):
    before = len(df)
    df = df.drop_duplicates(subset=subset, keep="first")
    n = before - len(df)
    if n:
        log.add(table, f"Registros duplicados ({desc})", "Mantida a primeira ocorrência", n, justification)
    return df


# ---------------------------------------------------------------- tabelas
def clean_orders(df, log):
    df = df.copy()
    df["order_id"] = df["order_id"].str.strip()
    df = _dedup(df, ["order_id"], log, "orders", "order_id repetido",
                "order_id é a chave primária do pedido")
    for c in ORDER_DATE_COLS:
        raw_nonnull = df[c].notna().sum()
        df[c] = pd.to_datetime(df[c], errors="coerce")
        lost = raw_nonnull - df[c].notna().sum()
        if lost:
            log.add("orders", f"Datas inválidas em {c}", "Convertidas para nulo", lost,
                    "Data não interpretável não pode ser usada em cálculos")
    df["order_status"] = _clean_text(df["order_status"])

    # Inconsistências cronológicas: sinalizadas, e datas conflitantes não entram nas métricas
    p, ap = df["order_purchase_timestamp"], df["order_approved_at"]
    ca, cu = df["order_delivered_carrier_date"], df["order_delivered_customer_date"]
    bad = (ap < p) | (ca < p) | (cu < ca) | (cu < p)
    df["has_date_inconsistency"] = bad
    log.add("orders", "Cronologia inválida (aprovação/postagem/entrega anterior à etapa precedente)",
            "Pedido sinalizado em `has_date_inconsistency`; excluído das métricas de prazo", bad.sum(),
            "Não corrigimos datas por suposição; apenas evitamos prazos negativos nas métricas")
    n = ((df["order_status"] == "delivered") & cu.isna()).sum()
    log.add("orders", "Status 'delivered' sem data de entrega ao cliente",
            "Mantido; data permanece nula e prazo de entrega fica nulo", n,
            "Não se inventa data de entrega (premissa do desafio)")
    n = ((df["order_status"] != "delivered") & cu.notna()).sum()
    log.add("orders", "Data de entrega preenchida com status diferente de 'delivered'",
            "Mantido; métricas de prazo consideram apenas status 'delivered'", n,
            "Status é a fonte de verdade sobre a conclusão do pedido")
    return df


def clean_order_items(df, log):
    df = df.copy()
    df = _dedup(df, ["order_id", "order_item_id"], log, "order_items",
                "(order_id, order_item_id) repetido", "Chave composta do item")
    df["order_item_id"] = pd.to_numeric(df["order_item_id"], errors="coerce").astype("Int64")
    for c in ["price", "freight_value"]:
        df[c] = pd.to_numeric(df[c], errors="coerce")
    df["shipping_limit_date"] = pd.to_datetime(df["shipping_limit_date"], errors="coerce")
    bad = df["price"].isna() | (df["price"] < 0) | df["freight_value"].isna() | (df["freight_value"] < 0)
    if bad.sum():
        log.add("order_items", "Preço/frete ausente, não numérico ou negativo", "Linha removida",
                bad.sum(), "Valores monetários inválidos distorceriam a receita")
    zero = (df["price"] == 0).sum()
    if zero:
        log.add("order_items", "Itens com preço igual a zero", "Mantidos e sinalizados apenas neste log",
                zero, "Podem ser brindes; remover alteraria a contagem de itens sem evidência")
    return df[~bad]


def clean_payments(df, log):
    df = df.copy()
    df = _dedup(df, ["order_id", "payment_sequential"], log, "order_payments",
                "(order_id, payment_sequential) repetido", "Chave composta do pagamento")
    for c in ["payment_sequential", "payment_installments"]:
        df[c] = pd.to_numeric(df[c], errors="coerce").astype("Int64")
    df["payment_value"] = pd.to_numeric(df["payment_value"], errors="coerce")
    df["payment_type"] = _clean_text(df["payment_type"])
    bad = df["payment_value"].isna() | (df["payment_value"] < 0) | (df["payment_type"] == "not_defined")
    log.add("order_payments", "Pagamento com valor inválido ou tipo 'not_defined'", "Linha removida",
            bad.sum(), "Registro sem meio de pagamento válido não representa transação")
    df = df[~bad]
    n = (df["payment_installments"] < 1).sum()
    if n:
        df.loc[df["payment_installments"] < 1, "payment_installments"] = 1
        log.add("order_payments", "Parcelas < 1", "Ajustadas para 1", n,
                "Todo pagamento tem ao menos uma parcela")
    return df


def clean_reviews(df, log):
    df = df.copy()
    df = _dedup(df, None, log, "order_reviews", "linhas idênticas", "Cópias exatas não agregam informação")
    for c in ["review_creation_date", "review_answer_timestamp"]:
        df[c] = pd.to_datetime(df[c], errors="coerce")
    df["review_score"] = pd.to_numeric(df["review_score"], errors="coerce").astype("Int64")
    bad = ~df["review_score"].between(1, 5)
    if bad.sum():
        log.add("order_reviews", "Nota fora do intervalo 1 a 5", "Linha removida", bad.sum(),
                "Nota inválida distorce a média de satisfação")
    df = df[~bad]
    for c in ["review_comment_title", "review_comment_message"]:
        df[c] = df[c].str.strip().replace("", pd.NA)
    n = df["review_id"].duplicated().sum()
    log.add("order_reviews", "review_id repetido em pedidos distintos (linhas não idênticas)",
            "Mantido na Silver; na Gold usa-se 1 avaliação por pedido (a mais recente)", n,
            "review_id não é único no dataset; a unicidade correta é por pedido nas análises")
    return df


def clean_customers(df, log):
    df = df.copy()
    df = _dedup(df, ["customer_id"], log, "customers", "customer_id repetido", "Chave do cadastro")
    df["customer_zip_code_prefix"] = df["customer_zip_code_prefix"].str.strip().str.zfill(5)
    df["customer_city"] = _clean_text(df["customer_city"]).map(_strip_accents)
    df["customer_state"] = _clean_text(df["customer_state"], "upper")
    log.add("customers", "Cidade com acentos/caixa/espaços variados; CEP sem zeros à esquerda",
            "Cidade em minúsculas sem acento; UF em maiúsculas; CEP com 5 dígitos", len(df),
            "Padronização para joins e agrupamentos consistentes")
    return df


def clean_sellers(df, log):
    df = df.copy()
    df = _dedup(df, ["seller_id"], log, "sellers", "seller_id repetido", "Chave do cadastro")
    df["seller_zip_code_prefix"] = df["seller_zip_code_prefix"].str.strip().str.zfill(5)
    df["seller_city"] = _clean_text(df["seller_city"]).map(_strip_accents)
    df["seller_state"] = _clean_text(df["seller_state"], "upper")
    log.add("sellers", "Cidade com variações de grafia; CEP sem zeros à esquerda",
            "Mesma padronização aplicada a customers", len(df), "Consistência entre tabelas")
    return df


def clean_translation(df, log):
    df = df.copy()
    for c in df.columns:
        df[c] = df[c].str.strip().str.lower()
    df = _dedup(df, ["product_category_name"], log, "category_translation",
                "categoria repetida", "Cada categoria deve ter uma única tradução")
    return df


def clean_products(df, translation, log):
    df = df.copy()
    df = df.rename(columns={"product_name_lenght": "product_name_length",
                            "product_description_lenght": "product_description_length"})
    log.add("products", "Colunas com erro de grafia (`lenght`)", "Renomeadas para `length`",
            2, "Nomes corretos evitam erros em consultas")
    df = _dedup(df, ["product_id"], log, "products", "product_id repetido", "Chave do cadastro")
    num = ["product_name_length", "product_description_length", "product_photos_qty",
           "product_weight_g", "product_length_cm", "product_height_cm", "product_width_cm"]
    for c in num:
        df[c] = pd.to_numeric(df[c], errors="coerce")
    n = (df["product_weight_g"] == 0).sum()
    df.loc[df["product_weight_g"] == 0, "product_weight_g"] = pd.NA
    log.add("products", "Peso igual a 0 g (fisicamente impossível)", "Convertido para nulo", n,
            "Zero indica ausência de medição, não peso real")
    df["product_category_name"] = _clean_text(df["product_category_name"])
    n = df["product_category_name"].isna().sum()
    df["product_category_name"] = df["product_category_name"].fillna(UNKNOWN_CATEGORY)
    log.add("products", "Categoria ausente", f"Rotulada '{UNKNOWN_CATEGORY}' (sem inferir categoria)", n,
            "Mantém o produto nas análises sem criar informação artificial")
    mapping = dict(zip(translation["product_category_name"], translation["product_category_name_english"]))
    missing = sorted(set(df["product_category_name"]) - set(mapping) - {UNKNOWN_CATEGORY})
    manual = {k: v for k, v in MANUAL_TRANSLATIONS.items() if k in missing}
    mapping.update(manual)
    mapping[UNKNOWN_CATEGORY] = "unknown"
    n = df["product_category_name"].isin(manual).sum()
    log.add("products", f"Categorias sem tradução no arquivo oficial: {', '.join(manual) or 'nenhuma'}",
            "Tradução manual adicionada", n, "Garante 100% de cobertura de tradução")
    still = sorted(set(df["product_category_name"]) - set(mapping))
    if still:
        log.add("products", f"Categorias sem tradução: {', '.join(still)}",
                "Mantido o nome em português", df["product_category_name"].isin(still).sum(),
                "Não há fonte confiável de tradução")
    df["product_category_name_english"] = df["product_category_name"].map(mapping).fillna(df["product_category_name"])
    return df


def clean_geolocation(df, log):
    df = df.copy()
    df["geolocation_zip_code_prefix"] = df["geolocation_zip_code_prefix"].str.strip().str.zfill(5)
    df["geolocation_lat"] = pd.to_numeric(df["geolocation_lat"], errors="coerce")
    df["geolocation_lng"] = pd.to_numeric(df["geolocation_lng"], errors="coerce")
    ok = df["geolocation_lat"].between(*BRAZIL_LAT) & df["geolocation_lng"].between(*BRAZIL_LNG)
    log.add("geolocation", "Coordenadas nulas ou fora do território brasileiro", "Linha removida",
            (~ok).sum(), "Pontos fora do Brasil são erros de geocodificação")
    df = df[ok]
    df["geolocation_city"] = _clean_text(df["geolocation_city"]).map(_strip_accents)
    df["geolocation_state"] = _clean_text(df["geolocation_state"], "upper")
    before = len(df)
    agg = (df.groupby("geolocation_zip_code_prefix")
             .agg(lat=("geolocation_lat", "mean"), lng=("geolocation_lng", "mean"),
                  city=("geolocation_city", lambda s: s.mode().iat[0]),
                  state=("geolocation_state", lambda s: s.mode().iat[0]))
             .reset_index())
    agg.columns = ["geolocation_zip_code_prefix", "geolocation_lat", "geolocation_lng",
                   "geolocation_city", "geolocation_state"]
    log.add("geolocation", "Múltiplas coordenadas por prefixo de CEP (milhares de repetições)",
            "Agregado em 1 linha por prefixo: média de lat/lng e cidade/UF mais frequentes",
            before - len(agg), "Torna o prefixo de CEP uma chave única e evita explosão de linhas em joins")
    return agg


def check_integrity(t, log):
    """Verifica relacionamentos entre tabelas. Apenas sinaliza; não remove."""
    checks = [
        ("order_items", "order_id", "orders", "order_id"),
        ("order_items", "product_id", "products", "product_id"),
        ("order_items", "seller_id", "sellers", "seller_id"),
        ("order_payments", "order_id", "orders", "order_id"),
        ("order_reviews", "order_id", "orders", "order_id"),
        ("orders", "customer_id", "customers", "customer_id"),
    ]
    for child, ck, parent, pk in checks:
        n = (~t[child][ck].isin(t[parent][pk])).sum()
        log.add(child, f"Integridade referencial: {ck} sem correspondente em {parent}.{pk}",
                "Verificado; sem remoção" if n == 0 else "Sinalizado; mantido", n,
                "Relacionamentos consistentes são requisito de qualidade")
    n = (~t["orders"]["order_id"].isin(t["order_items"]["order_id"])).sum()
    log.add("orders", "Pedidos sem nenhum item", "Mantidos (não entram em receita)", n,
            "Pedidos cancelados/indisponíveis frequentemente não têm itens")


def transform(raw: dict) -> dict:
    log = QualityLog()
    t = {
        "orders": clean_orders(raw["orders"], log),
        "order_items": clean_order_items(raw["order_items"], log),
        "order_payments": clean_payments(raw["order_payments"], log),
        "order_reviews": clean_reviews(raw["order_reviews"], log),
        "customers": clean_customers(raw["customers"], log),
        "sellers": clean_sellers(raw["sellers"], log),
        "category_translation": clean_translation(raw["category_translation"], log),
        "geolocation": clean_geolocation(raw["geolocation"], log),
    }
    t["products"] = clean_products(raw["products"], t["category_translation"], log)
    check_integrity(t, log)

    volumes = {k: (len(raw[k]), len(v)) for k, v in t.items()}
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    for name, df in t.items():
        path = PROCESSED_DIR / f"{name}.parquet"
        duckdb.sql(f"COPY (SELECT * FROM df) TO '{path}' (FORMAT PARQUET)")
        print(f"[transform] {name}: {len(raw[name]):,} -> {len(df):,}")
    DOCS_DIR.mkdir(exist_ok=True)
    (DOCS_DIR / "data_quality.md").write_text(log.to_markdown(volumes), encoding="utf-8")
    print(f"[transform] {len(log.rows)} regras registradas em docs/data_quality.md")
    return t
