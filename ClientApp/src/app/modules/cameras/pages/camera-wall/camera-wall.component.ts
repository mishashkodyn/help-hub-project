import { Component, OnDestroy, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TranslocoService } from '@ngneat/transloco';

/** One archive cleanup record reported by the backend (newest first). */
interface CleanupEvent {
  atUtc: string;
  deletedFrames: number;
  freedBytes: number;
  totalAfter: number;
  trigger: 'auto' | 'manual' | string;
}

/** Camera-wall store disk usage (GET /api/frames/storage). */
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

/** One AI-detected object on a frame, e.g. { label: 'person', confidence: 87 } (0-100 scale). */
interface DetectionInfo {
  label: string;
  confidence: number;
}

interface CameraFrame {
  imageUrl: string;
  timeUtc: string | null;
  brand: string | null;
  detections: DetectionInfo[];
}

/** A camera, identified by its IP (GET /api/frames/cameras). */
interface CameraInfo {
  ip: string;
  name: string | null;
  brand: string | null;
  lastSeenUtc: string | null;
  todayCount: number;
  totalCount: number;
  frames: CameraFrame[];
}

interface CameraState {
  ip: string;
  name: string | null;
  brand: string | null;
  lastSeenUtc: string | null;
  todayCount: number;
  totalCount: number;
  frames: CameraFrame[];
}

/** Lightweight payload for the live grid (GET /api/frames/live). */
interface LiveInfo {
  ip: string;
  name: string | null;
  brand: string | null;
  imageUrl: string | null;
  lastSeenUtc: string | null;
  detections: DetectionInfo[];
}

interface LiveCameraState {
  ip: string;
  name: string | null;
  brand: string | null;
  imageUrl: string | null;
  lastSeenUtc: string | null;
  detections: DetectionInfo[];
}

type ViewMode = 'cards' | 'live';

interface ArchiveDay {
  day: string;
  count: number;
}

interface ArchiveFrame {
  file: string;
  timeUtc: string | null;
  brand: string | null;
  imageUrl: string;
  detections: DetectionInfo[];
}

@Component({
  selector: 'app-camera-wall',
  standalone: false,
  templateUrl: './camera-wall.component.html',
  styleUrl: './camera-wall.component.scss',
})
export class CameraWallComponent implements OnInit, OnDestroy {
  cameras: CameraState[] = [];
  loadingCameras = false;

  // Two ways to look at the same cameras:
  //   'cards' → the rich card view (recent frames, counts)
  //   'live'  → a plain auto-refreshing grid of the latest frame per camera
  viewMode: ViewMode = 'cards';
  liveCameras: LiveCameraState[] = [];

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
  cleanupKeepDays = 7; // manual cleanup keeps frames from the last N days (0 = clear all)

  // archive viewer state (keyed by camera IP)
  viewerCamera: string | null = null;
  days: ArchiveDay[] = [];
  selectedDay: string | null = null;
  frames: ArchiveFrame[] = [];
  frameIndex = 0;
  loadingDays = false;
  loadingFrames = false;

  // The camera wall is operator-facing and always shown in English; the user's
  // app-wide language is saved here and restored when leaving the page.
  private prevLang: string | null = null;

  constructor(private http: HttpClient, private transloco: TranslocoService) {}

  ngOnInit(): void {
    this.prevLang = this.transloco.getActiveLang();
    this.transloco.setActiveLang('en');
    this.loadWall();
    this.tickClock();
    this.clockTimer = setInterval(() => this.tickClock(), 1000);
    this.startAutoRefresh();
    this.probeStorage();
  }

  ngOnDestroy(): void {
    if (this.clockTimer) clearInterval(this.clockTimer);
    this.stopAutoRefresh();
    // Restore the language the user had before opening the wall (not persisted,
    // so their saved choice elsewhere in the app is untouched).
    if (this.prevLang && this.prevLang !== this.transloco.getActiveLang()) {
      this.transloco.setActiveLang(this.prevLang);
    }
  }

  private tickClock(): void {
    this.clock = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  // A camera counts as LIVE if its last frame was fresh at the most recent wall load/refresh.
  isLive(cam: { lastSeenUtc: string | null }): boolean {
    if (!cam.lastSeenUtc) return false;
    return this.wallLoadedMs - Date.parse(cam.lastSeenUtc) < 30_000;
  }

  setViewMode(mode: ViewMode): void {
    if (this.viewMode === mode) return;
    this.viewMode = mode;
    this.loadWall();
  }

  refresh(): void {
    this.loadWall();
  }

  // ── wall (cameras + live grid) ────────────────────────────────────

  // Loads whichever view is active.
  private loadWall(): void {
    if (this.viewMode === 'cards') this.loadCards();
    else this.loadLive();
  }

  private loadCards(): void {
    this.cameras = [];
    this.loadingCameras = true;
    this.http.get<CameraInfo[]>('/api/frames/cameras').subscribe({
      next: cams => {
        this.wallLoadedMs = Date.now();
        this.cameras = cams.map(c => this.toState(c));
        this.loadingCameras = false;
      },
      error: () => { this.loadingCameras = false; },
    });
  }

  private loadLive(): void {
    this.liveCameras = [];
    this.loadingCameras = true;
    this.http.get<LiveInfo[]>('/api/frames/live').subscribe({
      next: cams => {
        this.wallLoadedMs = Date.now();
        this.liveCameras = cams.map(c => ({ ...c }));
        this.loadingCameras = false;
      },
      error: () => { this.loadingCameras = false; },
    });
  }

  private toState(c: CameraInfo): CameraState {
    return {
      ip: c.ip,
      name: c.name,
      brand: c.brand,
      lastSeenUtc: c.lastSeenUtc,
      todayCount: c.todayCount,
      totalCount: c.totalCount,
      frames: c.frames ?? [],
    };
  }

  // ── card view helpers ──────────────────────────────────────────────

  cameraTitle(cam: CameraState | LiveCameraState): string {
    return cam.name || cam.ip;
  }

  /** Newest frame for the big preview, or null when the camera has no frames yet. */
  mainFrame(cam: CameraState): CameraFrame | null {
    return cam.frames[0] ?? null;
  }

  /** Older frames shown as a thumbnail strip beside the main preview. */
  thumbFrames(cam: CameraState): CameraFrame[] {
    return cam.frames.slice(1);
  }

  // Maps a detection label to a Material icon; unrecognized labels fall back to a generic one.
  private static readonly DETECTION_ICONS: Record<string, string> = {
    person: 'person',
    dog: 'pets',
    cat: 'pets',
    bird: 'flutter_dash',
    car: 'directions_car',
    truck: 'local_shipping',
    bus: 'directions_bus',
    bicycle: 'directions_bike',
    motorcycle: 'two_wheeler',
  };

  detectionIcon(label: string): string {
    return CameraWallComponent.DETECTION_ICONS[label?.toLowerCase()] ?? 'category';
  }

  /** Confidence tier drives the badge color: high (≥70%), mid (≥35%), low otherwise. */
  detectionTier(confidence: number): 'high' | 'mid' | 'low' {
    if (confidence >= 70) return 'high';
    if (confidence >= 35) return 'mid';
    return 'low';
  }

  detectionPct(confidence: number): string {
    return `${Math.round(confidence * 10) / 10}%`;
  }

  /** Compact "time since last frame" badge, e.g. "3m", "5h", "1d 21h". */
  ageBadge(cam: CameraState): string {
    if (!cam.lastSeenUtc) return '—';
    const ms = Date.now() - Date.parse(cam.lastSeenUtc);
    if (ms < 60_000) return 'now';
    const mins = Math.floor(ms / 60_000);
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return remHours > 0 ? `${days}d ${remHours}h` : `${days}d`;
  }

  // ── live auto-refresh (in-place, keeps cell identity to avoid flicker) ──

  private startAutoRefresh(): void {
    this.stopAutoRefresh();
    if (!this.autoRefresh) return;
    this.refreshTimer = setInterval(() => this.refreshWall(), CameraWallComponent.REFRESH_MS);
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
    if (this.autoRefresh) this.refreshWall();
  }

  // Re-pull the active view in place (paused while the archive viewer is open).
  private refreshWall(): void {
    if (this.viewerCamera) return;
    if (this.viewMode === 'cards') this.refreshCards();
    else this.refreshLive();
  }

  // Merge fresh card data into existing cells so the <img> just swaps source instead of
  // the whole grid re-rendering. Frame URLs are immutable (unique file names), so reusing the
  // same CameraState object swaps the image only when a genuinely new frame lands.
  private refreshCards(): void {
    this.http.get<CameraInfo[]>('/api/frames/cameras').subscribe({
      next: cams => {
        this.wallLoadedMs = Date.now();
        const byIp = new Map(this.cameras.map(c => [c.ip, c]));
        this.cameras = cams.map(c => {
          const state = byIp.get(c.ip);
          if (!state) return this.toState(c);
          state.name = c.name;
          state.brand = c.brand;
          state.lastSeenUtc = c.lastSeenUtc;
          state.todayCount = c.todayCount;
          state.totalCount = c.totalCount;
          state.frames = c.frames ?? [];
          return state;
        });
      },
      error: () => { /* transient — keep showing the last good frames */ },
    });
  }

  // Same in-place merge for the live grid; lighter payload, just the newest frame per camera.
  private refreshLive(): void {
    this.http.get<LiveInfo[]>('/api/frames/live').subscribe({
      next: cams => {
        this.wallLoadedMs = Date.now();
        const byIp = new Map(this.liveCameras.map(c => [c.ip, c]));
        this.liveCameras = cams.map(c => {
          const state = byIp.get(c.ip);
          if (!state) return { ...c };
          state.name = c.name;
          state.brand = c.brand;
          state.imageUrl = c.imageUrl;
          state.lastSeenUtc = c.lastSeenUtc;
          return state;
        });
      },
      error: () => { /* transient — keep showing the last good frames */ },
    });
  }

  // ── archive viewer ────────────────────────────────────────────────

  openViewer(ip: string): void {
    this.viewerCamera = ip;
    this.days = [];
    this.frames = [];
    this.selectedDay = null;
    this.frameIndex = 0;
    this.loadingDays = true;
    this.http.get<ArchiveDay[]>(`/api/frames/${ip}/days`).subscribe({
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
    if (!this.viewerCamera) return;
    this.selectedDay = day;
    this.frames = [];
    this.frameIndex = 0;
    this.loadingFrames = true;
    this.http.get<ArchiveFrame[]>(`/api/frames/${this.viewerCamera}/days/${day}`).subscribe({
      next: frames => {
        this.frames = frames;
        this.frameIndex = frames.length > 0 ? frames.length - 1 : 0; // jump to latest frame of the day
        this.loadingFrames = false;
      },
      error: () => { this.loadingFrames = false; },
    });
  }

  // Clear every frame of the camera currently open in the viewer. Admin-only, runs regardless of
  // free space, then drops the now-empty camera off the wall.
  clearingCamera = false;
  clearCamera(): void {
    if (!this.viewerCamera || this.clearingCamera) return;
    if (!confirm(this.transloco.translate('cameras.storage.confirm_clear_camera'))) return;
    const ip = this.viewerCamera;
    this.clearingCamera = true;
    this.http.post<{ deletedFrames: number; freedBytes: number }>(
      `/api/frames/${ip}/cleanup?keepDays=0`, {},
    ).subscribe({
      next: () => {
        this.clearingCamera = false;
        this.closeViewer();
        this.loadWall();
        if (this.storageAvailable) this.loadStorage();
      },
      error: () => { this.clearingCamera = false; },
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

  onKeepChange(event: Event): void {
    this.cleanupKeepDays = +(event.target as HTMLSelectElement).value;
  }

  runCleanup(): void {
    if (this.cleaning) return;
    // Clearing the whole archive is destructive — confirm first.
    if (this.cleanupKeepDays === 0 &&
        !confirm(this.transloco.translate('cameras.storage.confirm_clear_all'))) {
      return;
    }
    this.cleaning = true;
    this.cleanupNote = null;
    this.http.post<{ deletedFrames: number; freedBytes: number }>(
      `/api/frames/storage/cleanup?keepDays=${this.cleanupKeepDays}`, {},
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
