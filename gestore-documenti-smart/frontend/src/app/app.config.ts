// ==============================================================================
// src/app/app.config.ts — Configurazione Globale dell'App (Standalone)
// ==============================================================================

import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [

    // ─── OTTIMIZZAZIONE DELLA CHANGE DETECTION ─────────────────────────────────
    // Raggruppa eventi ravvicinati in un singolo ciclo di aggiornamento,
    // riducendo ricalcoli della UI e consumo di CPU.
    provideZoneChangeDetection({ eventCoalescing: true }),

    // ─── ROUTING ────────────────────────────────────────────────────────────────
    // Registra le route dell'applicazione per gestire la navigazione
    // senza ricaricare la pagina.
    provideRouter(routes),

    // ─── CLIENT HTTP ────────────────────────────────────────────────────────────
    // Mantiene XMLHttpRequest (XHR) per supportare gli eventi di avanzamento
    // dell'upload, necessari alla barra di progresso durante il caricamento
    // dei CSV. L'opzione withFetch() non viene quindi abilitata.
    provideHttpClient(),
  ],
};
