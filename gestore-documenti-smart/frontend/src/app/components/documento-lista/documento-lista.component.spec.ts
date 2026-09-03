import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { Documento } from '../../models/documento.model';
import { DocumentoListaComponent } from './documento-lista.component';

function doc(
  id: number,
  nome: string,
  tipologia?: string,
): Documento {
  return {
    id,
    nome,
    tipologia,
    stato_elaborazione: 'elaborato',
    stato_effettivo: 'elaborato',
    creato_il: '2026-01-01T10:00:00Z',
  };
}

describe('DocumentoListaComponent', () => {
  let fixture: ComponentFixture<DocumentoListaComponent>;
  let componente: DocumentoListaComponent;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DocumentoListaComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DocumentoListaComponent);
    componente = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function primaPagina(documenti: Documento[]): void {
    fixture.detectChanges();

    const req = http.expectOne(
      (r) => r.url === '/api/documenti',
    );

    expect(req.request.params.get('skip')).toBe('0');

    req.flush(documenti);
  }

  it('filtra per testo e per tipologia, in combinazione', () => {
    primaPagina([
      doc(1, 'Delibera traffico', 'Delibera'),
      doc(2, 'Ordinanza traffico', 'Ordinanza'),
      doc(3, 'Delibera bilancio', 'Delibera'),
    ]);

    componente.testoFiltro.set('traffico');

    expect(
      componente.documentiFiltrati().map((d) => d.id),
    ).toEqual([1, 2]);

    componente.toggleFiltroTipologia('Delibera');

    expect(
      componente.documentiFiltrati().map((d) => d.id),
    ).toEqual([1]);
  });

  it('il filtro per tipologia funziona da interruttore', () => {
    primaPagina([
      doc(1, 'A', 'Delibera'),
      doc(2, 'B', 'Piano'),
    ]);

    componente.toggleFiltroTipologia('Piano');

    expect(componente.filtroTipologia()).toBe('Piano');

    componente.toggleFiltroTipologia('Piano');

    expect(componente.filtroTipologia()).toBeNull();
    expect(componente.documentiFiltrati().length).toBe(2);
  });

  it('elenca le tipologie presenti, senza duplicati e ordinate', () => {
    primaPagina([
      doc(1, 'A', 'Piano'),
      doc(2, 'B', 'Delibera'),
      doc(3, 'C', 'Piano'),
      doc(4, 'D'),
    ]);

    expect(componente.tipologieDisponibili()).toEqual([
      'Delibera',
      'Piano',
    ]);
  });

  it('accoda la pagina successiva partendo dallo scarto corretto', () => {
    primaPagina([
      doc(1, 'A'),
      doc(2, 'B'),
    ]);

    componente.caricaAltri();

    const req = http.expectOne(
      (r) => r.url === '/api/documenti',
    );

    expect(req.request.params.get('skip')).toBe('2');

    req.flush([
      doc(3, 'C'),
    ]);

    expect(
      componente.documenti().map((d) => d.id),
    ).toEqual([1, 2, 3]);

    expect(componente.altriDisponibili()).toBeFalse();
  });

  it('segnala un errore di caricamento senza restare in stato di attesa', () => {
    fixture.detectChanges();

    http
      .expectOne((r) => r.url === '/api/documenti')
      .flush('errore', {
        status: 500,
        statusText: 'Server Error',
      });

    expect(componente.caricamento()).toBeFalse();
    expect(componente.erroreCaricamento()).toBeTruthy();
  });
});
