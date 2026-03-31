import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PsychologistRegistrationComponent } from './psychologist-registration.component';

describe('PsychologistRegistrationComponent', () => {
  let component: PsychologistRegistrationComponent;
  let fixture: ComponentFixture<PsychologistRegistrationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PsychologistRegistrationComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PsychologistRegistrationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
