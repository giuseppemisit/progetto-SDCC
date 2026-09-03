import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';

import { DocumentoService } from './documento.service';

describe('DocumentoService (contratto API)', () => {
  let service: DocumentoService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(DocumentoService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('elenca i documenti con i parametri di paginazione accettati dal backend', () => {
    service.getDocumenti(0, 24).subscribe();

    const req = http.expectOne((r) => r.url === '/api/documenti');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('skip')).toBe('0');
    expect(req.request.params.get('limit')).toBe('24');
    req.flush([]);
  });

  it('legge le statistiche da un endpoint dedicato, non dalla lista paginata', () => {
    service.statistiche().subscribe();

    const req = http.expectOne('/api/documenti/statistiche');
    expect(req.request.method).toBe('GET');
    req.flush({ totale: 0, in_attesa: 0, senza_scansione: 0, elaborato: 0, errore: 0 });
  });

  it('crea un documento in POST sulla collezione', () => {
    service.creaDocumento({ nome: 'Delibera 1/2026' }).subscribe();

    const req = http.expectOne('/api/documenti');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ nome: 'Delibera 1/2026' });
    req.flush({});
  });

  it('aggiorna un documento con PATCH e non con PUT', () => {
    service.aggiornaDocumento(7, { tipologia: 'Ordinanza' }).subscribe();

    const req = http.expectOne('/api/documenti/7');
    expect(req.request.method).toBe('PATCH');
    req.flush({});
  });

  it('elimina un documento sulla risorsa puntuale', () => {
    service.eliminaDocumento(7).subscribe();

    const req = http.expectOne('/api/documenti/7');
    expect(req.request.method).toBe('DELETE');
    req.flush({ message: 'ok' });
  });

  it('richiede i documenti simili sulla sotto-rotta /simili', () => {
    service.documentiSimili(7, 5).subscribe();

    const req = http.expectOne((r) => r.url === '/api/documenti/7/simili');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('limit')).toBe('5');
    req.flush([]);
  });

  it('chiede il suggerimento di tipologia in POST con il payload atteso', () => {
    service.suggerisciTipologia({ nome: 'Delibera', top_k: 5 }).subscribe();

    const req = http.expectOne('/api/documenti/suggerisci-tipologia');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ nome: 'Delibera', top_k: 5 });
    req.flush({ suggerimenti: [] });
  });
});
