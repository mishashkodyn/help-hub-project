import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs';
import { AppointmentClientService } from '../../../../api/services/appointment-client.service';
import { ChatService } from '../../../../api/services/chat.service';
import { PresenceService } from '../../../../api/services/presence-service';
import { UsersService } from '../../../../api/services/users.service';
import { PendingPaymentDto } from '../../../../api/models/session.model';
import { User } from '../../../../api/models/user';

type PaymentsTab = 'pending' | 'release' | 'requisites';

@Component({
  selector: 'app-admin-payments',
  standalone: false,
  templateUrl: './admin-payments.component.html',
  styleUrl: './admin-payments.component.scss',
})
export class AdminPaymentsComponent implements OnInit {
  activeTab: PaymentsTab = 'pending';

  pendingPayments: PendingPaymentDto[] = [];
  completedSessions: PendingPaymentDto[] = [];

  // Filtered views
  filteredPending: PendingPaymentDto[] = [];
  filteredCompleted: PendingPaymentDto[] = [];

  isLoadingPending = true;
  isLoadingCompleted = true;

  confirmingId: string | null = null;
  rejectingId: string | null = null;
  releasingId: string | null = null;

  // Reject modal state
  rejectTarget: PendingPaymentDto | null = null;
  rejectReason = '';

  // Details modal state
  detailsTarget: PendingPaymentDto | null = null;

  // ─── Filters (per-tab) ──────────────────────────────────────────────────────
  pendingSearch = '';
  pendingDateFrom: string | null = null;
  pendingDateTo: string | null = null;

  releaseSearch = '';
  releaseDateFrom: string | null = null;
  releaseDateTo: string | null = null;

  // ─── Requisites form ────────────────────────────────────────────────────────
  requisitesForm!: FormGroup;
  isLoadingRequisites = false;
  isSavingRequisites = false;

  constructor(
    private appointmentService: AppointmentClientService,
    private chatService: ChatService,
    private presenceService: PresenceService,
    private router: Router,
    private route: ActivatedRoute,
    private snackBar: MatSnackBar,
    private fb: FormBuilder,
    private usersService: UsersService,
  ) {}

  ngOnInit(): void {
    const tab = this.route.snapshot.queryParamMap.get('tab');
    if (tab === 'release' || tab === 'requisites') this.activeTab = tab as PaymentsTab;

    this.requisitesForm = this.fb.group({
      cardNumber: ['', [Validators.maxLength(19), Validators.pattern(/^\d{0,4}(\s?\d{4}){0,3}$/)]],
    });

    this.loadPendingPayments();
    this.loadCompletedSessions();
    if (this.activeTab === 'requisites') this.loadRequisites();
  }

  setTab(tab: PaymentsTab): void {
    this.activeTab = tab;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });

    if (tab === 'requisites') this.loadRequisites();
  }

  // ─── Loaders ────────────────────────────────────────────────────────────────
  loadPendingPayments(): void {
    this.isLoadingPending = true;
    this.appointmentService.getPendingPayments()
      .pipe(finalize(() => (this.isLoadingPending = false)))
      .subscribe({
        next: (data) => {
          this.pendingPayments = data;
          this.applyPendingFilters();
        },
        error: () => this.snackBar.open('Не вдалось завантажити очікуючі оплати.', 'Закрити', { duration: 3000 }),
      });
  }

  loadCompletedSessions(): void {
    this.isLoadingCompleted = true;
    this.appointmentService.getCompletedUnpaidSessions()
      .pipe(finalize(() => (this.isLoadingCompleted = false)))
      .subscribe({
        next: (data) => {
          this.completedSessions = data;
          this.applyReleaseFilters();
        },
        error: () => this.snackBar.open('Не вдалось завантажити завершені сесії.', 'Закрити', { duration: 3000 }),
      });
  }

  loadRequisites(): void {
    if (this.isLoadingRequisites) return;
    this.isLoadingRequisites = true;
    this.usersService.getMyCardNumber()
      .pipe(finalize(() => (this.isLoadingRequisites = false)))
      .subscribe({
        next: (res) => {
          const stored = res?.data ?? '';
          const digits = stored.replace(/\D/g, '');
          const formatted = digits.match(/.{1,4}/g)?.join(' ') ?? digits;
          this.requisitesForm.patchValue({ cardNumber: formatted });
        },
        error: () => {
          this.snackBar.open('Не вдалось завантажити дані.', 'Закрити', { duration: 3000 });
        },
      });
  }

  saveRequisites(): void {
    if (this.requisitesForm.invalid) {
      this.requisitesForm.markAllAsTouched();
      return;
    }
    const raw = (this.requisitesForm.value.cardNumber ?? '').replace(/\s/g, '');
    this.isSavingRequisites = true;
    this.usersService.updateMyCardNumber(raw)
      .pipe(finalize(() => (this.isSavingRequisites = false)))
      .subscribe({
        next: () => this.snackBar.open('Номер картки збережено.', 'Закрити', { duration: 2500 }),
        error: () => this.snackBar.open('Помилка збереження.', 'Закрити', { duration: 3000 }),
      });
  }

  // ─── Filters: pending ───────────────────────────────────────────────────────
  onPendingSearch(event: Event): void {
    this.pendingSearch = (event.target as HTMLInputElement).value;
    this.applyPendingFilters();
  }
  setPendingDate(which: 'from' | 'to', value: string): void {
    if (which === 'from') this.pendingDateFrom = value || null;
    else this.pendingDateTo = value || null;
    this.applyPendingFilters();
  }
  resetPendingFilters(): void {
    this.pendingSearch = '';
    this.pendingDateFrom = null;
    this.pendingDateTo = null;
    this.applyPendingFilters();
  }
  get pendingActiveCount(): number {
    return (
      (this.pendingSearch.trim() ? 1 : 0) +
      (this.pendingDateFrom ? 1 : 0) +
      (this.pendingDateTo ? 1 : 0)
    );
  }
  applyPendingFilters(): void {
    this.filteredPending = this.filterList(
      this.pendingPayments,
      this.pendingSearch,
      this.pendingDateFrom,
      this.pendingDateTo,
    );
  }

  // ─── Filters: release ───────────────────────────────────────────────────────
  onReleaseSearch(event: Event): void {
    this.releaseSearch = (event.target as HTMLInputElement).value;
    this.applyReleaseFilters();
  }
  setReleaseDate(which: 'from' | 'to', value: string): void {
    if (which === 'from') this.releaseDateFrom = value || null;
    else this.releaseDateTo = value || null;
    this.applyReleaseFilters();
  }
  resetReleaseFilters(): void {
    this.releaseSearch = '';
    this.releaseDateFrom = null;
    this.releaseDateTo = null;
    this.applyReleaseFilters();
  }
  get releaseActiveCount(): number {
    return (
      (this.releaseSearch.trim() ? 1 : 0) +
      (this.releaseDateFrom ? 1 : 0) +
      (this.releaseDateTo ? 1 : 0)
    );
  }
  applyReleaseFilters(): void {
    this.filteredCompleted = this.filterList(
      this.completedSessions,
      this.releaseSearch,
      this.releaseDateFrom,
      this.releaseDateTo,
    );
  }

  private filterList(
    items: PendingPaymentDto[],
    search: string,
    dateFrom: string | null,
    dateTo: string | null,
  ): PendingPaymentDto[] {
    let temp = [...items];

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      temp = temp.filter(
        (i) =>
          i.clientName?.toLowerCase().includes(q) ||
          i.clientEmail?.toLowerCase().includes(q) ||
          i.psychologistName?.toLowerCase().includes(q),
      );
    }

    if (dateFrom) {
      const from = new Date(dateFrom).getTime();
      temp = temp.filter((i) => new Date(i.startTime).getTime() >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo).getTime() + 86399999;
      temp = temp.filter((i) => new Date(i.startTime).getTime() <= to);
    }

    return temp;
  }

  // ─── Actions ────────────────────────────────────────────────────────────────
  confirmPayment(appointmentId: string): void {
    if (this.confirmingId) return;
    this.confirmingId = appointmentId;
    this.appointmentService.confirmPayment(appointmentId)
      .pipe(finalize(() => (this.confirmingId = null)))
      .subscribe({
        next: () => {
          this.snackBar.open('Оплату підтверджено. Заявка надіслана психологу.', 'Закрити', { duration: 3000 });
          this.pendingPayments = this.pendingPayments.filter(p => p.appointmentId !== appointmentId);
          this.applyPendingFilters();
        },
        error: (err) => this.snackBar.open(err?.error?.error || 'Помилка підтвердження.', 'Закрити', { duration: 3000 }),
      });
  }

  openRejectModal(item: PendingPaymentDto): void {
    this.rejectTarget = item;
    this.rejectReason = '';
  }

  closeRejectModal(): void {
    this.rejectTarget = null;
    this.rejectReason = '';
  }

  submitReject(): void {
    if (!this.rejectTarget || this.rejectingId) return;
    const id = this.rejectTarget.appointmentId;
    this.rejectingId = id;
    this.appointmentService.rejectPayment(id, this.rejectReason)
      .pipe(finalize(() => (this.rejectingId = null)))
      .subscribe({
        next: () => {
          this.snackBar.open('Заявку відхилено. Клієнт отримав сповіщення.', 'Закрити', { duration: 3000 });
          this.pendingPayments = this.pendingPayments.filter(p => p.appointmentId !== id);
          this.applyPendingFilters();
          this.closeRejectModal();
        },
        error: (err) => this.snackBar.open(err?.error?.error || 'Помилка відхилення.', 'Закрити', { duration: 3000 }),
      });
  }

  releasePayment(appointmentId: string): void {
    if (this.releasingId) return;
    this.releasingId = appointmentId;
    this.appointmentService.releasePayment(appointmentId)
      .pipe(finalize(() => (this.releasingId = null)))
      .subscribe({
        next: () => {
          this.snackBar.open('Кошти зараховано на рахунок психолога.', 'Закрити', { duration: 3000 });
          this.completedSessions = this.completedSessions.filter(p => p.appointmentId !== appointmentId);
          this.applyReleaseFilters();
        },
        error: (err) => this.snackBar.open(err?.error?.error || 'Помилка виплати.', 'Закрити', { duration: 3000 }),
      });
  }

  openChatWithClient(item: PendingPaymentDto): void {
    const presenceUser = this.presenceService
      .usersList()
      .find((u) => u.id === item.clientUserId);

    const chatContact: User = presenceUser || ({
      id: item.clientUserId,
      userName: item.clientUserName ?? '',
      name: item.clientFirstName ?? '',
      surname: item.clientLastName ?? '',
      profileImage: item.clientProfileImage ?? '',
    } as User);

    this.chatService.chatRightSidebarIsOpen.set(false);
    this.chatService.currentOpenedChat.set(chatContact);

    this.router.navigate(['/chat'], { queryParams: { back: 'payments' } }).then(() => {
      if (this.chatService.isConnected()) {
        this.chatService.loadMessages(1);
      }
    });
  }

  showDetails(item: PendingPaymentDto): void {
    this.detailsTarget = item;
  }

  closeDetails(): void {
    this.detailsTarget = null;
  }

  formatDate(iso: string): string {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('uk-UA', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  }

  initials(item: PendingPaymentDto): string {
    const f = (item.clientFirstName?.[0] ?? '').toUpperCase();
    const l = (item.clientLastName?.[0] ?? '').toUpperCase();
    return `${f}${l}` || '?';
  }
}
