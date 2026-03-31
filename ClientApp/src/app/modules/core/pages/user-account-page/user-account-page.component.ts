import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { UserProfileDto } from '../../../../api/models/user';
import { UsersService } from '../../../../api/services/users.service';
import { AuthService } from '../../../../api/services/auth.service';

@Component({
  selector: 'app-user-account-page',
  standalone: false,
  templateUrl: './user-account-page.component.html',
  styleUrl: './user-account-page.component.scss',
})
export class UserAccountPageComponent implements OnInit {
  user: UserProfileDto | null = null;
  isLoading: boolean = false;
  activeTab: 'about' | 'posts' | 'reviews' = 'about';

  constructor(
    private route: ActivatedRoute,
    private service: UsersService,
    private router: Router,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.isLoading = true;
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');

      if (!id) {
        this.isLoading = false;
        this.router.navigate(['/']);
        return;
      }

      this.service.getUser(id).subscribe({
        next: (res) => {
          this.user = res.data;
          this.isLoading = false;
        },
        error: (err) => {
          console.warn(err);
          this.isLoading = false;
        },
      });
    });
  }

  get isOwnProfile(): boolean {
    return this.user?.id === this.authService.currentLoggedUser?.id;
  }

  get isPsychologist(): boolean {
    return !!this.user?.roles?.includes('Psychologist');
  }

  get displayRoles(): string[] {
    if (!this.user?.roles || this.user.roles.length === 0) {
      return ['Client'];
    }

    const roles = this.user.roles;
    
    const hasHigherRole = roles.some(r => 
      r === 'Superadmin' || r === 'Admin' || r === 'Psychologist'
    );

    if (hasHigherRole) {
      return roles.filter(r => r !== 'User');
    }

    return ['Client'];
  }

  setTab(tab: 'about' | 'posts' | 'reviews') {
    this.activeTab = tab;
  }
}
