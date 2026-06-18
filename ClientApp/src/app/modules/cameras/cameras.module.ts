import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { CameraWallComponent } from './pages/camera-wall/camera-wall.component';

@NgModule({
  declarations: [CameraWallComponent],
  imports: [CommonModule, MatIconModule],
})
export class CamerasModule {}
