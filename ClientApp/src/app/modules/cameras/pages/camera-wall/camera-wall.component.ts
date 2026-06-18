import { Component, OnDestroy, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';

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
  fetching: boolean;
}

@Component({
  selector: 'app-camera-wall',
  standalone: false,
  templateUrl: './camera-wall.component.html',
  styleUrl: './camera-wall.component.scss',
})
export class CameraWallComponent implements OnInit, OnDestroy {
  cameras: CameraState[] = [];
  private intervalId: ReturnType<typeof setInterval> | null = null;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.tick();
    this.intervalId = setInterval(() => this.tick(), 1000);
  }

  ngOnDestroy(): void {
    if (this.intervalId !== null) clearInterval(this.intervalId);
  }

  isLive(cam: CameraState): boolean {
    if (!cam.lastSeenUtc) return false;
    return (Date.now() - new Date(cam.lastSeenUtc).getTime()) < 5000;
  }

  private tick(): void {
    this.http.get<CameraInfo[]>('/api/frames/latest').subscribe({
      next: frames => {
        // merge metadata without replacing objects (keeps displayedSrc stable)
        if (this.cameras.length === 0) {
          this.cameras = frames.map(f => ({
            cameraId: f.cameraId,
            lastSeenUtc: f.lastSeenUtc,
            imageUrl: f.imageUrl,
            displayedSrc: null,
            fetching: false,
          }));
        } else {
          for (const f of frames) {
            const existing = this.cameras.find(c => c.cameraId === f.cameraId);
            if (existing) {
              existing.lastSeenUtc = f.lastSeenUtc;
              existing.imageUrl = f.imageUrl;
            }
          }
        }
        this.refreshImages();
      },
      error: () => {
        if (this.cameras.length === 0) {
          this.cameras = ['cam-01', 'cam-02', 'cam-03', 'cam-04'].map(id => ({
            cameraId: id,
            lastSeenUtc: null,
            imageUrl: `/api/frames/${id}/image`,
            displayedSrc: null,
            fetching: false,
          }));
        }
      }
    });
  }

  private refreshImages(): void {
    for (const cam of this.cameras) {
      if (cam.fetching) continue; // skip if previous request still in flight
      cam.fetching = true;
      const url = `${cam.imageUrl}?t=${Date.now()}`;
      const img = new Image();
      img.onload = () => {
        cam.displayedSrc = url;
        cam.fetching = false;
      };
      img.onerror = () => {
        // keep displayedSrc unchanged — show last good frame
        cam.fetching = false;
      };
      img.src = url;
    }
  }
}
