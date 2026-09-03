// ==============================================================================
// src/app/components/documento-form/documento-form.component.ts — Form Documento
// ==============================================================================

import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { DocumentoService } from '../../services/documento.service';
import { UploadService } from '../../services/upload.service';
import { TipologiaSuggerita } from '../../models/ricerca-result.model';

const TIPI_CONSENTITI = ['image/jpeg', 'image/png', 'image/webp'];
const DIMENSIONE_MASSIMA_MB = 10;

/**
 * Form per la creazione e modifica di un documento.
 *
 * L'assenza del parametro `:id` identifica la modalità di creazione;
 * la sua presenza attiva la modalità di modifica del documento esistente.
 */
@Component({
  selector: 'app-documento-form',
  standalone: true,
  imports: [ReactiveFormsModule, DecimalPipe],
  templateUrl: './documento-form.component.html',
  styleUrl: './documento-form.component.scss',
})
export class DocumentoFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly documentoService = inject(DocumentoService);
  private readonly uploadService = inject(UploadService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly documentoId = signal<number | null>(null);
  readonly modalitaModifica = computed(() => this.documentoId() !== null);

  readonly caricamentoIniziale = signal(false);
  readonly salvataggioInCorso = signal(false);
  readonly erroreSalvataggio = signal<string | null>(null);
  readonly esitoPositivo = signal<string | null>(null);

  readonly fileImmagine = signal<File | null>(null);
  readonly anteprimaImmagine = signal<string | null>(null);
  readonly erroreImmagine = signal<string | null>(null);
  readonly immagineEsistenteUrl = signal<string | null>(null);

  readonly suggerimentiTipologia = signal<TipologiaSuggerita[]>([]);
  readonly caricamentoSuggerimenti = signal(false);

  readonly form = this.fb.nonNullable.group({
    nome: ['', [Validators.required, Validators.maxLength(255)]],
    tipologia: ['', Validators.maxLength(100)],
    data_documento: [''],
    ufficio: ['', Validators.maxLength(200)],
    firmatari: [''],
    descrizione: [''],

    // Questi campi vengono popolati dalla pipeline OCR/NLP e sono modificabili
    // solo in fase di modifica per consentire correzioni manuali.
    testo_ocr: [''],
    keywords: [''],
  });

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    if (!idParam) return;

    const id = Number(idParam);
    this.documentoId.set(id);
    this.caricamentoIniziale.set(true);

    this.documentoService.getDocumento(id).subscribe({
      next: (documento) => {
        this.form.patchValue({
          nome: documento.nome,
          tipologia: documento.tipologia ?? '',
          data_documento: documento.data_documento ?? '',
          ufficio: documento.ufficio ?? '',
          firmatari: documento.firmatari ?? '',
          descrizione: documento.descrizione ?? '',
          testo_ocr: documento.testo_ocr ?? '',
          keywords: documento.keywords ?? '',
        });
        this.immagineEsistenteUrl.set(documento.immagine_url ?? null);
        this.caricamentoIniziale.set(false);
      },
      error: () => {
        this.erroreSalvataggio.set(
          'Impossibile recuperare i dati del documento richiesto.'
        );
        this.caricamentoIniziale.set(false);
      },
    });
  }

  onFileSelezionato(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    this.gestisciNuovoFile(file);

    // Permette di riselezionare lo stesso file dopo averlo rimosso
    input.value = '';
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();

    const file = event.dataTransfer?.files?.[0] ?? null;
    this.gestisciNuovoFile(file);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  rimuoviImmagine(): void {
    this.fileImmagine.set(null);
    this.anteprimaImmagine.set(null);
    this.erroreImmagine.set(null);
  }

  private gestisciNuovoFile(file: File | null): void {
    if (!file) return;

    if (!TIPI_CONSENTITI.includes(file.type)) {
      this.erroreImmagine.set(
        'Formato non supportato. Carica un file JPEG, PNG o WEBP.'
      );
      return;
    }

    if (file.size > DIMENSIONE_MASSIMA_MB * 1024 * 1024) {
      this.erroreImmagine.set(
        `Il file supera la dimensione massima di ${DIMENSIONE_MASSIMA_MB} MB.`,
      );
      return;
    }

    this.erroreImmagine.set(null);
    this.fileImmagine.set(file);
    this.anteprimaImmagine.set(URL.createObjectURL(file));
  }

  richiediSuggerimentoTipologia(): void {
    const { nome, descrizione } = this.form.getRawValue();

    if (!nome.trim() && !descrizione.trim()) {
      this.erroreSalvataggio.set(
        'Inserisci almeno un nome o una descrizione per ottenere un suggerimento.',
      );
      return;
    }

    this.caricamentoSuggerimenti.set(true);

    this.documentoService
      .suggerisciTipologia({ nome, descrizione, top_k: 5 })
      .subscribe({
        next: (risposta) => {
          this.suggerimentiTipologia.set(risposta.suggerimenti);
          this.caricamentoSuggerimenti.set(false);
        },
        error: () => {
          this.caricamentoSuggerimenti.set(false);
        },
      });
  }

  applicaTipologiaSuggerita(tipologia: string): void {
    this.form.controls.tipologia.setValue(tipologia);
  }

  annulla(): void {
    const id = this.documentoId();
    this.router.navigate(id ? ['/documenti', id] : ['/documenti']);
  }

  salva(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.erroreSalvataggio.set(null);
    this.esitoPositivo.set(null);
    this.salvataggioInCorso.set(true);

    const valori = this.form.getRawValue();
    const idEsistente = this.documentoId();

    // Il payload di creazione contiene solo i dati inseribili dall'operatore;
    // OCR e keyword vengono gestiti dal backend e sono modificabili solo via PATCH
    const salvataggio$ = idEsistente
      ? this.documentoService.aggiornaDocumento(idEsistente, {
          nome: valori.nome.trim(),
          descrizione: valori.descrizione.trim() || null,
          tipologia: valori.tipologia.trim() || null,
          data_documento: valori.data_documento || null,
          ufficio: valori.ufficio.trim() || null,
          firmatari: valori.firmatari.trim() || null,
          testo_ocr: valori.testo_ocr.trim() || null,
          keywords: valori.keywords.trim() || null,
        })
      : this.documentoService.creaDocumento({
          nome: valori.nome.trim(),
          descrizione: valori.descrizione.trim() || null,
          tipologia: valori.tipologia.trim() || null,
          data_documento: valori.data_documento || null,
          ufficio: valori.ufficio.trim() || null,
          firmatari: valori.firmatari.trim() || null,
        });

    salvataggio$.subscribe({
      next: (documento) => {
        const file = this.fileImmagine();
        if (!file) {
          this.completaSalvataggio(documento.id);
          return;
        }

        // L'immagine viene caricata dopo la creazione/modifica del record,
        // perché l'endpoint richiede l'ID del documento già esistente.
        this.uploadService.caricaImmagine(documento.id, file).subscribe({
          next: () => this.completaSalvataggio(documento.id),
          error: () => {
            this.salvataggioInCorso.set(false);
            this.erroreSalvataggio.set(
              'Il documento è stato salvato ma il caricamento dell\'immagine non è riuscito. Riprova dalla scheda di dettaglio.',
            );
            this.router.navigate(['/documenti', documento.id]);
          },
        });
      },
      error: () => {
        this.salvataggioInCorso.set(false);
        this.erroreSalvataggio.set(
          'Salvataggio non riuscito. Verifica i dati inseriti e riprova.',
        );
      },
    });
  }

  private completaSalvataggio(id: number): void {
    this.salvataggioInCorso.set(false);
    this.esitoPositivo.set('Documento salvato correttamente.');
    this.router.navigate(['/documenti', id]);
  }
}
