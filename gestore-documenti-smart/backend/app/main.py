from fastapi import FastAPI

app = FastAPI(
    title="Gestore Documenti Smart API",
    description="API per la gestione e l'elaborazione dei documenti comunali",
    version="1.0.0"
)

@app.get("/")
def read_root():
    return {"message": "Benvenuto nelle API del Gestore Documenti Smart!"}

@app.get("/health")
def health_check():
    return {"status": "ok"}
