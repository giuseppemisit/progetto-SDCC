// ==============================================================================
// src/app/components/documento-card/documento-card.component.ts — Card Documento
// ==============================================================================

import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Documento, descriviStato } from '../../models/documento.model';

const PALETTE_TIPOLOGIA = ['tono-a', 'tono-b', 'tono-c', 'tono-d', 'tono-e'] as const;

/**
 * Associa ogni tipologia a un tono in modo deterministico, evitando di memorizzare
 * lo stile nel documento e mantenendo la stessa resa tra visualizzazioni diverse.
 */
function tonoPerTipologia(tipologia: string | null | undefined): string {
  const chiave = tipologia?.trim() || 'generico';
  let hash = 0;
  for (let i = 0; i < chiave.length; i++) {
    hash = (hash * 31 + chiave.charCodeAt(i)) >>> 0;
  }
  return PALETTE_TIPOLOGIA[hash % PALETTE_TIPOLOGIA.length];
}

/**
 * Card riutilizzabile per rappresentare un documento in vista griglia,
 * usata sia nell'archivio sia nei risultati di ricerca
 */
@Component({
  selector: 'app-documento-card',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './documento-card.component.html',
  styleUrl: './documento-card.component.scss',
})
export class DocumentoCardComponent {
  readonly documento = input.required<Documento>();

  /** Punteggio di rilevanza (0-1), presente solo nei risultati di ricerca */
  readonly score = input<number | null>(null);

  readonly tono = computed(() => tonoPerTipologia(this.documento().tipologia));

  readonly iniziali = computed(() => {
    const tipologia = this.documento().tipologia?.trim();

    if (!tipologia) return 'DOC';

    return tipologia
      .split(/\s+/)
      .slice(0, 2)
      .map((parola) => parola[0]?.toUpperCase() ?? '')
      .join('');
  });

  // Centralizza la descrizione dello stato per evitare logiche
  // divergenti tra card, tabella e dettaglio del documento
  readonly statoInfo = computed(() => descriviStato(this.documento()));

  readonly percentualeRilevanza = computed(() => {
    const valore = this.score();

    return valore === null ? null : Math.round(Math.min(valore, 1) * 100);
  });
}
