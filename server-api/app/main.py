from dotenv import load_dotenv

# Load .env before importing routers: services read environment variables at import time.
load_dotenv()

from fastapi import FastAPI  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402

from app.routers import admin, batch, clinician, health, history, models, patients, predictions, profile  # noqa: E402


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
app.include_router(profile.router)
app.include_router(patients.router)
app.include_router(clinician.router)


@app.get("/")
def read_root() -> dict[str, str]:
    return {
        "service": "server-api",
        "status": "running",
        "docs": "/docs",
    }
