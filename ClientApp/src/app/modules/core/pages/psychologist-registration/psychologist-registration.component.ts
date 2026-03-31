import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CreatePsychologistApplicationDto } from '../../../../api/models/psychologist-application.model';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '../../../../api/services/auth.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SpecializationDto } from '../../../../api/models/specialization.model';
import { SpecializationService } from '../../../../api/services/specializations.service';

@Component({
  selector: 'app-psychologist-registration',
  standalone: false,
  templateUrl: './psychologist-registration.component.html',
  styleUrl: './psychologist-registration.component.scss',
})
export class PsychologistRegistrationComponent implements OnInit {
  currentStep = 1;
  totalSteps = 3;
  isLoading = false;
  applicationForm!: FormGroup;
  selectedFiles: { file: File; preview: string }[] = [];

  availableSpecializations: SpecializationDto[] = [];

  constructor(
    private router: Router,
    private fb: FormBuilder,
    private authService: AuthService,
    private snackBar: MatSnackBar,
    private specializationService: SpecializationService,
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.loadSpecializations();
  }

  loadSpecializations() {
    this.specializationService.getSpecializations().subscribe({
      next: (res) => {
        if (res.isSuccess && res.data) {
          this.availableSpecializations = res.data;
        }
      },
    });
  }

  initForm() {
    this.applicationForm = this.fb.group({
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', Validators.required],
      phone: ['', [Validators.required, Validators.pattern(/^\+?380\d{9}$/)]], // Проста валідація укр номера
      education: ['', Validators.required],
      experienceYears: [null, [Validators.required, Validators.min(0)]],
      specializations: [[] as string[], Validators.required],
      documents: [[] as File[], Validators.required],
    });
  }

  onFileSelected(event: any) {
    const input = event.target as HTMLInputElement;
    const files = input.files;

    if (files && files.length > 0) {
      const currentFormFiles =
        (this.applicationForm.get('documents')?.value as File[]) || [];
      const newFormFiles = [...currentFormFiles];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        if (file.size > 10 * 1024 * 1024) {
          this.snackBar.open(
            `File ${file.name} is too large. Max 10MB.`,
            'Close',
            { duration: 3000 },
          );
          continue;
        }

        newFormFiles.push(file);

        const reader = new FileReader();
        reader.onload = (e) => {
          this.selectedFiles.push({
            file: file,
            preview: e.target?.result as string,
          });
        };
        reader.readAsDataURL(file);
      }

      this.applicationForm.get('documents')?.setValue(newFormFiles);
      this.applicationForm.get('documents')?.markAsTouched();
    }
    input.value = '';
  }

  removeFile(index: number) {
    this.selectedFiles.splice(index, 1);

    const currentFormFiles = this.applicationForm.get('documents')
      ?.value as File[];
    currentFormFiles.splice(index, 1);
    this.applicationForm.get('documents')?.setValue(currentFormFiles);
  }

  nextStep() {
    const stepControls = this.getControlsForStep(this.currentStep);

    const isStepValid = stepControls.every((controlName) => {
      const control = this.applicationForm.get(controlName);
      return control?.valid !== false;
    });

    if (isStepValid) {
      if (this.currentStep < this.totalSteps) {
        this.currentStep++;
      }

      if (this.currentStep > this.totalSteps) {
        this.submitApplication();
      }
    } else {
      stepControls.forEach((controlName) => {
        this.applicationForm.get(controlName)?.markAsTouched();
      });

      this.snackBar.open(
        'Please fill in all required fields for this step.',
        'Close',
        {
          duration: 2000,
        },
      );
    }
  }

  prevStep() {
    if (this.currentStep > 1) this.currentStep--;
  }

  private getControlsForStep(step: number): string[] {
    switch (step) {
      case 1:
        return ['firstName', 'lastName', 'phone'];
      case 2:
        // return ['education', 'experienceYears', 'documents'];
        return ['education', 'experienceYears'];
      case 3:
        return ['specializations'];
      default:
        return [];
    }
  }

  toggleSpecialization(specId: string) {
    const currentSpecs = this.applicationForm.get('specializations')
      ?.value as string[];
    const index = currentSpecs.indexOf(specId);

    if (index > -1) {
      currentSpecs.splice(index, 1);
    } else {
      currentSpecs.push(specId);
    }

    this.applicationForm.get('specializations')?.setValue([...currentSpecs]);
  }

  submitApplication() {
    this.isLoading = true;
    this.authService
      .psychologistRegister(this.applicationForm.value)
      .subscribe({
        next: (res) => {
          this.isLoading = false;
          if (res.isSuccess == false) {
            this.snackBar.open(
              res.error ||
                'Failed to submit application. Please try again later.',
              'Close',
              {
                duration: 3000,
              },
            );
            return;
          }
          this.router.navigate(['/application-success']);
        },
        error: () => {
          this.isLoading = false;
          this.snackBar.open(
            'Failed to submit application. Please try again later.',
            'Close',
            {
              duration: 3000,
            },
          );
        },
      });
  }
}
