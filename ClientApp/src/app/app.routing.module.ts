import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { ChatComponent } from './modules/chat/pages/chat/chat.component';
import { LoginComponent } from './modules/core/pages/login/login.component';
import { RegisterComponent } from './modules/core/pages/register/register.component';

import { AuthGuard } from './guards/auth.guard';
import { loginGuard } from './guards/login.guard';
import { LayoutComponent } from './modules/core/layouts/layout/layout.component';
import { HomePageComponent } from './modules/core/pages/home-page/home-page.component';
import { UsersPageComponent } from './modules/admin-tools/pages/users-page/users-page.component';
import { UserAccountPageComponent } from './modules/core/pages/user-account-page/user-account-page.component';
import { SettingsPageComponent } from './modules/core/pages/settings-page/settings-page.component';
import { EditAccountPageComponent } from './modules/core/pages/edit-account-page/edit-account-page.component';
import { AiChatComponent } from './modules/ai/pages/ai-chat/ai-chat.component';
import { AdminDashboardComponent } from './modules/admin-tools/pages/admin-dashboard/admin-dashboard.component';
import { PsychologistRegistrationComponent } from './modules/core/pages/psychologist-registration/psychologist-registration.component';
import { ApplicationSuccessComponent } from './modules/core/pages/application-success/application-success.component';
import { ApplicationsPageComponent } from './modules/admin-tools/pages/applications-page/applications-page.component';
import { PsychologistListComponent } from './modules/client-portal/pages/psychologist-list/psychologist-list.component';
import { PsychologistDashboardComponent } from './modules/psychologist-tools/pages/psychologist-dashboard/psychologist-dashboard.component';
import { HomePageResolverComponent } from './modules/core/components/home-page-resolver/home-page-resolver.component';
import { NotificationsPageComponent } from './modules/core/pages/notifications-page/notifications-page.component';
import { ManageSpecializationsComponent } from './modules/admin-tools/pages/manage-specializations/manage-specializations.component';
import { PsychologistCalendarPageComponent } from './modules/psychologist-tools/pages/psychologist-calendar-page/psychologist-calendar-page.component';
import { PsychologistApplicationsComponent } from './modules/psychologist-tools/pages/psychologist-applications/psychologist-applications.component';
import { PsychologistSessionsComponent } from './modules/psychologist-tools/pages/psychologist-sessions/psychologist-sessions.component';
import { PsychologistPastSessionsComponent } from './modules/psychologist-tools/pages/psychologist-past-sessions/psychologist-past-sessions.component';
import { PsychologistProfileEditorComponent } from './modules/psychologist-tools/pages/psychologist-profile-editor/psychologist-profile-editor.component';
import { ClientSessionsComponent } from './modules/client-portal/pages/client-sessions/client-sessions.component';
import { SessionRoomComponent } from './modules/session/pages/session-room/session-room.component';
import { UserCategoryApplicationComponent } from './modules/core/pages/user-category-application/user-category-application.component';
import { AdminPaymentsComponent } from './modules/admin-tools/pages/admin-payments/admin-payments.component';
import { PsychologistFinancesComponent } from './modules/psychologist-tools/pages/psychologist-finances/psychologist-finances.component';
import { PracticesListComponent } from './modules/self-help/pages/practices-list/practices-list.component';
import { PracticeDetailComponent } from './modules/self-help/pages/practice-detail/practice-detail.component';
import { BoxBreathingComponent } from './modules/self-help/pages/box-breathing/box-breathing.component';
import { Breathing478Component } from './modules/self-help/pages/breathing-478/breathing-478.component';
import { BellyBreathingComponent } from './modules/self-help/pages/belly-breathing/belly-breathing.component';
import { Grounding54321Component } from './modules/self-help/pages/grounding-54321/grounding-54321.component';
import { BodyScanComponent } from './modules/self-help/pages/body-scan/body-scan.component';
import { ProgressiveMuscleComponent } from './modules/self-help/pages/progressive-muscle/progressive-muscle.component';

const routes: Routes = [
  {
    path: '',
    component: LayoutComponent,
    children: [
      { path: 'chat', canActivate: [AuthGuard], component: ChatComponent },
      { path: 'home', component: HomePageComponent, canActivate: [loginGuard] },
      { path: 'admin/users', canActivate: [AuthGuard], component: UsersPageComponent },
      { path: 'account/:id', canActivate: [AuthGuard], component: UserAccountPageComponent },
      { path: 'settings', canActivate: [AuthGuard], component: SettingsPageComponent },
      { path: 'edit-account', canActivate: [AuthGuard], component: EditAccountPageComponent },
      { path: 'admin', canActivate: [AuthGuard], component: AdminDashboardComponent },
      { path: 'ai-chat', canActivate: [AuthGuard], component: AiChatComponent},
      { path: 'admin/applications', canActivate: [AuthGuard], component: ApplicationsPageComponent },
      { path: 'admin/category-applications', redirectTo: 'admin/applications', pathMatch: 'full' },
      { path: 'admin/settings', redirectTo: 'admin/payments', pathMatch: 'full' },
      { path: 'admin/payments', canActivate: [AuthGuard], component: AdminPaymentsComponent },
      { path: 'psychologist/finances', canActivate: [AuthGuard], component: PsychologistFinancesComponent },
      { path: 'admin/specializations', canActivate: [AuthGuard], component: ManageSpecializationsComponent},
      { path: 'category-application', canActivate: [AuthGuard], component: UserCategoryApplicationComponent },
      { path: '', component: HomePageResolverComponent},
      {
        path: 'register',
        component: RegisterComponent,
        canActivate: [loginGuard],
      },
      {
        path: 'login',
        component: LoginComponent,
        canActivate: [loginGuard],
      },
      {
        path: 'psychologist-registration',
        component: PsychologistRegistrationComponent,
        canActivate: [AuthGuard],
      },
      {
        path: 'application-success',
        component: ApplicationSuccessComponent,
        canActivate: [AuthGuard],
      },
      {
        path: 'catalog',
        component: PsychologistListComponent,
        canActivate: [AuthGuard],
      },
      {
        path: 'psychologist',
        canActivate: [AuthGuard],
        component: PsychologistDashboardComponent
      },
      {
        path: 'psychologist/calendar',
        canActivate: [AuthGuard],
        component: PsychologistCalendarPageComponent
      },
      {
        path: 'psychologist/applications',
        canActivate: [AuthGuard],
        component: PsychologistApplicationsComponent
      },
      {
        path: 'psychologist/sessions',
        canActivate: [AuthGuard],
        component: PsychologistSessionsComponent
      },
      {
        path: 'psychologist/past-sessions',
        canActivate: [AuthGuard],
        component: PsychologistPastSessionsComponent
      },
      {
        path: 'psychologist/profile',
        canActivate: [AuthGuard],
        component: PsychologistProfileEditorComponent
      },
      {
        path: 'notifications',
        component: NotificationsPageComponent,
        canActivate: [AuthGuard],
      },
      {
        path: 'my-sessions',
        component: ClientSessionsComponent,
        canActivate: [AuthGuard],
      },
      {
        path: 'practices',
        component: PracticesListComponent,
        canActivate: [AuthGuard],
      },
      {
        path: 'practices/box-breathing',
        component: BoxBreathingComponent,
        canActivate: [AuthGuard],
      },
      {
        path: 'practices/breathing-478',
        component: Breathing478Component,
        canActivate: [AuthGuard],
      },
      {
        path: 'practices/belly-breathing',
        component: BellyBreathingComponent,
        canActivate: [AuthGuard],
      },
      {
        path: 'practices/grounding-54321',
        component: Grounding54321Component,
        canActivate: [AuthGuard],
      },
      {
        path: 'practices/body-scan',
        component: BodyScanComponent,
        canActivate: [AuthGuard],
      },
      {
        path: 'practices/progressive-muscle',
        component: ProgressiveMuscleComponent,
        canActivate: [AuthGuard],
      },
      {
        path: 'practices/:slug',
        component: PracticeDetailComponent,
        canActivate: [AuthGuard],
      },
      {
        path: 'session/:id',
        component: SessionRoomComponent,
        canActivate: [AuthGuard],
      },
    ],
  },
  {
    path: '**',
    redirectTo: '',
    pathMatch: 'full',
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
