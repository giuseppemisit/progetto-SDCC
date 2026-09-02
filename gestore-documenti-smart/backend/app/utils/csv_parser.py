# ==============================================================================
# app/utils/csv_parser.py — Parser e Validazione per Import Massivo CSV/JSON
# ==============================================================================

import csv
import io
import json
from typing import Any, Optional

from pydantic import ValidationError

from app.schemas.documento_schemas import DocumentoCreate


# ─── 1. WHITELIST DEI CAMPI IMPORTABILI ───────────────────────────────────────

# La whitelist deriva dallo schema DocumentoCreate, unica fonte che
# definisce i campi inseribili in creazione: evita di duplicare l'elenco
# a mano e impedisce che CSV/JSON valorizzino campi interni come 'id',
# 'embedding', 'immagine_url' o 'stato_elaborazione'.
CAMPI_ATTESI = set(DocumentoCreate.model_fields.keys())


# ─── 2. CLASSI DI SUPPORTO PER IL REPORT DI IMPORTAZIONE ──────────────────────

class RigaErrore:
    """
    Rappresenta un errore associato a una specifica riga del file importato.

    `riga` usa la numerazione visibile all'utente:
    - CSV: parte da 2 perché la riga 1 contiene l'header;
    - JSON: parte da 1 perché ogni elemento dell'array rappresenta un record.
    """

    def __init__(
            self,
            riga: int,
            errore: str,
            dati: Optional[dict[str, Any]] = None
    ):
        self.riga = riga
        self.errore = errore
        self.dati = dati


class RisultatoParsing:
    """
    Contiene il risultato completo del parsing.

    I documenti validi mantengono anche il numero della riga originale, così
    eventuali errori successivi durante l'import possono essere ricondotti al
    record corretto nel file sorgente.
    """

    def __init__(self):
        # Lista di tuple (numero_riga_originale, documento_validato)
        self.documenti_validi: list[tuple[int, DocumentoCreate]] = []
        self.errori: list[RigaErrore] = []

    @property
    def totale(self) -> int:
        """Numero totale di record effettivamente analizzati"""
        return len(self.documenti_validi) + len(self.errori)


# ─── 3. PULIZIA E VALIDAZIONE DEL SINGOLO RECORD ──────────────────────────────

def _pulisci_riga(riga: dict[str, Any]) -> dict[str, Any]:
    """
    Filtra e normalizza un record proveniente da CSV o JSON.

    - mantiene solo i campi ammessi da DocumentoCreate;
    - converte le stringhe vuote del CSV in None;
    - lascia a Pydantic la validazione definitiva dei tipi e dei vincoli.

    Non affidiamo questa funzione alla sicurezza del solo client: un file può
    contenere colonne aggiuntive o valori non previsti indipendentemente da
    ciò che mostra il frontend.
    """

    riga_pulita: dict[str, Any] = {}

    for (chiave, valore) in riga.items():
        if chiave not in CAMPI_ATTESI:
            continue

        # Il formato CSV rappresenta un campo vuoto come stringa "",
        # mentre Python/Pydantic usano None per rappresentare un valore assente
        if isinstance(valore, str) and valore.strip() == "":
            riga_pulita[chiave] = None
        else:
            riga_pulita[chiave] = valore

    return riga_pulita


def _riga_vuota(riga_pulita: dict[str, Any]) -> bool:
    """
    Restituisce True se il record non contiene alcun valore utile.

    Utile per ignorare righe vuote aggiunte accidentalmente alla
    fine di un CSV esportato.
    """
    for v in riga_pulita.values():
        if v is not None:
            return False
    return True


def _valida_riga(
        riga_pulita: dict[str, Any],
        numero_riga: int
) -> tuple[Optional[DocumentoCreate], Optional[RigaErrore]]:
    """
    Valida un record usando lo stesso schema Pydantic (DocumentoCreate)
    impiegato dalle API REST, così che import massivo e creazione manuale
    applichino esattamente le stesse regole di validazione.

    In caso di errore, i dettagli dell'eccezione vengono trasformati in un
    messaggio leggibile per il report di importazione.
    """
    try:
        documento = DocumentoCreate(**riga_pulita)
        return (documento, None)

    except ValidationError as e:
        # Convertiamo gli errori strutturati di Pydantic in un messaggio più
        # leggibile per il report di importazione.
        messaggi = []

        for err in e.errors():
            posizione = ".".join(str(parte) for parte in err["loc"])
            messaggi.append(f"{posizione}: {err['msg']}")

        return (
            None,
            RigaErrore(
                riga=numero_riga,
                errore="; ".join(messaggi),
                dati=riga_pulita,
            ),
        )


# ─── 4. PARSER CSV ────────────────────────────────────────────────────────────

def parse_csv(contenuto: bytes) -> RisultatoParsing:
    """
    Analizza un file CSV UTF-8 e restituisce documenti validi ed errori
    """
    risultato = RisultatoParsing()

    try:
        # utf-8-sig gestisce anche il BOM (Byte Order Mark)
        testo = contenuto.decode("utf-8-sig")

    except UnicodeDecodeError:
        risultato.errori.append(
            RigaErrore(
                0,
                "Impossibile decodificare il file: usa la codifica UTF-8")
        )
        return risultato

    # StringIO permette a csv.DictReader di lavorare sui dati già presenti in
    # memoria, senza creare un file temporaneo sul disco.
    reader = csv.DictReader(io.StringIO(testo))

    try:
        intestazione = reader.fieldnames

    except csv.Error as e:
        risultato.errori.append(
            RigaErrore(0, f"Riga di intestazione illeggibile: {e}")
        )
        return risultato


    if intestazione is None:
        risultato.errori.append(
            RigaErrore(
                0,
                "Il file CSV è vuoto o non ha un header valido")
        )
        return risultato


    # Se nessuna colonna dell'header corrisponde ai campi attesi, ogni riga
    # verrebbe svuotata da _pulisci_riga e scartata come "vuota", producendo
    # un import a zero risultati senza alcun errore.
    if not (set(reader.fieldnames) & CAMPI_ATTESI):
        risultato.errori.append(
            RigaErrore(
                0,
                f"Nessuna colonna riconosciuta nell'header. "
                f"Campi attesi: {', '.join(sorted(CAMPI_ATTESI))}"
            )
        )
        return risultato

    # Legge il CSV riga per riga saltando l'intestazione, (il primo
    # documento è alla riga 2) e valida ogni record prima di importarlo:
    try:
        for (indice, riga_grezza) in enumerate(reader, start=2):

            riga_pulita = _pulisci_riga(riga_grezza)

            if _riga_vuota(riga_pulita):
                continue  # riga vuota di troppo, non è un errore da segnalare

            documento, errore = _valida_riga(riga_pulita, indice)

            if documento is not None:
                risultato.documenti_validi.append((indice, documento))
            elif errore is not None:
                risultato.errori.append(errore)

    except csv.Error as e:
        risultato.errori.append(
            RigaErrore(
                reader.line_num,
                f"File CSV illeggibile dalla riga successiva a questa: {e}"
            )
        )

    return risultato


# ─── 5. PARSER JSON ───────────────────────────────────────────────────────────

def parse_json(contenuto: bytes) -> RisultatoParsing:
    """
    Analizza un file JSON contenente un array di documenti.

    Esempio di struttura prevista:

    [
        {"nome": "Documento 1", "tipologia": "Delibera"},
        {"nome": "Documento 2"}
    ]
    """
    risultato = RisultatoParsing()

    try:
        # utf-8-sig gestisce anche il BOM (Byte Order Mark)
        dati = json.loads(contenuto.decode("utf-8-sig"))

    except UnicodeDecodeError:
        risultato.errori.append(
            RigaErrore(
                0,
                "Impossibile decodificare il file JSON: usa la codifica UTF-8.",
            )
        )
        return risultato

    except json.JSONDecodeError as e:
        risultato.errori.append(
            RigaErrore(
                0,
                f"JSON non valido: {e.msg} (riga {e.lineno}, colonna {e.colno}).",
            )
        )
        return risultato

    # L'importazione è progettata per ricevere una lista di documenti.
    if not isinstance(dati, list):
        risultato.errori.append(
            RigaErrore(
                0,
                "Il file JSON deve contenere un array di documenti"
            )
        )
        return risultato

    # Itera sull'array JSON elemento per elemento (partendo dall'indice 1)
    # e valida ogni record prima di importarlo:
    for (indice, elemento) in enumerate(dati, start=1):

        if not isinstance(elemento, dict):
            risultato.errori.append(
                RigaErrore(
                    indice,
                    "L'elemento non è un oggetto JSON valido"
                )
            )
            continue

        riga_pulita = _pulisci_riga(elemento)

        # A differenza del CSV, ogni oggetto JSON ha chiavi proprie.
        # Se contiene solo campi non riconosciuti, verrebbe
        # scartato silenziosamente: lo intercettiamo.
        if not riga_pulita and elemento:
            risultato.errori.append(
                RigaErrore(
                    indice,
                    f"Nessun campo riconosciuto. "
                    f"Campi attesi: {', '.join(sorted(CAMPI_ATTESI))}",
                    dati=elemento,
                )
            )
            continue

        if _riga_vuota(riga_pulita):
            continue

        documento, errore = _valida_riga(riga_pulita, indice)

        if documento is not None:
            risultato.documenti_validi.append((indice, documento))
        elif errore is not None:
            risultato.errori.append(errore)

    return risultato


# ─── 6. ENTRY POINT UNICO ─────────────────────────────────────────────────────

def parse_file(contenuto: bytes, filename: str) -> RisultatoParsing:
    """
    Seleziona il parser corretto in base all'estensione del file.

    L'estensione viene convertita in minuscolo per accettare indifferentemente
    file come `.CSV`, `.Csv` o `.csv`.
    """
    nome_lower = (filename or "").lower()

    if nome_lower.endswith(".json"):
        return parse_json(contenuto)

    elif nome_lower.endswith(".csv"):
        return parse_csv(contenuto)

    risultato = RisultatoParsing()
    risultato.errori.append(
        RigaErrore(
            0,
            (
                f"Formato file non supportato: '{filename}'. "
                "Sono supportati esclusivamente file .csv e .json."
            ),
        )
    )

    return risultato
