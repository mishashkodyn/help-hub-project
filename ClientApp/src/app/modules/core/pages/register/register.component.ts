import { Component, OnDestroy, OnInit } from '@angular/core';
import { AuthService } from '../../../../api/services/auth.service';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiResponse } from '../../../../api/models/api-response';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ButtonComponent } from '../../../shared/button/button.component';

@Component({
  selector: 'app-register',
  standalone: false,
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
})
export class RegisterComponent implements OnInit {
  email!: string;
  password!: string;
  username!: string;
  name!: string;
  surname!: string;
  profilePicture: string = 'https://randomuser.me/api/portraits/lego/5.jpg';
  profileImage: File | null = null;
  gender: 'male' | 'female' = 'male';
  hide: boolean = true;
  anonymous: boolean = false;
  anonymousLogin: string | null = null;
  loginCopied: boolean = false;

  returnUrl: string = '/';

  constructor(
    public authService: AuthService,
    private snackBar: MatSnackBar,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      this.returnUrl = params['returnUrl'] || '/';
    });
  }

  togglePassword(event: MouseEvent) {
    this.hide = !this.hide;
    event.stopPropagation();
  }

  onFileSelected(event: any) {
    const file: File = event.target.files[0];
    if (file) {
      this.profileImage = file;
      
      const reader = new FileReader();
      reader.onload = (e) => {
        this.profilePicture = e.target!.result as string;
      };

      reader.readAsDataURL(file);
    }
  }

  toggleAnonymous() {
    this.anonymous = !this.anonymous;
  }

  register() {
    if (this.anonymous) {
      this.registerAnonymously();
      return;
    }

    this.authService.isLoading.set(true);
    let formData = new FormData();
    formData.append('email', this.email);
    formData.append('password', this.password);
    formData.append('name', this.name);
    formData.append('surname', this.surname);
    formData.append('profileImage', this.profileImage!);
    formData.append('gender', this.gender ?? 'male');

    this.authService.register(formData).subscribe({
      next: () => {
        this.authService.me().subscribe();
        
        this.snackBar.open('User registered successfully.', 'Close', {
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
        this.router.navigate([this.returnUrl]);
        this.authService.isLoading.set(false);
      },
    });
  }

  registerAnonymously() {
    this.authService.isLoading.set(true);

    this.authService.anonymousRegister(this.password).subscribe({
      next: () => {
        this.authService.me().subscribe({
          next: (res) => {
            const user = res.data;
            // The login is the auto-generated username, e.g. "User8347".
            this.anonymousLogin = `${user?.name ?? 'User'}${user?.surname ?? ''}`;
            this.authService.isLoading.set(false);
          },
          error: () => {
            this.anonymousLogin = `${this.name ?? 'User'}`;
            this.authService.isLoading.set(false);
          },
        });
      },
      error: (error: HttpErrorResponse) => {
        let err = error.error as ApiResponse<string>;
        this.snackBar.open(err.error, 'Close', {
          duration: 3000,
        });
        this.authService.isLoading.set(false);
      },
    });
  }

  copyLogin() {
    if (!this.anonymousLogin) return;
    navigator.clipboard?.writeText(this.anonymousLogin).then(() => {
      this.loginCopied = true;
      setTimeout(() => (this.loginCopied = false), 2000);
    });
  }

  continueAfterAnonymous() {
    this.router.navigate([this.returnUrl]);
  }

  continueWithGoogle() {
    this.snackBar.open('Temporarily unavailable.', 'Close', {
      duration: 3000,
    });
  }

  isPsychologistRegistration() {
    return this.returnUrl === '/psychologist-registration';
  }
}
