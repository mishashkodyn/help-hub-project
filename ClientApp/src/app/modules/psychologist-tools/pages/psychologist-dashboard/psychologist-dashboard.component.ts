import { Component, OnInit, computed, signal } from '@angular/core';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { AuthService } from '../../../../api/services/auth.service';
import { PsychologistService } from '../../../../api/services/psychologist.service';
import { AppointmentClientService } from '../../../../api/services/appointment-client.service';

import { AppointmentApplicationDto } from '../../../../api/models/psychologist.model';
import {
  ClientSessionDto,
  EarningItemDto,
  resolveDisplayStatus,
} from '../../../../api/models/session.model';

/** A single headline metric shown in the stat row. */
export interface KpiStat {
  key: string;
  labelKey: string;
  value: string | number;
  captionKey: string;
  captionValue: string | number;
  route: string;
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
  completed: number;
  scheduled: number;
  total: number;
  completedPct: number;
  scheduledPct: number;
}

/** Item in the "next sessions" queue. */
interface QueueItem {
  name: string;
  startTime: string;
  statusKey: string;
  color: string;
  price: number;
}

/** A recent earning row. */
interface EarningRow {
  name: string;
  amount: number;
  date: string;
  statusKey: string;
  color: string;
}

/** Quick navigation link (preserves original dashboard destinations). */
export interface NavLink {
  labelKey: string;
  route: string;
}

@Component({
  selector: 'app-psychologist-dashboard',
  standalone: false,
  templateUrl: './psychologist-dashboard.component.html',
  styleUrl: './psychologist-dashboard.component.scss',
})
export class PsychologistDashboardComponent implements OnInit {
  loading = signal(true);

  private sessions = signal<ClientSessionDto[]>([]);
  private applications = signal<AppointmentApplicationDto[]>([]);
  private balance = signal(0);
  private earnings = signal<EarningItemDto[]>([]);

  readonly today = new Date();

  constructor(
    protected authService: AuthService,
    private psychologistService: PsychologistService,
    private appointmentService: AppointmentClientService,
  ) {}

  ngOnInit(): void {
    this.loadAll();
  }

  loadAll(): void {
    this.loading.set(true);
    forkJoin({
      sessions: this.appointmentService
        .getPsychologistSessions()
        .pipe(catchError(() => of([] as ClientSessionDto[]))),
      applications: this.psychologistService
        .getPsychologistApplications()
        .pipe(catchError(() => of([] as AppointmentApplicationDto[]))),
      balance: this.psychologistService
        .getMyBalance()
        .pipe(catchError(() => of({ balance: 0, recentEarnings: [] }))),
    }).subscribe((res) => {
      this.sessions.set(res.sessions ?? []);
      this.applications.set(res.applications ?? []);
      this.balance.set(res.balance?.balance ?? 0);
      this.earnings.set(res.balance?.recentEarnings ?? []);
      this.loading.set(false);
    });
  }

  // ─── Derived session buckets ──────────────────────────────────────────────────
  private statusKey(s: ClientSessionDto): string {
    return resolveDisplayStatus(s).key;
  }

  private upcomingSessions = computed(() =>
    this.sessions().filter((s) => {
      const k = this.statusKey(s);
      return k === 'upcoming' || k === 'live' || k === 'pending';
    }),
  );

  private completedSessions = computed(() =>
    this.sessions().filter((s) => this.statusKey(s) === 'completed'),
  );

  pendingApplications = computed(() =>
    this.applications().filter((a) => a.status === 'Pending'),
  );

  /** Sessions whose start day is today (any non-cancelled status). */
  private todaysSessions = computed(() => {
    const key = this.localDayKey(new Date());
    return this.sessions().filter(
      (s) => this.statusKey(s) !== 'cancelled' && this.localDayKey(new Date(s.startTime)) === key,
    );
  });

  /** Completed sessions within the current calendar month. */
  private completedThisMonth = computed(() => {
    const now = new Date();
    return this.completedSessions().filter((s) => {
      const d = new Date(s.startTime);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).length;
  });

  // ─── Stat row ────────────────────────────────────────────────────────────────
  kpis = computed<KpiStat[]>(() => [
    {
      key: 'today',
      labelKey: 'psychologist.dashboard.kpi.today_label',
      value: this.todaysSessions().length,
      captionKey: 'psychologist.dashboard.kpi.upcoming_total',
      captionValue: this.upcomingSessions().length,
      route: '/psychologist/sessions',
      attention: this.todaysSessions().length > 0,
    },
    {
      key: 'requests',
      labelKey: 'psychologist.dashboard.kpi.requests_label',
      value: this.pendingApplications().length,
      captionKey: 'psychologist.dashboard.kpi.of_total',
      captionValue: this.applications().length,
      route: '/psychologist/applications',
      attention: this.pendingApplications().length > 0,
    },
    {
      key: 'balance',
      labelKey: 'psychologist.dashboard.kpi.balance_label',
      value: this.formatMoney(this.balance()),
      captionKey: 'psychologist.dashboard.kpi.entries',
      captionValue: this.earnings().length,
      route: '/psychologist/finances',
      attention: this.balance() > 0,
    },
    {
      key: 'completed',
      labelKey: 'psychologist.dashboard.kpi.completed_label',
      value: this.completedSessions().length,
      captionKey: 'psychologist.dashboard.kpi.this_month',
      captionValue: this.completedThisMonth(),
      route: '/psychologist/past-sessions',
      attention: false,
    },
  ]);

  // ─── Session status (slim stacked bar) ────────────────────────────────────────
  statusSegments = computed<StatusSegment[]>(() => {
    const all = this.sessions();
    const total = all.length || 1;
    const count = (pred: (k: string) => boolean) =>
      all.filter((s) => pred(this.statusKey(s))).length;
    const raw: { labelKey: string; value: number; color: string }[] = [
      { labelKey: 'psychologist.dashboard.status.upcoming', value: count((k) => k === 'upcoming' || k === 'live'), color: 'var(--color-success)' },
      { labelKey: 'psychologist.dashboard.status.completed', value: this.completedSessions().length, color: 'var(--color-sky)' },
      { labelKey: 'psychologist.dashboard.status.pending', value: count((k) => k === 'pending'), color: '#d6a015' },
      { labelKey: 'psychologist.dashboard.status.cancelled', value: count((k) => k === 'cancelled'), color: '#c2554f' },
    ];
    return raw.map((s) => ({ ...s, pct: (s.value / total) * 100 }));
  });

  totalSessions = computed(() => this.sessions().length);

  // ─── Activity timeline (last 30 days) ─────────────────────────────────────────
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

    const completedMap = this.bucketByDay(this.completedSessions());
    const scheduledMap = this.bucketByDay(
      this.sessions().filter((s) => {
        const k = this.statusKey(s);
        return k !== 'completed' && k !== 'cancelled';
      }),
    );

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = this.localDayKey(d);
      const completed = completedMap.get(key) ?? 0;
      const scheduled = scheduledMap.get(key) ?? 0;
      buckets.push({
        label: d.toLocaleDateString('uk-UA', { day: 'numeric' }),
        full: d.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' }),
        completed,
        scheduled,
        total: completed + scheduled,
        completedPct: 0,
        scheduledPct: 0,
      });
    }

    const max = Math.max(1, ...buckets.map((b) => b.total));
    for (const b of buckets) {
      b.completedPct = (b.completed / max) * 100;
      b.scheduledPct = (b.scheduled / max) * 100;
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
      completed: toPoints((b) => b.completedPct),
      scheduled: toPoints((b) => b.scheduledPct),
    };
  });

  private bucketByDay(items: { startTime: string }[]): Map<string, number> {
    const map = new Map<string, number>();
    for (const it of items) {
      if (!it.startTime) continue;
      const key = this.localDayKey(new Date(it.startTime));
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }

  // ─── Next sessions queue ──────────────────────────────────────────────────────
  nextSessions = computed<QueueItem[]>(() =>
    this.upcomingSessions()
      .slice()
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
      .slice(0, 6)
      .map((s) => {
        const k = this.statusKey(s);
        return {
          // For psychologist sessions the "psychologistName" field carries the client name.
          name: s.psychologistName,
          startTime: s.startTime,
          statusKey:
            k === 'live'
              ? 'psychologist.dashboard.status.live'
              : k === 'pending'
                ? 'psychologist.dashboard.status.pending'
                : 'psychologist.dashboard.status.upcoming',
          color: k === 'live' ? 'var(--color-success)' : k === 'pending' ? '#d6a015' : 'var(--color-blue)',
          price: s.price,
        };
      }),
  );

  // ─── Recent earnings ──────────────────────────────────────────────────────────
  recentEarnings = computed<EarningRow[]>(() =>
    this.earnings()
      .slice(0, 5)
      .map((e) => ({
        name: e.clientName,
        amount: e.amount,
        date: e.sessionDate,
        statusKey:
          e.paymentStatus === 'ReleasedToPsychologist'
            ? 'psychologist.dashboard.earnings.released'
            : e.paymentStatus === 'Free'
              ? 'psychologist.dashboard.earnings.free'
              : 'psychologist.dashboard.earnings.pending',
        color:
          e.paymentStatus === 'ReleasedToPsychologist'
            ? 'var(--color-success)'
            : e.paymentStatus === 'Free'
              ? 'var(--color-sky)'
              : '#d6a015',
      })),
  );

  // ─── Quick links (original dashboard destinations preserved) ──────────────────
  navLinks: NavLink[] = [
    { labelKey: 'psychologist.dashboard.nav.schedule', route: '/psychologist/calendar' },
    { labelKey: 'psychologist.dashboard.nav.sessions', route: '/psychologist/sessions' },
    { labelKey: 'psychologist.dashboard.nav.clients', route: '/psychologist/clients' },
    { labelKey: 'psychologist.dashboard.nav.profile', route: '/psychologist/profile' },
    { labelKey: 'psychologist.dashboard.nav.finances', route: '/psychologist/finances' },
    { labelKey: 'psychologist.dashboard.nav.past', route: '/psychologist/past-sessions' },
  ];

  // ─── Helpers ─────────────────────────────────────────────────────────────────
  formatMoney(value: number): string {
    return `${Math.round(value).toLocaleString('uk-UA')} ₴`;
  }
}
