// ==============================================================================
// src/app/app.routes.ts — Configurazione delle Rotte e Navigazione SPA
// ==============================================================================

import { Routes } from '@angular/router';
import { HomeComponent } from './components/home/home.component';
import { DocumentoListaComponent } from './components/documento-lista/documento-lista.component';
import { DocumentoFormComponent } from './components/documento-form/documento-form.component';
import { DocumentoDettaglioComponent } from './components/documento-dettaglio/documento-dettaglio.component';
import { InserimentoComponent } from './components/inserimento/inserimento.component';
import { RicercaComponent } from './components/ricerca/ricerca.component';

export const routes: Routes = [

  // ─── PANORAMICA E ARCHIVIO ───────────────────────────────────────────────────
  {
    path: '',
    component: HomeComponent,
    // Aggiorna il titolo della pagina
    title: 'Panoramica | Gestore Documenti Comunali',
    // Fornisce metadati al layout per costruire dinamicamente intestazioni e breadcrumb
    data: { heading: 'Panoramica', sezione: 'Dashboard' },
  },
  {
    path: 'documenti',
    component: DocumentoListaComponent,
    title: 'Archivio | Gestore Documenti Comunali',
    data: { heading: 'Archivio documenti', sezione: 'Consultazione' },
  },

  // ─── ACQUISIZIONE E GESTIONE ─────────────────────────────────────────────────
  {
    path: 'documenti/nuovo',
    // Riutilizza InserimentoComponent configurandolo per l'inserimento manuale
    component: InserimentoComponent,
    data: { tab: 'manuale', heading: 'Nuovo documento', sezione: 'Acquisizione' },
    title: 'Nuovo documento | Gestore Documenti Comunali',
  },
  {
    path: 'upload',
    // Lo stesso componente gestisce una seconda modalità tramite il parametro
    // di configurazione della rotta
    component: InserimentoComponent,
    data: { tab: 'massivo', heading: 'Caricamento massivo', sezione: 'Acquisizione' },
    title: 'Caricamento massivo | Gestore Documenti Comunali',
  },
  {
    path: 'documenti/:id/modifica',
    component: DocumentoFormComponent,
    title: 'Modifica documento | Gestore Documenti Comunali',
    data: { heading: 'Modifica documento', sezione: 'Acquisizione' },
  },
  {
    path: 'documenti/:id',
    component: DocumentoDettaglioComponent,
    title: 'Dettaglio documento | Gestore Documenti Comunali',
    data: { heading: 'Dettaglio documento', sezione: 'Consultazione' },
  },

  // ─── RICERCA ─────────────────────────────────────────────────────────────────
  {
    path: 'ricerca',
    // Riutilizza RicercaComponent per la ricerca testuale
    component: RicercaComponent,
    data: { tab: 'testo', heading: 'Ricerca avanzata', sezione: 'Consultazione' },
    title: 'Ricerca | Gestore Documenti Comunali',
  },
  {
    path: 'ricerca/immagine',
    // Riutilizza lo stesso componente per la ricerca per immagine
    component: RicercaComponent,
    data: { tab: 'immagine', heading: 'Ricerca per immagine', sezione: 'Consultazione' },
    title: 'Ricerca per immagine | Gestore Documenti Comunali',
  },

  // ─── GESTIONE DELLE ROTTE NON VALIDE ─────────────────────────────────────────
  // Reindirizza alla Home gli URL non riconosciuti
  { path: '**', redirectTo: '' },
];
