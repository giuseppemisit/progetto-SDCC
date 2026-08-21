# Importa tutti i modelli in modo che SQLAlchemy registri le loro tabelle
# nel metadata di Base prima che venga chiamato create_all() o Alembic.
from app.models.documento import Documento

__all__ = ["Documento"]
