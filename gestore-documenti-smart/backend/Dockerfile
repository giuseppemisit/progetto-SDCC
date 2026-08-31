# ─── 1. IMMAGINE BASE ─────────────────────────────────────────────────────────
# Linux leggero (slim) + Python 3.11
# Digest SHA256 → immagine immutabile: build identica nel tempo
FROM python:3.11-slim@sha256:be1575ed968de893bd54f4c56315ff7c4736ce522c1bca08fd521731aafc0d76


# ─── 2. DIPENDENZE DI SISTEMA ──────────────────────────────────────────────────
# Installiamo i "motori" a livello di sistema operativo (Linux) di cui Python avrà bisogno:
# - tesseract-ocr:          Motore OCR che legge il testo dalle immagini
# - tesseract-ocr-ita:      Dizionario della lingua italiana
# - libgl1 / libglib2.0-0:  Librerie grafiche richieste da OpenCV per elaborare le immagini
# - gcc / libpq-dev:        Compilatore C e header per compilare psycopg2 (driver PostgreSQL) da sorgente
# - curl:                   Utile per healthcheck e debug; alla fine puliamo la cache di apt
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    tesseract-ocr-ita \
    libgl1 \
    libglib2.0-0 \
    curl \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*


# ─── 3. WORKING DIR + CACHE DOCKER + DIPENDENZE PYTHON ────────────────────────
WORKDIR /app

# Copia SOLO requirements.txt (non tutto il codice)
# Se le dipendenze non cambiano, Docker riusa questo layer dalla cache → build molto più veloci
COPY requirements.txt .

# - PyTorch solo-CPU → risparmio di diversi GB (niente CUDA)
# - Rimuove gcc dopo l'uso: riduce la superficie d'attacco:
#   se qualcuno ottiene RCE nel container, non ha un compilatore C a disposizione
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu \
    && pip install --no-cache-dir -r requirements.txt \
    && apt-get purge -y --auto-remove gcc


# ─── 4. MODELLI AI (scaricati in build) ───────────────────────────────────────
# I modelli vengono scaricati ora, durante la build, non al primo avvio.
# Vantaggi:
# - il container parte subito anche offline
# - evita errori di permesso su ~/.cache (il container gira come utente non-root)
ARG MODEL_NAME=sentence-transformers/all-MiniLM-L6-v2
ENV HF_HOME=/opt/hf-cache

RUN python -m spacy download it_core_news_sm \
    && python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('${MODEL_NAME}')"


# ─── 5. CODICE SORGENTE + UTENTE NON-ROOT ─────────────────────────────────────
# Installate le librerie, ora possiamo copiare il codice Python dentro il container
COPY . .

# Di default Docker gira come root → pericoloso.
# Creiamo un utente limitato "appuser" (-m crea la home) e gli diamo la proprietà
# di /app e della cache dei modelli. Se l'app viene compromessa, l'attaccante
# resta senza privilegi di root.
RUN groupadd -r appuser && useradd -r -m -g appuser appuser \
    && chown -R appuser:appuser /app "${HF_HOME}"
USER appuser


# ─── 6. AVVIO DEL SERVER ──────────────────────────────────────────────────────
# Porta su cui ascolta l'applicazione
EXPOSE 8000

# "exec" sostituisce la shell con uvicorn (server HTTP Python) come processo PID 1
# (il "padre" di tutti i processi del container). Solo PID 1 riceve il SIGTERM
# (segnale di spegnimento di Docker): senza exec lo riceve la shell, che lo ignora,
# e Docker è costretto a terminare il container forzatamente dopo il timeout.
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port 8000 ${UVICORN_EXTRA_ARGS:-}"]
