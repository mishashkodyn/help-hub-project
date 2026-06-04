import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoModule } from '@ngneat/transloco';
import { PracticesListComponent } from './pages/practices-list/practices-list.component';
import { PracticeDetailComponent } from './pages/practice-detail/practice-detail.component';
import { BoxBreathingComponent } from './pages/box-breathing/box-breathing.component';
import { Breathing478Component } from './pages/breathing-478/breathing-478.component';
import { BellyBreathingComponent } from './pages/belly-breathing/belly-breathing.component';

@NgModule({
  declarations: [
    PracticesListComponent,
    PracticeDetailComponent,
    BoxBreathingComponent,
    Breathing478Component,
    BellyBreathingComponent,
  ],
  imports: [CommonModule, MatIconModule, TranslocoModule],
})
export class SelfHelpModule {}
