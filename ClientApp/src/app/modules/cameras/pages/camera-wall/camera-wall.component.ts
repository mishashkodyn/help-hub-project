import { Component, OnDestroy, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';

interface CameraFrame {
  cameraId: string;
  lastSeenUtc: string | null;
  imageUrl: string;
  error?: boolean;
}

@Component({
  selector: 'app-camera-wall',
  standalone: false,
  templateUrl: './camera-wall.component.html',
  styleUrl: './camera-wall.component.scss',
})
export class CameraWallComponent implements OnInit, OnDestroy {
  cameras: CameraFrame[] = [];
  private intervalId: ReturnType<typeof setInterval> | null = null;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.load();
    this.intervalId = setInterval(() => this.load(), 1000);
  }

  ngOnDestroy(): void {
    if (this.intervalId !== null) clearInterval(this.intervalId);
  }

  isLive(cam: CameraFrame): boolean {
    if (!cam.lastSeenUtc) return false;
    return (Date.now() - new Date(cam.lastSeenUtc).getTime()) < 5000;
  }

  imageUrl(cam: CameraFrame): string {
    return `${cam.imageUrl}?t=${Date.now()}`;
  }

  private load(): void {
    this.http.get<CameraFrame[]>('/api/frames/latest').subscribe({
      next: frames => {
        this.cameras = frames.map(f => ({ ...f, error: false }));
      },
      error: () => {
        // keep previous data if any, mark all as error only on first load
        if (this.cameras.length === 0) {
          this.cameras = ['cam-01', 'cam-02', 'cam-03', 'cam-04'].map(id => ({
            cameraId: id,
            lastSeenUtc: null,
            imageUrl: `/api/frames/${id}/image`,
            error: true,
          }));
        }
      }
    });
  }

  onImageError(cam: CameraFrame): void {
    cam.error = true;
  }

  onImageLoad(cam: CameraFrame): void {
    cam.error = false;
  }
}
