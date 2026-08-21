from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.schemas.documento_create import DocumentoCreate
from app.schemas.documento_update import DocumentoUpdate
from app.schemas.documento_response import DocumentoResponse
from app.services import documento_service

# Definiamo il prefisso per tutte le rotte di questo controller
router = APIRouter(
    prefix="/api/documenti",
    tags=["Documenti"]
)

@router.post("", response_model=DocumentoResponse)
def create_documento(documento: DocumentoCreate, db: Session = Depends(get_db)):
    return documento_service.create_documento(db=db, documento=documento)

@router.get("", response_model=List[DocumentoResponse])
def read_documenti(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return documento_service.get_documenti(db, skip=skip, limit=limit)

@router.get("/{documento_id}", response_model=DocumentoResponse)
def read_documento(documento_id: int, db: Session = Depends(get_db)):
    db_documento = documento_service.get_documento(db, documento_id=documento_id)
    if db_documento is None:
        raise HTTPException(status_code=404, detail="Documento non trovato")
    return db_documento

@router.patch("/{documento_id}", response_model=DocumentoResponse)
def update_documento(documento_id: int, documento: DocumentoUpdate, db: Session = Depends(get_db)):
    db_documento = documento_service.update_documento(db, documento_id, documento)
    if db_documento is None:
        raise HTTPException(status_code=404, detail="Documento non trovato")
    return db_documento

@router.delete("/{documento_id}", status_code=200)
def delete_documento(documento_id: int, db: Session = Depends(get_db)):
    db_documento = documento_service.delete_documento(db, documento_id)
    if db_documento is None:
        raise HTTPException(status_code=404, detail="Documento non trovato")
    return {"message": "Documento eliminato con successo"}