import { Component, OnInit } from '@angular/core';
import { finalize } from 'rxjs';
import { PsychologistBalanceDto } from '../../../../api/models/session.model';
import { PsychologistService } from '../../../../api/services/psychologist.service';

@Component({
  selector: 'app-psychologist-finances',
  standalone: false,
  templateUrl: './psychologist-finances.component.html',
  styleUrl: './psychologist-finances.component.scss',
})
export class PsychologistFinancesComponent implements OnInit {
  data: PsychologistBalanceDto | null = null;
  isLoading = true;

  constructor(private psychologistService: PsychologistService) {}

  ngOnInit(): void {
    this.psychologistService.getMyBalance()
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (res) => (this.data = res),
        error: (err) => console.error('Failed to load balance', err),
      });
  }

  formatDate(iso: string): string {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('uk-UA', {
      day: 'numeric', month: 'short', year: 'numeric'
    });
  }

  paymentStatusLabel(status: string): string {
    switch (status) {
      case 'ReleasedToPsychologist': return 'Зараховано';
      case 'Confirmed': return 'Підтверджено (очікує виплати)';
      case 'Free': return 'Безкоштовно';
      default: return status;
    }
  }

  paymentStatusClass(status: string): string {
    switch (status) {
      case 'ReleasedToPsychologist': return 'bg-green-100 text-green-700';
      case 'Confirmed': return 'bg-blue-100 text-blue-700';
      case 'Free': return 'bg-purple-100 text-purple-700';
      default: return 'bg-gray-100 text-gray-600';
    }
  }
}
