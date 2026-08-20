import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RicercaImmagineComponent } from './ricerca-immagine.component';

describe('RicercaImmagineComponent', () => {
  let component: RicercaImmagineComponent;
  let fixture: ComponentFixture<RicercaImmagineComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RicercaImmagineComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RicercaImmagineComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
