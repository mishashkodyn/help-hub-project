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
      icon: 'category',
      titleKey: 'admin.dashboard.specializations_title',
      descriptionKey: 'admin.dashboard.specializations_desc',
      buttonKey: 'admin.dashboard.specializations_btn',
      route: '/admin/specializations',
      iconBgClass: 'bg-purple-100',
      iconTextClass: 'text-purple-600',
    },
    {
      icon: 'verified_user',
      titleKey: 'category_application.admin.dashboard_card_title',
      descriptionKey: 'category_application.admin.dashboard_card_desc',
      buttonKey: 'category_application.admin.dashboard_card_button',
      route: '/admin/category-applications',
      iconBgClass: 'bg-emerald-100',
      iconTextClass: 'text-emerald-600',
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
      icon: 'insights',
      titleKey: 'admin.dashboard.analytics_title',
      descriptionKey: 'admin.dashboard.analytics_desc',
      buttonKey: 'admin.dashboard.analytics_btn',
      route: '/admin/analytics',
      iconBgClass: 'bg-orange-100',
      iconTextClass: 'text-orange-500',
    },
  ]);
}
