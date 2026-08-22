"""
app/config.py — Configurazione centralizzata (equivalente al tuo
application.properties di Spring Boot).

NOTA sulla coerenza dei nomi: nel file .env di esempio del Master Plan la
variabile è chiamata GARAGE_BUCKET_NAME, ma nel Capitolo 3 la guida la
chiama S3_BUCKET_NAME. Qui uso un alias per accettare entrambe, così
non devi rifare il .env: basta che una delle due sia presente.
"""

from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, AliasChoices


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file="../.env",
        env_file_encoding="utf-8",
        # Se una variabile è nel .env ma lasciata vuota (es. durante lo sviluppo),
        # ignoriamo il valore vuoto e cediamo il posto al default o all'env reale.
        env_ignore_empty=True,
        extra="ignore",
    )

    # Database
    DATABASE_URL: str

    # Object Storage (Garage / S3-compatibile)
    S3_ENDPOINT: str
    S3_ACCESS_KEY: str
    S3_SECRET_KEY: str
    # Utilizziamo AliasChoices per accettare REALMENTE entrambe le variabili d'ambiente
    S3_BUCKET_NAME: str = Field(validation_alias=AliasChoices("S3_BUCKET_NAME", "GARAGE_BUCKET_NAME"))

    # Endpoint pubblico per la generazione dei presigned URL (usato da GarageService._public_client).
    # In sviluppo Docker locale: "http://localhost:3900" (raggiungibile dal browser del developer).
    # In produzione: uguale a S3_ENDPOINT o al dominio pubblico dello storage.
    # Se non specificato, fallback su S3_ENDPOINT (corretto in produzione, ma rompe i presigned
    # URL in locale dove garage != localhost).
    S3_PUBLIC_ENDPOINT: Optional[str] = None

    # AI
    MODEL_NAME: str = "sentence-transformers/all-MiniLM-L6-v2"


settings = Settings()
