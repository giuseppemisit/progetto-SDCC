// ==============================================================================
// src/app/components/ricerca-immagine/ricerca-immagine.component.ts — Ricerca per Immagine
// ==============================================================================

import { Component, inject, signal } from '@angular/core';

import { RicercaService } from '../../services/ricerca.service';
import { DocumentoSearchResult } from '../../models/ricerca-result.model';
import { DocumentoCardComponent } from '../documento-card/documento-card.component';

const TIPI_CONSENTITI = ['image/jpeg', 'image/png', 'image/webp'];
const DIMENSIONE_MASSIMA_MB = 10;

/**
 * Ricerca per immagine: l'operatore carica la fotografia di un documento
 * cartaceo; il backend esegue l'OCR e usa il testo estratto come query per
 * una ricerca ibrida (full-text + semantica) sull'archivio digitalizzato
 */
@Component({
  selector: 'app-ricerca-immagine',
  standalone: true,
  imports: [DocumentoCardComponent],
  templateUrl: './ricerca-immagine.component.html',
  styleUrl: './ricerca-immagine.component.scss',
})
export class RicercaImmagineComponent {
  private readonly ricercaService = inject(RicercaService);

  readonly fileSelezionato = signal<File | null>(null);
  readonly anteprimaImmagine = signal<string | null>(null);
  readonly erroreFile = signal<string | null>(null);

  readonly ricercaInCorso = signal(false);
  readonly erroreRicerca = signal<string | null>(null);
  readonly testoEstratto = signal<string | null>(null);
  readonly risultati = signal<DocumentoSearchResult[] | null>(null);

  onFileSelezionato(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.gestisciNuovoFile(input.files?.[0] ?? null);

    // Permette di riselezionare lo stesso file dopo averlo rimosso
    input.value = '';
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.gestisciNuovoFile(event.dataTransfer?.files?.[0] ?? null);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  private gestisciNuovoFile(file: File | null): void {
    if (!file) return;

    if (!TIPI_CONSENTITI.includes(file.type)) {
      this.erroreFile.set('Formato non supportato. Carica una foto JPEG, PNG o WEBP.');
      return;
    }

    // Evita di avviare una richiesta per file che superano il limite previsto
    if (file.size > DIMENSIONE_MASSIMA_MB * 1024 * 1024) {
      this.erroreFile.set(`Il file supera la dimensione massima di ${DIMENSIONE_MASSIMA_MB} MB.`);
      return;
    }

    this.erroreFile.set(null);
    this.testoEstratto.set(null);
    this.risultati.set(null);
    this.fileSelezionato.set(file);
    this.anteprimaImmagine.set(URL.createObjectURL(file));
  }

  rimuoviImmagine(): void {
    this.fileSelezionato.set(null);
    this.anteprimaImmagine.set(null);
    this.testoEstratto.set(null);
    this.risultati.set(null);
    this.erroreRicerca.set(null);
  }

  avviaRicerca(): void {
    const file = this.fileSelezionato();
    if (!file) return;

    this.ricercaInCorso.set(true);
    this.erroreRicerca.set(null);

    this.ricercaService.perImmagine(file).subscribe({
      next: (esito) => {
        // Il testo OCR viene mantenuto per mostrare all'operatore la query effettivamente utilizzata
        this.testoEstratto.set(esito.testo_estratto);
        this.risultati.set(esito.risultati);
        this.ricercaInCorso.set(false);
      },
      error: () => {
        this.ricercaInCorso.set(false);
        this.erroreRicerca.set('La ricerca per immagine non è riuscita. Riprova con un\'altra foto.');
      },
    });
  }
}
