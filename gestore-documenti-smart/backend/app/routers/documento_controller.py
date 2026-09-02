# ==============================================================================
# app/routers/documento_controller.py — Endpoint per la gestione dei documenti
# ==============================================================================

import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.schemas.documento_schemas import (
    DocumentoCreate,
    DocumentoUpdate,
    DocumentoResponse,
    DocumentoSearchResult,
    SuggerisciTipologiaRequest,
    SuggerimentoTipologiaResponse,
    TipologiaSuggerita,
    StatisticheArchivio
)
from app.services import (
    documento_service,
    ricerca_service,
    classificazione_service
)
from app.services.garage_service import garage_service


logger = logging.getLogger(__name__)


# ─── CONFIGURAZIONE DEL ROUTER ────────────────────────────────────────────────
# Tutte le API dei documenti condividono il prefisso /api/documenti.
# Il tag raggruppa le rotte nella documentazione OpenAPI/Swagger.

router = APIRouter(
    prefix="/api/documenti",
    tags=["Documenti"]
)


# ─── 1. AI: SUGGERIMENTO DELLA TIPOLOGIA ──────────────────────────────────────
@router.post("/suggerisci-tipologia",response_model=SuggerimentoTipologiaResponse)
def suggerisci_tipologia(payload: SuggerisciTipologiaRequest):
    """
    POST /api/documenti/suggerisci-tipologia

    Analizza nome, descrizione, testo OCR e keywords per restituire
    le tipologie documentali più probabili, ordinate per confidenza.
    Il parametro top_k determina il numero massimo di suggerimenti.
    """
    risultati = classificazione_service.suggerisci_tipologia(
        nome=payload.nome,
        descrizione=payload.descrizione,
        testo_ocr=payload.testo_ocr,
        keywords=payload.keywords,
        top_k=payload.top_k,
    )

    return SuggerimentoTipologiaResponse(
        suggerimenti=[TipologiaSuggerita(**r) for r in risultati]
    )


# ─── 2. CREAZIONE E LETTURA DEI DOCUMENTI ─────────────────────────────────────
@router.post("", response_model=DocumentoResponse)
def create_documento(
        documento: DocumentoCreate,
        db: Session = Depends(get_db)
):
    """
    POST /api/documenti

    Crea un nuovo documento e restituisce la risorsa appena salvata.
    La sessione SQLAlchemy viene iniettata automaticamente tramite get_db.
    """
    return documento_service.create_documento(db=db, documento=documento)


@router.get("", response_model=List[DocumentoResponse])
def read_documenti(
        skip: int = Query(0, ge=0),
        limit: int = Query(100, ge=1, le=100),
        db: Session = Depends(get_db),
):
    """
    GET /api/documenti

    Restituisce i documenti con paginazione tramite skip e limit.
    Il limite massimo di 100 risultati evita risposte pesanti.
    """
    return documento_service.get_documenti(
        db,
        skip=skip,
        limit=limit
    )


# ─── 3. STATISTICHE DELL'ARCHIVIO ─────────────────────────────────────────────
@router.get("/statistiche", response_model=StatisticheArchivio)
def statistiche_archivio(db: Session = Depends(get_db)):
    """
    GET /api/documenti/statistiche

    Restituisce i conteggi complessivi dell'archivio e la relativa
    distribuzione per stato di elaborazione, calcolati tramite aggregazione SQL.

    La rotta è dichiarata prima di /{documento_id}: FastAPI valuta le rotte
    nell'ordine di registrazione e, con l'ordine inverso, "statistiche"
    verrebbe interpretato come documento_id causando un errore di validazione.
    """
    return StatisticheArchivio(**documento_service.get_statistiche(db))


# ─── 4. AI: RICERCA DI DOCUMENTI SIMILI ──────────────────────────────────────
@router.get("/{documento_id}/simili", response_model=List[DocumentoSearchResult])
def documenti_simili(
        documento_id: int,
        limit: int = Query(5, ge=1, le=50),
        db: Session = Depends(get_db)
):
    """
    GET /api/documenti/{documento_id}/simili

    Restituisce i documenti semanticamente più vicini a quello indicato,
    utilizzando il relativo embedding.

    Se il documento non esiste viene restituito 404.
    Se l'embedding non è disponibile, il service restituisce una lista vuota.
    """
    db_documento = documento_service.get_documento(
        db,
        documento_id=documento_id
    )

    if db_documento is None:
        raise HTTPException(
            status_code=404,
            detail="Documento non trovato"
        )

    risultati = ricerca_service.documenti_simili(
        db,
        documento_id,
        limit=limit
    )

    return [
        DocumentoSearchResult(
            documento=r["documento"],
            score=r["score"]
        )
        for r in risultati
    ]


# ─── 5. MANUTENZIONE DEGLI EMBEDDING ──────────────────────────────────────────
@router.post("/manutenzione/ricostruisci-embedding")
def trigger_ricostruzione_embedding(db: Session = Depends(get_db)):
    """
    POST /api/documenti/manutenzione/ricostruisci-embedding

    Ricalcola gli embedding mancanti oppure obsoleti, ad esempio per documenti
    storici o elaborazioni OCR precedentemente fallite.

    L'UPDATE degli embedding attiva il trigger PostgreSQL che aggiorna
    automaticamente anche search_vector, mantenendo allineate la ricerca
    semantica e quella full-text.

    La funzione è sincrona (def): FastAPI la esegue nel threadpool,
    evitando di bloccare l'event loop durante l'elaborazione.
    """
    documento_service.ricostruisci_embedding_mancanti(db)

    return {
        "message":
            "Ricostruzione embedding e search vector"
            "completata con successo"
    }


# ─── 6. GESTIONE DEL SINGOLO DOCUMENTO ───────────────────────────────────────
@router.get("/{documento_id}", response_model=DocumentoResponse)
def read_documento(
        documento_id: int,
        db: Session = Depends(get_db)
):
    """
    GET /api/documenti/{documento_id}

    Restituisce il documento identificato da documento_id.
    Se il documento non esiste viene restituito un errore 404.
    """
    db_documento = documento_service.get_documento(
        db,
        documento_id=documento_id
    )

    if db_documento is None:
        raise HTTPException(
            status_code=404,
            detail="Documento non trovato"
        )

    return db_documento


@router.patch("/{documento_id}", response_model=DocumentoResponse)
def update_documento(
        documento_id: int,
        documento: DocumentoUpdate,
        db: Session = Depends(get_db)
):
    """
    PATCH /api/documenti/{documento_id}

    Aggiorna parzialmente il documento indicato e restituisce
    la versione aggiornata. Se non esiste, viene restituito 404.
    """
    db_documento = documento_service.update_documento(
        db,
        documento_id,
        documento
    )

    if db_documento is None:
        raise HTTPException(
            status_code=404,
            detail="Documento non trovato"
        )

    return db_documento


@router.delete("/{documento_id}", status_code=200)
def delete_documento(documento_id: int, db: Session = Depends(get_db)):
    """
    DELETE /api/documenti/{documento_id}

    Elimina il documento e, se presente, il relativo file da Garage.

    La cancellazione dello storage è gestita separatamente da quella
    del database: un errore di Garage viene registrato ma non impedisce
    l'eliminazione del record, evitando di bloccare l'operazione principale.
    """
    db_documento = documento_service.get_documento(
        db,
        documento_id
    )

    if db_documento is None:
        raise HTTPException(
            status_code=404,
            detail="Documento non trovato"
        )

    # ─── GESTIONE DEL FILE ASSOCIATO ──────────────────────────────────────────
    # Il file viene eliminato prima del record del database.
    # In caso di errore, il warning consente di individuare eventuali
    # oggetti orfani nello storage senza interrompere la richiesta.

    if db_documento.immagine_url:
        try:
            garage_service.delete_file(
                db_documento.immagine_url
            )

        except Exception as e:
            logger.warning(
                "Impossibile cancellare l'immagine '%s' da Garage "
                "per il documento %d: %s",
                db_documento.immagine_url,
                documento_id,
                e,
            )

    documento_service.delete_documento(
        db,
        documento_id
    )

    return {
        "message": "Documento eliminato con successo"
    }
