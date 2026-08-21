# ─── Immagine base ────────────────────────────────────────────────────────────
FROM python:3.11-slim

# ─── Dipendenze di sistema ────────────────────────────────────────────────────
# tesseract-ocr        → motore OCR
# tesseract-ocr-ita    → pacchetto lingua italiana per Tesseract
# libgl1               → richiesto da OpenCV/Pillow per elaborazione immagini
# curl                 → utile per healthcheck e debug
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    tesseract-ocr-ita \
    libgl1 \
    libglib2.0-0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# ─── Working directory ────────────────────────────────────────────────────────
WORKDIR /app

# ─── Dipendenze Python ───────────────────────────────────────────────────────
# Copia prima solo requirements.txt per sfruttare la cache di Docker:
# se il codice cambia ma le dipendenze no, questo layer NON viene rieseguito
COPY requirements.txt .

RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu \
    && pip install --no-cache-dir -r requirements.txt

# ─── Modello spaCy italiano ──────────────────────────────────────────────────
# Scaricato durante la build dell'immagine (non ad ogni avvio del container)
RUN python -m spacy download it_core_news_sm

# ─── Codice sorgente ─────────────────────────────────────────────────────────
COPY . .

# ─── Porta esposta ───────────────────────────────────────────────────────────
EXPOSE 8000

# ─── Avvio del server ────────────────────────────────────────────────────────
# --reload → il server si riavvia automaticamente ad ogni modifica del codice
# (funziona grazie al volume montato nel docker-compose.yml)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
