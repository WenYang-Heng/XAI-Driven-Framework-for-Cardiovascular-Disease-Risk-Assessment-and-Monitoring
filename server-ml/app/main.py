from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import batch, dataset, health, predict


app = FastAPI(
    title="Cardiovascular Risk ML Service",
    description="Machine learning inference service for cardiovascular disease risk assessment.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(dataset.router)
app.include_router(predict.router)
app.include_router(batch.router)

app.include_router(dataset.router, prefix="/api/v1")
app.include_router(predict.router, prefix="/api/v1")
app.include_router(batch.router, prefix="/api/v1")


@app.get("/")
def read_root() -> dict[str, str]:
    return {
        "service": "server-ml",
        "status": "running",
        "docs": "/docs",
    }
