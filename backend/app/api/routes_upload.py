from io import BytesIO

import pandas as pd
from fastapi import APIRouter, File, HTTPException, UploadFile

router = APIRouter(
    prefix="/api/uploads",
    tags=["Uploads"],
)


@router.post("/csv")
async def upload_csv(file: UploadFile = File(...)):
    # Verifica se o arquivo parece ser CSV
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=400,
            detail="Envie um arquivo no formato CSV.",
        )

    try:
        content = await file.read()

        if not content:
            raise HTTPException(
                status_code=400,
                detail="O arquivo enviado está vazio.",
            )

        dataframe = pd.read_csv(BytesIO(content))

        return {
            "message": "Arquivo recebido com sucesso.",
            "filename": file.filename,
            "rows": len(dataframe),
            "columns_count": len(dataframe.columns),
            "columns": dataframe.columns.tolist(),
        }

    except HTTPException:
        raise

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