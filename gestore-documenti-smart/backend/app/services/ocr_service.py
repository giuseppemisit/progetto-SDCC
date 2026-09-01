# ==============================================================================
# app/services/ocr_service.py — Servizio OCR basato su Tesseract
# ==============================================================================

import io
import logging
import os

import pytesseract
from PIL import Image, ImageOps, ImageEnhance


logger = logging.getLogger(__name__)


# ─── 1. LIMITAZIONE DEI THREAD ────────────────────────────────────────────────

def _limita_thread_tesseract() -> None:
    """
    Esegue OCR limitando Tesseract a 1 thread per immagine
    """

    # Evita l'oversubscription della CPU quando più richieste OCR vengono
    # elaborate contemporaneamente, riducendo il rischio di CPU thrashing.
    #
    # La variabile viene impostata immediatamente prima dell'OCR (e non nel Dockerfile) per limitare
    # solo Tesseract senza influenzare globalmente le librerie AI.
    os.environ.setdefault("OMP_THREAD_LIMIT", "1")


# ─── 2. SERVIZIO OCR ──────────────────────────────────────────────────────────

class OCRService:
    """
    Wrapper per pytesseract. Incapsula tutte le chiamate OCR in un unico punto:
    sostituire Tesseract con un altro motore (es. Google Vision) richiede
    modifiche solo a questa classe, senza toccare il resto dell'applicazione.
    """

    def __init__(self, lang: str = "ita"):
        self._lang = lang


    # ─── 3. PREPROCESSING DELLE IMMAGINI ──────────────────────────────────────

    def _preprocess(self, image: Image.Image) -> Image.Image:
        """
        Pre-processing minimo per migliorare l'accuratezza dell'OCR
        """

        # 1. Conversione in scala di grigi (Tesseract lavora meglio senza rumore cromatico)
        image = ImageOps.grayscale(image)

        # 2. Aumento del contrasto del 50% (1.5), utile su scansioni sbiadite o fotocopie
        enhancer = ImageEnhance.Contrast(image)
        image = enhancer.enhance(1.5)

        return image


    # ─── 4. ESTRAZIONE DEL TESTO ──────────────────────────────────────────────

    def estrai_testo(self, image_bytes: bytes) -> str:
        """
        Esegue OCR su un'immagine in memoria e restituisce il testo estratto.

        :param image_bytes: Immagine grezza in memoria (bytes)
        :return: Testo riconosciuto da Tesseract
        """

        # Applica il limite prima dell'avvio di Tesseract
        _limita_thread_tesseract()

        try:
            # BytesIO consente a Pillow di leggere i dati dalla memoria,
            # evitando la creazione di file temporanei sul filesystem.
            image = Image.open(io.BytesIO(image_bytes))

            # Migliora l'immagine prima dell'elaborazione OCR
            image = self._preprocess(image)

            # Esegue il riconoscimento utilizzando il modello linguistico italiano
            testo = pytesseract.image_to_string(
                image,
                lang=self._lang
            )
            testo_pulito = testo.strip()

            logger.info(
                "OCR completato: estratti %d caratteri.",
                len(testo_pulito)
            )

            return testo_pulito

        except pytesseract.TesseractNotFoundError as e:
            # Segnala separatamente l'assenza di Tesseract, che rende
            # il servizio OCR completamente non disponibile
            logger.critical(
                "Tesseract non trovato/non installato: OCR non funzionante. %s",
                e
            )
            return ""

        except Exception as e:
            # Un errore OCR non interrompe il flusso dell'applicazione
            logger.error(
                "Errore durante l'estrazione OCR: %s",
                e
            )
            return ""


# ─── 5. ISTANZA CONDIVISA - SINGLETON ─────────────────────────────────────────

# Riutilizza una singola istanza configurata del servizio OCR
ocr_service = OCRService(lang="ita")
