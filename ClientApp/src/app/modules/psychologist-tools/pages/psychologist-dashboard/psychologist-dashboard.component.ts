import { Component, signal } from '@angular/core';
import { AuthService } from '../../../../api/services/auth.service';
import { DashboardCardItem } from '../../../../api/models/menu-item';

@Component({
  selector: 'app-psychologist-dashboard',
  standalone: false,
  templateUrl: './psychologist-dashboard.component.html',
  styleUrl: './psychologist-dashboard.component.scss',
})
export class PsychologistDashboardComponent {
  psychologistCards = signal<DashboardCardItem[]>([
    {
      icon: 'calendar_month',
      title: 'My Schedule',
      description:
        'Set your weekly working hours and manage your availability.',
      buttonText: 'Manage Schedule',
      route: '/psychologist/calendar',
      iconBgClass: 'bg-[var(--color-sky)]/20',
      iconTextClass: 'text-[var(--color-primary)]',
    },
    {
      icon: 'videocam',
      title: 'Upcoming Sessions',
      description:
        'View scheduled appointments and join video calls with clients.',
      buttonText: 'View Sessions',
      route: '/psychologist/sessions',
      iconBgClass: 'bg-[var(--color-mint)]/20',
      iconTextClass: 'text-[var(--color-success)]',
    },
    {
      icon: 'groups',
      title: 'My Clients',
      description:
        'Access client profiles, session history, and private notes.',
      buttonText: 'Clients List',
      route: '/psychologist/clients',
      iconBgClass: 'bg-purple-500/10',
      iconTextClass: 'text-purple-600',
    },
    {
      icon: 'manage_accounts',
      title: 'Public Profile',
      description:
        'Update your bio, pricing, specializations, and video greeting.',
      buttonText: 'Edit Profile',
      route: '/psychologist/profile',
      iconBgClass: 'bg-orange-500/10',
      iconTextClass: 'text-orange-600',
    },
    {
      icon: 'account_balance_wallet',
      title: 'Earnings & Finances',
      description: 'Track your income, payments, and generated invoices.',
      buttonText: 'View Finances',
      route: '/psychologist/finances',
      iconBgClass: 'bg-emerald-500/10',
      iconTextClass: 'text-emerald-600',
    },
  ]);
  
  constructor(protected authService: AuthService) {}
}
