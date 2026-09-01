# ==============================================================================
# app/services/keyword_service.py — Estrazione delle parole chiave con KeyBERT
# ==============================================================================

import logging

from keybert import KeyBERT
from spacy.lang.it.stop_words import STOP_WORDS as ITALIAN_STOP_WORDS

# Riutilizza il modello già caricato dal servizio degli embedding per evitare
# una seconda istanza in memoria e ridurre il tempo di avvio.
from app.services.embedding_service import model as sentence_model


logger = logging.getLogger(__name__)


# ─── 1. STOP WORD ITALIANE ────────────────────────────────────────────────────

# KeyBERT utilizza scikit-learn, che non fornisce direttamente una lista
# italiana. Le stop word di spaCy garantiscono quindi il filtraggio delle
# parole comuni senza introdurre una lista manuale.
_ITALIAN_STOP_WORDS = list(ITALIAN_STOP_WORDS)


# ─── 2. INIZIALIZZAZIONE DI KEYBERT ───────────────────────────────────────────

# Riutilizza il modello SentenceTransformer già presente in memoria, evitando
# duplicazioni di risorse e ulteriori caricamenti all'avvio.
_kw_model = KeyBERT(model=sentence_model)


# ─── 3. ESTRAZIONE DELLE PAROLE CHIAVE ────────────────────────────────────────

def estrai_keywords(
        testo: str,
        top_n: int = 10,
        ngram_range: tuple[int, int] = (1, 2),
) -> str:
    """
    Estrae le keyword più rappresentative da un testo tramite TF-IDF

    :param testo: Testo da analizzare (OCR di documenti amministrativi).
    :param top_n: Numero massimo di keyword da restituire.
    :param ngram_range: Range n-grammi; (1,2) cattura termini singoli e bigrammi
                        tecnici (es. "delibera", "piano regolatore").
    :return: Keyword separate da virgola (es. "delibera, giunta comunale"),
             stringa vuota se il testo è vuoto o l'estrazione fallisce.
    """

    # Evita elaborazioni inutili su contenuti privi di testo
    if not testo or not testo.strip():
        return ""

    try:
        keywords = _kw_model.extract_keywords(
            testo,

            # Analizza sia parole singole sia espressioni composte da due termini
            keyphrase_ngram_range=ngram_range,

            # Esclude le STOP WORD della lingua italiana
            stop_words=_ITALIAN_STOP_WORDS,

            top_n=top_n,

            # Maximal Marginal Relevance (MMR) aumenta la varietà dei risultati, evitando
            # keyword semanticamente troppo simili. diversity=0.5 bilancia rilevanza e diversità
            use_mmr=True,
            diversity=0.5,
        )

        # KeyBERT restituisce coppie (keyword, score); noi estraiamo solo le parole,
        # ignoriamo i numeri (_), e le uniamo con una virgola
        return ", ".join(kw for kw, _ in keywords)

    except Exception as e:
        # Un errore nell'estrazione non deve interrompere il salvataggio del documento:
        # l'errore viene registrato e si restituisce un valore vuoto
        logger.error("Errore durante l'estrazione keywords con KeyBERT: %s", e)
        return ""
