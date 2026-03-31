import {
  AfterViewChecked,
  AfterViewInit,
  Component,
  effect,
  ElementRef,
  ViewChild,
} from '@angular/core';
import { ChatService } from '../../../../api/services/chat.service';
import { AuthService } from '../../../../api/services/auth.service';
import { Message } from '../../../../api/models/message';

@Component({
  selector: 'app-chat-box',
  standalone: false,
  templateUrl: './chat-box.component.html',
  styleUrl: './chat-box.component.scss',
})
export class ChatBoxComponent implements AfterViewInit {
  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;

  private previousMessageCount = 0;

  constructor(
    protected chatService: ChatService,
    protected authService: AuthService,
  ) {
    effect(() => {
      const messages = this.chatService.chatMessages();
      if (messages && messages.length > 0) {
        setTimeout(() => this.scrollToBottom(), 50);
      }
    });
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.scrollToBottom(), 100);
  }

  ngOnInit(): void {}

  addReplyMessage(message: Message) {
    if (message) {
      this.chatService.replyMessage.set(message);
    }
  }

  private scrollToBottom(): void {
    try {
      this.scrollContainer.nativeElement.scrollTop =
        this.scrollContainer.nativeElement.scrollHeight;
    } catch (err) {}
  }

  viewImage(url: string) {
    window.open(url, '_blank');
  }

  loadMoreMessage() {
    const nextPage = this.chatService.pageNumber() + 1;
    this.chatService.loadMessages(nextPage);
  }

  getBubbleClass(index: number): string {
    const messages = this.chatService.chatMessages();
    const currentMsg = messages[index];
    const prevMsg = messages[index - 1];
    const nextMsg = messages[index + 1];

    const isMe = currentMsg.senderId === this.authService.currentLoggedUser?.id;
    const isPrevSame = prevMsg && prevMsg.senderId === currentMsg.senderId;
    const isNextSame = nextMsg && nextMsg.senderId === currentMsg.senderId;

    let classes = 'px-3 py-2 md:px-4 md:py-2.5 transition-all duration-300 relative ';

    if (isMe) {
      classes += 'bg-mint text-gray-800 shadow-sm border border-mint/40 ';
    } else {
      classes += 'bg-primary text-white shadow-md shadow-primary/20 ';
    }

    classes += 'rounded-[18px] md:rounded-[20px] ';

    if (isMe) {
      if (isPrevSame) classes += '!rounded-tr-[4px] ';
      if (isNextSame) classes += '!rounded-br-[4px] ';
    } else {
      if (isPrevSame) classes += '!rounded-tl-[4px] ';
      if (isNextSame) classes += '!rounded-bl-[4px] ';
    }

    if (!isNextSame) {
      classes += 'mb-3 ';
    } else {
      classes += 'mb-0.5 ';
    }

    return classes;
  }
}