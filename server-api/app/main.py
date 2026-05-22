from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import admin, batch, health, history, models, patients, predictions

from dotenv import load_dotenv

load_dotenv()



app = FastAPI(
    title="Cardiovascular Risk API",
    description="Application API service for cardiovascular disease risk assessment and monitoring.",
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
app.include_router(models.router)
app.include_router(predictions.router)
app.include_router(batch.router)
app.include_router(history.router)
app.include_router(admin.router)
app.include_router(patients.router, prefix="/api/v1")


@app.get("/")
def read_root() -> dict[str, str]:
    return {
        "service": "server-api",
        "status": "running",
        "docs": "/docs",
    }
