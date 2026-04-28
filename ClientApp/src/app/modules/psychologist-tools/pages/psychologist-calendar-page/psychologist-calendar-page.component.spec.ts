import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PsychologistCalendarPageComponent } from './psychologist-calendar-page.component';

describe('PsychologistCalendarPageComponent', () => {
  let component: PsychologistCalendarPageComponent;
  let fixture: ComponentFixture<PsychologistCalendarPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PsychologistCalendarPageComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PsychologistCalendarPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
