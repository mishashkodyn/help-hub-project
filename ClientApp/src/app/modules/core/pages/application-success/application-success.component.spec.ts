import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ApplicationSuccessComponent } from './application-success.component';

describe('ApplicationSuccessComponent', () => {
  let component: ApplicationSuccessComponent;
  let fixture: ComponentFixture<ApplicationSuccessComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ApplicationSuccessComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ApplicationSuccessComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
