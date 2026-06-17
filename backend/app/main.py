from fastapi import FastAPI

app = FastAPI(
    title="Dashboard IMU API",
    description="API para análise e visualização de dados processados de IMUs.",
    version="0.1.0",
)


@app.get("/")
def root():
    return {"message": "Dashboard IMU API funcionando"}


@app.get("/health")
def health_check():
    return {"status": "ok"}