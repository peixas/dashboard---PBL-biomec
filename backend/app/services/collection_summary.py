import pandas as pd


def calculate_collection_summary(dataframe: pd.DataFrame) -> dict:
    """
    Calcula informações básicas da coleta e do ângulo do joelho.
    """

    required_columns = [
        "tempo_mcu",
        "tempo_vetorizado",
        "angulo_joelho_graus",
    ]

    missing_columns = [
        column
        for column in required_columns
        if column not in dataframe.columns
    ]

    if missing_columns:
        raise ValueError(
            f"Colunas ausentes: {', '.join(missing_columns)}"
        )

    tempo_mcu = pd.to_numeric(
        dataframe["tempo_mcu"],
        errors="coerce",
    ).dropna()

    tempo_vetorizado = pd.to_numeric(
        dataframe["tempo_vetorizado"],
        errors="coerce",
    ).dropna()

    angulo_joelho = pd.to_numeric(
        dataframe["angulo_joelho_graus"],
        
        errors="coerce",
    ).dropna()

    if tempo_mcu.empty:
        raise ValueError("A coluna tempo_mcu não possui valores válidos.")

    if tempo_vetorizado.empty:
        raise ValueError(
            "A coluna tempo_vetorizado não possui valores válidos."
        )

    if angulo_joelho.empty:
        raise ValueError(
            "A coluna angulo_joelho não possui valores válidos."
        )

    duracao_mcu = float(tempo_mcu.max() - tempo_mcu.min())

    duracao_vetorizada = float(
        tempo_vetorizado.max() - tempo_vetorizado.min()
    )

    cobertura_percentual = (
        duracao_vetorizada / duracao_mcu * 100
        if duracao_mcu > 0
        else 0
    )

    return {
        "duracao_mcu_s": round(duracao_mcu, 3),
        "duracao_vetorizada_s": round(duracao_vetorizada, 3),
        "cobertura_percentual": round(cobertura_percentual, 2),
        "angulo_joelho": {
            "minimo": round(float(angulo_joelho.min()), 3),
            "maximo": round(float(angulo_joelho.max()), 3),
            "media": round(float(angulo_joelho.mean()), 3),
        },
    }