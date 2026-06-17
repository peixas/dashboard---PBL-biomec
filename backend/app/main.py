from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes_upload import router as upload_router


app = FastAPI(
    title="Dashboard IMU API",
    description="API para análise e visualização de dados processados de IMUs.",
    version="0.1.0",
)


# Endereços autorizados a acessar o backend pelo navegador
allowed_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]


app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(upload_router)


@app.get("/")
def root():
    return {"message": "Dashboard IMU API funcionando"}


@app.get("/health")
def health_check():
    return {"status": "ok"}