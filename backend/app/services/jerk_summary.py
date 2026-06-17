import pandas as pd


def calculate_jerk_summary(dataframe: pd.DataFrame) -> dict:
    """
    Calcula estatísticas da norma do jerk linear da coxa e da perna.
    """

    required_columns = [
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

    jerk_coxa = pd.to_numeric(
        dataframe["jerk_linear_norma_coxa_m_s3"],
        errors="coerce",
    ).dropna()

    jerk_perna = pd.to_numeric(
        dataframe["jerk_linear_norma_perna_m_s3"],
        errors="coerce",
    ).dropna()

    if jerk_coxa.empty:
        raise ValueError(
            "A coluna jerk_linear_norma_coxa_m_s3 não possui valores válidos."
        )

    if jerk_perna.empty:
        raise ValueError(
            "A coluna jerk_linear_norma_perna_m_s3 não possui valores válidos."
        )

    return {
        "coxa": {
            "media": round(float(jerk_coxa.mean()), 3),
            "maximo": round(float(jerk_coxa.max()), 3),
            "percentil_95": round(float(jerk_coxa.quantile(0.95)), 3),
        },
        "perna": {
            "media": round(float(jerk_perna.mean()), 3),
            "maximo": round(float(jerk_perna.max()), 3),
            "percentil_95": round(float(jerk_perna.quantile(0.95)), 3),
        },
    }