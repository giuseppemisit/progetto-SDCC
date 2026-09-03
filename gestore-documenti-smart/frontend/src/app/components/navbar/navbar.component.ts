// ==============================================================================
// src/app/components/navbar/navbar.component.ts — Navigazione Principale
// ==============================================================================

import { Component, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

interface VoceMenu {
  etichetta: string;
  percorso: string;
  esatto?: boolean;
  icona: 'panoramica' | 'archivio' | 'nuovo' | 'massivo' | 'ricerca';
}

/**
 * Sidebar di navigazione primaria dell'applicazione.
 *
 * Le voci sono organizzate per attività dell'operatore anziché per struttura
 * tecnica delle rotte, rendendo la navigazione più coerente con il flusso di lavoro.
 */
@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss',
})
export class NavbarComponent {
  // Stato e chiusura della sidebar mobile sono gestiti dal componente padre
  readonly mobileOpen = input(false);
  readonly closeMobile = output<void>();

  readonly vociConsultazione: VoceMenu[] = [
    { etichetta: 'Panoramica', percorso: '/', esatto: true, icona: 'panoramica' },
    { etichetta: 'Archivio documenti', percorso: '/documenti', icona: 'archivio' },
    { etichetta: 'Ricerca avanzata', percorso: '/ricerca', icona: 'ricerca' },
  ];

  readonly vociAcquisizione: VoceMenu[] = [
    { etichetta: 'Nuovo documento', percorso: '/documenti/nuovo', icona: 'nuovo' },
    { etichetta: 'Caricamento massivo', percorso: '/upload', icona: 'massivo' },
  ];

  // Dopo la navigazione chiude il menu su dispositivi mobili
  onLinkClick(): void {
    this.closeMobile.emit();
  }
}
