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

import { DocumentoFormComponent } from './documento-form.component';

function rotta(id?: string) {
  return {
    snapshot: {
      paramMap: convertToParamMap(id ? { id } : {}),
    },
  };
}

async function creaComponente(
  id?: string,
): Promise<ComponentFixture<DocumentoFormComponent>> {
  TestBed.resetTestingModule();

  await TestBed.configureTestingModule({
    imports: [DocumentoFormComponent],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      {
        provide: ActivatedRoute,
        useValue: rotta(id),
      },
    ],
  }).compileComponents();

  return TestBed.createComponent(DocumentoFormComponent);
}

describe('DocumentoFormComponent', () => {
  it('in creazione invia una POST senza i campi generati dal server', async () => {
    const fixture = await creaComponente();
    const http = TestBed.inject(HttpTestingController);

    fixture.detectChanges();

    fixture.componentInstance.form.patchValue({
      nome: '  Delibera 45/2026  ',
      tipologia: 'Delibera',
    });

    fixture.componentInstance.salva();

    const req = http.expectOne('/api/documenti');

    expect(req.request.method).toBe('POST');
    expect(req.request.body.nome).toBe('Delibera 45/2026');
    expect(req.request.body.ufficio).toBeNull();
    expect('testo_ocr' in req.request.body).toBeFalse();
    expect('keywords' in req.request.body).toBeFalse();

    req.flush({ id: 1 });
    http.verify();
  });

  it('in modifica precarica i dati e salva con PATCH includendo le correzioni OCR', async () => {
    const fixture = await creaComponente('9');
    const http = TestBed.inject(HttpTestingController);

    fixture.detectChanges();

    http.expectOne('/api/documenti/9').flush({
      id: 9,
      nome: 'Delibera 9',
      tipologia: 'Delibera',
      testo_ocr: 'testo grezzo',
      keywords: 'delibera',
      stato_elaborazione: 'elaborato',
      stato_effettivo: 'elaborato',
      creato_il: 'x',
    });

    expect(
      fixture.componentInstance.form.getRawValue().nome,
    ).toBe('Delibera 9');

    fixture.componentInstance.form.patchValue({
      testo_ocr: 'testo corretto',
    });

    fixture.componentInstance.salva();

    const req = http.expectOne('/api/documenti/9');

    expect(req.request.method).toBe('PATCH');
    expect(req.request.body.testo_ocr).toBe('testo corretto');

    req.flush({ id: 9 });
    http.verify();
  });

  it('non invia nulla se il nome, unico campo obbligatorio, manca', async () => {
    const fixture = await creaComponente();
    const http = TestBed.inject(HttpTestingController);

    fixture.detectChanges();

    fixture.componentInstance.salva();

    http.expectNone(() => true);

    expect(
      fixture.componentInstance.form.controls.nome.touched,
    ).toBeTrue();

    http.verify();
  });

  it('carica l\'immagine solo dopo aver ottenuto l\'id del documento creato', async () => {
    const fixture = await creaComponente();
    const http = TestBed.inject(HttpTestingController);

    fixture.detectChanges();

    spyOn(URL, 'createObjectURL').and.returnValue('blob:anteprima');

    const file = new File(
      ['x'],
      'pagina.png',
      { type: 'image/png' },
    );

    Object.defineProperty(file, 'size', {
      value: 10,
    });

    const input = document.createElement('input');

    Object.defineProperty(input, 'files', {
      value: [file],
    });

    const evento = new Event('change');

    Object.defineProperty(evento, 'target', {
      value: input,
    });

    fixture.componentInstance.onFileSelezionato(evento);

    fixture.componentInstance.form.patchValue({
      nome: 'Con immagine',
    });

    fixture.componentInstance.salva();

    http.expectNone((r) => r.url.startsWith('/api/upload'));

    http.expectOne('/api/documenti').flush({
      id: 77,
    });

    const upload = http.expectOne('/api/upload/immagine/77');

    expect(upload.request.method).toBe('POST');

    upload.flush({});
    http.verify();
  });

  it('richiede il suggerimento di tipologia e lo applica al form', async () => {
    const fixture = await creaComponente();
    const http = TestBed.inject(HttpTestingController);

    fixture.detectChanges();

    fixture.componentInstance.form.patchValue({
      nome: 'Approvazione piano traffico',
    });

    fixture.componentInstance.richiediSuggerimentoTipologia();

    http
      .expectOne('/api/documenti/suggerisci-tipologia')
      .flush({
        suggerimenti: [
          {
            tipologia: 'Delibera',
            confidenza: 0.82,
          },
        ],
      });

    expect(
      fixture.componentInstance.suggerimentiTipologia().length,
    ).toBe(1);

    fixture.componentInstance.applicaTipologiaSuggerita('Delibera');

    expect(
      fixture.componentInstance.form.controls.tipologia.value,
    ).toBe('Delibera');

    http.verify();
  });
});
