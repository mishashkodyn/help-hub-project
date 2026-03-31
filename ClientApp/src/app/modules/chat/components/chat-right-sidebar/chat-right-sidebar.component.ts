import { Component, OnInit, signal } from '@angular/core';
import { ChatService } from '../../../../api/services/chat.service';
import { Router } from '@angular/router';
import { MenuItem } from '../../../../api/models/menu-item';

@Component({
  selector: 'app-chat-right-sidebar',
  standalone: false,
  templateUrl: './chat-right-sidebar.component.html',
  styleUrl: './chat-right-sidebar.component.scss',
})
export class ChatRightSidebarComponent{
  activeTab: string = 'Information';

  constructor(protected chatService: ChatService, private router: Router) {}

  tabItems = signal<MenuItem[]>([
    {
      label: 'Information',
    },
    {
      label: 'Files',
    },
    {
      label: 'Media',
    },
  ]);

  goToProfile(id: string) {
    this.router.navigate([`account/${id}`])
  }

  setActiveTab(tab: MenuItem) {
    this.activeTab = tab.label ?? 'Information';
  }
}
