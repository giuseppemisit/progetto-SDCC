from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import date, datetime

class DocumentoResponse(BaseModel):
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
    creato_il: datetime
    aggiornato_il: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)