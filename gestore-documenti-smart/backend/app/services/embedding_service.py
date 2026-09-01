# ==============================================================================
# app/services/embedding_service.py — Servizio per la ricerca semantica (AI)
# ==============================================================================

from sentence_transformers import SentenceTransformer

from app.config import settings


# ─── 1. CARICAMENTO DEL MODELLO ───────────────────────────────────────────────

# Il modello viene caricato una sola volta all'avvio per evitare caricamenti
# ripetuti e mantenere una singola istanza condivisa tra i servizi dell'app.
model = SentenceTransformer(settings.MODEL_NAME)


# ─── 2. GENERAZIONE DI UN SINGOLO EMBEDDING ───────────────────────────────────

def genera_embedding(testo: str) -> list[float] | None:
    """
    Genera l'embedding normalizzato di un testo

    :param testo: Testo da convertire in vettore

    :returns: Lista di 384 float (normalizzati per ottimizzare il calcolo della cosine similarity),
    oppure None se il testo è vuoto, così da evitare di indicizzare documenti privi di significato.
    """

    # Un testo vuoto non contiene informazioni utili alla ricerca semantica
    if not testo or not testo.strip():
        return None

    # La normalizzazione rende i vettori confrontabili tramite distanza coseno
    # e mantiene coerenza con l'indice e gli operatori pgvector utilizzati.
    vettore = model.encode(
        testo,
        normalize_embeddings=True
    )

    return vettore.tolist()


# ─── 3. PREPARAZIONE DEL TESTO ────────────────────────────────────────────────

def testo_per_embedding(
        nome: str,
        descrizione: str | None = None,
        tipologia: str | None = None,
        testo_ocr: str | None = None,
) -> str:
    """
    Costruisce la stringa utilizzata per generare l'embedding del documento
    """

    # Il nome viene ripetuto per aumentarne il peso nella rappresentazione
    # semantica, evitando che venga penalizzato rispetto a testi OCR molto lunghi
    parti = [nome, nome, descrizione or "", tipologia or "", testo_ocr or ""]

    # Normalizza il testo: scarta le parti vuote o null e rimuove spazi superflui
    return " ".join(p for p in parti if p).strip()


# ─── 4. GENERAZIONE MASSIVA EMBEDDING (batch) ───────────────────────────────

def genera_embeddings_batch(testi: list[str]) -> list[list[float] | None]:
    """
    Genera embedding per una lista di testi in una singola chiamata al modello.
    Il batching riduce drasticamente l'overhead rispetto a N chiamate sequenziali di genera_embedding().

    :param testi: Lista di testi da codificare

    :return: Lista di vettori float, None per i testi non codificabili
    """

    # Crea una lista dei risultati vuota, della stessa lunghezza della lista originale
    risultati: list[list[float] | None] = [None] * len(testi)

    # Trova gli indici dei soli testi che contengono informazioni significative
    indici_validi = [
        i for (i, t) in enumerate(testi)
        if t and t.strip()
    ]

    if not indici_validi:
        return risultati

    # Codifica-embedding dei soli testi validi a blocchi di 64 (equilibrio tra velocità e memoria)
    vettori = model.encode(
        [testi[i] for i in indici_validi],
        normalize_embeddings=True,
        batch_size=64,
    )

    # Ripristina ogni embedding nella posizione corrispondente al testo originale
    for posizione, indice in enumerate(indici_validi):
        risultati[indice] = vettori[posizione].tolist()

    return risultati
