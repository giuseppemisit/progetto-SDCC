// ==============================================================================
// src/app/services/documento.service.ts — Servizio di Accesso ai Documenti
// ==============================================================================

import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { Documento, DocumentoCreate, DocumentoUpdate } from '../models/documento.model';
import {
  DocumentoSearchResult,
  StatisticheArchivio,
  SuggerimentoTipologiaResponse,
  SuggerisciTipologiaRequest,
} from '../models/ricerca-result.model';

@Injectable({ providedIn: 'root' })
export class DocumentoService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/documenti';

  getDocumenti(skip = 0, limit = 100): Observable<Documento[]> {
    return this.http.get<Documento[]>(this.baseUrl, { params: { skip, limit } });
  }

  /**
   * Recupera le statistiche dell'intero archivio per la dashboard.
   *
   * Utilizza un endpoint dedicato perché la lista dei documenti è paginata
   * e non può rappresentare correttamente i conteggi globali.
   */
  statistiche(): Observable<StatisticheArchivio> {
    return this.http.get<StatisticheArchivio>(`${this.baseUrl}/statistiche`);
  }

  getDocumento(id: number): Observable<Documento> {
    return this.http.get<Documento>(`${this.baseUrl}/${id}`);
  }

  creaDocumento(documento: DocumentoCreate): Observable<Documento> {
    return this.http.post<Documento>(this.baseUrl, documento);
  }

  aggiornaDocumento(id: number, documento: DocumentoUpdate): Observable<Documento> {
    return this.http.patch<Documento>(`${this.baseUrl}/${id}`, documento);
  }

  eliminaDocumento(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.baseUrl}/${id}`);
  }

  // Recupera documenti semanticamente affini per la sezione "Suggerimenti AI"
  documentiSimili(id: number, limit = 5): Observable<DocumentoSearchResult[]> {
    return this.http.get<DocumentoSearchResult[]>(
      `${this.baseUrl}/${id}/simili`,
      { params: { limit } },
    );
  }

  suggerisciTipologia(payload: SuggerisciTipologiaRequest): Observable<SuggerimentoTipologiaResponse> {
    return this.http.post<SuggerimentoTipologiaResponse>(
      `${this.baseUrl}/suggerisci-tipologia`,
      payload
    );
  }
}
