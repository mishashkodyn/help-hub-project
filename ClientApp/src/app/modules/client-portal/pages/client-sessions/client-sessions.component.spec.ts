import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ClientSessionsComponent } from './client-sessions.component';

describe('ClientSessionsComponent', () => {
  let component: ClientSessionsComponent;
  let fixture: ComponentFixture<ClientSessionsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ClientSessionsComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(ClientSessionsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
