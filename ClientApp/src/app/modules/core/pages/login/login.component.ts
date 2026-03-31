import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { ButtonComponent } from '../../../shared/button/button.component';
import { AuthService } from '../../../../api/services/auth.service';
import { ApiResponse } from '../../../../api/models/api-response';

@Component({
  selector: 'app-login',
  standalone: false,
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  email!: string;
  password!: string;

  hide: boolean = true;

  constructor(
    public authService: AuthService,
    private snackBar: MatSnackBar,
    private router: Router,
  ) {}

  login() {
    this.authService.isLoading.set(true);
    this.authService.login(this.email, this.password).subscribe({
      next: () => {
        this.authService.me().subscribe();
        this.snackBar.open('Logged in successfully.', 'Close', {
          duration: 3000,
        });
        this.authService.isLoading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        let err = error.error as ApiResponse<string>;

        this.snackBar.open(err.error, 'Close', {
          duration: 3000,
        });
        this.authService.isLoading.set(false);
      },
      complete: () => {
        this.router.navigate(['/']);
        this.authService.isLoading.set(false);
      },
    });
  }

  togglePassword(event: MouseEvent) {
    this.hide = !this.hide;
    event.stopPropagation();
  }

  forgotPassword() {
    this.snackBar.open('Temporarily unavailable.', 'Close', {
      duration: 3000,
    });
  }

  continueWithGoogle() {
    this.snackBar.open('Temporarily unavailable.', 'Close', {
      duration: 3000,
    });
  }
}
