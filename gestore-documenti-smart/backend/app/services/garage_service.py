# ==============================================================================
# app/services/garage_service.py — Servizio di object storage compatibile S3
# ==============================================================================

import uuid
import logging
from typing import Optional

import boto3
from botocore.client import Config
from botocore.exceptions import ClientError

from app.config import settings


logger = logging.getLogger(__name__)


# ─── SERVIZIO DI STORAGE ──────────────────────────────────────────────────────

class GarageService:
    """
    Wrapper client boto3 per Garage S3-compatibile.

    Incapsula tutte le chiamate a boto3 in un unico punto: sostituire Garage
    con AWS S3 o altro provider richiede modifiche solo a questa classe.
    """

    def __init__(self):
        self._bucket_name = settings.S3_BUCKET_NAME

        # ─── 1. CONFIGURAZIONE DI RETRY E TIMEOUT ─────────────────────────────

        # Timeout ridotti evitano che richieste HTTP rimangano bloccate a lungo
        # in caso di storage irraggiungibile. I retry gestiscono errori transitori.
        _boto_config = Config(
            signature_version="s3v4",
            s3={"addressing_style": "path"},
            connect_timeout=5,
            read_timeout=20,
            retries={"max_attempts": 3, "mode": "standard"},
        )

        # ─── 2. CLIENT INTERNO E PUBBLICO ─────────────────────────────────────

        # Client Interno: per le operazioni server-to-server dentro
        # rete Docker (upload, download, delete, ensure_bucket)
        self._client = boto3.client(
            "s3",
            endpoint_url=settings.S3_ENDPOINT,
            aws_access_key_id=settings.S3_ACCESS_KEY,
            aws_secret_access_key=settings.S3_SECRET_KEY,
            config=_boto_config,
            region_name="garage",  # valore arbitrario, richiesto da boto3 ma non usato da Garage
        )

        # Client Pubblico: dedicato agli URL accessibili dal browser.
        # Signature V4 include l'hostname nella firma, quindi l'endpoint usato
        # per generare il link deve coincidere con quello raggiunto dal client.
        public_endpoint = (
                settings.S3_PUBLIC_ENDPOINT
                or settings.S3_ENDPOINT
        )

        self._public_client = boto3.client(
            "s3",
            endpoint_url=public_endpoint,
            aws_access_key_id=settings.S3_ACCESS_KEY,
            aws_secret_access_key=settings.S3_SECRET_KEY,
            config=_boto_config,
            region_name="garage",
        )


    # ─── 3. INIZIALIZZAZIONE DEL BUCKET ────────────────────────────────────────

    def ensure_bucket(self) -> None:
        """
        Verifica l'esistenza del bucket e lo crea se non presente.
        """

        try:
            # Verifica l'esistenza del bucket senza trasferire dati
            self._client.head_bucket(Bucket=self._bucket_name)

            logger.info(
                "Bucket '%s' già esistente su Garage.",
                self._bucket_name
            )

        except ClientError as e:
            # Solo il 404 indica l'assenza del bucket. Gli altri errori,
            # come credenziali errate o problemi di rete, vengono propagati.
            status = (
                e.response
                .get("ResponseMetadata", {})
                .get("HTTPStatusCode")
            )

            if status != 404:
                raise

            logger.info(
                "Bucket '%s' non trovato, lo creo.",
                self._bucket_name
            )

            self._client.create_bucket(
                Bucket=self._bucket_name
            )


    # ─── 4. CARICAMENTO DEI FILE ──────────────────────────────────────────────

    def upload_file(
            self,
            file_bytes: bytes,
            original_filename: str,
            content_type: Optional[str] = None,
    ) -> str:
        """
        Carica un file nello storage e restituisce la relativa chiave univoca.
        """

        # Preserva l'estensione originale per mantenere riconoscibile il formato
        extension = ""

        if "." in original_filename:
            extension = (
                    "."
                    + original_filename.rsplit(".", 1)[-1].lower()
            )

        # UUID evita collisioni tra file con lo stesso nome
        object_key = f"{uuid.uuid4().hex}{extension}"

        # Include il Content-Type solo quando disponibile
        extra_args = (
            {"ContentType": content_type}
            if content_type
            else {}
        )

        # Salva direttamente i dati binari nello storage
        self._client.put_object(
            Bucket=self._bucket_name,
            Key=object_key,
            Body=file_bytes,
            **extra_args,
        )

        logger.info(
            "File caricato su Garage con chiave '%s'.",
            object_key
        )

        # Nel database viene salvata la chiave, non un URL o un path locale
        return object_key


    # ─── 5. DOWNLOAD E CANCELLAZIONE ──────────────────────────────────────────

    def download_file(self, object_key: str) -> bytes:
        """
        Scarica un oggetto e ne restituisce il contenuto binario.

        Mantiene l'interfaccia completa del servizio e consente future
        operazioni su file già presenti nello storage.
        """

        response = self._client.get_object(
            Bucket=self._bucket_name,
            Key=object_key
        )

        return response["Body"].read()


    def delete_file(self, object_key: str) -> None:
        """
        Cancella un oggetto identificato dalla relativa chiave
        """

        self._client.delete_object(
            Bucket=self._bucket_name,
            Key=object_key
        )

        logger.info(
            "File '%s' cancellato da Garage.",
            object_key
        )


    # ─── 6. URL TEMPORANEI ────────────────────────────────────────────────────

    def get_presigned_url(
            self,
            object_key: str,
            expires_in: int = 3600
    ) -> str:
        """
        Genera un URL firmato e temporaneo per l'accesso diretto al file.

        Il browser scarica il file direttamente dallo storage, evitando il
        passaggio dei dati attraverso il backend.
        """

        # Il client pubblico genera una firma coerente con l'hostname utilizzato
        # dal browser, evitando errori di validazione Signature V4.
        return self._public_client.generate_presigned_url(
            "get_object",
            Params={
                "Bucket": self._bucket_name,
                "Key": object_key
            },
            ExpiresIn=expires_in,
        )


# ─── 7. ISTANZA CONDIVISA ────────────────────────────────────────────────────

# Istanza singleton: riutilizzata dai moduli che devono accedere allo storage
garage_service = GarageService()
