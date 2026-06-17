import pandas as pd


def calculate_start_end_comparison(dataframe: pd.DataFrame) -> dict:
    """
    Compara os primeiros 20% e os últimos 20% da coleta.
    """

    required_columns = [
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

    comparison_dataframe = dataframe[required_columns].copy()

    for column in required_columns:
        comparison_dataframe[column] = pd.to_numeric(
            comparison_dataframe[column],
            errors="coerce",
        )

    comparison_dataframe = comparison_dataframe.dropna()

    if comparison_dataframe.empty:
        raise ValueError(
            "Não existem dados válidos para comparar o início e o final da coleta."
        )

    total_rows = len(comparison_dataframe)

    # Usa 20% da coleta, mas garante pelo menos uma linha
    segment_size = max(1, int(total_rows * 0.20))

    start_segment = comparison_dataframe.iloc[:segment_size]
    end_segment = comparison_dataframe.iloc[-segment_size:]

    def summarize_segment(segment: pd.DataFrame) -> dict:
        angle = segment["angulo_joelho_graus"]
        jerk_thigh = segment["jerk_linear_norma_coxa_m_s3"]
        jerk_leg = segment["jerk_linear_norma_perna_m_s3"]

        angle_min = float(angle.min())
        angle_max = float(angle.max())

        return {
            "angulo_joelho_media": round(float(angle.mean()), 3),
            "angulo_joelho_amplitude": round(angle_max - angle_min, 3),
            "jerk_coxa_media": round(float(jerk_thigh.mean()), 3),
            "jerk_perna_media": round(float(jerk_leg.mean()), 3),
        }

    start_summary = summarize_segment(start_segment)
    end_summary = summarize_segment(end_segment)

    return {
        "percentual_analisado_em_cada_trecho": 20,
        "total_pontos_validos": total_rows,
        "pontos_por_trecho": segment_size,
        "inicio": start_summary,
        "final": end_summary,
        "variacao_final_menos_inicio": {
            "angulo_joelho_media": round(
                end_summary["angulo_joelho_media"]
                - start_summary["angulo_joelho_media"],
                3,
            ),
            "angulo_joelho_amplitude": round(
                end_summary["angulo_joelho_amplitude"]
                - start_summary["angulo_joelho_amplitude"],
                3,
            ),
            "jerk_coxa_media": round(
                end_summary["jerk_coxa_media"]
                - start_summary["jerk_coxa_media"],
                3,
            ),
            "jerk_perna_media": round(
                end_summary["jerk_perna_media"]
                - start_summary["jerk_perna_media"],
                3,
            ),
        },
    }