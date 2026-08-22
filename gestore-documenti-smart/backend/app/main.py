from fastapi import FastAPI
from contextlib import asynccontextmanager
from app.database import engine, Base
from app.routers import documento_controller, upload
from app.services.garage_service import garage_service
import app.models  # Importa il package models per registrare tutte le tabelle nel metadata

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Crea le tabelle nel DB all'avvio (utile in sviluppo)
    Base.metadata.create_all(bind=engine)
    
    # Crea il bucket su Garage se non esiste
    garage_service.ensure_bucket()
    
    yield
    # Nessuna azione specifica allo spegnimento

app = FastAPI(
    title="API Documenti Comunali Cloud",
    lifespan=lifespan
)

app.include_router(documento_controller.router)
app.include_router(upload.router)

@app.get("/")
def read_root():
    return {"status": "ok", "message": "Backend avviato e DB connesso!"}

@app.get("/health")
def health_check():
    return {"status": "ok"}