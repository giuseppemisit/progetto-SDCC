// ==============================================================================
// src/main.ts — Entry Point dell'Applicazione Angular
// ==============================================================================

import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';


// ─── AVVIO DELL'APPLICAZIONE ──────────────────────────────────────────────────
// Avvio l'app caricando il componente principale (AppComponent) con le
// impostazioni globali definite in appConfig (Router, HttpClient, ecc.)
bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));    // Intercetta gli errori durante il bootstrap
