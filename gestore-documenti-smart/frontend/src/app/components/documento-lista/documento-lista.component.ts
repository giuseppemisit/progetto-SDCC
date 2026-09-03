// ==============================================================================
// src/app/components/documento-lista/documento-lista.component.ts — Archivio Documentale
// ==============================================================================

import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { DocumentoService } from '../../services/documento.service';
import { Documento, descriviStato } from '../../models/documento.model';
import { DocumentoCardComponent } from '../documento-card/documento-card.component';

type Vista = 'griglia' | 'tabella';

const DIMENSIONE_PAGINA = 24;

/**
 * Archivio documentale: elenco dei documenti con filtro rapido lato client,
 * doppia modalità di visualizzazione e caricamento incrementale.
 */
@Component({
  selector: 'app-documento-lista',
  standalone: true,
  imports: [RouterLink, DocumentoCardComponent],
  templateUrl: './documento-lista.component.html',
  styleUrl: './documento-lista.component.scss',
})
export class DocumentoListaComponent implements OnInit {
  private readonly documentoService = inject(DocumentoService);

  // Riutilizza la stessa logica di presentazione dello stato nelle card e nella tabella
  readonly descriviStato = descriviStato;

  readonly documenti = signal<Documento[]>([]);
  readonly caricamento = signal(true);
  readonly erroreCaricamento = signal<string | null>(null);
  readonly altriDisponibili = signal(true);
  readonly caricamentoAltri = signal(false);

  readonly vista = signal<Vista>('griglia');
  readonly testoFiltro = signal('');
  readonly filtroTipologia = signal<string | null>(null);

  // Ricava dinamicamente le tipologie presenti nei documenti già caricati
  readonly tipologieDisponibili = computed(() => {
    const insieme = new Set<string>();
    for (const d of this.documenti()) {
      if (d.tipologia) insieme.add(d.tipologia);
    }
    return Array.from(insieme).sort();
  });

  // I filtri sono applicati lato client sui documenti già disponibili,
  // evitando una nuova richiesta al backend per ogni modifica del filtro
  readonly documentiFiltrati = computed(() => {
    const testo = this.testoFiltro().trim().toLowerCase();
    const tipologia = this.filtroTipologia();

    return this.documenti().filter((d) => {
      const corrispondeTesto = !testo || d.nome.toLowerCase().includes(testo);
      const corrispondeTipologia = !tipologia || d.tipologia === tipologia;

      return corrispondeTesto && corrispondeTipologia;
    });
  });

  ngOnInit(): void {
    this.caricaPagina(0);
  }

  impostaVista(vista: Vista): void {
    this.vista.set(vista);
  }

  toggleFiltroTipologia(tipologia: string): void {
    this.filtroTipologia.set(this.filtroTipologia() === tipologia ? null : tipologia);
  }

  caricaAltri(): void {
    this.caricamentoAltri.set(true);
    this.caricaPagina(this.documenti().length);
  }

  private caricaPagina(skip: number): void {
    this.documentoService.getDocumenti(skip, DIMENSIONE_PAGINA).subscribe({
      next: (pagina) => {
        // La prima pagina sostituisce l'archivio; le successive vengono accodate
        // per realizzare il caricamento incrementale senza perdere i dati già visibili
        this.documenti.set(skip === 0 ? pagina : [...this.documenti(), ...pagina]);
        this.altriDisponibili.set(pagina.length === DIMENSIONE_PAGINA);
        this.caricamento.set(false);
        this.caricamentoAltri.set(false);
      },
      error: () => {
        this.erroreCaricamento.set('Impossibile recuperare l\'archivio documentale in questo momento.');
        this.caricamento.set(false);
        this.caricamentoAltri.set(false);
      },
    });
  }
}
