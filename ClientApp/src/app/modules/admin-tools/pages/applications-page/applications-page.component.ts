import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoService } from '@ngneat/transloco';

import { ApplicationsService } from '../../../../api/services/applications.service';
import { UserCategoryApplicationService } from '../../../../api/services/user-category-application.service';
import { ChatService } from '../../../../api/services/chat.service';
import { PresenceService } from '../../../../api/services/presence-service';

import { PsychologistApplicationResponseDto } from '../../../../api/models/psychologist-application.model';
import { UserCategoryApplicationResponseDto } from '../../../../api/models/user-category-application.model';
import { User } from '../../../../api/models/user';

import { ApplicationDetailsDialogComponent } from '../../components/application-details-dialog/application-details-dialog.component';

type ApplicationsTab = 'psychologists' | 'categories';

@Component({
  selector: 'app-applications-page',
  standalone: false,
  templateUrl: './applications-page.component.html',
  styleUrl: './applications-page.component.scss',
})
export class ApplicationsPageComponent implements OnInit {
  activeTab: ApplicationsTab = 'psychologists';

  // ─── Psychologist applications ──────────────────────────────────────────────
  psychApplications: PsychologistApplicationResponseDto[] = [];
  filteredPsychApps: PsychologistApplicationResponseDto[] = [];
  isLoadingPsych = true;

  psychSearch = '';
  psychStatuses = new Set<string>();
  psychDateFrom: string | null = null;
  psychDateTo: string | null = null;

  // ─── Category applications ──────────────────────────────────────────────────
  catApplications: UserCategoryApplicationResponseDto[] = [];
  filteredCatApps: UserCategoryApplicationResponseDto[] = [];
  isLoadingCat = true;

  catSearch = '';
  catStatuses = new Set<string>();
  catCategories = new Set<string>();
  catDateFrom: string | null = null;
  catDateTo: string | null = null;

  // Category review modal
  reviewing: UserCategoryApplicationResponseDto | null = null;
  rejectionReason = '';
  isSubmittingReview = false;

  readonly availableStatuses = ['Pending', 'Approved', 'Rejected'];

  constructor(
    private psychService: ApplicationsService,
    private catService: UserCategoryApplicationService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private chatService: ChatService,
    private presenceService: PresenceService,
    private router: Router,
    private route: ActivatedRoute,
    private transloco: TranslocoService,
  ) {}

  ngOnInit(): void {
    const tab = this.route.snapshot.queryParamMap.get('tab');
    if (tab === 'categories') this.activeTab = 'categories';

    this.loadPsychologistApps();
    this.loadCategoryApps();
  }

  setTab(tab: ApplicationsTab): void {
    this.activeTab = tab;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  // ─── Loaders ────────────────────────────────────────────────────────────────
  private loadPsychologistApps(): void {
    this.isLoadingPsych = true;
    this.psychService.getPsychologistApplications().subscribe({
      next: (res) => {
        this.psychApplications = res.isSuccess ? res.data : [];
        this.applyPsychFilters();
        this.isLoadingPsych = false;
      },
      error: () => (this.isLoadingPsych = false),
    });
  }

  private loadCategoryApps(): void {
    this.isLoadingCat = true;
    this.catService.getAll().subscribe({
      next: (res) => {
        this.catApplications = res.data ?? [];
        this.applyCatFilters();
        this.isLoadingCat = false;
      },
      error: () => (this.isLoadingCat = false),
    });
  }

  // ─── Psych filters ──────────────────────────────────────────────────────────
  onPsychSearch(event: Event): void {
    this.psychSearch = (event.target as HTMLInputElement).value;
    this.applyPsychFilters();
  }

  togglePsychStatus(status: string): void {
    if (this.psychStatuses.has(status)) this.psychStatuses.delete(status);
    else this.psychStatuses.add(status);
    this.applyPsychFilters();
  }

  setPsychDate(which: 'from' | 'to', value: string): void {
    if (which === 'from') this.psychDateFrom = value || null;
    else this.psychDateTo = value || null;
    this.applyPsychFilters();
  }

  resetPsychFilters(): void {
    this.psychSearch = '';
    this.psychStatuses.clear();
    this.psychDateFrom = null;
    this.psychDateTo = null;
    this.applyPsychFilters();
  }

  get psychActiveCount(): number {
    return (
      (this.psychSearch.trim() ? 1 : 0) +
      this.psychStatuses.size +
      (this.psychDateFrom ? 1 : 0) +
      (this.psychDateTo ? 1 : 0)
    );
  }

  applyPsychFilters(): void {
    let temp = [...this.psychApplications];

    if (this.psychStatuses.size > 0) {
      temp = temp.filter((app) => this.psychStatuses.has(app.status));
    }

    if (this.psychSearch.trim()) {
      const q = this.psychSearch.toLowerCase().trim();
      temp = temp.filter(
        (app) =>
          app.firstName?.toLowerCase().includes(q) ||
          app.lastName?.toLowerCase().includes(q) ||
          app.email?.toLowerCase().includes(q) ||
          app.phone?.toLowerCase().includes(q),
      );
    }

    if (this.psychDateFrom) {
      const from = new Date(this.psychDateFrom).getTime();
      temp = temp.filter((a) => new Date(a.createdAt).getTime() >= from);
    }
    if (this.psychDateTo) {
      const to = new Date(this.psychDateTo).getTime() + 86399999;
      temp = temp.filter((a) => new Date(a.createdAt).getTime() <= to);
    }

    this.filteredPsychApps = temp;
  }

  // ─── Category filters ───────────────────────────────────────────────────────
  onCatSearch(event: Event): void {
    this.catSearch = (event.target as HTMLInputElement).value;
    this.applyCatFilters();
  }

  toggleCatStatus(status: string): void {
    if (this.catStatuses.has(status)) this.catStatuses.delete(status);
    else this.catStatuses.add(status);
    this.applyCatFilters();
  }

  toggleCatCategory(category: string): void {
    if (this.catCategories.has(category)) this.catCategories.delete(category);
    else this.catCategories.add(category);
    this.applyCatFilters();
  }

  setCatDate(which: 'from' | 'to', value: string): void {
    if (which === 'from') this.catDateFrom = value || null;
    else this.catDateTo = value || null;
    this.applyCatFilters();
  }

  resetCatFilters(): void {
    this.catSearch = '';
    this.catStatuses.clear();
    this.catCategories.clear();
    this.catDateFrom = null;
    this.catDateTo = null;
    this.applyCatFilters();
  }

  get catActiveCount(): number {
    return (
      (this.catSearch.trim() ? 1 : 0) +
      this.catStatuses.size +
      this.catCategories.size +
      (this.catDateFrom ? 1 : 0) +
      (this.catDateTo ? 1 : 0)
    );
  }

  get availableCategories(): string[] {
    const set = new Set<string>();
    for (const a of this.catApplications) {
      if (a.requestedCategoryName) set.add(a.requestedCategoryName);
    }
    return Array.from(set).sort();
  }

  applyCatFilters(): void {
    let temp = [...this.catApplications];

    if (this.catStatuses.size > 0) {
      temp = temp.filter((a) => this.catStatuses.has(a.status));
    }

    if (this.catCategories.size > 0) {
      temp = temp.filter((a) => this.catCategories.has(a.requestedCategoryName));
    }

    if (this.catSearch.trim()) {
      const q = this.catSearch.toLowerCase().trim();
      temp = temp.filter(
        (a) =>
          a.firstName?.toLowerCase().includes(q) ||
          a.lastName?.toLowerCase().includes(q) ||
          a.email?.toLowerCase().includes(q) ||
          a.requestedCategoryName?.toLowerCase().includes(q),
      );
    }

    if (this.catDateFrom) {
      const from = new Date(this.catDateFrom).getTime();
      temp = temp.filter((a) => new Date(a.createdAt).getTime() >= from);
    }
    if (this.catDateTo) {
      const to = new Date(this.catDateTo).getTime() + 86399999;
      temp = temp.filter((a) => new Date(a.createdAt).getTime() <= to);
    }

    this.filteredCatApps = temp;
  }

  // ─── Psych review (dialog) ──────────────────────────────────────────────────
  viewPsychDetails(app: PsychologistApplicationResponseDto): void {
    const dialogRef = this.dialog.open(ApplicationDetailsDialogComponent, {
      width: '100%',
      maxWidth: '42rem',
      data: { app },
      panelClass: 'custom-dialog-container',
      autoFocus: false,
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (!result) return;
      if (result.action === 'approve') this.reviewPsychApp(result.id, true);
      else if (result.action === 'reject') this.reviewPsychApp(result.id, false);
    });
  }

  private reviewPsychApp(id: string, approved: boolean): void {
    this.psychService.reviewApplication(id, approved).subscribe(() => {
      this.psychApplications = this.psychApplications.map((app) =>
        app.id === id ? { ...app, status: approved ? 'Approved' : 'Rejected' } : app,
      );
      this.applyPsychFilters();
    });
  }

  // ─── Category review (inline modal) ─────────────────────────────────────────
  startCatReview(app: UserCategoryApplicationResponseDto): void {
    this.reviewing = app;
    this.rejectionReason = '';
  }

  cancelCatReview(): void {
    this.reviewing = null;
    this.rejectionReason = '';
  }

  approveCat(): void {
    if (!this.reviewing) return;
    this.submitCatReview(true);
  }

  rejectCat(): void {
    if (!this.reviewing) return;
    if (!this.rejectionReason.trim()) {
      this.snackBar.open(
        this.transloco.translate('category_application.admin.rejection_required'),
        'OK',
        { duration: 3000 },
      );
      return;
    }
    this.submitCatReview(false);
  }

  openChatWithApplicant(app: UserCategoryApplicationResponseDto): void {
    const presenceUser = this.presenceService
      .usersList()
      .find((u) => u.id === app.userId);

    const chatContact: User =
      presenceUser ||
      ({
        id: app.userId,
        userName: '',
        name: app.firstName,
        surname: app.lastName,
        profileImage: app.profileImage,
      } as User);

    this.chatService.chatRightSidebarIsOpen.set(false);
    this.chatService.currentOpenedChat.set(chatContact);

    this.cancelCatReview();

    this.router
      .navigate(['/chat'], { queryParams: { back: 'category-applications' } })
      .then(() => {
        if (this.chatService.isConnected()) {
          this.chatService.loadMessages(1);
        }
      });
  }

  private submitCatReview(isApproved: boolean): void {
    if (!this.reviewing) return;

    this.isSubmittingReview = true;
    this.catService
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
          this.catApplications = this.catApplications.map((a) =>
            a.id === res.data.id ? res.data : a,
          );
          this.applyCatFilters();
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
