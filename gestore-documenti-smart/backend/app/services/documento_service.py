# ==============================================================================
# app/services/documento_service.py — Logica di Business e Gestione Database
# ==============================================================================

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.documento import Documento
from app.schemas.documento_schemas import DocumentoCreate, DocumentoUpdate
from app.services.embedding_service import genera_embedding, testo_per_embedding


# ─── CAMPI RILEVANTI PER LA RICERCA SEMANTICA ─────────────────────────────────

# Solo questi campi influenzano l'embedding
# Le modifiche agli altri dati non richiedono un nuovo calcolo AI
_CAMPI_RILEVANTI_PER_EMBEDDING = {
    "nome",
    "descrizione",
    "tipologia",
    "testo_ocr"
}


# ─── 1. UTILITY INTERNE ───────────────────────────────────────────────────────

def _aggiorna_embedding(db_documento: Documento) -> None:
    """
    Ricalcola e assegna l'embedding del documento in base ai suoi campi testuali correnti.
    Va chiamata dopo ogni creazione o modifica.

    :param db_documento: Entità ORM da aggiornare. L'embedding viene assegnato
        direttamente sull'oggetto passato, la persistenza su database richiede
        un successivo db.commit().

    :return: None, l'effetto è la modifica dell'attributo `embedding` sull'oggetto ricevuto.
    """

    testo = testo_per_embedding(
        db_documento.nome,
        db_documento.descrizione,
        db_documento.tipologia,
        db_documento.testo_ocr,
    )

    db_documento.embedding = genera_embedding(testo)


def ricostruisci_embedding_mancanti(db: Session) -> int:
    """
    Calcola gli embedding mancanti nei database creati prima dell'integrazione AI.

    L'operazione è idempotente: elabora solo le righe con embedding NULL e può
    quindi essere eseguita più volte senza ricalcolare i vettori esistenti.

    :param db: Sessione SQLAlchemy attiva su cui eseguire query e commit.
    :return: Numero di documenti aggiornati.
    """

    documenti = (
        db.query(Documento)
        .filter(Documento.embedding.is_(None))
        .all()
    )

    for documento in documenti:
        _aggiorna_embedding(documento)

    # Evita una transazione inutile quando non sono presenti documenti da aggiornare
    if documenti:
        db.commit()

    return len(documenti)


# ─── 2. SENTINELLA PER L'EMBEDDING PRECALCOLATO ───────────────────────────────

# Distingue un argomento non fornito da un None legittimo (dal caricamento massivo),
# che può essere un risultato valido per un testo privo di contenuto.
_EMBEDDING_NON_FORNITO = object()


# ─── 3. OPERAZIONI CRUD ───────────────────────────────────────────────────────

def create_documento(
        db: Session,
        documento: DocumentoCreate,
        embedding_precalcolato=_EMBEDDING_NON_FORNITO
):
    """
    Crea e salva un nuovo documento a partire dal DTO di input.

    Nella creazione singola l'embedding viene calcolato qui. Nel caricamento
    massivo, invece, gli embedding di tutte le righe sono già stati calcolati
    altrove con un'unica invocazione AI (più efficiente di una chiamata per
    documento); a questa funzione viene passato l'embedding già pronto
    relativo al singolo documento.
    """

    # Converte il DTO validato in una Entity da salvare
    db_documento = Documento(**documento.model_dump())

    if embedding_precalcolato is _EMBEDDING_NON_FORNITO:
        # Genera l'embedding per le operazioni di creazione singola
        _aggiorna_embedding(db_documento)
    else:
        # Riutilizza il risultato batch, anche se esplicitamente None
        db_documento.embedding = embedding_precalcolato

    db.add(db_documento)
    db.commit()

    # Ricarica l'oggetto dal DB per recuperare i valori
    # generati dal database, come ID e i default
    db.refresh(db_documento)

    return db_documento


def get_documenti(
        db: Session,
        skip: int = 0,          # quante righe saltare all'inizio
        limit: int = 100        # quante righe restituire al massimo
):
    """
    Restituisce una pagina di documenti tramite OFFSET e LIMIT
    """

    return (
        db.query(Documento).    # SELECT * FROM documenti
        offset(skip).
        limit(limit).
        all()
    )


def get_documento(
        db: Session,
        documento_id: int
):
    """
    Restituisce il documento richiesto oppure None se non esiste
    """

    return (
        db.query(Documento).
        filter(Documento.id == documento_id).
        first()
    )


def update_documento(
        db: Session,
        documento_id: int,
        documento_data: DocumentoUpdate
):
    """
    Aggiorna i campi forniti e ricalcola l'embedding solo quando necessario
    """

    db_documento = get_documento(db, documento_id)

    if db_documento:
        # exclude_unset=True: include solo i campi effettivamente inviati nella
        # richiesta PATCH, escludendo quelli non specificati dal client.
        campi_forniti = documento_data.model_dump(exclude_unset=True)

        for key, value in campi_forniti.items():
            setattr(db_documento, key, value)

        # Ricalcola l'embedding solo se è cambiato almeno un campo che influenza
        # il significato semantico del documento.
        if _CAMPI_RILEVANTI_PER_EMBEDDING & campi_forniti.keys():
            _aggiorna_embedding(db_documento)

        db.commit()
        db.refresh(db_documento)

    return db_documento


def delete_documento(
        db: Session,
        documento_id: int
):
    """
    Elimina il documento e restituisce l'oggetto rimosso
    """

    db_documento = get_documento(db, documento_id)

    if db_documento:
        db.delete(db_documento)
        db.commit()

    return db_documento


# ─── 4. STATISTICHE DELLA DASHBOARD ──────────────────────────────────────────

def get_statistiche(db: Session) -> dict[str, int]:
    """
    Calcola i conteggi della dashboard direttamente nel database.

    L'aggregazione SQL evita di trasferire l'intero archivio al backend solo
    per eseguire i conteggi.
    """

    # PostgreSQL non restituisce gruppi con valore zero.
    # L'inizializzazione garantisce una struttura di risposta costante per il frontend.
    conteggi = {
        "in_attesa": 0,
        "senza_scansione": 0,
        "elaborato": 0,
        "errore": 0
    }

    # GROUP BY esegue i conteggi direttamente nel database,
    # trasferendo solo i risultati aggregati invece di tutti i documenti.
    # SELECT stato_effettivo, COUNT(id)
    # FROM documenti
    righe = (
        db.query(
            Documento.stato_effettivo,
            func.count(Documento.id)
        )
        .group_by(Documento.stato_effettivo)
        .all()
    )

    for stato, quantita in righe:
        if stato in conteggi:
            conteggi[stato] = quantita

    # totale: somma dei quattro stati effettivi
    # stati effettivi: restituiti da "conteggi"
    return {
        "totale": sum(conteggi.values()),
        **conteggi
    }
