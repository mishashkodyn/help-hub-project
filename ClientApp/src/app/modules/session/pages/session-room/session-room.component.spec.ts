import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SessionRoomComponent } from './session-room.component';

describe('SessionRoomComponent', () => {
  let component: SessionRoomComponent;
  let fixture: ComponentFixture<SessionRoomComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [SessionRoomComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(SessionRoomComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
