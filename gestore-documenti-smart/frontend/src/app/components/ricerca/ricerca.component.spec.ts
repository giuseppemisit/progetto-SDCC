import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
} from '@angular/router';

import { RicercaComponent } from './ricerca.component';

function rotta(
  dati: Record<string, unknown> = {},
  queryParam: Record<string, string> = {},
) {
  return {
    snapshot: {
      data: dati,
      queryParamMap: convertToParamMap(queryParam),
    },
  };
}

async function creaComponente(
  dati = {},
  queryParam = {},
): Promise<ComponentFixture<RicercaComponent>> {
  TestBed.resetTestingModule();

  await TestBed.configureTestingModule({
    imports: [RicercaComponent],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      {
        provide: ActivatedRoute,
        useValue: rotta(dati, queryParam),
      },
    ],
  }).compileComponents();

  return TestBed.createComponent(RicercaComponent);
}

describe('RicercaComponent', () => {
  it('sceglie la scheda iniziale in base alla rotta di ingresso', async () => {
    let fixture = await creaComponente({ tab: 'immagine' });

    fixture.detectChanges();

    expect(fixture.componentInstance.schedaAttiva()).toBe('immagine');

    fixture = await creaComponente({ tab: 'testo' });

    fixture.detectChanges();

    expect(fixture.componentInstance.schedaAttiva()).toBe('testo');
  });

  it('esegue subito la ricerca quando arriva da un collegamento con query', async () => {
    const fixture = await creaComponente(
      {},
      {
        q: 'piano regolatore',
        modo: 'semantica',
      },
    );

    const http = TestBed.inject(HttpTestingController);

    fixture.detectChanges();

    expect(fixture.componentInstance.modalita()).toBe('semantica');

    const req = http.expectOne(
      (r) => r.url === '/api/ricerca/semantica',
    );

    expect(req.request.params.get('q')).toBe('piano regolatore');

    req.flush([]);
    http.verify();
  });

  it('interroga la rotta corrispondente alla modalita\' scelta', async () => {
    const fixture = await creaComponente();
    const http = TestBed.inject(HttpTestingController);

    fixture.detectChanges();

    const componente = fixture.componentInstance;

    componente.query.set('delibera');

    componente.impostaModalita('fulltext');
    componente.cerca();

    http.expectOne((r) => r.url === '/api/ricerca').flush([]);

    componente.impostaModalita('ibrida');
    componente.cerca();

    const ibrida = http.expectOne(
      (r) => r.url === '/api/ricerca/ibrida',
    );

    expect(ibrida.request.params.get('peso_semantico')).toBe('0.5');

    ibrida.flush([]);
    http.verify();
  });

  it('ricava i filtri per tipologia dai risultati e li applica', async () => {
    const fixture = await creaComponente();
    const http = TestBed.inject(HttpTestingController);

    fixture.detectChanges();

    const componente = fixture.componentInstance;

    componente.query.set('atti');
    componente.cerca();

    http.expectOne((r) => r.url === '/api/ricerca/ibrida').flush([
      {
        documento: {
          id: 1,
          nome: 'A',
          tipologia: 'Delibera',
          stato_elaborazione: 'elaborato',
          stato_effettivo: 'elaborato',
          creato_il: 'x',
        },
        score: 0.9,
      },
      {
        documento: {
          id: 2,
          nome: 'B',
          tipologia: 'Piano',
          stato_elaborazione: 'elaborato',
          stato_effettivo: 'elaborato',
          creato_il: 'x',
        },
        score: 0.5,
      },
    ]);

    expect(componente.tipologieDisponibili()).toEqual([
      'Delibera',
      'Piano',
    ]);

    componente.toggleFiltroTipologia('Piano');

    expect(
      componente.risultatiFiltrati().map((r) => r.documento.id),
    ).toEqual([2]);

    http.verify();
  });

  it('non interroga il backend con una query vuota', async () => {
    const fixture = await creaComponente();
    const http = TestBed.inject(HttpTestingController);

    fixture.detectChanges();

    fixture.componentInstance.query.set('   ');
    fixture.componentInstance.cerca();

    expect(http.match(() => true).length).toBe(0);
    expect(fixture.componentInstance.ricercaInCorso()).toBeFalse();

    http.verify();
  });
});
