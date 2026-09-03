import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AppComponent } from './app.component';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('si istanzia correttamente', () => {
    const fixture = TestBed.createComponent(AppComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('parte con la navigazione mobile chiusa e la apre/chiude a comando', () => {
    const app = TestBed.createComponent(AppComponent).componentInstance;

    expect(app.mobileNavOpen()).toBeFalse();
    app.toggleMobileNav();
    expect(app.mobileNavOpen()).toBeTrue();
    app.closeMobileNav();
    expect(app.mobileNavOpen()).toBeFalse();
  });

  // Verifica i valori di fallback quando la rotta non fornisce metadati
  it('espone sempre heading e sezione per la topbar, anche senza dati di rotta', () => {
    const app = TestBed.createComponent(AppComponent).componentInstance;

    expect(app.datiRotta()).toEqual({ heading: '', sezione: '' });
  });
});
