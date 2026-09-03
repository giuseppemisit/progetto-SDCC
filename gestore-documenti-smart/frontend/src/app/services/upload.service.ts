// ==============================================================================
// src/app/services/upload.service.ts — Servizio per il Caricamento dei File
// ==============================================================================

import { HttpClient, HttpEvent, HttpRequest } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { Documento } from '../models/documento.model';
import { RisultatoCaricamentoMassivo } from '../models/ricerca-result.model';

@Injectable({ providedIn: 'root' })
export class UploadService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/upload';

  // Carica l'immagine di un documento esistente;
  // l'elaborazione OCR avviene successivamente in background per non bloccare la risposta HTTP
  caricaImmagine(documentoId: number, file: File): Observable<Documento> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post<Documento>(
      `${this.baseUrl}/immagine/${documentoId}`,
      formData
    );
  }

  getUrlImmagine(documentoId: number): Observable<{ url: string }> {
    return this.http.get<{ url: string }>(
      `${this.baseUrl}/immagine/${documentoId}/url`
    );
  }

  // HttpRequest con reportProgress abilita gli eventi necessari per mostrare
  // l'avanzamento reale dell'upload massivo
  caricaMassivo(file: File): Observable<HttpEvent<RisultatoCaricamentoMassivo>> {
    const formData = new FormData();
    formData.append('file', file);

    const req = new HttpRequest<FormData>(
      'POST',
      `${this.baseUrl}/massivo`,
      formData,
      {
      reportProgress: true,
      }
    );

    return this.http.request<RisultatoCaricamentoMassivo>(req);
  }
}
