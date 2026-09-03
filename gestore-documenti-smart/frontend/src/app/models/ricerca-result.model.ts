// ==============================================================================
// src/app/models/ricerca.result.model.ts — Modelli per Ricerca e Risultati
// ==============================================================================

import { Documento } from './documento.model';

export type ModalitaRicerca = 'fulltext' | 'semantica' | 'ibrida';

/** Rispecchia DocumentoSearchResult del backend */
export interface DocumentoSearchResult {
  documento: Documento;
  score: number;
}

/** Risposta di POST /api/ricerca/immagine */
export interface RisultatoRicercaImmagine {
  testo_estratto: string | null;
  risultati: DocumentoSearchResult[];
}

export interface ErroreRiga {
  riga: number;
  errore: string;
}

/** Risposta di POST /api/upload/massivo */
export interface RisultatoCaricamentoMassivo {
  totale_righe: number;
  successi: number;
  falliti: number;
  errori: ErroreRiga[];
}

export interface TipologiaSuggerita {
  tipologia: string;
  confidenza: number;
}

export interface SuggerimentoTipologiaResponse {
  suggerimenti: TipologiaSuggerita[];
}

export interface SuggerisciTipologiaRequest {
  nome?: string;
  descrizione?: string;
  testo_ocr?: string;
  keywords?: string;
  top_k?: number;
}

/**
 * Risposta di GET /api/documenti/statistiche
 *
 * I conteggi sono calcolati sull'intero archivio dal database e non coincidono
 * necessariamente con il numero di elementi restituiti dall'endpoint paginato
 */
export interface StatisticheArchivio {
  totale: number;

  // Documenti con un'immagine e un'elaborazione OCR realmente pendente
  in_attesa: number;

  // Documenti privi dell'immagine della prima pagina: non richiedono elaborazione
  senza_scansione: number;
  elaborato: number;
  errore: number;
}
