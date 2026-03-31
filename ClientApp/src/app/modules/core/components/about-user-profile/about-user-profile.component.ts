import { Component, Input } from '@angular/core';
import { UserProfileDto } from '../../../../api/models/user';

@Component({
  selector: 'app-about-user-profile',
  standalone: false,
  templateUrl: './about-user-profile.component.html',
  styleUrl: './about-user-profile.component.scss',
})
export class AboutUserProfileComponent {
  user: UserProfileDto | null = null;

  @Input() set userInpt(value: UserProfileDto) {
    if (value) {
      this.user = value;
    }
  }
}
