# ==============================================================================
# app/main.py — Entry Point dell'Applicazione FastAPI
# ==============================================================================

from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from sqlalchemy import text

from app.database import SessionLocal, init_db
from app.routers import documento_controller, upload, ricerca
from app.services.garage_service import garage_service

# L'import registra i modelli SQLAlchemy prima dell'inizializzazione del database
# In questo modo SQLAlchemy conosce tutte le tabelle definite dall'applicazione
import app.models


# ─── 1. CICLO DI VITA DELL'APPLICAZIONE ───────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Gestisce le operazioni di avvio e spegnimento dell'applicazione.

    Il codice prima di yield viene eseguito durante lo startup,
    mentre quello successivo viene eseguito durante lo shutdown.
    """

    # ─── INIZIALIZZAZIONE DEL DATABASE ─────────────────────────────────────────
    # Configura il database prima di accettare richieste.
    # Il lock consultivo PostgreSQL evita conflitti durante l'avvio
    # simultaneo di più container o istanze dell'applicazione

    init_db()

    # ─── INIZIALIZZAZIONE DELL'OBJECT STORAGE ──────────────────────────────────
    # Verifica l'esistenza del bucket e lo crea se necessario,
    # garantendo la disponibilità dello storage all'avvio
    garage_service.ensure_bucket()


    # ─── AVVIO DEL SERVER ──────────────────────────────────────────────────────
    # Cede il controllo a FastAPI, che può iniziare a gestire le richieste HTTP

    yield


    # ─── SHUTDOWN ──────────────────────────────────────────────────────────────
    # Non sono richieste operazioni di cleanup specifiche


# ─── 2. CREAZIONE DELL'APPLICAZIONE ───────────────────────────────────────────
app = FastAPI(
    title="API Documenti Comunali Cloud",
    lifespan=lifespan
)


# ─── 3. REGISTRAZIONE DELLE ROTTE ─────────────────────────────────────────────
# I router separano gli endpoint per responsabilità, evitando di concentrare
# tutta la logica HTTP nel file principale dell'applicazione

app.include_router(documento_controller.router)
app.include_router(upload.router)
app.include_router(ricerca.router)


# ─── 4. ENDPOINT DI SERVIZIO ──────────────────────────────────────────────────
@app.get("/")
def read_root():
    """
    GET /

    Endpoint di base per verificare rapidamente che il server
    sia avviato e raggiungibile.
    """
    return {
        "status": "ok",
        "message": "Backend avviato"
    }


@app.get("/health")
def health_check():
    """
    GET /health

    Verifica lo stato dell'applicazione e la raggiungibilità del database.

    Il controllo esegue una query reale invece di verificare soltanto
    che il processo FastAPI sia attivo.
    """
    try:
        # Apre una sessione dedicata esclusivamente al controllo di salute.
        db = SessionLocal()

        try:
            # SELECT 1 verifica la connessione al database con un costo minimo
            db.execute(text("SELECT 1"))

        finally:
            # Chiude sempre la sessione per evitare connessioni inutilizzate
            db.close()

    except Exception:
        # Se il database non è raggiungibile, l'applicazione restituisce
        # 503 Service Unavailable per segnalare un servizio non operativo.

        raise HTTPException(
            status_code=503,
            detail="Database non raggiungibile"
        )

    return {"status": "ok"}
