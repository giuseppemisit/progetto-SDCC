// ==============================================================================
// src/app/components/ricerca/ricerca.component.ts — Ricerca Documenti
// ==============================================================================


import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { RicercaService } from '../../services/ricerca.service';
import { descriviStato } from '../../models/documento.model';
import { DocumentoSearchResult, ModalitaRicerca } from '../../models/ricerca-result.model';
import { DocumentoCardComponent } from '../documento-card/documento-card.component';
import { RicercaImmagineComponent } from '../ricerca-immagine/ricerca-immagine.component';

type SchedaRicerca = 'testo' | 'immagine';
type Vista = 'griglia' | 'tabella';

/**
 * Componente di Ricerca: offre due modalità di accesso all'archivio:
 * ricerca testuale (full-text, semantica o ibrida) e
 * ricerca per immagine tramite OCR, delegata a RicercaImmagineComponent.
 */
@Component({
  selector: 'app-ricerca',
  standalone: true,
  imports: [FormsModule, RouterLink, DecimalPipe, DocumentoCardComponent, RicercaImmagineComponent],
  templateUrl: './ricerca.component.html',
  styleUrl: './ricerca.component.scss',
})
export class RicercaComponent implements OnInit {
  private readonly ricercaService = inject(RicercaService);
  private readonly route = inject(ActivatedRoute);

  readonly schedaAttiva = signal<SchedaRicerca>(
    (this.route.snapshot.data['tab'] as SchedaRicerca) ?? 'testo',
  );

  // Riutilizza la stessa descrizione dello stato delle card nella vista tabellare
  readonly descriviStato = descriviStato;

  readonly query = signal('');
  readonly modalita = signal<ModalitaRicerca>('ibrida');
  readonly pesoSemantico = signal(0.5);

  readonly ricercaInCorso = signal(false);
  readonly haRicercato = signal(false);
  readonly erroreRicerca = signal<string | null>(null);
  readonly risultati = signal<DocumentoSearchResult[]>([]);

  readonly vista = signal<Vista>('griglia');
  readonly filtroTipologia = signal<string | null>(null);

  readonly tipologieDisponibili = computed(() => {
    const insieme = new Set<string>();
    for (const r of this.risultati()) {
      if (r.documento.tipologia) insieme.add(r.documento.tipologia);
    }
    return Array.from(insieme).sort();
  });

  readonly risultatiFiltrati = computed(() => {
    const filtro = this.filtroTipologia();
    if (!filtro) return this.risultati();
    return this.risultati().filter((r) => r.documento.tipologia === filtro);
  });

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    const q = params.get('q');
    const modo = params.get('modo') as ModalitaRicerca | null;
    if (modo && ['fulltext', 'semantica', 'ibrida'].includes(modo)) {
      this.modalita.set(modo);
    }
    if (q) {
      this.query.set(q);
      this.cerca();
    }
  }

  selezionaScheda(scheda: SchedaRicerca): void {
    this.schedaAttiva.set(scheda);
  }

  impostaModalita(modalita: ModalitaRicerca): void {
    this.modalita.set(modalita);
  }

  impostaVista(vista: Vista): void {
    this.vista.set(vista);
  }

  toggleFiltroTipologia(tipologia: string): void {
    this.filtroTipologia.set(this.filtroTipologia() === tipologia ? null : tipologia);
  }

  cerca(): void {
    const testo = this.query().trim();
    if (!testo) return;

    this.ricercaInCorso.set(true);
    this.erroreRicerca.set(null);
    this.filtroTipologia.set(null);

    // Seleziona l'endpoint in base alla modalità senza duplicare la gestione della risposta
    const ricerca$ =
      this.modalita() === 'fulltext'
        ? this.ricercaService.fulltext(testo, 30)
        : this.modalita() === 'semantica'
          ? this.ricercaService.semantica(testo, 30)
          : this.ricercaService.ibrida(testo, 30, this.pesoSemantico());

    ricerca$.subscribe({
      next: (risultati) => {
        this.risultati.set(risultati);
        this.ricercaInCorso.set(false);
        this.haRicercato.set(true);
      },
      error: () => {
        this.ricercaInCorso.set(false);
        this.haRicercato.set(true);
        this.erroreRicerca.set('La ricerca non è riuscita. Riprova tra qualche istante.');
      },
    });
  }
}
