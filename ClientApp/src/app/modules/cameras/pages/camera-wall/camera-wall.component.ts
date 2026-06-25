import { Component, OnDestroy, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';

interface PcInfo {
  pc: string;
  cameras: number;
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
  }

  ngOnDestroy(): void {
    if (this.clockTimer) clearInterval(this.clockTimer);
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
}
