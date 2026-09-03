// ==============================================================================
// src/app/services/ricerca.service.ts — Servizio per le Operazioni di Ricerca
// ==============================================================================

import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { DocumentoSearchResult, RisultatoRicercaImmagine } from '../models/ricerca-result.model';

@Injectable({ providedIn: 'root' })
export class RicercaService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/ricerca';

  // Ricerca letterale basata sull'indicizzazione full-text di PostgreSQL
  fulltext(q: string, limit = 20): Observable<DocumentoSearchResult[]> {
    return this.http.get<DocumentoSearchResult[]>(this.baseUrl, { params: { q, limit } });
  }

  // Ricerca basata sul significato dei contenuti tramite embedding e pgvector
  semantica(q: string, limit = 20): Observable<DocumentoSearchResult[]> {
    return this.http.get<DocumentoSearchResult[]>(`${this.baseUrl}/semantica`, { params: { q, limit } });
  }

  // Combina rilevanza testuale e semantica in un unico punteggio pesato
  ibrida(q: string, limit = 20, pesoSemantico = 0.5): Observable<DocumentoSearchResult[]> {
    return this.http.get<DocumentoSearchResult[]>(`${this.baseUrl}/ibrida`, {
      params: { q, limit, peso_semantico: pesoSemantico },
    });
  }

  // Estrae il testo dall'immagine tramite OCR e utilizza il risultato come query per la ricerca ibrida
  perImmagine(file: File, limit = 20, pesoSemantico = 0.5): Observable<RisultatoRicercaImmagine> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<RisultatoRicercaImmagine>(`${this.baseUrl}/immagine`, formData, {
      params: { limit, peso_semantico: pesoSemantico },
    });
  }
}
