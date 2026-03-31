import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SharedModule } from '../shared/shared.module';
import { LoginComponent } from './pages/login/login.component';
import { RegisterComponent } from './pages/register/register.component';
import {
  RouterLink,
  RouterModule,
  RouterOutlet,
  RouterLinkActive,
} from '@angular/router';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { LayoutComponent } from './layouts/layout/layout.component';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { HomePageComponent } from './pages/home-page/home-page.component';
import { UsersPageComponent } from '../admin-tools/pages/users-page/users-page.component';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { UserAccountPageComponent } from './pages/user-account-page/user-account-page.component';
import { SettingsPageComponent } from './pages/settings-page/settings-page.component';
import { EditAccountPageComponent } from './pages/edit-account-page/edit-account-page.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { HeaderComponent } from './components/header/header.component';
import { MainComponent } from './components/main/main.component';
import { PsychologistRegistrationComponent } from './pages/psychologist-registration/psychologist-registration.component';
import { ApplicationSuccessComponent } from './pages/application-success/application-success.component';
import { HomePageResolverComponent } from './components/home-page-resolver/home-page-resolver.component';
import { NotificationsPageComponent } from './pages/notifications-page/notifications-page.component';
import { NotificationsPopupComponent } from './components/notifications-popup/notifications-popup.component';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { AboutUserProfileComponent } from './components/about-user-profile/about-user-profile.component';
import { PostsUserProfileComponent } from './components/posts-user-profile/posts-user-profile.component';
import { ReviewsUserProfileComponent } from './components/reviews-user-profile/reviews-user-profile.component';

@NgModule({
  declarations: [
    LoginComponent,
    RegisterComponent,
    LayoutComponent,
    SidebarComponent,
    HomePageComponent,
    UserAccountPageComponent,
    SettingsPageComponent,
    EditAccountPageComponent,
    HeaderComponent,
    MainComponent,
    PsychologistRegistrationComponent,
    ApplicationSuccessComponent,
    HomePageResolverComponent,
    NotificationsPageComponent,
    NotificationsPopupComponent,
    AboutUserProfileComponent,
    PostsUserProfileComponent,
    ReviewsUserProfileComponent
  ],
  imports: [
    CommonModule,
    SharedModule,
    RouterLink,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    FormsModule,
    MatFormFieldModule,
    RouterOutlet,
    MatSidenavModule,
    MatListModule,
    RouterLinkActive,
    MatToolbarModule,
    MatTooltipModule,
    BrowserAnimationsModule,
    ReactiveFormsModule,
    MatProgressSpinner
  ],
})
export class CoreModule {}
