# ==============================================================================
# app/services/classificazione_service.py — Classificazione AI Zero-Shot
# ==============================================================================

import threading

from app.services.embedding_service import genera_embedding
import numpy as np


# ─── 1. PROTOTIPI DELLE TIPOLOGIE ─────────────────────────────────────────────

# Ogni tipologia è rappresentata da una descrizione testuale contenente termini
# caratteristici. Questo approccio evita l'addestramento di un modello dedicato
# e consente la classificazione tramite confronto semantico.
PROTOTIPI_TIPOLOGIA: dict[str, str] = {
    "Delibera": (
        "delibera di giunta comunale approvazione provvedimento deliberativo "
        "deliberazione consiglio comunale atto deliberativo"
    ),
    "Ordinanza": (
        "ordinanza del sindaco provvedimento contingibile urgente "
        "ordinanza sindacale limitazione divieto"
    ),
    "Autorizzazione": (
        "autorizzazione comunale permesso concessione licenza "
        "autorizzazione edilizia commerciale"
    ),
    "Determina": (
        "determina dirigenziale determinazione a contrarre "
        "affidamento impegno di spesa determina"
    ),
    "Regolamento": (
        "regolamento comunale disciplina norme regolamentari "
        "regolamento edilizio di polizia urbana"
    ),
    "Piano": (
        "piano regolatore generale piano urbanistico piano triennale "
        "opere pubbliche programmazione"
    ),
    "Verbale": (
        "verbale di seduta consiglio giunta verbale di riunione "
        "verbale di consegna"
    ),
    "Circolare": (
        "circolare interna disposizione di servizio nota circolare "
        "comunicazione amministrativa"
    ),
}


# ─── 2. CACHE DEGLI EMBEDDING ─────────────────────────────────────────────────

# Cache degli embedding dei prototipi (lazy loading: calcolati al primo accesso)
_prototipi_embedding: dict[str, list[float]] | None = None

# Sincronizza l'inizializzazione della cache tra thread concorrenti
_prototipi_lock = threading.Lock()


# ─── 3. INIZIALIZZAZIONE THREAD-SAFE DELLA CACHE ──────────────────────────────

def _carica_prototipi() -> dict[str, list[float]]:
    """
    Genera e memorizza gli embedding dei prototipi al primo utilizzo
    """
    global _prototipi_embedding

    # Evita l'acquisizione del lock dopo l'inizializzazione della cache
    if _prototipi_embedding is None:

        # Garantisce che un solo thread esegua il caricamento iniziale
        with _prototipi_lock:

            # Ricontrolla la cache perché un altro thread potrebbe averla
            # inizializzata durante l'attesa del lock.
            if _prototipi_embedding is None:
                risultati = {}

                for (nome, testo) in PROTOTIPI_TIPOLOGIA.items():
                    emb = genera_embedding(testo)

                    if emb is not None:
                        risultati[nome] = emb

                _prototipi_embedding = risultati

    return _prototipi_embedding


# ─── 4. CALCOLO DELLA SIMILARITÀ ──────────────────────────────────────────────

def _cosine_similarity(a: list[float], b: list[float]) -> float:
    """
    Calcola la similarità coseno tra due embedding normalizzati.
    """

    va = np.array(a)
    vb = np.array(b)

    # Per vettori normalizzati, la similarità coseno coincide con il prodotto scalare,
    # evitando il calcolo esplicito delle norme dei vettori
    return float(np.dot(va, vb))


# ─── 5. SUGGERIMENTO DELLA TIPOLOGIA ──────────────────────────────────────────

def suggerisci_tipologia(
        nome: str | None = None,
        descrizione: str | None = None,
        testo_ocr: str | None = None,
        keywords: str | None = None,
        top_k: int = 3,
) -> list[dict]:
    """
    Confronta semanticamente il documento con i prototipi e restituisce le tipologie più simili
    """

    # Combina le informazioni disponibili in un unico testo rappresentativo
    parti = [
        nome or "",
        descrizione or "",
        testo_ocr or "",
        keywords or ""
    ]
    testo = " ".join(p for p in parti if p).strip()

    # Senza contenuto non è possibile generare una classificazione
    if not testo:
        return []

    # Genera la rappresentazione vettoriale del documento
    emb = genera_embedding(testo)

    if emb is None:
        return []

    # Recupera gli embedding dei prototipi dalla cache
    prototipi = _carica_prototipi()

    # Calcola la similarità tra il documento e ogni tipologia disponibile
    punteggi = [
        {
            "tipologia": tipo_nome,
            "confidenza": round(_cosine_similarity(emb, prototipo), 4)
        }
        for (tipo_nome, prototipo) in prototipi.items()
    ]

    # Ordina le tipologie dalla maggiore alla minore similarità
    punteggi.sort(
        key=lambda x: x["confidenza"],
        reverse=True
    )

    # Restituisce esclusivamente il numero di suggerimenti richiesto
    return punteggi[0:top_k]
