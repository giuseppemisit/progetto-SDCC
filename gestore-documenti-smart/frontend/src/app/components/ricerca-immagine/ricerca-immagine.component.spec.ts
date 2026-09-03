import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { RicercaImmagineComponent } from './ricerca-immagine.component';

function fileFinto(
  nome: string,
  tipo: string,
  dimensione = 10,
): File {
  const file = new File(['x'], nome, { type: tipo });

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

describe('RicercaImmagineComponent', () => {
  let fixture: ComponentFixture<RicercaImmagineComponent>;
  let componente: RicercaImmagineComponent;
  let http: HttpTestingController;

  beforeEach(async () => {
    spyOn(URL, 'createObjectURL').and.returnValue('blob:anteprima');

    await TestBed.configureTestingModule({
      imports: [RicercaImmagineComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RicercaImmagineComponent);
    componente = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('accetta i formati immagine supportati dal backend', () => {
    for (const tipo of ['image/jpeg', 'image/png', 'image/webp']) {
      componente.onFileSelezionato(
        eventoSelezione(
          fileFinto(`foto.${tipo.split('/')[1]}`, tipo),
        ),
      );

      expect(componente.erroreFile()).toBeNull();
      expect(componente.fileSelezionato()).toBeTruthy();
    }
  });

  it('rifiuta un formato non supportato dal backend', () => {
    componente.onFileSelezionato(
      eventoSelezione(
        fileFinto('scansione.pdf', 'application/pdf'),
      ),
    );

    expect(componente.fileSelezionato()).toBeNull();
    expect(componente.erroreFile()).toContain('Formato non supportato');
  });

  it('rifiuta le immagini oltre il limite applicato dal backend', () => {
    componente.onFileSelezionato(
      eventoSelezione(
        fileFinto('foto.png', 'image/png', 11 * 1024 * 1024),
      ),
    );

    expect(componente.fileSelezionato()).toBeNull();
    expect(componente.erroreFile()).toContain('dimensione massima');
  });

  it('mostra il testo riconosciuto dall\'OCR insieme ai documenti individuati', () => {
    componente.onFileSelezionato(
      eventoSelezione(
        fileFinto('foto.png', 'image/png'),
      ),
    );

    componente.avviaRicerca();

    http.expectOne((r) => r.url === '/api/ricerca/immagine').flush({
      testo_estratto: 'COMUNE DI PROVA DELIBERAZIONE',
      risultati: [
        {
          documento: {
            id: 1,
            nome: 'Delibera 45',
            stato_elaborazione: 'elaborato',
            stato_effettivo: 'elaborato',
            creato_il: 'x',
          },
          score: 0.8,
        },
      ],
    });

    expect(componente.testoEstratto()).toContain('COMUNE DI PROVA');
    expect(componente.risultati()?.length).toBe(1);
    expect(componente.ricercaInCorso()).toBeFalse();
  });

  it('gestisce l\'immagine illeggibile come risposta valida, non come errore', () => {
    componente.onFileSelezionato(
      eventoSelezione(
        fileFinto('sfocata.png', 'image/png'),
      ),
    );

    componente.avviaRicerca();

    http
      .expectOne((r) => r.url === '/api/ricerca/immagine')
      .flush({
        testo_estratto: null,
        risultati: [],
      });

    expect(componente.erroreRicerca()).toBeNull();
    expect(componente.testoEstratto()).toBeNull();
    expect(componente.risultati()).toEqual([]);
  });
});
