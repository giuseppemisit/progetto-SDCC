-- In PostgreSQL, abilito il "plugin" pgvector per la ricerca vettoriale
CREATE EXTENSION IF NOT EXISTS vector;

-- Nota: Tabelle, indici HNSW/GIN e trigger sono creati da SQLAlchemy (app/database.py::init_db),
-- protetti da lock consultivo contro race condition al cold start con più repliche.