import { Component, signal } from '@angular/core';
import { AdminCard } from '../../../../api/models/menu-item';

@Component({
  selector: 'app-admin-dashboard',
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.scss',
  standalone: false,
})
export class AdminDashboardComponent {
  adminCards = signal<AdminCard[]>([
    {
      icon: 'assignment',
      title: 'Applications',
      description:
        'Review and approve pending requests from psychologists to join the platform.',
      buttonText: 'View Applications',
      route: '/admin/applications',
      iconBgClass: 'bg-[var(--color-sky)]/20',
      iconTextClass: 'text-[var(--color-primary)]',
    },
    {
      icon: 'category',
      title: 'Specializations',
      description:
        'Manage the list of expertises and topics (e.g., PTSD, Depression) used in the catalog.',
      buttonText: 'Manage Topics',
      route: '/admin/specializations',
      iconBgClass: 'bg-purple-100',
      iconTextClass: 'text-purple-600',
    },
    {
      icon: 'people',
      title: 'Users & Roles',
      description:
        'View all registered clients and specialists, assign roles, and handle permissions.',
      buttonText: 'Manage Users',
      route: '/admin/users',
      iconBgClass: 'bg-mint/20',
      iconTextClass: 'text-success',
    },
    {
      icon: 'insights',
      title: 'Analytics',
      description:
        'View platform statistics, user growth, and session metrics.',
      buttonText: 'View Stats',
      route: '/admin/analytics',
      iconBgClass: 'bg-orange-100',
      iconTextClass: 'text-orange-500',
    },
  ]);
}
