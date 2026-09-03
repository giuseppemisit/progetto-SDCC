import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import {
  ComponentFixture,
  TestBed,
  discardPeriodicTasks,
  fakeAsync,
  tick,
} from '@angular/core/testing';
import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
} from '@angular/router';

import {
  Documento,
  StatoElaborazione,
} from '../../models/documento.model';
import { DocumentoDettaglioComponent } from './documento-dettaglio.component';

const ROTTA_DOCUMENTO_5 = {
  snapshot: {
    paramMap: convertToParamMap({ id: '5' }),
  },
};

function documentoFinto(
  stato: StatoElaborazione,
  extra: Partial<Documento> = {},
): Documento {
  const base = {
    id: 5,
    nome: 'Delibera n. 45/2026',
    stato_elaborazione: stato,
    creato_il: '2026-01-15T10:00:00Z',
    immagine_url: 'chiave-immagine.png' as string | null,
    ...extra,
  };

  return {
    ...base,
    stato_effettivo: base.immagine_url
      ? stato
      : 'senza_scansione',
  };
}

describe('DocumentoDettaglioComponent (elaborazione asincrona)', () => {
  let fixture: ComponentFixture<DocumentoDettaglioComponent>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DocumentoDettaglioComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: ROTTA_DOCUMENTO_5,
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DocumentoDettaglioComponent);
    http = TestBed.inject(HttpTestingController);
  });

  function avvia(
    stato: StatoElaborazione,
    extra: Partial<Documento> = {},
  ): void {
    fixture.detectChanges();

    http
      .expectOne((r) => r.url === '/api/documenti/5')
      .flush(documentoFinto(stato, extra));

    http
      .expectOne((r) => r.url === '/api/documenti/5/simili')
      .flush([]);

    const richiesteUrl = http.match(
      (r) => r.url === '/api/upload/immagine/5/url',
    );

    richiesteUrl.forEach((r) => {
      r.flush({
        url: 'http://storage/immagine.png',
      });
    });
  }

  it('aggiorna la scheda da sola quando il task in background termina', fakeAsync(() => {
    avvia('in_attesa');

    expect(fixture.componentInstance.elaborazioneInCorso()).toBeTrue();

    tick(2000);

    http
      .expectOne((r) => r.url === '/api/documenti/5')
      .flush(documentoFinto('in_attesa'));

    expect(
      fixture.componentInstance.documento()?.stato_elaborazione,
    ).toBe('in_attesa');

    tick(2000);

    http
      .expectOne((r) => r.url === '/api/documenti/5')
      .flush(
        documentoFinto('elaborato', {
          testo_ocr: 'COMUNE DI PROVA',
          keywords: 'delibera, traffico',
        }),
      );

    const documento = fixture.componentInstance.documento();

    expect(documento?.stato_elaborazione).toBe('elaborato');
    expect(documento?.keywords).toBe('delibera, traffico');
    expect(fixture.componentInstance.elaborazioneInCorso()).toBeFalse();

    http
      .expectOne((r) => r.url === '/api/documenti/5/simili')
      .flush([]);

    tick(6000);

    http.expectNone((r) => r.url === '/api/documenti/5');
    discardPeriodicTasks();
  }));

  it('smette di interrogare il backend anche quando l\'elaborazione fallisce', fakeAsync(() => {
    avvia('in_attesa');

    tick(2000);

    http
      .expectOne((r) => r.url === '/api/documenti/5')
      .flush(documentoFinto('errore'));

    expect(
      fixture.componentInstance.documento()?.stato_elaborazione,
    ).toBe('errore');

    expect(fixture.componentInstance.elaborazioneInCorso()).toBeFalse();

    http
      .expectOne((r) => r.url === '/api/documenti/5/simili')
      .flush([]);

    tick(6000);

    http.expectNone((r) => r.url === '/api/documenti/5');
    discardPeriodicTasks();
  }));

  it('non interroga il backend per un documento senza immagine', fakeAsync(() => {
    avvia('in_attesa', {
      immagine_url: null,
    });

    expect(fixture.componentInstance.elaborazioneInCorso()).toBeFalse();

    tick(8000);

    http.expectNone((r) => r.url === '/api/documenti/5');
    discardPeriodicTasks();
  }));

  it('non interroga il backend per un documento già elaborato', fakeAsync(() => {
    avvia('elaborato');

    expect(fixture.componentInstance.elaborazioneInCorso()).toBeFalse();

    tick(8000);

    http.expectNone((r) => r.url === '/api/documenti/5');
    discardPeriodicTasks();
  }));

  it('non annuncia un\'elaborazione per una scheda priva di scansione', () => {
    avvia('in_attesa', {
      immagine_url: null,
    });

    const stato = fixture.componentInstance.statoInfo();

    expect(stato.stato).toBe('senza_scansione');
    expect(stato.classe).toBe('badge--neutral');
    expect(stato.etichettaEstesa).not.toContain('attesa');
  });

  it('mantiene il badge di attesa quando l\'elaborazione è davvero in corso', fakeAsync(() => {
    avvia('in_attesa');

    expect(
      fixture.componentInstance.statoInfo().stato,
    ).toBe('in_attesa');

    expect(fixture.componentInstance.elaborazioneInCorso()).toBeTrue();

    discardPeriodicTasks();
  }));

  it('ricade sul segnaposto se l\'immagine non e\' piu\' recuperabile', () => {
    avvia('elaborato');

    expect(fixture.componentInstance.urlImmagine()).toBe(
      'http://storage/immagine.png',
    );

    fixture.componentInstance.onImmagineNonCaricata();

    expect(fixture.componentInstance.urlImmagine()).toBeNull();
    expect(fixture.componentInstance.immagineNonDisponibile()).toBeTrue();
  });

  it('distingue "mai avuta una scansione" da "immagine non recuperabile"', () => {
    avvia('in_attesa', {
      immagine_url: null,
    });

    expect(fixture.componentInstance.urlImmagine()).toBeNull();
    expect(
      fixture.componentInstance.immagineNonDisponibile(),
    ).toBeFalse();
  });

  it('espone le keyword come elenco, scartando i separatori a vuoto', () => {
    avvia('elaborato', {
      keywords: 'delibera giunta, piano regolatore, , centro storico',
    });

    expect(fixture.componentInstance.keywordsList).toEqual([
      'delibera giunta',
      'piano regolatore',
      'centro storico',
    ]);
  });
});
