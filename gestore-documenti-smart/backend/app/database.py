# ==============================================================================
# app/database.py — Configurazione e gestione del database PostgreSQL
# ==============================================================================
import time

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from app.config import settings


# ─── 1. CONNESSIONE AL DATABASE ───────────────────────────────────────────────

# Crea il motore SQLAlchemy. Il pre-ping verifica le connessioni del pool
# prima dell'uso, evitando errori causati da connessioni inattive o interrotte.
engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)

# Fabbrica le sessioni del database.
# Le modifiche richiedono un commit esplicito e l'autoflush è disabilitato
# per mantenere il controllo sulle operazioni inviate al database.
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Classe base comune a tutti i modelli ORM.
# Le classi che rappresentano le tabelle ereditano da Base, analogamente
# alle entità annotate in altri framework. `pass` definisce una classe vuota.
class Base(DeclarativeBase):
    pass


# ─── 2. GESTIONE DELLE SESSIONI ───────────────────────────────────────────────

def get_db():
    """
    Fornisce una sessione SQLAlchemy alla richiesta e ne garantisce la chiusura
    """
    db = SessionLocal()
    try:
        # Rende la sessione disponibile alla dependency injection di FastAPI
        yield db
    finally:
        # Libera sempre la connessione, anche in caso di errore
        db.close()


def crea_trigger_search_vector(conn):
    """
    Crea il trigger PostgreSQL che aggiorna automaticamente `search_vector`
    durante INSERT e UPDATE della tabella `documenti`.

    I pesi A-D attribuiscono maggiore rilevanza ai campi più importanti
    nel calcolo del ranking della ricerca.

    La connessione viene ricevuta da init_db() per operare nella stessa sessione
    che detiene il lock consultivo e serializzare l'inizializzazione tra repliche.
    """
    ddl = """
          CREATE OR REPLACE FUNCTION documenti_search_vector_update() RETURNS trigger AS $$
          BEGIN
        NEW.search_vector :=
            setweight(to_tsvector('italian', coalesce(NEW.nome, '')), 'A') ||
            setweight(to_tsvector('italian', coalesce(NEW.descrizione, '')), 'B') ||
            setweight(to_tsvector('italian', coalesce(NEW.tipologia, '')), 'C') ||
            setweight(to_tsvector('italian', coalesce(NEW.testo_ocr, '')), 'D');
          RETURN NEW;
          END
    $$ LANGUAGE plpgsql;

          DROP TRIGGER IF EXISTS trg_documenti_search_vector ON documenti;

          CREATE TRIGGER trg_documenti_search_vector
              BEFORE INSERT OR UPDATE ON documenti
                                   FOR EACH ROW
                                   EXECUTE FUNCTION documenti_search_vector_update();
          """
    conn.execute(text(ddl))

    # Aggiorna i record esistenti privi di search_vector.
    # L'UPDATE attiva il trigger e rende l'operazione idempotente.
    conn.execute(text("""
        UPDATE documenti
        SET nome = nome
        WHERE search_vector IS NULL
    """))


# ─── 4. INIZIALIZZAZIONE SICURA DELLO SCHEMA ──────────────────────────────────

# Chiave fissa del lock consultivo, dedicata alla sincronizzazione di init_db().
# Deve evitare collisioni con altri eventuali pg_advisory_lock del database.
_SCHEMA_INIT_LOCK_KEY = 72197


def init_db():
    """
    Crea schema, indici e trigger all'avvio dell'applicazione

    Il lock consultivo PostgreSQL impedisce che più repliche inizializzino
    contemporaneamente lo schema
    """
    ultimo_errore = None

    # Riprova l'inizializzazione fino a tre volte in caso di errore temporaneo.
    for tentativo in range(3):
        try:
            with engine.connect() as conn:

                # Serializza l'inizializzazione tra container concorrenti

                # 1. ACQUISIZIONE DEL LOCK:
                conn.execute(text("SELECT pg_advisory_lock(:key)"), {"key": _SCHEMA_INIT_LOCK_KEY})
                try:
                    # 2. SEZIONE CRITICA:
                    # Crea le tabelle definite dai modelli ORM, se mancanti
                    Base.metadata.create_all(bind=conn)
                    # Installa o aggiorna il trigger della ricerca full-text
                    crea_trigger_search_vector(conn)
                    # Conferma le modifiche allo schema
                    conn.commit()
                finally:
                    # 3. RILASCIO DEL LOCK E PULIZIA:
                    # Ripristina la transazione prima di rilasciare il lock: dopo un errore,
                    # PostgreSQL non accetta altri comandi finché non viene eseguito il rollback.
                    conn.rollback()
                    # Rilascia il lock e permette alle altre repliche di procedere
                    conn.execute(
                        text("SELECT pg_advisory_unlock(:key)"),
                        {"key": _SCHEMA_INIT_LOCK_KEY}
                    )
                    conn.commit()

            # Inizializzazione completata correttamente
            return

        except Exception as e:
            ultimo_errore = e

            # Attende prima del tentativo successivo, evitando retry immediati
            if tentativo < 2:
                time.sleep(0.5)

    # Interrompe l'avvio dell'applicazione dopo tre tentativi falliti
    raise ultimo_errore
