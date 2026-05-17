import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MarkdownModule } from 'ngx-markdown';
import { SessionRoomComponent } from './pages/session-room/session-room.component';
import { SessionVideoPanelComponent } from './components/session-video-panel/session-video-panel.component';

@NgModule({
  declarations: [SessionRoomComponent, SessionVideoPanelComponent],
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MarkdownModule,
  ],
})
export class SessionModule {}
