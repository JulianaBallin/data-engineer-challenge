"""Executa o pipeline completo: Extract -> Transform -> Load."""
from extract import extract
from load import load
from transform import transform


def main():
    raw = extract()
    transform(raw)
    load().close()
    print("[pipeline] concluído: data/warehouse/olist.duckdb")


if __name__ == "__main__":
    main()
