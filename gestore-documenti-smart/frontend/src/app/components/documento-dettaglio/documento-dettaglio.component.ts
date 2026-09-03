// ==============================================================================
// src/app/components/documento-dettaglio/documento-dettaglio.component.ts — Dettaglio Documento
// ==============================================================================

import { DatePipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { switchMap, takeWhile, timer } from 'rxjs';

import { DocumentoService } from '../../services/documento.service';
import { UploadService } from '../../services/upload.service';
import { Documento, descriviStato } from '../../models/documento.model';
import { DocumentoSearchResult } from '../../models/ricerca-result.model';
import { DocumentoCardComponent } from '../documento-card/documento-card.component';

/** Intervallo tra due interrogazioni successive dello stato di elaborazione */
const INTERVALLO_POLLING_MS = 2000;

/**
 * Limita il polling a 90 secondi per evitare interrogazioni indefinite
 * in caso di un'elaborazione in background interrotta anormalmente
 */
const MAX_TENTATIVI_POLLING = 45;

/**
 * Dettaglio documento: vista completa dei metadati e dell'immagine associata,
 * con suggerimenti di documenti semanticamente affini
 */
@Component({
  selector: 'app-documento-dettaglio',
  standalone: true,
  imports: [RouterLink, DatePipe, DocumentoCardComponent],
  templateUrl: './documento-dettaglio.component.html',
  styleUrl: './documento-dettaglio.component.scss',
})
export class DocumentoDettaglioComponent implements OnInit {
  private readonly documentoService = inject(DocumentoService);
  private readonly uploadService = inject(UploadService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly documento = signal<Documento | null>(null);
  readonly caricamento = signal(true);
  readonly erroreCaricamento = signal<string | null>(null);

  readonly urlImmagine = signal<string | null>(null);

  /**
   * Distingue un'immagine mai presente da una risorsa dichiarata nel database
   * ma non più disponibile nello storage
   */
  readonly immagineNonDisponibile = signal(false);
  readonly testoOcrEspanso = signal(false);

  readonly suggerimenti = signal<DocumentoSearchResult[]>([]);
  readonly caricamentoSuggerimenti = signal(true);

  /** Indica che il componente sta seguendo l'elaborazione OCR in background */
  readonly elaborazioneInCorso = signal(false);

  // Riutilizza la stessa logica di stato impiegata nelle card e nell'archivio
  readonly statoInfo = computed(() => {
    const documento = this.documento();

    return documento
      ? descriviStato(documento)
      : {
      stato: 'senza_scansione' as const,
        etichetta: '',
        etichettaEstesa: '',
        classe: ''
    };
  });

  readonly modaleEliminazioneAperto = signal(false);
  readonly eliminazioneInCorso = signal(false);

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));

    this.documentoService.getDocumento(id).subscribe({
      next: (documento) => {
        this.documento.set(documento);
        this.caricamento.set(false);

        if (documento.immagine_url) {
          this.uploadService.getUrlImmagine(id).subscribe({
            next: (esito) => this.urlImmagine.set(esito.url),
            error: () => this.urlImmagine.set(null),
          });
        }

        // Usa lo stato effettivo per avviare il polling solo quando esiste
        // realmente un'elaborazione OCR in attesa
        if (documento.stato_effettivo === 'in_attesa') {
          this.seguiElaborazione(id);
        }
      },
      error: () => {
        this.erroreCaricamento.set(
          'Documento non trovato oppure non più disponibile in archivio.'
        );
        this.caricamento.set(false);
      },
    });

    this.caricaSuggerimenti(id);
  }

  /**
   * Segue l'elaborazione OCR fino al completamento.
   *
   * Il backend esegue OCR, keyword ed embedding in background; il polling
   * permette alla pagina di aggiornarsi senza richiedere un refresh manuale.
   */
  private seguiElaborazione(id: number): void {
    this.elaborazioneInCorso.set(true);

    timer(INTERVALLO_POLLING_MS, INTERVALLO_POLLING_MS)
      .pipe(
        // Evita l'accumulo di richieste se una risposta impiega più dell'intervallo
        switchMap(() => this.documentoService.getDocumento(id)),

        // Include anche l'ultimo valore, cioè quello che conclude l'elaborazione
        takeWhile(
          (documento) => documento.stato_effettivo === 'in_attesa',
          true
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (documento) => {
          this.documento.set(documento);

          if (documento.stato_effettivo !== 'in_attesa') {
            this.elaborazioneInCorso.set(false);

            // L'embedding viene aggiornato dopo l'OCR, quindi anche i suggerimenti
            // devono essere ricalcolati per riflettere il contenuto aggiornato
            this.caricaSuggerimenti(id);
          }
        },
        error: () => this.elaborazioneInCorso.set(false),
      });

    // Impedisce al polling di rimanere attivo indefinitamente
    timer(INTERVALLO_POLLING_MS * MAX_TENTATIVI_POLLING)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.elaborazioneInCorso.set(false));
  }

  private caricaSuggerimenti(id: number): void {
    this.caricamentoSuggerimenti.set(true);

    this.documentoService
      .documentiSimili(id, 5)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (risultati) => {
          this.suggerimenti.set(risultati);
          this.caricamentoSuggerimenti.set(false);
        },
        error: () => this.caricamentoSuggerimenti.set(false),
      });
  }

  /**
   * Gestisce il caso in cui l'URL firmato è valido ma l'oggetto nello storage
   * non è più disponibile
   */
  onImmagineNonCaricata(): void {
    this.urlImmagine.set(null);
    this.immagineNonDisponibile.set(true);
  }

  get keywordsList(): string[] {
    const keywords = this.documento()?.keywords;

    if (!keywords) return [];

    return keywords
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);
  }

  apriModaleEliminazione(): void {
    this.modaleEliminazioneAperto.set(true);
  }

  chiudiModaleEliminazione(): void {
    this.modaleEliminazioneAperto.set(false);
  }

  confermaEliminazione(): void {
    const documento = this.documento();
    if (!documento) return;

    this.eliminazioneInCorso.set(true);

    this.documentoService.eliminaDocumento(documento.id).subscribe({
      next: () => this.router.navigate(['/documenti']),
      error: () => {
        this.eliminazioneInCorso.set(false);
        this.modaleEliminazioneAperto.set(false);
        this.erroreCaricamento.set(
          'Impossibile eliminare il documento. Riprova più tardi.'
        );
      },
    });
  }
}
