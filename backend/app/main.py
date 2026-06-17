from fastapi import FastAPI

from app.api.routes_upload import router as upload_router

app = FastAPI(
    title="Dashboard IMU API",
    description="API para análise e visualização de dados processados de IMUs.",
    version="0.1.0",
)

app.include_router(upload_router)


@app.get("/")
def root():
    return {"message": "Dashboard IMU API funcionando"}


@app.get("/health")
def health_check():
    return {"status": "ok"}