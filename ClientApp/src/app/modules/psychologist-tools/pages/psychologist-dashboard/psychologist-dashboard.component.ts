import { Component } from '@angular/core';
import { AuthService } from '../../../../api/services/auth.service';

@Component({
  selector: 'app-psychologist-dashboard',
  standalone: false,
  templateUrl: './psychologist-dashboard.component.html',
  styleUrl: './psychologist-dashboard.component.scss'
})
export class PsychologistDashboardComponent {
  constructor(protected authService: AuthService) {
  }
}
