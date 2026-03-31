import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AiChatComponent } from './pages/ai-chat/ai-chat.component';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { MarkdownModule } from 'ngx-markdown';

@NgModule({
  declarations: [
    AiChatComponent
  ],
  imports: [
    CommonModule,
    MatIconModule,
    FormsModule,
    MarkdownModule
  ]
})
export class AiModule { }
