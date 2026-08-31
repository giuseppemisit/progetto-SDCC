# ==============================================================================
# app/models/documento.py — Struttura della Tabella e Logica di Database
# ==============================================================================

from sqlalchemy import CheckConstraint, Column, Computed, Integer, String, Text, Date, DateTime, Index
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import TSVECTOR
from pgvector.sqlalchemy import Vector
from app.database import Base


class Documento(Base):
    __tablename__ = "documenti"

    # ─── 1. VINCOLI E INDICI ──────────────────────────────────────────────────

    __table_args__ = (
        # INDICE AI (HNSW): Organizza i vettori matematici per permettere
        # la ricerca per similarità (ricerca semantica) in millisecondi
        Index(
            'ix_documenti_embedding_hnsw',
            'embedding',
            postgresql_using='hnsw',
            postgresql_with={'m': 16, 'ef_construction': 64},
            postgresql_ops={'embedding': 'vector_cosine_ops'}
        ),
        # INDICE FULL-TEXT (GIN): Senza questo, cercare una parola nei testi OCR
        # costringerebbe il DB a leggere la tabella riga per riga
        Index(
            'ix_documenti_search_vector_gin',
            'search_vector',
            postgresql_using='gin'
        ),
        # VINCOLO DI STATO: Impedisce al database di accettare valori di stato non previsti
        CheckConstraint(
            "stato_elaborazione IN ('in_attesa', 'elaborato', 'errore')",
            name='ck_documenti_stato_elaborazione'
        ),
    )


    # ─── 2. DATI DEL DOCUMENTO ────────────────────────────────────────────────

    id = Column(Integer, primary_key=True, autoincrement=True)

    nome = Column(String(255), nullable=False)
    descrizione = Column(Text, nullable=True)
    tipologia = Column(String(100), nullable=True)
    data_documento = Column(Date, nullable=True)
    ufficio = Column(String(200), nullable=True)
    firmatari = Column(Text, nullable=True)
    immagine_url = Column(String(500), nullable=True)
    testo_ocr = Column(Text, nullable=True)
    keywords = Column(Text, nullable=True)

    # Colonna per il vettore AI (384 dimensioni = modello MiniLM)
    embedding = Column(Vector(384), nullable=True)
    # Colonna per la ricerca per parole (TSVECTOR, aggiornata dal Trigger)
    search_vector = Column(TSVECTOR, nullable=True)


    # ─── 3. STATO DI ELABORAZIONE ─────────────────────────────────────────────

    # Il default è imposto dal database, quindi vale anche per inserimenti effettuati al di fuori di Python
    stato_elaborazione = Column(
        String(50),
        nullable=False,
        server_default="in_attesa"
    )

    # Stato derivato calcolato direttamente da PostgreSQL.
    # Se manca la scansione, prevale 'senza_scansione'; altrimenti viene
    # utilizzato lo stato di elaborazione, evitando combinazioni incoerenti.
    stato_effettivo = Column(
        String(50),
        Computed(
            "CASE WHEN immagine_url IS NULL "
            "THEN 'senza_scansione' ELSE stato_elaborazione END",
            persisted=True,
        ),
        nullable=False,
    )


    # ─── 4. TIMESTAMP DI SISTEMA ──────────────────────────────────────────────

    # PostgreSQL assegna automaticamente la data di creazione.
    creato_il = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )

    # server_default imposta la data iniziale; onupdate la aggiorna
    # automaticamente quando il record viene modificato tramite SQLAlchemy.
    aggiornato_il = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now()
    )