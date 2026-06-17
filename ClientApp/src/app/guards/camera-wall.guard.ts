import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { map } from 'rxjs';
import { FeaturesService } from '../api/services/features.service';

export const cameraWallGuard: CanActivateFn = () => {
  const features = inject(FeaturesService);
  const router = inject(Router);
  return features.getFeatures().pipe(
    map(f => {
      if (f.cameraWall) return true;
      router.navigate(['/']);
      return false;
    })
  );
};
