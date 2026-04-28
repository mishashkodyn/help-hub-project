import { Component, effect, OnInit } from '@angular/core';
import { AuthService } from '../../../../api/services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-home-page-resolver',
  standalone: false,
  templateUrl: './home-page-resolver.component.html',
  styleUrl: './home-page-resolver.component.scss',
})
export class HomePageResolverComponent implements OnInit {
  constructor(
    private authService: AuthService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/home']);
      return;
    }

    this.authService.me().subscribe({
      next: () => {
        this.redirectUser();
      },
      error: () => {
        this.authService.logout();
      },
    });
  }

  private redirectUser() {
    if (this.authService.isAdmin || this.authService.isSuperAdmin) {
      this.router.navigate(['/admin']);
    } else if (this.authService.isPsychologist) {
      this.router.navigate(['/psychologist']);
    } else {
      this.router.navigate(['/catalog']);
    }
  }
}
