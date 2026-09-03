import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { NavbarComponent } from './navbar.component';

describe('NavbarComponent', () => {
  let fixture: ComponentFixture<NavbarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NavbarComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(NavbarComponent);
    fixture.detectChanges();
  });

  it('espone tutte le rotte principali dell\'applicazione', () => {
    const componente = fixture.componentInstance;

    const percorsi = [
      ...componente.vociConsultazione,
      ...componente.vociAcquisizione,
    ].map((v) => v.percorso);

    expect(percorsi).toEqual([
      '/',
      '/documenti',
      '/ricerca',
      '/documenti/nuovo',
      '/upload',
    ]);
  });

  it('richiede la chiusura del menu mobile alla selezione di una voce', () => {
    const componente = fixture.componentInstance;
    let chiuso = false;

    componente.closeMobile.subscribe(() => (chiuso = true));

    componente.onLinkClick();

    expect(chiuso).toBeTrue();
  });
});
