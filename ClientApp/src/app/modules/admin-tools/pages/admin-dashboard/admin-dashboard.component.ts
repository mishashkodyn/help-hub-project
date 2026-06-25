import { Component, OnInit, computed, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { ApplicationsService } from '../../../../api/services/applications.service';
import { UserCategoryApplicationService } from '../../../../api/services/user-category-application.service';
import { AppointmentClientService } from '../../../../api/services/appointment-client.service';
import { SpecializationService } from '../../../../api/services/specializations.service';

import { PsychologistApplicationResponseDto } from '../../../../api/models/psychologist-application.model';
import { UserCategoryApplicationResponseDto } from '../../../../api/models/user-category-application.model';
import { PendingPaymentDto } from '../../../../api/models/session.model';
import { SpecializationAdminDto } from '../../../../api/models/specialization.model';

/** A single headline metric shown in the stat row. */
export interface KpiStat {
  key: string;
  labelKey: string;
  value: number;
  captionKey: string;
  captionValue: string | number;
  route: string;
  queryParams?: Record<string, string>;
  attention: boolean;
}

/** One segment of the slim status bar. */
interface StatusSegment {
  labelKey: string;
  value: number;
  pct: number;
  color: string;
}

/** One vertical bar in the activity timeline. */
interface ActivityBar {
  label: string;
  full: string;
  psych: number;
  category: number;
  total: number;
  psychPct: number;
  categoryPct: number;
}

/** Horizontal rank row (top specializations / category split). */
interface RankRow {
  label: string;
  value: number;
  pct: number;
}

/** Item in the review queue. */
interface QueueItem {
  type: 'psych' | 'category' | 'payment';
  typeKey: string;
  name: string;
  meta: string;
  createdAt: string;
  amount?: number;
  route: string;
  queryParams?: Record<string, string>;
}

/** Quick navigation link (preserves original dashboard destinations). */
export interface NavLink {
  labelKey: string;
  route: string;
}

/** Camera-wall archive disk usage (GET /api/frames/storage). */
interface StorageInfo {
  enabled: boolean;
  maxBytes: number;
  usedBytes: number;
  usedPct: number;
  frameCount: number;
  avgFrameBytes: number;
  oldestUtc: string | null;
  newestUtc: string | null;
  retentionHours: number | null;
}

@Component({
  selector: 'app-admin-dashboard',
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.scss',
  standalone: false,
})
export class AdminDashboardComponent implements OnInit {
  loading = signal(true);

  private psychApps = signal<PsychologistApplicationResponseDto[]>([]);
  private catApps = signal<UserCategoryApplicationResponseDto[]>([]);
  private pendingPayments = signal<PendingPaymentDto[]>([]);
  private releaseQueue = signal<PendingPaymentDto[]>([]);
  private specializations = signal<SpecializationAdminDto[]>([]);
  storage = signal<StorageInfo | null>(null);

  readonly today = new Date();

  constructor(
    private applicationsService: ApplicationsService,
    private categoryService: UserCategoryApplicationService,
    private appointmentService: AppointmentClientService,
    private specializationService: SpecializationService,
    private http: HttpClient,
  ) {}

  ngOnInit(): void {
    this.loadAll();
  }

  loadAll(): void {
    this.loading.set(true);
    forkJoin({
      psych: this.applicationsService
        .getPsychologistApplications()
        .pipe(catchError(() => of({ isSuccess: false, data: [] as PsychologistApplicationResponseDto[] } as any))),
      cat: this.categoryService
        .getAll()
        .pipe(catchError(() => of({ isSuccess: false, data: [] as UserCategoryApplicationResponseDto[] } as any))),
      pending: this.appointmentService
        .getPendingPayments()
        .pipe(catchError(() => of([] as PendingPaymentDto[]))),
      release: this.appointmentService
        .getCompletedUnpaidSessions()
        .pipe(catchError(() => of([] as PendingPaymentDto[]))),
      specs: this.specializationService
        .getSpecializationsForAdmin()
        .pipe(catchError(() => of({ isSuccess: false, data: [] as SpecializationAdminDto[] } as any))),
      storage: this.http
        .get<StorageInfo>('/api/frames/storage')
        .pipe(catchError(() => of(null))), // camera wall disabled / no access → hide the card
    }).subscribe((res) => {
      this.psychApps.set(res.psych?.data ?? []);
      this.catApps.set(res.cat?.data ?? []);
      this.pendingPayments.set(res.pending ?? []);
      this.releaseQueue.set(res.release ?? []);
      this.specializations.set(res.specs?.data ?? []);
      this.storage.set(res.storage ?? null);
      this.loading.set(false);
    });
  }

  // ─── Derived counts ──────────────────────────────────────────────────────────
  private countByStatus<T extends { status: string }>(items: T[], status: string): number {
    return items.filter((i) => i.status === status).length;
  }

  pendingPsych = computed(() => this.countByStatus(this.psychApps(), 'Pending'));
  pendingCat = computed(() => this.countByStatus(this.catApps(), 'Pending'));

  private sumAmount(items: PendingPaymentDto[]): number {
    return items.reduce((acc, i) => acc + (i.amount || 0), 0);
  }

  totalApplications = computed(() => this.psychApps().length + this.catApps().length);

  // ─── Stat row ────────────────────────────────────────────────────────────────
  kpis = computed<KpiStat[]>(() => [
    {
      key: 'psych',
      labelKey: 'admin.dashboard.kpi.psych_label',
      value: this.pendingPsych(),
      captionKey: 'admin.dashboard.kpi.of_total',
      captionValue: this.psychApps().length,
      route: '/admin/applications',
      queryParams: { tab: 'psychologists' },
      attention: this.pendingPsych() > 0,
    },
    {
      key: 'category',
      labelKey: 'admin.dashboard.kpi.category_label',
      value: this.pendingCat(),
      captionKey: 'admin.dashboard.kpi.of_total',
      captionValue: this.catApps().length,
      route: '/admin/applications',
      queryParams: { tab: 'categories' },
      attention: this.pendingCat() > 0,
    },
    {
      key: 'payments',
      labelKey: 'admin.dashboard.kpi.payments_label',
      value: this.pendingPayments().length,
      captionKey: 'admin.dashboard.kpi.sum',
      captionValue: this.formatMoney(this.sumAmount(this.pendingPayments())),
      route: '/admin/payments',
      queryParams: { tab: 'pending' },
      attention: this.pendingPayments().length > 0,
    },
    {
      key: 'release',
      labelKey: 'admin.dashboard.kpi.release_label',
      value: this.releaseQueue().length,
      captionKey: 'admin.dashboard.kpi.sum',
      captionValue: this.formatMoney(this.sumAmount(this.releaseQueue())),
      route: '/admin/payments',
      queryParams: { tab: 'release' },
      attention: this.releaseQueue().length > 0,
    },
  ]);

  totalAttention = computed(() => this.kpis().filter((k) => k.attention).length);

  // ─── Applications status (slim stacked bar) ──────────────────────────────────
  statusSegments = computed<StatusSegment[]>(() => {
    const all = [...this.psychApps(), ...this.catApps()];
    const total = all.length || 1;
    const raw: { labelKey: string; status: string; color: string }[] = [
      { labelKey: 'admin.dashboard.status.approved', status: 'Approved', color: 'var(--color-success)' },
      { labelKey: 'admin.dashboard.status.pending', status: 'Pending', color: 'var(--color-sky)' },
      { labelKey: 'admin.dashboard.status.rejected', status: 'Rejected', color: '#c2554f' },
    ];
    return raw.map((s) => {
      const value = all.filter((a) => a.status === s.status).length;
      return { labelKey: s.labelKey, value, pct: (value / total) * 100, color: s.color };
    });
  });

  // ─── Activity timeline (last 14 days) ────────────────────────────────────────
  activityView = signal<'bars' | 'line'>('bars');

  setActivityView(view: 'bars' | 'line'): void {
    this.activityView.set(view);
  }

  /** Local calendar day key (YYYY-MM-DD) — avoids the UTC off-by-one that hid "today". */
  private localDayKey(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  activity = computed<ActivityBar[]>(() => {
    const days = 30;
    const buckets: ActivityBar[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const psychMap = this.bucketByDay(this.psychApps());
    const catMap = this.bucketByDay(this.catApps());

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = this.localDayKey(d);
      const psych = psychMap.get(key) ?? 0;
      const category = catMap.get(key) ?? 0;
      buckets.push({
        label: d.toLocaleDateString('uk-UA', { day: 'numeric' }),
        full: d.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' }),
        psych,
        category,
        total: psych + category,
        psychPct: 0,
        categoryPct: 0,
      });
    }

    const max = Math.max(1, ...buckets.map((b) => b.total));
    for (const b of buckets) {
      b.psychPct = (b.psych / max) * 100;
      b.categoryPct = (b.category / max) * 100;
    }
    return buckets;
  });

  activityTotal = computed(() => this.activity().reduce((acc, b) => acc + b.total, 0));

  /** Polyline point strings for the line view, scaled to the same max as the bars. */
  lineSeries = computed(() => {
    const a = this.activity();
    const toPoints = (sel: (b: ActivityBar) => number) =>
      a.map((b, i) => `${i},${(100 - sel(b)).toFixed(2)}`).join(' ');
    return {
      viewBox: `0 0 ${Math.max(1, a.length - 1)} 100`,
      psych: toPoints((b) => b.psychPct),
      category: toPoints((b) => b.categoryPct),
    };
  });

  private bucketByDay(items: { createdAt: string }[]): Map<string, number> {
    const map = new Map<string, number>();
    for (const it of items) {
      if (!it.createdAt) continue;
      const key = this.localDayKey(new Date(it.createdAt));
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }

  // ─── Top specializations ─────────────────────────────────────────────────────
  topSpecializations = computed<RankRow[]>(() => {
    const list = [...this.specializations()]
      .sort((a, b) => (b.psychologistsCount || 0) - (a.psychologistsCount || 0))
      .slice(0, 5);
    const max = Math.max(1, ...list.map((s) => s.psychologistsCount || 0));
    return list.map((s) => ({
      label: s.name,
      value: s.psychologistsCount || 0,
      pct: ((s.psychologistsCount || 0) / max) * 100,
    }));
  });

  totalSpecializations = computed(() => this.specializations().length);

  // ─── Category requests split ─────────────────────────────────────────────────
  categorySplit = computed<RankRow[]>(() => {
    const map = new Map<string, number>();
    for (const a of this.catApps()) {
      const name = a.requestedCategoryName || '—';
      map.set(name, (map.get(name) ?? 0) + 1);
    }
    const list = Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
    const max = Math.max(1, ...list.map(([, v]) => v));
    return list.map(([label, value]) => ({ label, value, pct: (value / max) * 100 }));
  });

  // ─── Review queue ────────────────────────────────────────────────────────────
  reviewQueue = computed<QueueItem[]>(() => {
    const psych: QueueItem[] = this.psychApps()
      .filter((a) => a.status === 'Pending')
      .map((a) => ({
        type: 'psych',
        typeKey: 'admin.dashboard.queue.type_psych',
        name: `${a.firstName ?? ''} ${a.lastName ?? ''}`.trim() || a.email,
        meta: a.email,
        createdAt: a.createdAt,
        route: '/admin/applications',
        queryParams: { tab: 'psychologists' },
      }));

    const cat: QueueItem[] = this.catApps()
      .filter((a) => a.status === 'Pending')
      .map((a) => ({
        type: 'category',
        typeKey: 'admin.dashboard.queue.type_category',
        name: `${a.firstName ?? ''} ${a.lastName ?? ''}`.trim() || a.email,
        meta: a.requestedCategoryName,
        createdAt: a.createdAt,
        route: '/admin/applications',
        queryParams: { tab: 'categories' },
      }));

    const payments: QueueItem[] = this.pendingPayments().map((p) => ({
      type: 'payment',
      typeKey: 'admin.dashboard.queue.type_payment',
      name: p.clientName,
      meta: p.psychologistName,
      createdAt: p.startTime,
      amount: p.amount,
      route: '/admin/payments',
      queryParams: { tab: 'pending' },
    }));

    return [...psych, ...cat, ...payments]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 7);
  });

  // ─── Quick links (original dashboard destinations preserved) ──────────────────
  navLinks: NavLink[] = [
    { labelKey: 'admin.dashboard.applications_title', route: '/admin/applications' },
    { labelKey: 'admin.dashboard.users_title', route: '/admin/users' },
    { labelKey: 'admin.dashboard.specializations_title', route: '/admin/specializations' },
    { labelKey: 'admin.dashboard.payments_title', route: '/admin/payments' },
  ];

  // ─── Helpers ─────────────────────────────────────────────────────────────────
  formatMoney(value: number): string {
    return `${Math.round(value).toLocaleString('uk-UA')} ₴`;
  }

  daysAgo(iso: string): number {
    if (!iso) return 0;
    const diff = Date.now() - new Date(iso).getTime();
    return Math.max(0, Math.floor(diff / 86_400_000));
  }

  // ─── Camera storage helpers ──────────────────────────────────────────────────
  formatBytes(bytes: number): string {
    if (!bytes || bytes <= 0) return '0 МБ';
    const gb = bytes / 1024 ** 3;
    if (gb >= 1) return `${gb.toFixed(1)} ГБ`;
    const mb = bytes / 1024 ** 2;
    return `${Math.max(1, Math.round(mb))} МБ`;
  }

  /** Bar fill never exceeds 100% even if the archive briefly overshoots the limit. */
  storagePct = computed(() => Math.min(100, this.storage()?.usedPct ?? 0));

  /** Green under 75%, amber under 90%, red above — mirrors how full the quota is. */
  storageColor = computed(() => {
    const pct = this.storage()?.usedPct ?? 0;
    if (pct >= 90) return '#c2554f';
    if (pct >= 75) return '#b07400';
    return 'var(--color-success)';
  });

  /** Retention shown in days past 48h, otherwise hours; null when not estimable yet. */
  retention = computed<{ value: string; unitKey: string } | null>(() => {
    const h = this.storage()?.retentionHours;
    if (h == null) return null;
    return h >= 48
      ? { value: (h / 24).toFixed(1), unitKey: 'admin.dashboard.storage.unit_days' }
      : { value: h.toFixed(1), unitKey: 'admin.dashboard.storage.unit_hours' };
  });
}
