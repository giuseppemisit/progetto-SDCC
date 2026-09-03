// ==============================================================================
// src/app/components/inserimento/inserimento.component.ts — Area Inserimento Documenti
// ==============================================================================

import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { DocumentoFormComponent } from '../documento-form/documento-form.component';
import { UploadMassivoComponent } from '../upload-massivo/upload-massivo.component';

type SchedaInserimento = 'manuale' | 'massivo';

/**
 * Area di inserimento documenti: contiene i due flussi di
 * inserimento manuale e caricamento massivo, accessibili dalla stessa schermata.
 *
 * La scheda iniziale viene determinata dai metadati della rotta
 * (/documenti/nuovo oppure /upload), mantenendo validi i link diretti alle rispettive modalità.
 */
@Component({
  selector: 'app-inserimento',
  standalone: true,
  imports: [DocumentoFormComponent, UploadMassivoComponent],
  templateUrl: './inserimento.component.html',
  styleUrl: './inserimento.component.scss',
})
export class InserimentoComponent {
  private readonly route = inject(ActivatedRoute);

  readonly schedaAttiva = signal<SchedaInserimento>(
    (this.route.snapshot.data['tab'] as SchedaInserimento) ?? 'manuale',
  );

  selezionaScheda(scheda: SchedaInserimento): void {
    this.schedaAttiva.set(scheda);
  }
}
