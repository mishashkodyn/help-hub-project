import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../api/services/auth.service';
import { inject } from '@angular/core';

export const AuthGuard: CanActivateFn = (route, state) => {
  if (inject(AuthService).isLoggedIn()){
    return true;
  }

  inject(Router).navigate(['/login']);
  return false;
};
