import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DocumentoListaComponent } from './documento-lista.component';

describe('DocumentoListaComponent', () => {
  let component: DocumentoListaComponent;
  let fixture: ComponentFixture<DocumentoListaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DocumentoListaComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DocumentoListaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
