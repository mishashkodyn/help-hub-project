import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonComponent } from './button/button.component';
import { TypingIndicatorComponent } from './typing-indicator/typing-indicator.component';
import { LogoutConfirmModalComponent } from './logout-confirm-modal/logout-confirm-modal.component';
import { MatDialogModule } from '@angular/material/dialog';
import { MatIcon } from "@angular/material/icon";
import { DropdownComponent } from './dropdown/dropdown.component';
import { LoadingSpinnerComponent } from './loading-spinner/loading-spinner.component';
import { ConfirmDialogModalComponent } from './confirm-dialog-modal/confirm-dialog-modal.component';
import { TranslocoModule } from '@ngneat/transloco';


@NgModule({
  declarations: [
    ButtonComponent,
    TypingIndicatorComponent,
    LogoutConfirmModalComponent,
    DropdownComponent,
    LoadingSpinnerComponent,
    ConfirmDialogModalComponent
  ],
  imports: [
    CommonModule,
    MatDialogModule,
    MatIcon,
    TranslocoModule
],
  exports: [
    ButtonComponent,
    TypingIndicatorComponent,
    LogoutConfirmModalComponent,
    DropdownComponent,
    LoadingSpinnerComponent,
    ConfirmDialogModalComponent
  ]
})
export class SharedModule { }
