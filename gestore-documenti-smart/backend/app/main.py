from fastapi import FastAPI
from contextlib import asynccontextmanager
from app.database import engine, Base
from app.routers import documento_controller
import app.models  # Importa il package models per registrare tutte le tabelle nel metadata

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Crea le tabelle nel DB all'avvio (utile in sviluppo)
    Base.metadata.create_all(bind=engine)
    yield
    # Nessuna azione specifica allo spegnimento

app = FastAPI(
    title="API Documenti Comunali Cloud",
    lifespan=lifespan
)

app.include_router(documento_controller.router)

@app.get("/")
def read_root():
    return {"status": "ok", "message": "Backend avviato e DB connesso!"}

@app.get("/health")
def health_check():
    return {"status": "ok"}