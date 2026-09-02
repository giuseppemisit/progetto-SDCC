# ==============================================================================
# app/services/ricerca_service.py — Motore di Ricerca Avanzato
# ==============================================================================

from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.models.documento import Documento
from app.services.embedding_service import genera_embedding


# ─── 1. RICERCA FULL-TEXT ─────────────────────────────────────────────────────

def ricerca_fulltext(
        db: Session,
        query: str,
        limit: int = 50
) -> list[dict]:
    """
    Cerca i documenti in base alle parole contenute nella query
    """

    termini = query.strip().split()

    if not termini:
        return []

    # Costruisco la Text Search Query (tsquery) a partire dal primo termine
    tsquery = func.plainto_tsquery('italian', termini[0])

    # Unisco ogni termine successivo con l'operatore OR (||), trasformandolo
    # separatamente per preservare stemming e normalizzazione.
    for termine in termini[1:]:
        tsquery = tsquery.op('||')(
            func.plainto_tsquery('italian', termine)
        )

    # ts_rank calcola quanto il documento è pertinente alla ricerca,
    # confrontando il tsvector del documento (search_vector) con il tsquery della ricerca
    rank = func.ts_rank(
        Documento.search_vector,
        tsquery
    ).label('score')

    # Costruiamo la query
    statement = (
        # Seleziona documento e punteggio
        select(Documento, rank)
        # Filtra sui risultati che soddisfano il match full-text (@@)
        .where(Documento.search_vector.op('@@')(tsquery))
        # Ordina per rilevanza decrescente
        .order_by(rank.desc())
        .limit(limit)
    )

    righe = db.execute(statement).all()

    return [
        {
            "documento": doc,
            "score": float(score)
        }
        for (doc, score) in righe
    ]


# ─── 2. RICERCA SEMANTICA ─────────────────────────────────────────────────────

def ricerca_semantica(
        db: Session,
        query: str,
        limit: int = 10
) -> list[dict]:
    """
    Cerca documenti semanticamente simili alla query, anche senza
    corrispondenze testuali esatte.
    """

    query_embedding = genera_embedding(query)

    if query_embedding is None:
        return []

    # Documento.embedding è la colonna dell'intera tabella:
    # il confronto avviene quindi lato database, riga per riga.
    # cosine_distance: calcola la distanza coseno.
    distanza = Documento.embedding.cosine_distance(
        query_embedding
    ).label("distanza")

    statement = (
        select(Documento, distanza)
        # Esclude i documenti privi di embedding, non confrontabili semanticamente
        .where(Documento.embedding.isnot(None))
        .order_by(distanza)
        .limit(limit)
    )

    righe = db.execute(statement).all()

    # cosine_distance è in [0, 2]: score = 1 - dist è in [-1, 1].
    # Il valore minimo viene limitato a 0 per evitare punteggi negativi.
    return [
        {
            "documento": doc,
            "score": float(max(0.0, 1 - dist)),
        }
        for (doc, dist) in righe
    ]


# ─── 3. RICERCA IBRIDA ────────────────────────────────────────────────────────

def ricerca_ibrida(
        db: Session,
        query: str,
        limit: int = 10,
        peso_semantico: float = 0.5
) -> list[dict]:
    """
    Combina ricerca full-text e semantica in un unico punteggio.
    Utile quando alcuni documenti rilevanti condividono le parole
    della query e altri ne condividono solo il senso.
    """

    # Recupera più risultati del limite finale per ridurre il rischio di
    # escludere documenti rilevanti in una delle due modalità di ricerca.

    risultati_fulltext = ricerca_fulltext(
        db,
        query,
        limit=limit * 2
    )

    risultati_semantici = ricerca_semantica(
        db,
        query,
        limit=limit * 2
    )

    # I punteggi full-text non hanno un intervallo fisso. La normalizzazione rispetto
    # al massimo punteggio ottenuto li rende confrontabili con gli score semantici.
    max_ft = (
            max(
                (r["score"] for r in risultati_fulltext),
                default=0.0
            )
            or 1.0
    )

    # Il dizionario unisce i risultati usando l'ID del documento come chiave
    combinato: dict[int, dict] = {}

    for risultato in risultati_fulltext:
        id_documento = risultato["documento"].id

        combinato[id_documento] = {
            "documento": risultato["documento"],
            "score_fulltext": risultato["score"] / max_ft,
            "score_semantico": 0.0,
        }

    for risultato in risultati_semantici:
        id_documento = risultato["documento"].id

        if id_documento in combinato:
            combinato[id_documento]["score_semantico"] = risultato["score"]

        else:
            combinato[id_documento] = {
                "documento": risultato["documento"],
                "score_fulltext": 0.0,
                "score_semantico": risultato["score"],
            }

    # La media pesata permette di regolare l'importanza relativa della
    # corrispondenza semantica rispetto alla ricerca per parole.
    risultati = [
        {
            "documento": valore_dizionario["documento"],
            "score":
                (1 - peso_semantico) * valore_dizionario["score_fulltext"]
                + peso_semantico * valore_dizionario["score_semantico"],
        }
        for valore_dizionario in combinato.values()
    ]

    # Ordina il risultato finale per rilevanza decrescente
    risultati.sort(
        key=lambda r: r["score"],
        reverse=True)

    return risultati[0:limit]


# ─── 4. DOCUMENTI SEMANTICAMENTE SIMILI ───────────────────────────────────────

def documenti_simili(
        db: Session,
        documento_id: int,
        limit: int = 5
) -> list[dict]:
    """
    Trova i documenti semanticamente più simili a un documento esistente,
    escludendo il documento stesso.
    """

    documento = db.get(Documento, documento_id)

    # Senza embedding non è possibile effettuare un confronto semantico
    if documento is None or documento.embedding is None:
        return []

    distanza = Documento.embedding.cosine_distance(
        documento.embedding
    ).label("distanza")

    statement = (
        select(Documento, distanza)
        # Esclude il documento di origine e le righe prive di embedding
        .where(
            Documento.id != documento_id,
            Documento.embedding.isnot(None)
        )
        .order_by(distanza)
        .limit(limit)
    )

    righe = db.execute(statement).all()

    # Stesso clamping della ricerca_semantica: score in [0, 1]
    return [
        {
            "documento": doc,
            "score": float(max(0.0, 1 - dist))
        }
        for (doc, dist) in righe
    ]
