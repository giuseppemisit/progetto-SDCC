from sqlalchemy.orm import Session
from app.models.documento import Documento
from app.schemas.documento_create import DocumentoCreate
from app.schemas.documento_update import DocumentoUpdate

def create_documento(db: Session, documento: DocumentoCreate):
    # Trasforma il DTO in una Entity
    db_documento = Documento(**documento.model_dump())
    db.add(db_documento)
    db.commit()
    db.refresh(db_documento)
    return db_documento

def get_documenti(db: Session, skip: int = 0, limit: int = 100):
    # SELECT * FROM documenti LIMIT x OFFSET y
    return db.query(Documento).offset(skip).limit(limit).all()

def get_documento(db: Session, documento_id: int):
    # SELECT * FROM documenti WHERE id = x
    return db.query(Documento).filter(Documento.id == documento_id).first()

def update_documento(db: Session, documento_id: int, documento_data: DocumentoUpdate):
    db_documento = get_documento(db, documento_id)
    if db_documento:
        # Aggiorna solo i campi forniti
        for key, value in documento_data.model_dump(exclude_unset=True).items():
            setattr(db_documento, key, value)
        db.commit()
        db.refresh(db_documento)
    return db_documento

def delete_documento(db: Session, documento_id: int):
    db_documento = get_documento(db, documento_id)
    if db_documento:
        db.delete(db_documento)
        db.commit()
    return db_documento