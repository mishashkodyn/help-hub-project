import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../api/services/auth.service';
import { inject } from '@angular/core';

export const loginGuard: CanActivateFn = (route, state) => {
  if(inject(AuthService).isLoggedIn()) {
    inject(Router).navigate(['/']);
    return false;
  }
  return true;
};
