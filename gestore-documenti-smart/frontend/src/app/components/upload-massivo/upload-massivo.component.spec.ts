import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UploadMassivoComponent } from './upload-massivo.component';

describe('UploadMassivoComponent', () => {
  let component: UploadMassivoComponent;
  let fixture: ComponentFixture<UploadMassivoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UploadMassivoComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UploadMassivoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
