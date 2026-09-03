import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';

import { RicercaService } from './ricerca.service';

describe('RicercaService (contratto API)', () => {
  let service: RicercaService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(RicercaService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('la ricerca full-text usa la rotta radice /api/ricerca', () => {
    service.fulltext('delibera traffico', 30).subscribe();

    const req = http.expectOne((r) => r.url === '/api/ricerca');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('q')).toBe('delibera traffico');
    expect(req.request.params.get('limit')).toBe('30');
    req.flush([]);
  });

  it('la ricerca semantica usa la sotto-rotta /semantica', () => {
    service.semantica('costruire una casa').subscribe();

    const req = http.expectOne((r) => r.url === '/api/ricerca/semantica');
    expect(req.request.params.get('q')).toBe('costruire una casa');
    req.flush([]);
  });

  it('la ricerca ibrida invia peso_semantico nel formato atteso dal backend', () => {
    service.ibrida('piano regolatore', 30, 0.7).subscribe();

    const req = http.expectOne((r) => r.url === '/api/ricerca/ibrida');
    expect(req.request.params.get('peso_semantico')).toBe('0.7');
    req.flush([]);
  });

  it('la ricerca per immagine invia il file come multipart e i pesi in query string', () => {
    const file = new File(['xx'], 'foto.png', { type: 'image/png' });
    service.perImmagine(file, 10, 0.5).subscribe();

    const req = http.expectOne((r) => r.url === '/api/ricerca/immagine');
    expect(req.request.method).toBe('POST');
    expect(req.request.body instanceof FormData).toBeTrue();
    expect((req.request.body as FormData).get('file')).toBe(file);
    expect(req.request.params.get('limit')).toBe('10');
    expect(req.request.params.get('peso_semantico')).toBe('0.5');
    req.flush({ testo_estratto: null, risultati: [] });
  });
});
