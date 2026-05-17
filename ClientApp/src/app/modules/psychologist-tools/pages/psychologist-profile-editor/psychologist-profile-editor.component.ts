import { Location } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { Subject, finalize, forkJoin, takeUntil } from 'rxjs';
import { PsychologistService } from '../../../../api/services/psychologist.service';
import { SpecializationService } from '../../../../api/services/specializations.service';
import { SpecializationDto } from '../../../../api/models/specialization.model';
import {
  PsychologistResumeDto,
  UpdatePsychologistResumeDto,
} from '../../../../api/models/psychologist.model';
import { AuthService } from '../../../../api/services/auth.service';

@Component({
  selector: 'app-psychologist-profile-editor',
  standalone: false,
  templateUrl: './psychologist-profile-editor.component.html',
  styleUrl: './psychologist-profile-editor.component.scss',
})
export class PsychologistProfileEditorComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  form!: FormGroup;
  isLoading = true;
  isSaving = false;
  resume: PsychologistResumeDto | null = null;

  availableSpecializations: SpecializationDto[] = [];
  selectedSpecializationIds = new Set<string>();

  readonly sessionDurations = [30, 45, 50, 60, 90];

  private hadHistory = false;

  constructor(
    private fb: FormBuilder,
    private psychologistService: PsychologistService,
    private specializationService: SpecializationService,
    private snackBar: MatSnackBar,
    private router: Router,
    private location: Location,
    protected authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.hadHistory =
      typeof window !== 'undefined' && window.history.length > 1;
    this.initForm();
    this.loadData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initForm(): void {
    this.form = this.fb.group({
      bio: ['', [Validators.required, Validators.minLength(50), Validators.maxLength(4000)]],
      videoGreetingUrl: ['', [Validators.maxLength(500)]],
      pricePerSession: [0, [Validators.required, Validators.min(0)]],
      sessionDurationMinutes: [50, [Validators.required, Validators.min(15), Validators.max(240)]],
      education: ['', [Validators.required, Validators.maxLength(500)]],
      experienceYears: [0, [Validators.required, Validators.min(0), Validators.max(80)]],
      contactPhone: ['', [Validators.required, Validators.pattern(/^\+?\d[\d\s\-()]{6,30}$/)]],
      worksWithMilitary: [false],
      hasTraumaTraining: [false],
      offersFreeSessionsForMilitary: [false],
      discountForAffected: [0, [Validators.min(0), Validators.max(100)]],
      isPublished: [false],
    });
  }

  private loadData(): void {
    this.isLoading = true;
    forkJoin({
      resume: this.psychologistService.getMyResume(),
      specs: this.specializationService.getSpecializations(),
    })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.isLoading = false)),
      )
      .subscribe({
        next: ({ resume, specs }) => {
          this.resume = resume;
          this.availableSpecializations = specs?.data ?? [];
          this.selectedSpecializationIds = new Set(
            (resume.specializations ?? []).map((s) => s.id),
          );
          this.form.patchValue({
            bio: resume.bio ?? '',
            videoGreetingUrl: resume.videoGreetingUrl ?? '',
            pricePerSession: resume.pricePerSession ?? 0,
            sessionDurationMinutes: resume.sessionDurationMinutes || 50,
            education: resume.education ?? '',
            experienceYears: resume.experienceYears ?? 0,
            contactPhone: resume.contactPhone ?? '',
            worksWithMilitary: !!resume.worksWithMilitary,
            hasTraumaTraining: !!resume.hasTraumaTraining,
            offersFreeSessionsForMilitary: !!resume.offersFreeSessionsForMilitary,
            discountForAffected: resume.discountForAffected ?? 0,
            isPublished: !!resume.isPublished,
          });
        },
        error: (err) => {
          console.warn(err);
          this.snackBar.open(
            err?.error?.error || 'Could not load resume data.',
            'Close',
            { duration: 3000 },
          );
        },
      });
  }

  toggleSpecialization(id: string): void {
    if (this.selectedSpecializationIds.has(id)) {
      this.selectedSpecializationIds.delete(id);
    } else {
      this.selectedSpecializationIds.add(id);
    }
  }

  isSpecializationSelected(id: string): boolean {
    return this.selectedSpecializationIds.has(id);
  }

  selectedSpecializations(): SpecializationDto[] {
    if (this.availableSpecializations.length === 0) {
      return this.resume?.specializations ?? [];
    }
    return this.availableSpecializations.filter((s) =>
      this.selectedSpecializationIds.has(s.id),
    );
  }

  get canPublish(): boolean {
    const v = this.form?.value ?? {};
    return (
      !!v.bio &&
      v.bio.trim().length >= 50 &&
      !!v.education &&
      !!v.contactPhone &&
      v.pricePerSession > 0 &&
      v.sessionDurationMinutes > 0 &&
      this.selectedSpecializationIds.size > 0
    );
  }

  get completenessPercent(): number {
    const v = this.form?.value ?? {};
    const checks = [
      !!v.bio && v.bio.trim().length >= 50,
      !!v.education,
      !!v.contactPhone,
      v.pricePerSession > 0,
      v.sessionDurationMinutes > 0,
      v.experienceYears !== null && v.experienceYears !== undefined && v.experienceYears >= 0,
      this.selectedSpecializationIds.size > 0,
    ];
    const passed = checks.filter(Boolean).length;
    return Math.round((passed / checks.length) * 100);
  }

  togglePublish(): void {
    const current = this.form.get('isPublished')?.value;
    if (!current && !this.canPublish) {
      this.snackBar.open(
        'Fill in bio, education, contact phone, price and at least one specialization to publish.',
        'Close',
        { duration: 3500 },
      );
      return;
    }
    this.form.get('isPublished')?.setValue(!current);
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.snackBar.open('Please fix the highlighted fields.', 'Close', {
        duration: 3000,
      });
      return;
    }

    const wantsPublish = !!this.form.value.isPublished;
    if (wantsPublish && !this.canPublish) {
      this.snackBar.open(
        'Resume is incomplete — cannot publish to catalog yet.',
        'Close',
        { duration: 3500 },
      );
      this.form.get('isPublished')?.setValue(false);
      return;
    }

    const payload: UpdatePsychologistResumeDto = {
      ...this.form.value,
      bio: (this.form.value.bio ?? '').trim(),
      videoGreetingUrl: (this.form.value.videoGreetingUrl ?? '').trim(),
      education: (this.form.value.education ?? '').trim(),
      contactPhone: (this.form.value.contactPhone ?? '').trim(),
      specializationIds: Array.from(this.selectedSpecializationIds),
    };

    this.isSaving = true;
    this.psychologistService
      .updateMyResume(payload)
      .pipe(finalize(() => (this.isSaving = false)))
      .subscribe({
        next: (res) => {
          this.resume = res;
          this.form.get('isPublished')?.setValue(res.isPublished);
          this.snackBar.open(
            res.isPublished ? 'Saved and visible in catalog.' : 'Saved.',
            'Close',
            { duration: 2500 },
          );
          this.goBack();
        },
        error: (err) => {
          console.warn(err);
          this.snackBar.open(
            err?.error?.error || 'Failed to save resume.',
            'Close',
            { duration: 3500 },
          );
        },
      });
  }

  cancel(): void {
    this.goBack();
  }

  private goBack(): void {
    if (this.hadHistory) {
      this.location.back();
    } else {
      this.router.navigate(['/psychologist']);
    }
  }

  initials(): string {
    const u = this.authService.currentLoggedUser;
    const f = (u?.name?.[0] ?? '').toUpperCase();
    const l = (u?.surname?.[0] ?? '').toUpperCase();
    return `${f}${l}` || '?';
  }
}
