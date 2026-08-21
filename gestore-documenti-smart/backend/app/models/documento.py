from sqlalchemy import Column, Integer, String, Text, Date, DateTime, Index
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import TSVECTOR
from pgvector.sqlalchemy import Vector
from app.database import Base

class Documento(Base):
    __tablename__ = "documenti"

    __table_args__ = (
        # Indice HNSW per rendere le ricerche semantiche estremamente veloci e scalabili in produzione.
        # Usa vector_cosine_ops poiché i modelli sentence-transformers come MiniLM usano tipicamente la similarità del coseno.
        Index(
            'ix_documenti_embedding_hnsw',
            'embedding',
            postgresql_using='hnsw',
            postgresql_with={'m': 16, 'ef_construction': 64},
            postgresql_ops={'embedding': 'vector_cosine_ops'}
        ),
    )

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    nome = Column(String(255), nullable=False)
    descrizione = Column(Text, nullable=True)
    tipologia = Column(String(100), nullable=True)
    data_documento = Column(Date, nullable=True)
    ufficio = Column(String(200), nullable=True)
    firmatari = Column(Text, nullable=True)
    immagine_url = Column(String(500), nullable=True)
    testo_ocr = Column(Text, nullable=True)
    keywords = Column(Text, nullable=True)
    embedding = Column(Vector(384), nullable=True)
    search_vector = Column(TSVECTOR, nullable=True)
    
    # Utilizzo server_default invece di default per far sì che il valore di default sia applicato
    # direttamente dal database (PostgreSQL) a livello di schema, garantendo l'integrità dei dati 
    # anche se l'inserimento avviene da un client SQL esterno o da uno script non-Python.
    stato_elaborazione = Column(String(50), server_default="in_attesa")
    
    creato_il = Column(DateTime(timezone=True), server_default=func.now())
    aggiornato_il = Column(DateTime(timezone=True), onupdate=func.now())