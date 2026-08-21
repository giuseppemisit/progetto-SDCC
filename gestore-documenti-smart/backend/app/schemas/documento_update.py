from pydantic import BaseModel
from typing import Optional
from datetime import date


class DocumentoUpdate(BaseModel):
    """
    Schema per l'aggiornamento parziale (PATCH) di un documento.
    Tutti i campi sono opzionali: vengono aggiornati solo quelli forniti.
    Include anche i campi che possono essere corretti manualmente dopo
    l'elaborazione automatica (testo_ocr, keywords).
    """
    nome: Optional[str] = None
    descrizione: Optional[str] = None
    tipologia: Optional[str] = None
    data_documento: Optional[date] = None
    ufficio: Optional[str] = None
    firmatari: Optional[str] = None
    immagine_url: Optional[str] = None
    testo_ocr: Optional[str] = None
    keywords: Optional[str] = None
