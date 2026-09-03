import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';

import { UploadService } from './upload.service';


describe('UploadService (contratto API)', () => {
  let service: UploadService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(UploadService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it("carica l'immagine sulla rotta che include l'id del documento", () => {
    const file = new File(['xx'], 'pagina1.jpg', { type: 'image/jpeg' });
    service.caricaImmagine(12, file).subscribe();

    const req = http.expectOne('/api/upload/immagine/12');
    expect(req.request.method).toBe('POST');
    expect(req.request.body instanceof FormData).toBeTrue();
    expect((req.request.body as FormData).get('file')).toBe(file);
    req.flush({});
  });

  it("richiede l'URL firmato dell'immagine sulla sotto-rotta /url", () => {
    service.getUrlImmagine(12).subscribe();

    const req = http.expectOne('/api/upload/immagine/12/url');
    expect(req.request.method).toBe('GET');
    req.flush({ url: 'http://localhost:3900/...' });
  });

  it('richiede il tracciamento dell\'avanzamento per il caricamento massivo', () => {
    const file = new File(['nome\nDoc 1\n'], 'import.csv', { type: 'text/csv' });
    service.caricaMassivo(file).subscribe();

    const req = http.expectOne('/api/upload/massivo');
    expect(req.request.method).toBe('POST');
    expect(req.request.reportProgress).toBeTrue();
    expect((req.request.body as FormData).get('file')).toBe(file);
    req.flush({ totale_righe: 1, successi: 1, falliti: 0, errori: [] });
  });
});
