import { TestBed } from '@angular/core/testing';

import { RicercaService } from './ricerca.service';

describe('RicercaService', () => {
  let service: RicercaService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(RicercaService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
