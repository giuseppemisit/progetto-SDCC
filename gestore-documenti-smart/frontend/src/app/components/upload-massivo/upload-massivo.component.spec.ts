import { HttpEventType, provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UploadMassivoComponent } from './upload-massivo.component';

function fileFinto(
  nome: string,
  tipo: string,
  dimensione = 10,
): File {
  const file = new File(['x'.repeat(dimensione)], nome, { type: tipo });

  Object.defineProperty(file, 'size', {
    value: dimensione,
  });

  return file;
}

function eventoSelezione(file: File): Event {
  const input = document.createElement('input');
  input.type = 'file';

  Object.defineProperty(input, 'files', {
    value: [file],
  });

  const evento = new Event('change');

  Object.defineProperty(evento, 'target', {
    value: input,
  });

  return evento;
}

describe('UploadMassivoComponent', () => {
  let fixture: ComponentFixture<UploadMassivoComponent>;
  let componente: UploadMassivoComponent;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UploadMassivoComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(UploadMassivoComponent);
    componente = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('accetta i formati previsti dalla traccia (CSV e JSON)', () => {
    componente.onFileSelezionato(
      eventoSelezione(
        fileFinto('import.csv', 'text/csv'),
      ),
    );

    expect(componente.fileSelezionato()?.name).toBe('import.csv');
    expect(componente.erroreFile()).toBeNull();

    componente.onFileSelezionato(
      eventoSelezione(
        fileFinto('import.json', 'application/json'),
      ),
    );

    expect(componente.fileSelezionato()?.name).toBe('import.json');
    expect(componente.erroreFile()).toBeNull();
  });

  it('rifiuta un formato non supportato senza contattare il backend', () => {
    componente.onFileSelezionato(
      eventoSelezione(
        fileFinto('documento.pdf', 'application/pdf'),
      ),
    );

    expect(componente.fileSelezionato()).toBeNull();
    expect(componente.erroreFile()).toContain('Formato non supportato');
  });

  it('rifiuta lato client i file oltre il limite applicato dal backend', () => {
    componente.onFileSelezionato(
      eventoSelezione(
        fileFinto('grande.csv', 'text/csv', 6 * 1024 * 1024),
      ),
    );

    expect(componente.fileSelezionato()).toBeNull();
    expect(componente.erroreFile()).toContain('dimensione massima');
  });

  it('riporta l\'avanzamento reale dell\'upload e poi il riepilogo', () => {
    componente.onFileSelezionato(
      eventoSelezione(
        fileFinto('import.csv', 'text/csv'),
      ),
    );

    componente.avviaCaricamento();

    const req = http.expectOne('/api/upload/massivo');

    req.event({
      type: HttpEventType.UploadProgress,
      loaded: 50,
      total: 200,
    });

    expect(componente.percentualeAvanzamento()).toBe(25);

    req.event({
      type: HttpEventType.UploadProgress,
      loaded: 200,
      total: 200,
    });

    expect(componente.percentualeAvanzamento()).toBe(100);

    req.flush({
      totale_righe: 3,
      successi: 2,
      falliti: 1,
      errori: [
        {
          riga: 3,
          errore: 'nome mancante',
        },
      ],
    });

    expect(componente.caricamentoInCorso()).toBeFalse();
    expect(componente.risultato()?.successi).toBe(2);
    expect(componente.risultato()?.errori[0].riga).toBe(3);
  });

  it('segnala il fallimento del caricamento senza restare bloccato', () => {
    componente.onFileSelezionato(
      eventoSelezione(
        fileFinto('import.csv', 'text/csv'),
      ),
    );

    componente.avviaCaricamento();

    http
      .expectOne('/api/upload/massivo')
      .flush('errore', {
        status: 500,
        statusText: 'Server Error',
      });

    expect(componente.caricamentoInCorso()).toBeFalse();
    expect(componente.erroreCaricamento()).toBeTruthy();
  });
});
