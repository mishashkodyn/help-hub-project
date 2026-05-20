import { Component, OnInit } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { TranslocoService } from '@ngneat/transloco';
import { UserCategoryApplicationResponseDto } from '../../../../api/models/user-category-application.model';
import { UserCategoryApplicationService } from '../../../../api/services/user-category-application.service';
import { ChatService } from '../../../../api/services/chat.service';
import { PresenceService } from '../../../../api/services/presence-service';
import { User } from '../../../../api/models/user';

@Component({
  selector: 'app-user-category-applications-page',
  standalone: false,
  templateUrl: './user-category-applications-page.component.html',
  styleUrl: './user-category-applications-page.component.scss',
})
export class UserCategoryApplicationsPageComponent implements OnInit {
  applications: UserCategoryApplicationResponseDto[] = [];
  filtered: UserCategoryApplicationResponseDto[] = [];
  isLoading = true;

  searchQuery = '';
  statusFilter = 'All';
  availableStatuses = ['All', 'Pending', 'Approved', 'Rejected'];

  reviewing: UserCategoryApplicationResponseDto | null = null;
  rejectionReason = '';
  isSubmittingReview = false;

  constructor(
    private service: UserCategoryApplicationService,
    private snackBar: MatSnackBar,
    private chatService: ChatService,
    private presenceService: PresenceService,
    private router: Router,
    private transloco: TranslocoService,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load() {
    this.isLoading = true;
    this.service.getAll().subscribe({
      next: (res) => {
        this.applications = res.data ?? [];
        this.applyFilters();
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      },
    });
  }

  onSearch(event: Event) {
    this.searchQuery = (event.target as HTMLInputElement).value;
    this.applyFilters();
  }

  setStatusFilter(status: string) {
    this.statusFilter = status;
    this.applyFilters();
  }

  applyFilters() {
    let temp = [...this.applications];

    if (this.statusFilter !== 'All') {
      temp = temp.filter((a) => a.status === this.statusFilter);
    }

    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase().trim();
      temp = temp.filter(
        (a) =>
          a.firstName?.toLowerCase().includes(q) ||
          a.lastName?.toLowerCase().includes(q) ||
          a.email?.toLowerCase().includes(q) ||
          a.requestedCategoryName?.toLowerCase().includes(q),
      );
    }

    this.filtered = temp;
  }

  startReview(app: UserCategoryApplicationResponseDto) {
    this.reviewing = app;
    this.rejectionReason = '';
  }

  cancelReview() {
    this.reviewing = null;
    this.rejectionReason = '';
  }

  approve() {
    if (!this.reviewing) return;
    this.submitReview(true);
  }

  reject() {
    if (!this.reviewing) return;
    if (!this.rejectionReason.trim()) {
      this.snackBar.open(
        this.transloco.translate('category_application.admin.rejection_required'),
        'OK',
        { duration: 3000 },
      );
      return;
    }
    this.submitReview(false);
  }

  openChatWithApplicant(app: UserCategoryApplicationResponseDto) {
    const presenceUser = this.presenceService
      .usersList()
      .find((u) => u.id === app.userId);

    const chatContact: User = presenceUser || ({
      id: app.userId,
      userName: '',
      name: app.firstName,
      surname: app.lastName,
      profileImage: app.profileImage,
    } as User);

    this.chatService.chatRightSidebarIsOpen.set(false);
    this.chatService.currentOpenedChat.set(chatContact);

    this.cancelReview();

    this.router
      .navigate(['/chat'], { queryParams: { back: 'category-applications' } })
      .then(() => {
        if (this.chatService.isConnected()) {
          this.chatService.loadMessages(1);
        }
      });
  }

  private submitReview(isApproved: boolean) {
    if (!this.reviewing) return;

    this.isSubmittingReview = true;
    this.service
      .review(this.reviewing.id, {
        isApproved,
        rejectionReason: isApproved ? undefined : this.rejectionReason.trim(),
      })
      .subscribe({
        next: (res) => {
          this.isSubmittingReview = false;
          if (!res.isSuccess) {
            this.snackBar.open(
              res.error ||
                this.transloco.translate('category_application.admin.generic_error'),
              'OK',
              { duration: 3000 },
            );
            return;
          }
          this.applications = this.applications.map((a) =>
            a.id === res.data.id ? res.data : a,
          );
          this.applyFilters();
          this.reviewing = null;
          this.rejectionReason = '';
          this.snackBar.open(
            this.transloco.translate(
              isApproved
                ? 'category_application.admin.approved_toast'
                : 'category_application.admin.rejected_toast',
            ),
            'OK',
            { duration: 3000 },
          );
        },
        error: (err) => {
          this.isSubmittingReview = false;
          const msg =
            err?.error?.error ||
            this.transloco.translate('category_application.admin.review_error');
          this.snackBar.open(msg, 'OK', { duration: 4000 });
        },
      });
  }
}
