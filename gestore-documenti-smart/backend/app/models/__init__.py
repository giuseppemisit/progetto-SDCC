# ==============================================================================
# app/models/__init__.py — Registro Ufficiale dei Modelli
# ==============================================================================

# ─── REGISTRAZIONE DEI MODELLI ────────────────────────────────────────────────
# Leggendo questa riga, Python carica in memoria la classe Documento.
# Facendolo, SQLAlchemy "scopre" che esiste questa tabella e la aggiunge
# ai suoi progetti (il metadata di Base).
from app.models.documento import Documento

# ─── API PUBBLICA DEL MODULO ──────────────────────────────────────────────────
# Dichiariamo esplicitamente cosa vogliamo rendere "pubblico" di questa cartella
__all__ = ["Documento"]
