import { Component, signal } from '@angular/core';

export interface AdminDashboardCard {
  icon: string;
  titleKey: string;
  descriptionKey: string;
  buttonKey: string;
  route: string;
  iconBgClass: string;
  iconTextClass: string;
}

@Component({
  selector: 'app-admin-dashboard',
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.scss',
  standalone: false,
})
export class AdminDashboardComponent {
  adminCards = signal<AdminDashboardCard[]>([
    {
      icon: 'assignment',
      titleKey: 'admin.dashboard.applications_title',
      descriptionKey: 'admin.dashboard.applications_desc',
      buttonKey: 'admin.dashboard.applications_btn',
      route: '/admin/applications',
      iconBgClass: 'bg-[var(--color-sky)]/20',
      iconTextClass: 'text-[var(--color-primary)]',
    },
    {
      icon: 'people',
      titleKey: 'admin.dashboard.users_title',
      descriptionKey: 'admin.dashboard.users_desc',
      buttonKey: 'admin.dashboard.users_btn',
      route: '/admin/users',
      iconBgClass: 'bg-mint/20',
      iconTextClass: 'text-success',
    },
    {
      icon: 'category',
      titleKey: 'admin.dashboard.specializations_title',
      descriptionKey: 'admin.dashboard.specializations_desc',
      buttonKey: 'admin.dashboard.specializations_btn',
      route: '/admin/specializations',
      iconBgClass: 'bg-purple-100',
      iconTextClass: 'text-purple-600',
    },
    {
      icon: 'payments',
      titleKey: 'admin.dashboard.payments_title',
      descriptionKey: 'admin.dashboard.payments_desc',
      buttonKey: 'admin.dashboard.payments_btn',
      route: '/admin/payments',
      iconBgClass: 'bg-green-50',
      iconTextClass: 'text-green-600',
    },
  ]);
}
