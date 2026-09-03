// ==============================================================================
// src/app/models/documento.model.ts — Modelli e Stato dei Documenti
// ==============================================================================

/** Modelli allineati 1:1 con app/schemas/documento_schemas.py (backend) */

export type StatoElaborazione = 'in_attesa' | 'elaborato' | 'errore';

export interface Documento {
  id: number;
  nome: string;
  descrizione?: string | null;
  tipologia?: string | null;
  data_documento?: string | null; // ISO date (yyyy-MM-dd)
  ufficio?: string | null;
  firmatari?: string | null;
  immagine_url?: string | null;
  testo_ocr?: string | null;
  keywords?: string | null;
  stato_elaborazione: StatoElaborazione;

  //Stato calcolato dal backend tramite colonna generata PostgreSQL
  stato_effettivo: StatoVisualizzato;

  creato_il: string;
  aggiornato_il?: string | null;
}

/** Payload per POST /api/documenti: contiene solo i campi inseribili dall'operatore */
export interface DocumentoCreate {
  nome: string;
  descrizione?: string | null;
  tipologia?: string | null;
  data_documento?: string | null;
  ufficio?: string | null;
  firmatari?: string | null;
}

/** Payload per PATCH /api/documenti/{id}: tutti i campi sono opzionali */
export interface DocumentoUpdate extends Partial<DocumentoCreate> {
  testo_ocr?: string | null;
  keywords?: string | null;
}

/**
 * Stato mostrato all'utente.
 *
 * Il valore arriva già calcolato dal backend tramite 'stato_effettivo',
 * evitando di duplicare in TypeScript la stessa logica utilizzata
 * dal database per determinare lo stato effettivo del documento.
 */
export type StatoVisualizzato = 'elaborato' | 'in_attesa' | 'errore' | 'senza_scansione';

export interface DescrizioneStato {
  stato: StatoVisualizzato;
  /** Etichetta breve, per il badge di una card */
  etichetta: string;
  /** Etichetta estesa, per la scheda di dettaglio */
  etichettaEstesa: string;
  classe: string;
}

/**
 * Associa a ogni stato le relative informazioni di presentazione.
 * Centralizza etichette e classi CSS evitando duplicazioni nei componenti.
 */
const DESCRIZIONI: Record<StatoVisualizzato, Omit<DescrizioneStato, 'stato'>> = {
  elaborato: {
    etichetta: 'Elaborato',
    etichettaEstesa: 'Elaborato',
    classe: 'badge--success',
  },
  errore: {
    etichetta: 'Errore OCR',
    etichettaEstesa: 'Errore durante il riconoscimento del testo',
    classe: 'badge--danger',
  },
  in_attesa: {
    etichetta: 'In elaborazione',
    etichettaEstesa: 'In attesa di elaborazione',
    classe: 'badge--warning',
  },
  senza_scansione: {
    etichetta: 'Senza scansione',
    etichettaEstesa: 'Nessuna scansione associata',
    classe: 'badge--neutral',
  },
};

/** Traduce un documento nello stato e nelle informazioni da mostrare nell'interfaccia */
export function descriviStato(documento: Documento): DescrizioneStato {
  // Il fallback gestisce eventuali valori inattesi restituiti dall'API
  const descrizione = DESCRIZIONI[documento.stato_effettivo] ?? DESCRIZIONI.senza_scansione;

  return { stato: documento.stato_effettivo, ...descrizione };
}
