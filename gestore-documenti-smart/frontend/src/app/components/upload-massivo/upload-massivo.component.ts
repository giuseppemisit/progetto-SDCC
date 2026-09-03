// ==============================================================================
// src/app/components/upload-massivo/upload-massivo.component.ts — Caricamento Massivo
// ==============================================================================

import { HttpEventType } from '@angular/common/http';
import { Component, signal } from '@angular/core';
import { inject } from '@angular/core';

import { UploadService } from '../../services/upload.service';
import { RisultatoCaricamentoMassivo } from '../../models/ricerca-result.model';

const ESTENSIONI_CONSENTITE = ['.csv', '.json'];
const DIMENSIONE_MASSIMA_MB = 5;

// Esempi dei campi accettati da DocumentoCreate lato backend:
// solo 'nome' è obbligatorio, gli altri possono essere omessi (JSON) o lasciati vuoti (CSV).
const ESEMPIO_CSV = `nome,descrizione,tipologia,data_documento,ufficio,firmatari
Delibera 45/2024,"Approvazione bilancio di previsione, esercizio 2024",Delibera,2024-03-12,Ufficio Ragioneria,Mario Rossi; Anna Bianchi
Ordinanza 12/2024,Chiusura temporanea di via Roma,Ordinanza,2024-05-02,Polizia Locale,Luca Verdi
Determina 88/2024,,Determina,,Ufficio Tecnico,`;

const ESEMPIO_JSON = `[
  {
    "nome": "Delibera 45/2024",
    "descrizione": "Approvazione bilancio di previsione, esercizio 2024",
    "tipologia": "Delibera",
    "data_documento": "2024-03-12",
    "ufficio": "Ufficio Ragioneria",
    "firmatari": "Mario Rossi; Anna Bianchi"
  },
  {
    "nome": "Determina 88/2024",
    "tipologia": "Determina",
    "ufficio": "Ufficio Tecnico"
  }
]`;

/**
 * Gestisce il caricamento massivo di documenti da file CSV/JSON.
 *
 * Mostra l'avanzamento reale dell'upload e il riepilogo degli esiti
 * restituito dal backend per le singole righe del file.
 */
@Component({
  selector: 'app-upload-massivo',
  standalone: true,
  imports: [],
  templateUrl: './upload-massivo.component.html',
  styleUrl: './upload-massivo.component.scss',
})
export class UploadMassivoComponent {
  private readonly uploadService = inject(UploadService);

  readonly fileSelezionato = signal<File | null>(null);
  readonly erroreFile = signal<string | null>(null);

  readonly caricamentoInCorso = signal(false);
  readonly percentualeAvanzamento = signal(0);
  readonly risultato = signal<RisultatoCaricamentoMassivo | null>(null);
  readonly erroreCaricamento = signal<string | null>(null);

  // Esposti al template come sola lettura: il contenuto è statico e non
  // partecipa allo stato del componente.
  readonly esempioCsv = ESEMPIO_CSV;
  readonly esempioJson = ESEMPIO_JSON;

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

    const estensioneValida = ESTENSIONI_CONSENTITE.some((ext) => file.name.toLowerCase().endsWith(ext));

    if (!estensioneValida) {
      this.erroreFile.set('Formato non supportato. Carica un file .csv o .json.');
      return;
    }

    // Il controllo lato client evita di avviare upload sicuramente non validi
    if (file.size > DIMENSIONE_MASSIMA_MB * 1024 * 1024) {
      this.erroreFile.set(
        `Il file supera la dimensione massima di ${DIMENSIONE_MASSIMA_MB} MB.`,
      );
      return;
    }

    this.erroreFile.set(null);
    this.risultato.set(null);
    this.erroreCaricamento.set(null);
    this.fileSelezionato.set(file);
  }

  rimuoviFile(): void {
    this.fileSelezionato.set(null);
    this.percentualeAvanzamento.set(0);
    this.risultato.set(null);
    this.erroreCaricamento.set(null);
  }

  avviaCaricamento(): void {
    const file = this.fileSelezionato();
    if (!file) return;

    this.caricamentoInCorso.set(true);
    this.percentualeAvanzamento.set(0);
    this.erroreCaricamento.set(null);

    this.uploadService.caricaMassivo(file).subscribe({
      next: (evento) => {
        // UploadProgress consente di mostrare l'avanzamento reale,
        // anziché simulare una percentuale durante il trasferimento del file
        if (evento.type === HttpEventType.UploadProgress && evento.total) {
          this.percentualeAvanzamento.set(Math.round((evento.loaded / evento.total) * 100));
        } else if (evento.type === HttpEventType.Response && evento.body) {
          this.risultato.set(evento.body);
          this.caricamentoInCorso.set(false);
        }
      },
      error: () => {
        this.caricamentoInCorso.set(false);
        this.erroreCaricamento.set(
          'Il caricamento non è riuscito. Verifica il formato del file e riprova.',
        );
      },
    });
  }

  formatoDimensione(byte: number): string {
    if (byte < 1024) return `${byte} B`;

    const kb = byte / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;

    return `${(kb / 1024).toFixed(2)} MB`;
  }
}
