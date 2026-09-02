# ==============================================================================
# app/routers/ricerca.py — Endpoint del motore di ricerca dei documenti
# ==============================================================================

from typing import List, Optional
from fastapi import APIRouter, Depends, Query, UploadFile, File, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.services import ricerca_service
from app.services.ocr_service import ocr_service
from app.schemas.documento_schemas import DocumentoSearchResult


# ─── CONFIGURAZIONE DEL ROUTER ────────────────────────────────────────────────
router = APIRouter(
    prefix="/api/ricerca",
    tags=["Ricerca"]
)


# ─── 1. RICERCA SINTATTICA ────────────────────────────────────────────────────
@router.get("", response_model=List[DocumentoSearchResult])
def ricerca_fulltext(
        # Impedisce l'invio di query completamente vuote
        q: str = Query(..., min_length=1, description="Parole chiave da cercare"),
        limit: int = Query(10, ge=1, le=100),
        db: Session = Depends(get_db),
):
    """
    GET /api/ricerca

    Esegue una ricerca full-text basata sulle parole presenti nel documento,
    utilizzando lo stemming e l'operatore OR tra i termini della query.
    """
    risultati = ricerca_service.ricerca_fulltext(
        db,
        q,
        limit=limit
    )

    return [
        DocumentoSearchResult(
            documento=r["documento"],
            score=r["score"]
        )
        for r in risultati
    ]


# ─── 2. RICERCA SEMANTICA ─────────────────────────────────────────────────────
@router.get("/semantica", response_model=List[DocumentoSearchResult])
def ricerca_semantica(
        q: str = Query(..., min_length=1, description="Frase o parole libere da cercare per significato"),
        limit: int = Query(10, ge=1, le=100),
        db: Session = Depends(get_db),
):
    """
    GET /api/ricerca/semantica

    Esegue una ricerca basata sulla similarità semantica tra i vettori
    della query e quelli dei documenti, sfruttando l'indice HNSW di pgvector.
    """
    risultati = ricerca_service.ricerca_semantica(
        db,
        q,
        limit=limit
    )

    return [
        DocumentoSearchResult(
            documento=r["documento"],
            score=r["score"]
        )
        for r in risultati
    ]


# ─── 3. RICERCA IBRIDA ────────────────────────────────────────────────────────
@router.get("/ibrida", response_model=List[DocumentoSearchResult])
def ricerca_ibrida(
        q: str = Query(..., min_length=1, description="Parole chiave o frase libera"),
        limit: int = Query(10, ge=1, le=100),
        # Controlla il contributo della ricerca semantica nel ranking finale:
        # 0 = solo full-text, 1 = solo semantica, 0.5 = contributo equivalente.
        peso_semantico: float = Query(
            0.5,
            ge=0.0,
            le=1.0,
            description="0 = solo full-text, 1 = solo semantica"
        ),
        db: Session = Depends(get_db),
):
    """
    GET /api/ricerca/ibrida

    Combina la ricerca full-text e semantica tramite una
    Reciprocal Rank Fusion semplificata.

    Il parametro peso_semantico consente di controllare
    il contributo della componente semantica al ranking finale.
    """
    risultati = ricerca_service.ricerca_ibrida(
        db,
        q,
        limit=limit,
        peso_semantico=peso_semantico
    )

    return [
        DocumentoSearchResult(
            documento=r["documento"],
            score=r["score"]
        )
        for r in risultati
    ]


# ─── 4. RICERCA PER IMMAGINE ──────────────────────────────────────────────────
# Mantiene i controlli di sicurezza locali per validare direttamente l'upload.
MAX_IMAGE_SIZE_MB = 10
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}


class RisultatoRicercaImmagine(BaseModel):
    """
    Restituisce il testo individuato dall'OCR insieme ai risultati della ricerca
    """
    testo_estratto: Optional[str]
    risultati: List[DocumentoSearchResult]


@router.post("/immagine", response_model=RisultatoRicercaImmagine)
def ricerca_per_immagine(
        file: UploadFile = File(...),
        limit: int = Query(10, ge=1, le=100),
        peso_semantico: float = Query(
            0.5,
            ge=0.0,
            le=1.0,
            description="0 = solo full-text, 1 = solo semantica"
        ),
        db: Session = Depends(get_db),
):

    """
    POST /api/ricerca/immagine

    Riceve un'immagine, estrae il testo tramite OCR e utilizza il testo
    ottenuto per ricercare il documento corrispondente nell'archivio.
    """
    # ─── VALIDAZIONE DEL FORMATO ───────────────────────────────────────────────
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        # 415: il formato del file non è supportato.
        raise HTTPException(
            status_code=415,
            detail=(
                f"Tipo file non supportato: {file.content_type}. "
                   f"Usa JPEG, PNG o WEBP.",
            )
        )

    file_bytes = file.file.read()

    # ─── VALIDAZIONE DELLA DIMENSIONE ──────────────────────────────────────────
    # Limita la quantità di dati elaborati per contenere il consumo di risorse
    size_mb = len(file_bytes) / (1024 * 1024)

    if size_mb > MAX_IMAGE_SIZE_MB:
        # 413: la dimensione del payload supera il limite configurato
        raise HTTPException(
            status_code=413,
            detail=f"File troppo grande ({size_mb:.1f} MB). Limite: {MAX_IMAGE_SIZE_MB} MB.",
        )

    # ─── ESTRAZIONE DEL TESTO ──────────────────────────────────────────────────
    testo_estratto = ocr_service.estrai_testo(file_bytes)

    # ─── GESTIONE DI OCR SENZA RISULTATO ───────────────────────────────────────
    # Un'immagine senza testo valido non genera un errore:
    # la ricerca restituisce semplicemente un insieme vuoto di risultati.
    if not testo_estratto or not testo_estratto.strip():
        return RisultatoRicercaImmagine(
            testo_estratto=None,
            risultati=[]
        )

    # ─── RICERCA DEL DOCUMENTO ─────────────────────────────────────────────────
    # La ricerca ibrida combina corrispondenza testuale e semantica,
    # rendendo il ranking più robusto agli errori introdotti dall'OCR
    risultati = ricerca_service.ricerca_ibrida(
        db,
        testo_estratto,
        limit=limit,
        peso_semantico=peso_semantico
    )

    return RisultatoRicercaImmagine(
        testo_estratto=testo_estratto,
        risultati=[
            DocumentoSearchResult(
                documento=r["documento"],
                score=r["score"]
            )
            for r in risultati
        ],
    )
