import { Component, OnDestroy, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';

interface PcInfo {
  pc: string;
  cameras: number;
}

/** One archive cleanup record reported by the backend (newest first). */
interface CleanupEvent {
  atUtc: string;
  deletedFrames: number;
  freedBytes: number;
  totalAfter: number;
  trigger: 'auto' | 'manual' | string;
}

/** Camera-wall archive disk usage (GET /api/frames/storage). */
interface StorageInfo {
  enabled: boolean;
  quotaEnabled: boolean;
  maxBytes: number;
  usedBytes: number;
  freeBytes: number;
  usedPct: number;
  frameCount: number;
  avgFrameBytes: number;
  oldestUtc: string | null;
  newestUtc: string | null;
  retentionHours: number | null;
  cleaning: boolean;
  recentCleanups: CleanupEvent[];
}

interface CameraInfo {
  cameraId: string;
  lastSeenUtc: string | null;
  imageUrl: string;
}

interface CameraState {
  cameraId: string;
  lastSeenUtc: string | null;
  imageUrl: string;
  displayedSrc: string | null;
}

interface ArchiveDay {
  day: string;
  count: number;
}

interface ArchiveFrame {
  file: string;
  timeUtc: string | null;
  imageUrl: string;
}

@Component({
  selector: 'app-camera-wall',
  standalone: false,
  templateUrl: './camera-wall.component.html',
  styleUrl: './camera-wall.component.scss',
})
export class CameraWallComponent implements OnInit, OnDestroy {
  pcs: PcInfo[] = [];
  selectedPc: string | null = null;
  cameras: CameraState[] = [];
  loadingPcs = false;
  loadingCameras = false;

  // wall clock (header) + snapshot time used to decide LIVE badges
  clock = '';
  private wallLoadedMs = Date.now();
  private clockTimer?: ReturnType<typeof setInterval>;

  // live wall auto-refresh (re-pulls latest frames in place, no flicker)
  autoRefresh = true;
  private refreshTimer?: ReturnType<typeof setInterval>;
  private static readonly REFRESH_MS = 10_000;

  // admin storage panel (only enabled when GET /storage returns 200)
  storageAvailable = false;
  storageOpen = false;
  storage: StorageInfo | null = null;
  loadingStorage = false;
  cleaning = false;
  cleanupNote: string | null = null;

  // archive viewer state
  viewerCamera: string | null = null;
  days: ArchiveDay[] = [];
  selectedDay: string | null = null;
  frames: ArchiveFrame[] = [];
  frameIndex = 0;
  loadingDays = false;
  loadingFrames = false;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadPcs();
    this.tickClock();
    this.clockTimer = setInterval(() => this.tickClock(), 1000);
    this.startAutoRefresh();
    this.probeStorage();
  }

  ngOnDestroy(): void {
    if (this.clockTimer) clearInterval(this.clockTimer);
    this.stopAutoRefresh();
  }

  private tickClock(): void {
    this.clock = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  // A camera counts as LIVE if its last frame was fresh when the wall loaded.
  // The wall loads once (no polling), so this is a snapshot, not a ticking state.
  isLive(cam: CameraState): boolean {
    if (!cam.lastSeenUtc) return false;
    return this.wallLoadedMs - Date.parse(cam.lastSeenUtc) < 30_000;
  }

  // ── PCs + wall (loaded once, no auto-refresh) ─────────────────────

  loadPcs(): void {
    this.loadingPcs = true;
    this.http.get<PcInfo[]>('/api/frames/pcs').subscribe({
      next: pcs => {
        this.pcs = pcs;
        this.loadingPcs = false;
        if (pcs.length > 0) {
          // default to PC1 if present, otherwise the first folder
          const preferred = pcs.find(p => p.pc.toLowerCase() === 'pc1') ?? pcs[0];
          this.selectPc(preferred.pc);
        }
      },
      error: () => { this.loadingPcs = false; },
    });
  }

  selectPc(pc: string): void {
    this.selectedPc = pc;
    this.cameras = [];
    this.loadingCameras = true;
    this.http.get<CameraInfo[]>(`/api/frames/${pc}/cameras`).subscribe({
      next: cams => {
        this.wallLoadedMs = Date.now();
        this.cameras = cams.map(c => ({
          cameraId: c.cameraId,
          lastSeenUtc: c.lastSeenUtc,
          imageUrl: c.imageUrl,
          displayedSrc: `${c.imageUrl}?t=${Date.now()}`, // load the last frame once
        }));
        this.loadingCameras = false;
      },
      error: () => { this.loadingCameras = false; },
    });
  }

  // ── live auto-refresh (in-place, keeps cell identity to avoid flicker) ──

  private startAutoRefresh(): void {
    this.stopAutoRefresh();
    if (!this.autoRefresh) return;
    this.refreshTimer = setInterval(() => this.refreshFrames(), CameraWallComponent.REFRESH_MS);
  }

  private stopAutoRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = undefined;
    }
  }

  toggleAutoRefresh(): void {
    this.autoRefresh = !this.autoRefresh;
    this.startAutoRefresh();
    if (this.autoRefresh) this.refreshFrames();
  }

  // Re-pull latest frames for the selected PC, merging into existing cells so the
  // <img> just swaps source instead of the whole grid re-rendering. Paused while
  // the archive viewer is open.
  private refreshFrames(): void {
    if (!this.selectedPc || this.viewerCamera) return;
    this.http.get<CameraInfo[]>(`/api/frames/${this.selectedPc}/cameras`).subscribe({
      next: cams => {
        this.wallLoadedMs = Date.now();
        const byId = new Map(this.cameras.map(c => [c.cameraId, c]));
        this.cameras = cams.map(c => {
          const state: CameraState = byId.get(c.cameraId) ?? {
            cameraId: c.cameraId,
            lastSeenUtc: c.lastSeenUtc,
            imageUrl: c.imageUrl,
            displayedSrc: null,
          };
          state.lastSeenUtc = c.lastSeenUtc;
          state.imageUrl = c.imageUrl;
          state.displayedSrc = `${c.imageUrl}?t=${Date.now()}`;
          return state;
        });
      },
      error: () => { /* transient — keep showing the last good frames */ },
    });
  }

  // ── archive viewer ────────────────────────────────────────────────

  openViewer(cam: CameraState): void {
    if (!this.selectedPc) return;
    this.viewerCamera = cam.cameraId;
    this.days = [];
    this.frames = [];
    this.selectedDay = null;
    this.frameIndex = 0;
    this.loadingDays = true;
    this.http.get<ArchiveDay[]>(`/api/frames/${this.selectedPc}/${cam.cameraId}/days`).subscribe({
      next: days => {
        this.days = days;
        this.loadingDays = false;
        if (days.length > 0) this.selectDay(days[0].day); // newest day first
      },
      error: () => { this.loadingDays = false; },
    });
  }

  closeViewer(): void {
    this.viewerCamera = null;
    this.days = [];
    this.frames = [];
    this.selectedDay = null;
    this.frameIndex = 0;
  }

  selectDay(day: string): void {
    if (!this.selectedPc || !this.viewerCamera) return;
    this.selectedDay = day;
    this.frames = [];
    this.frameIndex = 0;
    this.loadingFrames = true;
    this.http.get<ArchiveFrame[]>(`/api/frames/${this.selectedPc}/${this.viewerCamera}/days/${day}`).subscribe({
      next: frames => {
        this.frames = frames;
        this.frameIndex = frames.length > 0 ? frames.length - 1 : 0; // jump to latest frame of the day
        this.loadingFrames = false;
      },
      error: () => { this.loadingFrames = false; },
    });
  }

  get currentFrame(): ArchiveFrame | null {
    return this.frames[this.frameIndex] ?? null;
  }

  prevFrame(): void {
    if (this.frameIndex > 0) this.frameIndex--;
  }

  nextFrame(): void {
    if (this.frameIndex < this.frames.length - 1) this.frameIndex++;
  }

  onScrub(event: Event): void {
    const value = +(event.target as HTMLInputElement).value;
    if (!Number.isNaN(value)) this.frameIndex = value;
  }

  // ── admin storage panel ───────────────────────────────────────────

  // Probe once: a 200 means the caller is an admin → expose the storage button.
  // 401/403 (regular users) silently leaves the panel hidden.
  private probeStorage(): void {
    this.http.get<StorageInfo>('/api/frames/storage').subscribe({
      next: info => {
        this.storageAvailable = true;
        this.storage = info;
      },
      error: () => { this.storageAvailable = false; },
    });
  }

  openStorage(): void {
    this.storageOpen = true;
    this.cleanupNote = null;
    this.loadStorage();
  }

  closeStorage(): void {
    this.storageOpen = false;
  }

  loadStorage(): void {
    this.loadingStorage = true;
    this.http.get<StorageInfo>('/api/frames/storage').subscribe({
      next: info => {
        this.storage = info;
        this.loadingStorage = false;
      },
      error: () => { this.loadingStorage = false; },
    });
  }

  runCleanup(): void {
    if (this.cleaning) return;
    this.cleaning = true;
    this.cleanupNote = null;
    this.http.post<{ deletedFrames: number; freedBytes: number }>(
      '/api/frames/storage/cleanup', {},
    ).subscribe({
      next: res => {
        this.cleaning = false;
        this.cleanupNote = res.deletedFrames > 0
          ? `−${this.formatBytes(res.freedBytes)} · ${res.deletedFrames}`
          : 'ok';
        this.loadStorage();
      },
      error: () => {
        this.cleaning = false;
        this.cleanupNote = 'error';
      },
    });
  }

  // ── storage view helpers ──────────────────────────────────────────

  /** Bar/gauge fill, clamped so a brief overshoot past the limit never exceeds 100%. */
  get storagePct(): number {
    return Math.min(100, this.storage?.usedPct ?? 0);
  }

  /** Green under 75%, amber under 90%, red above — mirrors how full the quota is. */
  get storageColor(): string {
    const pct = this.storage?.usedPct ?? 0;
    if (pct >= 90) return '#f0584f';
    if (pct >= 75) return '#e0a106';
    return 'var(--accent)';
  }

  /** SVG ring geometry (r=52). */
  readonly gaugeCircumference = 2 * Math.PI * 52;
  get gaugeOffset(): number {
    return this.gaugeCircumference * (1 - this.storagePct / 100);
  }

  /** Retention shown in days past 48h, otherwise hours; null when not estimable yet. */
  get retention(): { value: string; unit: 'days' | 'hours' } | null {
    const h = this.storage?.retentionHours;
    if (h == null) return null;
    return h >= 48
      ? { value: (h / 24).toFixed(1), unit: 'days' }
      : { value: h.toFixed(1), unit: 'hours' };
  }

  formatBytes(bytes: number): string {
    if (!bytes || bytes <= 0) return '0 МБ';
    const gb = bytes / 1024 ** 3;
    if (gb >= 1) return `${gb.toFixed(1)} ГБ`;
    const mb = bytes / 1024 ** 2;
    return `${Math.max(1, Math.round(mb))} МБ`;
  }
}
