// ==============================================================================
// src/app/components/home/home.component.ts — Dashboard e Ricerca Rapida
// ==============================================================================

import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { DocumentoService } from '../../services/documento.service';
import { Documento } from '../../models/documento.model';
import { ModalitaRicerca, StatisticheArchivio } from '../../models/ricerca-result.model';
import { DocumentoCardComponent } from '../documento-card/documento-card.component';

const TIPOLOGIE_RAPIDE = [
  'Delibera',
  'Determina',
  'Ordinanza',
  'Protocollo generale',
  'Verbale'
];

/**
 * Dashboard / Area di ricerca avanzata: punto di ingresso
 * che riunisce ricerca testuale rapida, filtri per tipologia e riepilogo
 * dello stato dell'archivio, oltre agli ultimi documenti inseriti.
 */
@Component({
  selector: 'app-home',
  standalone: true,
  imports: [FormsModule, RouterLink, DocumentoCardComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnInit {
  private readonly documentoService = inject(DocumentoService);
  private readonly router = inject(Router);

  readonly query = signal('');
  readonly modalita = signal<ModalitaRicerca>('ibrida');
  readonly tipologieRapide = TIPOLOGIE_RAPIDE;

  readonly documenti = signal<Documento[]>([]);
  readonly caricamento = signal(true);

  /**
   * Le statistiche provengono da un endpoint aggregato e rappresentano
   * l'intero archivio, evitando di ricavare i conteggi dalla lista paginata
   */
  readonly statistiche = signal<StatisticheArchivio | null>(null);

  readonly totaleDocumenti = computed(() => this.statistiche()?.totale ?? 0);

  // Considera solo i documenti realmente in attesa di elaborazione OCR
  readonly inAttesa = computed(() => this.statistiche()?.in_attesa ?? 0);

  readonly senzaScansione = computed(() => this.statistiche()?.senza_scansione ?? 0);

  readonly inErrore = computed(() => this.statistiche()?.errore ?? 0);

  // La lista viene utilizzata per mostrare gli ultimi documenti inseriti,
  // ordinandoli per data di creazione senza modificare l'ordine dei dati originali.
  readonly recenti = computed(() =>
    [...this.documenti()]
      .sort(
        (a, b) => new Date(b.creato_il).getTime() - new Date(a.creato_il).getTime()
      )
      .slice(0, 4),
  );

  ngOnInit(): void {
    this.documentoService.statistiche().subscribe({
      next: (statistiche) => this.statistiche.set(statistiche),
      // Un errore nelle statistiche non impedisce il caricamento dei documenti recenti
      error: () => this.statistiche.set(null),
    });

    this.documentoService.getDocumenti(0, 100).subscribe({
      next: (documenti) => {
        this.documenti.set(documenti);
        this.caricamento.set(false);
      },
      error: () => this.caricamento.set(false),
    });
  }

  impostaModalita(modalita: ModalitaRicerca): void {
    this.modalita.set(modalita);
  }

  cerca(): void {
    const testo = this.query().trim();
    if (!testo) return;

    // Passa query e modalità all'area di ricerca per mantenere un unico flusso di ricerca
    this.router.navigate(['/ricerca'], {
      queryParams: {
        q: testo,
        modo: this.modalita()
      }
    });
  }

  cercaPerTipologia(tipologia: string): void {
    this.router.navigate(['/ricerca'], {
      queryParams: {
        q: tipologia, modo: 'fulltext'
      }
    });
  }
}
