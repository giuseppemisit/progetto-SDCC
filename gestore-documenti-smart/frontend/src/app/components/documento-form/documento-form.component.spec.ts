import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DocumentoFormComponent } from './documento-form.component';

describe('DocumentoFormComponent', () => {
  let component: DocumentoFormComponent;
  let fixture: ComponentFixture<DocumentoFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DocumentoFormComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DocumentoFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
