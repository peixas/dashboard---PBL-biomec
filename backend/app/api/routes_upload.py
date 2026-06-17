from io import BytesIO
from app.services.time_series import build_time_series
import pandas as pd
from fastapi import APIRouter, File, HTTPException, UploadFile

from app.services.collection_summary import calculate_collection_summary
from app.services.jerk_summary import calculate_jerk_summary


router = APIRouter(
    prefix="/api/uploads",
    tags=["Uploads"],
)


@router.post("/csv")
async def upload_csv(file: UploadFile = File(...)):
    """
    Recebe um arquivo CSV, lê os dados e calcula:

    - informações gerais do arquivo;
    - duração e cobertura da coleta;
    - estatísticas do ângulo do joelho;
    - estatísticas do jerk da coxa e da perna.
    """

    # Verifica se o arquivo possui extensão CSV
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=400,
            detail="Envie um arquivo no formato CSV.",
        )

    try:
        # Lê o conteúdo enviado
        content = await file.read()

        if not content:
            raise HTTPException(
                status_code=400,
                detail="O arquivo enviado está vazio.",
            )

        # Converte o conteúdo em um DataFrame
        dataframe = pd.read_csv(BytesIO(content))

        # Calcula o resumo geral da coleta e do ângulo do joelho
        collection_summary = calculate_collection_summary(dataframe)

        # Calcula as métricas de jerk da coxa e da perna
        jerk_summary = calculate_jerk_summary(dataframe)
        time_series = build_time_series(dataframe)

        return {
            "message": "Arquivo recebido e analisado com sucesso.",
            "filename": file.filename,
            "rows": len(dataframe),
            "columns_count": len(dataframe.columns),
            "columns": dataframe.columns.tolist(),
            "summary": collection_summary,
            "jerk_summary": jerk_summary,
            "time_series": time_series,
        }

    except HTTPException:
        raise

    except ValueError as error:
        # Erros causados por colunas ausentes ou dados inválidos
        raise HTTPException(
            status_code=400,
            detail=str(error),
        )

    except pd.errors.EmptyDataError:
        raise HTTPException(
            status_code=400,
            detail="O CSV não contém dados.",
        )

    except pd.errors.ParserError:
        raise HTTPException(
            status_code=400,
            detail="Não foi possível interpretar o arquivo CSV.",
        )

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao processar o arquivo: {str(error)}",
        )