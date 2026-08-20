import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DocumentoDettaglioComponent } from './documento-dettaglio.component';

describe('DocumentoDettaglioComponent', () => {
  let component: DocumentoDettaglioComponent;
  let fixture: ComponentFixture<DocumentoDettaglioComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DocumentoDettaglioComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DocumentoDettaglioComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
