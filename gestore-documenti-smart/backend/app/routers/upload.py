# ==============================================================================
# app/routers/upload.py — API di caricamento singolo e massivo
# ==============================================================================

import logging

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.services.documento_service import create_documento, _aggiorna_embedding
from app.services.embedding_service import genera_embeddings_batch, testo_per_embedding
from app.utils.csv_parser import parse_file

from app.database import get_db, SessionLocal
from app.models.documento import Documento
from app.schemas.documento_schemas import DocumentoResponse
from app.services.garage_service import garage_service
from app.services.ocr_service import ocr_service
from app.services.keyword_service import estrai_keywords


logger = logging.getLogger(__name__)


# ─── CONFIGURAZIONE DEL ROUTER ────────────────────────────────────────────────
router = APIRouter(
    prefix="/api/upload",
    tags=["upload"]
)

# ─── VALIDAZIONE DEGLI UPLOAD IMMAGINE ────────────────────────────────────────
# I limiti vengono controllati direttamente dal router per bloccare
# richieste non valide prima dell'elaborazione OCR
MAX_FILE_SIZE_MB = 10

ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp"
}


# ─── 1. CARICAMENTO IMMAGINE E AVVIO OCR ──────────────────────────────────────
@router.post("/immagine/{documento_id}", response_model=DocumentoResponse)
def upload_immagine(
        documento_id: int,
        background_tasks: BackgroundTasks,
        file: UploadFile = File(...),
        db: Session = Depends(get_db),
):
    """
    POST /api/upload/immagine/{documento_id}

    Carica o sostituisce l'immagine associata a un documento e avvia
    l'elaborazione OCR in background.

    La funzione è sincrona perché GarageService utilizza boto3, una libreria
    bloccante. FastAPI può quindi eseguire l'endpoint nel threadpool senza
    bloccare l'event loop principale.
    """
    documento = (
        db.query(Documento)
        .filter(Documento.id == documento_id)
        .first()
    )

    if documento is None:
        raise HTTPException(
            status_code=404,
            detail=f"Documento {documento_id} non trovato"
        )


    # ─── VALIDAZIONE DEL FORMATO ───────────────────────────────────────────────
    # Accetta solo formati supportati dal sistema di elaborazione immagini

    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=415,
            detail=f"Tipo file non supportato: {file.content_type}. "
                   f"Usare JPEG, PNG o WEBP.",
        )

    file_bytes = file.file.read()

    # ─── VALIDAZIONE DELLA DIMENSIONE ──────────────────────────────────────────
    # Limita il consumo di memoria e le richieste eccessivamente onerose

    size_mb = len(file_bytes) / (1024 * 1024)
    if size_mb > MAX_FILE_SIZE_MB:
        raise HTTPException(
            status_code=413,
            detail=f"File troppo grande ({size_mb:.1f} MB). "
                   f"Limite: {MAX_FILE_SIZE_MB} MB.",
        )


    # ─── SOSTITUZIONE DELL'IMMAGINE PRECEDENTE ─────────────────────────────────
    # Elimina il file precedente per evitare oggetti orfani nello storage

    if documento.immagine_url:
        try:
            garage_service.delete_file(documento.immagine_url)

        except Exception as e:
            # L'errore viene registrato senza interrompere il caricamento della nuova immagine
            logger.warning(
                "Impossibile cancellare la vecchia immagine '%s' da Garage per il documento %d: %s",
                documento.immagine_url,
                documento_id,
                e,
            )

    # ─── CARICAMENTO SU GARAGE ─────────────────────────────────────────────────
    # Lo storage restituisce la chiave dell'oggetto, salvata nel database
    # per separare i dati applicativi dal sistema di archiviazione

    object_key = garage_service.upload_file(
        file_bytes=file_bytes,
        original_filename=file.filename,
        content_type=file.content_type,
    )

    documento.immagine_url = object_key

    # L'elaborazione OCR non è ancora completata
    documento.stato_elaborazione = "in_attesa"

    db.commit()
    db.refresh(documento)

    # ─── AVVIO DELL'ELABORAZIONE IN BACKGROUND ─────────────────────────────────
    # L'utente riceve subito la risposta HTTP mentre OCR, keyword extraction
    # e aggiornamento dell'embedding vengono eseguiti successivamente.
    background_tasks.add_task(
        _processa_ocr_in_background,
        documento_id,
        file_bytes
    )

    return documento


# ─── 2. ELABORAZIONE OCR IN BACKGROUND ───────────────────────────────────────
def _processa_ocr_in_background(
        documento_id: int,
        image_bytes: bytes
):
    """
    Elabora l'immagine dopo la risposta HTTP.

    La background task utilizza una nuova sessione database perché la sessione
    della richiesta originale viene chiusa al termine della risposta.
    """
    db = SessionLocal()

    try:
        documento = (
            db.query(Documento)
            .filter(Documento.id == documento_id)
            .first()
        )

        if documento is None:
            logger.error(
                "Documento %d non trovato durante l'elaborazione OCR",
                documento_id
            )
            return


        # ─── ESTRAZIONE DEL TESTO ──────────────────────────────────────────────
        testo = ocr_service.estrai_testo(image_bytes)
        documento.testo_ocr = testo if testo else None


        # ─── ESTRAZIONE DELLE KEYWORD ──────────────────────────────────────────
        # Le keyword vengono generate solo se l'OCR ha prodotto testo utile.

        if testo:
            kw = estrai_keywords(testo)
            documento.keywords = kw if kw else None


        # ─── AGGIORNAMENTO DELLO STATO ─────────────────────────────────────────
        documento.stato_elaborazione = "elaborato" if testo else "errore"


        # ─── AGGIORNAMENTO DELL'EMBEDDING ──────────────────────────────────────
        # L'embedding viene rigenerato includendo il nuovo testo OCR e le keyword estratte
        _aggiorna_embedding(documento)
        
        db.commit()

        if testo:
            logger.info("OCR completato per il documento %d", documento_id)
        else:
            logger.warning("OCR fallito (nessun testo estratto) per il documento %d", documento_id)


    except Exception as e:
        logger.error("Errore OCR per il documento %d: %s", documento_id, e)

        # Ripristina la transazione per evitare di lasciare la sessione
        # in stato non utilizzabile dopo un errore.

        db.rollback()

        try:
            documento = (
                db.query(Documento)
                .filter(Documento.id == documento_id)
                .first()
            )

            if documento:
                # Lo stato consente al frontend di distinguere un documento
                # non elaborato da un'elaborazione fallita

                documento.stato_elaborazione = "errore"
                db.commit()

        except Exception as db_err:
            logger.error(
                "Impossibile aggiornare lo stato di errore per il documento %d: %s",
                documento_id, db_err
            )
    finally:
        # Chiudere sempre la sessione privata della background task
        db.close()


# ─── 3. RECUPERO DELL'URL DELL'IMMAGINE ───────────────────────────────────────
@router.get("/immagine/{documento_id}/url")
def get_url_immagine(
        documento_id: int,
        db: Session = Depends(get_db)
):
    """
    GET /api/upload/immagine/{documento_id}/url

    Genera un URL temporaneo per accedere all'immagine associata
    al documento senza rendere pubblici gli oggetti nello storage.
    """
    documento = (
        db.query(Documento)
        .filter(Documento.id == documento_id)
        .first()
    )

    if documento is None:
        raise HTTPException(
            status_code=404,
            detail=f"Documento {documento_id} non trovato"
        )
    if not documento.immagine_url:
        raise HTTPException(
            status_code=404,
            detail="Questo documento non ha un'immagine associata"
        )

    url = garage_service.get_presigned_url(documento.immagine_url)

    return {"url": url}


# ─── 4. CARICAMENTO MASSIVO ───────────────────────────────────────────────────

MAX_BULK_FILE_SIZE_MB = 5


class ErroreRiga(BaseModel):
    # Rappresenta un errore associato a una specifica riga del file importato
    riga: int
    errore: str


class RisultatoCaricamentoMassivo(BaseModel):
    # Riassume l'esito dell'importazione e conserva gli errori non bloccanti
    totale_righe: int
    successi: int
    falliti: int
    errori: list[ErroreRiga]


@router.post("/massivo", response_model=RisultatoCaricamentoMassivo)
def upload_massivo(
        file: UploadFile = File(...),
        db: Session = Depends(get_db),
):
    """
    POST /api/upload/massivo

    Importa documenti da un file CSV o JSON e restituisce il risultato
    dell'elaborazione, inclusi gli eventuali errori per singola riga.

    Gli embedding vengono generati in batch per ridurre il numero di chiamate
    al modello e migliorare le prestazioni dell'importazione.
    """

    # ─── VALIDAZIONE DEL FORMATO ───────────────────────────────────────────────
    if not file.filename or not file.filename.lower().endswith((".csv", ".json")):
        raise HTTPException(
            status_code=415,
            detail="Formato file non supportato. Carica un file .csv o .json",
        )

    file_bytes = file.file.read()


    # ─── VALIDAZIONE DELLA DIMENSIONE ──────────────────────────────────────────
    size_mb = len(file_bytes) / (1024 * 1024)

    if size_mb > MAX_BULK_FILE_SIZE_MB:
        raise HTTPException(
            status_code=413,
            detail=(f"File troppo grande ({size_mb:.1f} MB). "
                    f"Limite: {MAX_BULK_FILE_SIZE_MB} MB."),
        )


    # ─── PARSING DEL FILE ──────────────────────────────────────────────────────
    # Il parser separa i documenti validi dagli errori di formato,
    # consentendo di proseguire con l'importazione parziale

    risultato_parsing = parse_file(
        file_bytes,
        file.filename
    )

    errori: list[ErroreRiga] = [
        ErroreRiga(
            riga=e.riga,
            errore=e.errore
        )
        for e in risultato_parsing.errori
    ]

    successi = 0


    # ─── GENERAZIONE BATCH DEGLI EMBEDDING ─────────────────────────────────────
    # Tutti i testi validi vengono elaborati in un'unica operazione,
    # riducendo il costo rispetto alla generazione di un embedding per volta

    testi_da_calcolare = [
        testo_per_embedding(
            d.nome,
            d.descrizione,
            d.tipologia,
            None
        )
        for (_, d) in risultato_parsing.documenti_validi
    ]

    embeddings = genera_embeddings_batch(
        testi_da_calcolare
    )


    # ─── SALVATAGGIO DEI DOCUMENTI ─────────────────────────────────────────────
    # zip associa ogni documento all'embedding generato nella stessa posizione

    for (riga_originale, documento_create), embedding in zip(
            risultato_parsing.documenti_validi, embeddings):
        try:
            # L'embedding viene passato già calcolato per evitare una seconda
            # chiamata al servizio AI durante il salvataggio

            create_documento(
                db,
                documento_create,
                embedding_precalcolato=embedding
            )

            successi += 1

        except Exception as e:
            # Il rollback annulla solo la transazione corrente, permettendo
            # all'importazione di proseguire con le righe successive

            db.rollback()

            logger.error(
                "Errore creazione documento durante upload massivo (riga %d): %s",
                riga_originale, e
            )
            errori.append(
                ErroreRiga(
                    riga=riga_originale,
                    errore=f"Errore database: {e}"
                )
            )

    return RisultatoCaricamentoMassivo(
        totale_righe=risultato_parsing.totale,
        successi=successi,
        falliti=len(errori),
        errori=errori,
    )
