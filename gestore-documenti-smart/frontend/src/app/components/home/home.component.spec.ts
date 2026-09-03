import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { Documento } from '../../models/documento.model';
import { HomeComponent } from './home.component';

function doc(
  id: number,
  stato: Documento['stato_elaborazione'],
  creato: string,
): Documento {
  return {
    id,
    nome: `Doc ${id}`,
    stato_elaborazione: stato,
    stato_effettivo: stato,
    creato_il: creato,
  };
}

describe('HomeComponent', () => {
  let fixture: ComponentFixture<HomeComponent>;
  let componente: HomeComponent;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HomeComponent);
    componente = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function statisticheVuote(): void {
    http
      .expectOne('/api/documenti/statistiche')
      .flush({
        totale: 0,
        in_attesa: 0,
        senza_scansione: 0,
        elaborato: 0,
        errore: 0,
      });
  }

  it('riepiloga l\'archivio con i conteggi aggregati, non con la pagina di risultati', () => {
    fixture.detectChanges();

    http
      .expectOne('/api/documenti/statistiche')
      .flush({
        totale: 4638,
        in_attesa: 6,
        senza_scansione: 4626,
        elaborato: 4,
        errore: 2,
      });

    http.expectOne((r) => r.url === '/api/documenti').flush([
      doc(1, 'elaborato', '2026-01-01T10:00:00Z'),
      doc(2, 'in_attesa', '2026-01-03T10:00:00Z'),
    ]);

    expect(componente.totaleDocumenti()).toBe(4638);
    expect(componente.inAttesa()).toBe(6);
    expect(componente.senzaScansione()).toBe(4626);
    expect(componente.inErrore()).toBe(2);
  });

  it('mostra il resto della dashboard anche se le statistiche falliscono', () => {
    fixture.detectChanges();

    http
      .expectOne('/api/documenti/statistiche')
      .flush('errore', {
        status: 500,
        statusText: 'Server Error',
      });

    http.expectOne((r) => r.url === '/api/documenti').flush([
      doc(1, 'elaborato', '2026-01-01T10:00:00Z'),
    ]);

    expect(componente.totaleDocumenti()).toBe(0);
    expect(componente.recenti().length).toBe(1);
  });

  it('ordina i documenti recenti dal piu\' nuovo al piu\' vecchio', () => {
    fixture.detectChanges();
    statisticheVuote();

    http.expectOne((r) => r.url === '/api/documenti').flush([
      doc(1, 'elaborato', '2026-01-01T10:00:00Z'),
      doc(2, 'elaborato', '2026-01-03T10:00:00Z'),
      doc(3, 'elaborato', '2026-01-02T10:00:00Z'),
    ]);

    expect(componente.recenti().map((d) => d.id)).toEqual([2, 3, 1]);
  });

  it('inoltra la ricerca alla pagina dedicata conservando query e modalita\'', () => {
    fixture.detectChanges();
    statisticheVuote();

    http.expectOne((r) => r.url === '/api/documenti').flush([]);

    const router = TestBed.inject(Router);
    const navigate = spyOn(router, 'navigate');

    componente.query.set('  piano regolatore  ');
    componente.impostaModalita('semantica');
    componente.cerca();

    expect(navigate).toHaveBeenCalledWith(['/ricerca'], {
      queryParams: {
        q: 'piano regolatore',
        modo: 'semantica',
      },
    });
  });

  it('non avvia una ricerca vuota', () => {
    fixture.detectChanges();
    statisticheVuote();

    http.expectOne((r) => r.url === '/api/documenti').flush([]);

    const navigate = spyOn(TestBed.inject(Router), 'navigate');

    componente.query.set('   ');
    componente.cerca();

    expect(navigate).not.toHaveBeenCalled();
  });
});
