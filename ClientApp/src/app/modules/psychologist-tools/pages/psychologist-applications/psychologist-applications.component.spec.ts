import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PsychologistApplicationsComponent } from './psychologist-applications.component';

describe('PsychologistApplicationsComponent', () => {
  let component: PsychologistApplicationsComponent;
  let fixture: ComponentFixture<PsychologistApplicationsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PsychologistApplicationsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PsychologistApplicationsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
