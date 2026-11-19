"""Extract: lê os CSVs originais (camada RAW) sem alterá-los.

Os arquivos em data/raw/ nunca são modificados. Tudo é lido como texto
(dtype=str) para que a tipagem seja uma decisão explícita da etapa Transform.
"""
import pandas as pd

from config import RAW_DIR, RAW_FILES


def check_raw_files() -> None:
    missing = [f for f in RAW_FILES.values() if not (RAW_DIR / f).exists()]
    if missing:
        raise FileNotFoundError(
            f"Arquivos ausentes em {RAW_DIR}: {', '.join(missing)}.\n"
            "Baixe o dataset em https://www.kaggle.com/datasets/olistbr/brazilian-ecommerce "
            "e extraia os CSVs em data/raw/."
        )


def extract() -> dict[str, pd.DataFrame]:
    check_raw_files()
    tables = {}
    for name, filename in RAW_FILES.items():
        tables[name] = pd.read_csv(RAW_DIR / filename, dtype=str, keep_default_na=False, na_values=[""])
        print(f"[extract] {name}: {len(tables[name]):,} linhas")
    return tables


if __name__ == "__main__":
    extract()
