# ==============================================================================
# app/config.py — Configurazione centralizzata (Pydantic Settings)
# ==============================================================================
from pathlib import Path
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict

# ─── 1. PATH ASSOLUTO DEL FILE .ENV ───────────────────────────────────────────
# Calcolato dalla posizione fisica di questo file → funziona da qualsiasi CWD.
# In Docker il .env non esiste: le variabili arrivano da docker-compose.yml.
_ENV_FILE = Path(__file__).resolve().parent.parent.parent / ".env"


class Settings(BaseSettings):
    """
    Classe che mappa e valida le variabili d'ambiente (eredita BaseSettings).
    Se manca una variabile obbligatoria, Pydantic interrompe l'avvio con errore chiaro.
    """

    model_config = SettingsConfigDict(
        env_file=_ENV_FILE,
        env_file_encoding="utf-8",
        env_ignore_empty=True,          # Variabili vuote nel .env, usa il default
        extra="ignore",
    )

    # ─── DATABASE ─────────────────────────────────────────────────────────────
    DATABASE_URL: str

    # ─── OBJECT STORAGE (Garage / S3) ─────────────────────────────────────────
    S3_ENDPOINT: str
    S3_ACCESS_KEY: str
    S3_SECRET_KEY: str
    S3_BUCKET_NAME: str

    # ─── DOPPIO ENDPOINT (Presigned URL in locale) ────────────────────────────
    # S3_ENDPOINT:          usato da FastAPI dentro la rete Docker (es. http://garage:3900)
    # S3_PUBLIC_ENDPOINT:   usato nei link generati per il browser (es. http://localhost:3900)
    S3_PUBLIC_ENDPOINT: Optional[str] = None    # Deve essere una stringa o None(default se assente nel .env)

    # ─── AI ───────────────────────────────────────────────────────────────────
    # Default del modello; sovrascrivibile via .env se serve
    MODEL_NAME: str = "sentence-transformers/all-MiniLM-L6-v2"


# ─── SINGLETON ────────────────────────────────────────────────────────────────
# Un'unica istanza in memoria: gli altri moduli importano "settings" già pronto
# senza rileggere il .env ogni volta
settings = Settings()
