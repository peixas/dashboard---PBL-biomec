import pandas as pd


def build_time_series(dataframe: pd.DataFrame) -> dict:
    """
    Prepara as séries temporais usadas nos gráficos do dashboard.
    """

    required_columns = [
        "tempo_vetorizado",
        "angulo_joelho_graus",
        "jerk_linear_norma_coxa_m_s3",
        "jerk_linear_norma_perna_m_s3",
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

    series_dataframe = dataframe[required_columns].copy()

    # Converte os valores para números.
    for column in required_columns:
        series_dataframe[column] = pd.to_numeric(
            series_dataframe[column],
            errors="coerce",
        )

    # Remove linhas com valores inválidos em qualquer uma das séries.
    series_dataframe = series_dataframe.dropna()

    if series_dataframe.empty:
        raise ValueError(
            "Não existem dados válidos para construir as séries temporais."
        )

    return {
        "tempo_s": series_dataframe["tempo_vetorizado"].round(4).tolist(),
        "angulo_joelho_graus": (
            series_dataframe["angulo_joelho_graus"].round(4).tolist()
        ),
        "jerk_coxa_m_s3": (
            series_dataframe["jerk_linear_norma_coxa_m_s3"].round(4).tolist()
        ),
        "jerk_perna_m_s3": (
            series_dataframe["jerk_linear_norma_perna_m_s3"].round(4).tolist()
        ),
        "total_pontos": len(series_dataframe),
    }