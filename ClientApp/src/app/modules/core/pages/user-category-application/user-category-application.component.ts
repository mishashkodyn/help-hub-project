import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { TranslocoService } from '@ngneat/transloco';
import {
  USER_CATEGORY_OPTIONS,
  UserCategoryApplicationResponseDto,
  UserCategoryValue,
} from '../../../../api/models/user-category-application.model';
import { UserCategoryApplicationService } from '../../../../api/services/user-category-application.service';
import { AuthService } from '../../../../api/services/auth.service';
import { UsersService } from '../../../../api/services/users.service';

@Component({
  selector: 'app-user-category-application',
  standalone: false,
  templateUrl: './user-category-application.component.html',
  styleUrl: './user-category-application.component.scss',
})
export class UserCategoryApplicationComponent implements OnInit {
  form!: FormGroup;
  options = USER_CATEGORY_OPTIONS;
  isLoading = false;
  isSubmitting = false;

  currentCategory: UserCategoryValue = UserCategoryValue.Civilian;
  latestApplication: UserCategoryApplicationResponseDto | null = null;

  selectedFiles: { file: File; name: string }[] = [];

  constructor(
    private fb: FormBuilder,
    private service: UserCategoryApplicationService,
    private authService: AuthService,
    private usersService: UsersService,
    private snackBar: MatSnackBar,
    private router: Router,
    private transloco: TranslocoService,
  ) {}

  categoryLabel(value: number | UserCategoryValue): string {
    switch (value) {
      case UserCategoryValue.Military:
        return this.transloco.translate('category_application.categories.military');
      case UserCategoryValue.Veteran:
        return this.transloco.translate('category_application.categories.veteran');
      case UserCategoryValue.IDP:
        return this.transloco.translate('category_application.categories.idp');
      default:
        return this.transloco.translate('profile.client');
    }
  }

  get isRoleBlocked(): boolean {
    return this.authService.isAdmin || this.authService.isSuperAdmin || this.authService.isPsychologist;
  }

  ngOnInit(): void {
    this.form = this.fb.group({
      requestedCategory: [null, Validators.required],
      comment: ['', [Validators.required, Validators.minLength(10)]],
      documents: [[] as File[]],
    });

    this.loadInitialState();
  }

  private loadInitialState() {
    if (this.isRoleBlocked) {
      this.isLoading = false;
      return;
    }

    this.isLoading = true;
    const userId = this.authService.currentLoggedUser?.id;
    if (!userId) {
      this.isLoading = false;
      return;
    }

    this.usersService.getUser(userId).subscribe({
      next: (res) => {
        if (res.isSuccess && res.data) {
          this.currentCategory = res.data.userCategory ?? UserCategoryValue.Civilian;
        }
        this.loadLatestApplication();
      },
      error: () => {
        this.loadLatestApplication();
      },
    });
  }

  private loadLatestApplication() {
    this.service.getMyApplication().subscribe({
      next: (res) => {
        this.latestApplication = res.data ?? null;
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      },
    });
  }

  get canSubmit(): boolean {
    if (this.isRoleBlocked) return false;
    if (this.currentCategory !== UserCategoryValue.Civilian) return false;
    if (this.latestApplication?.status === 'Pending') return false;
    return true;
  }

  get blockedReason(): string | null {
    if (this.isRoleBlocked) {
      return this.transloco.translate('category_application.not_allowed_role');
    }
    if (this.currentCategory !== UserCategoryValue.Civilian) {
      return this.transloco.translate('category_application.already_approved', {
        category: this.categoryLabel(this.currentCategory),
      });
    }
    if (this.latestApplication?.status === 'Pending') {
      return this.transloco.translate('category_application.already_pending');
    }
    return null;
  }

  selectCategory(value: UserCategoryValue) {
    this.form.get('requestedCategory')?.setValue(value);
    this.form.get('requestedCategory')?.markAsTouched();
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (!files || files.length === 0) return;

    const current = (this.form.get('documents')?.value as File[]) || [];
    const next = [...current];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > 10 * 1024 * 1024) {
        this.snackBar.open(
          this.transloco.translate('category_application.file_too_large', {
            name: file.name,
          }),
          'OK',
          { duration: 3000 },
        );
        continue;
      }
      next.push(file);
      this.selectedFiles.push({ file, name: file.name });
    }

    this.form.get('documents')?.setValue(next);
    input.value = '';
  }

  removeFile(index: number) {
    this.selectedFiles.splice(index, 1);
    const current = (this.form.get('documents')?.value as File[]) || [];
    current.splice(index, 1);
    this.form.get('documents')?.setValue(current);
  }

  submit() {
    if (!this.canSubmit) return;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.snackBar.open(
        this.transloco.translate('category_application.fill_required'),
        'OK',
        { duration: 3000 },
      );
      return;
    }

    this.isSubmitting = true;
    const value = this.form.value;

    this.service
      .submit({
        requestedCategory: value.requestedCategory,
        comment: value.comment,
        documents: value.documents || [],
      })
      .subscribe({
        next: (res) => {
          this.isSubmitting = false;
          if (!res.isSuccess) {
            this.snackBar.open(
              res.error || this.transloco.translate('category_application.submit_failed'),
              'OK',
              { duration: 4000 },
            );
            return;
          }
          this.latestApplication = res.data;
          this.snackBar.open(
            this.transloco.translate('category_application.success_submitted'),
            'OK',
            { duration: 3000 },
          );
        },
        error: (err) => {
          this.isSubmitting = false;
          const message =
            err?.error?.error ||
            this.transloco.translate('category_application.submit_failed');
          this.snackBar.open(message, 'OK', { duration: 4000 });
        },
      });
  }

  goBack() {
    this.router.navigate(['/home']);
  }
}
