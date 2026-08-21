from pydantic import BaseModel
from typing import Optional
from datetime import date

class DocumentoCreate(BaseModel):
    nome: str
    descrizione: Optional[str] = None
    tipologia: Optional[str] = None
    data_documento: Optional[date] = None
    ufficio: Optional[str] = None
    firmatari: Optional[str] = None
    immagine_url: Optional[str] = None
