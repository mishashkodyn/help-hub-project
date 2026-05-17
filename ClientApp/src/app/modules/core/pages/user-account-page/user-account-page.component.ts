import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { User, UserProfileDto } from '../../../../api/models/user';
import { UsersService } from '../../../../api/services/users.service';
import { AuthService } from '../../../../api/services/auth.service';
import { ChatService } from '../../../../api/services/chat.service';
import { PresenceService } from '../../../../api/services/presence-service';

@Component({
  selector: 'app-user-account-page',
  standalone: false,
  templateUrl: './user-account-page.component.html',
  styleUrl: './user-account-page.component.scss',
})
export class UserAccountPageComponent implements OnInit {
  user: UserProfileDto | null = null;
  isLoading: boolean = false;
  activeTab: string = 'posts';
  activeMedia: { url: string, type: 'image' | 'video' } | null = null;
  isBookingModalOpen: boolean = false;
  showActionsMenu: boolean = false;

  isOnline: boolean = true;

  stats = {
    posts: 0,
    sessions: 0,
    rating: 0,
    reviews: 0,
  };

  joinedDate: Date = new Date();

  constructor(
    private route: ActivatedRoute,
    private service: UsersService,
    private router: Router,
    private authService: AuthService,
    private chatService: ChatService,
    private presenceService: PresenceService,
    private location: Location
  ) {}

  goBack(): void {
    if (window.history.length > 1) {
      this.location.back();
    } else {
      this.router.navigate(['/']);
    }
  }

  ngOnInit(): void {
    this.isLoading = true;
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');

      if (!id) {
        this.isLoading = false;
        this.router.navigate(['/']);
        return;
      }

      this.service.getUser(id).subscribe({
        next: (res) => {
          this.user = res.data;
          this.isLoading = false;
        },
        error: (err) => {
          console.warn(err);
          this.isLoading = false;
        },
      });
    });
  }

  get isUserOnline(): boolean {
    if (!this.user) return false;
    const presenceUser = this.presenceService.usersList().find(u => u.id === this.user!.id);
    return presenceUser ? (presenceUser as any).isOnline : false; 
  }

  openChat(): void {
    if (!this.user) return;

    const existingPresenceUser = this.presenceService.usersList().find(u => u.id === this.user!.id);

    const chatContact: User = existingPresenceUser || ({
      id: this.user.id!,
      userName: this.user.userName!,
      name: this.user.name,
      surname: this.user.surname,
      profileImage: this.user.profileImage,
    } as User);

    this.chatService.chatRightSidebarIsOpen.set(false);
    
    this.chatService.currentOpenedChat.set(chatContact);

    this.router.navigate(['/chat']).then(() => {
      if (this.chatService.isConnected()) {
        this.chatService.loadMessages(1);
      }
    });
  }

  openMedia(url: string, type: 'image' | 'video') {
    this.activeMedia = { url, type };
  }

  closeMedia() {
    this.activeMedia = null;
  }

  get isOwnProfile(): boolean {
    return this.user?.id === this.authService.currentLoggedUser?.id;
  }

  get isPsychologist(): boolean {
    return !!this.user?.roles?.includes('Psychologist');
  }

  get isPsychologistUnpublished(): boolean {
    return (
      this.isOwnProfile &&
      this.isPsychologist &&
      !!this.user?.psychologist &&
      !this.user.psychologist.isPublished
    );
  }

  get displayRoles(): string[] {
    if (!this.user?.roles || this.user.roles.length === 0) {
      return ['Client'];
    }

    const roles = this.user.roles;

    const hasHigherRole = roles.some(r =>
      r === 'Superadmin' || r === 'Admin' || r === 'Psychologist'
    );

    if (hasHigherRole) {
      return roles.filter(r => r !== 'User');
    }

    return ['Client'];
  }

  get isVerified(): boolean {
    return this.isPsychologist || this.displayRoles.some(r => r === 'Admin' || r === 'Superadmin');
  }

  setTab(tab: string) {
    this.activeTab = tab;
  }

  toggleActionsMenu() {
    this.showActionsMenu = !this.showActionsMenu;
  }

  copyProfileLink() {
    if (typeof window !== 'undefined' && this.user) {
      navigator.clipboard?.writeText(window.location.href);
    }
    this.showActionsMenu = false;
  }
}
