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
        raise ValueError(
            "A coluna tempo_mcu não possui valores válidos."
        )

    if tempo_vetorizado.empty:
        raise ValueError(
            "A coluna tempo_vetorizado não possui valores válidos."
        )

    if angulo_joelho.empty:
        raise ValueError(
            "A coluna angulo_joelho_graus não possui valores válidos."
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

    angulo_minimo = float(angulo_joelho.min())
    angulo_maximo = float(angulo_joelho.max())
    angulo_medio = float(angulo_joelho.mean())
    angulo_amplitude = angulo_maximo - angulo_minimo
    angulo_desvio_padrao = float(angulo_joelho.std())

    return {
        "duracao_mcu_s": round(duracao_mcu, 3),
        "duracao_vetorizada_s": round(duracao_vetorizada, 3),
        "cobertura_percentual": round(cobertura_percentual, 2),
        "angulo_joelho": {
            "minimo": round(angulo_minimo, 3),
            "maximo": round(angulo_maximo, 3),
            "media": round(angulo_medio, 3),
            "amplitude": round(angulo_amplitude, 3),
            "desvio_padrao": round(angulo_desvio_padrao, 3),
        },
    }