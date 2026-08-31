# ==============================================================================
# app/schemas/documento_schemas.py — (DTO) Schemi di validazione e trasferimento dati
# ==============================================================================

from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


# ─── 1. DATI IN INGRESSO: CREAZIONE ──────────────────────────────────────────

class DocumentoCreate(BaseModel):
    """
    Schema per la creazione di un documento.

    Include solo i campi modificabili dall'utente, escludendo quelli gestiti
    direttamente dal sistema.
    """

    # I limiti di lunghezza sono coerenti con la definizione delle colonne SQL
    nome: str = Field(..., min_length=1, max_length=255)
    descrizione: Optional[str] = None
    tipologia: Optional[str] = Field(None, max_length=100)
    data_documento: Optional[date] = None
    ufficio: Optional[str] = Field(None, max_length=200)
    firmatari: Optional[str] = None



# ─── 2. DATI IN INGRESSO: AGGIORNAMENTO ──────────────────────────────────────

class DocumentoUpdate(BaseModel):
    """
    Schema per l'aggiornamento parziale (PATCH) di un documento.

    Tutti i campi sono opzionali per consentire modifiche parziali tramite PATCH.
    """

    nome: Optional[str] = Field(None, min_length=1, max_length=255)
    descrizione: Optional[str] = None
    tipologia: Optional[str] = Field(None, max_length=100)
    data_documento: Optional[date] = None
    ufficio: Optional[str] = Field(None, max_length=200)
    firmatari: Optional[str] = None

    # Consentono la correzione manuale dei risultati generati dall'elaborazione AI
    testo_ocr: Optional[str] = None
    keywords: Optional[str] = None



# ─── 3. DATI IN USCITA: RISPOSTA API ─────────────────────────────────────────

class DocumentoResponse(BaseModel):
    """
    Schema restituito dalle API.

    Include sia i dati del documento sia i campi generati o gestiti dal sistema.
    """

    id: int
    nome: str
    descrizione: Optional[str] = None
    tipologia: Optional[str] = None
    data_documento: Optional[date] = None
    ufficio: Optional[str] = None
    firmatari: Optional[str] = None
    immagine_url: Optional[str] = None
    testo_ocr: Optional[str] = None
    keywords: Optional[str] = None
    stato_elaborazione: str

    # Valore calcolato automaticamente dal database
    stato_effettivo: str

    creato_il: datetime
    aggiornato_il: Optional[datetime] = None

    # Permette a Pydantic di creare la risposta direttamente dagli oggetti ORM
    model_config = ConfigDict(from_attributes=True)



# ─── 4. RISULTATI DELLE RICERCHE ──────────────────────────────────────────────

class DocumentoSearchResult(BaseModel):
    """
    Rappresenta un documento restituito da una ricerca con il relativo
    punteggio di rilevanza.
    """

    documento: DocumentoResponse

    # Score calcolato dal motore di ricerca, utilizzato per ordinare i risultati
    score: float

    # Consente la conversione diretta dagli oggetti ORM
    model_config = ConfigDict(from_attributes=True)



# ─── 5. SUGGERIMENTO DELLA TIPOLOGIA ──────────────────────────────────────────

class SuggerisciTipologiaRequest(BaseModel):
    """
    Schema per la richiesta di suggerimenti sulla tipologia del documento (POST).
    """

    nome: Optional[str] = None
    descrizione: Optional[str] = None
    testo_ocr: Optional[str] = None
    keywords: Optional[str] = None

    # Limita il numero di risultati per impedire valori non validi o richieste
    # eccessive che potrebbero aumentare inutilmente il carico del sistema.
    top_k: int = Field(3, ge=1, le=20)


class TipologiaSuggerita(BaseModel):
    """
    Rappresenta una tipologia proposta dal modello con il relativo score di confidenza.
    """

    tipologia: str
    confidenza: float


class SuggerimentoTipologiaResponse(BaseModel):
    """
    Rappresenta la risposta dell'endpoint di suggerimento della tipologia.
    """

    suggerimenti: list[TipologiaSuggerita]



# ─── 6. STATISTICHE AGGREGATE DELL'ARCHIVIO ───────────────────────────────────

class StatisticheArchivio(BaseModel):
    """
    Rappresenta i conteggi complessivi dell'archivio, calcolati direttamente
    dal database tramite aggregazioni SQL.
    """

    # I valori non vengono calcolati sui risultati paginati: un endpoint
    # dedicato evita conteggi incompleti e il trasferimento dell'intero archivio

    # I contatori rappresentano tutti gli stati possibili di 'stato_effettivo'
    # e la loro somma corrisponde al totale dei documenti

    # 'in_attesa' indica elaborazioni realmente pendenti,
    # 'senza_scansione' identifica documenti privi dell'immagine necessaria
    # per avviare l'elaborazione.

    totale: int
    in_attesa: int
    senza_scansione: int
    elaborato: int
    errore: int
