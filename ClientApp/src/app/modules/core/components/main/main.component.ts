import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-main',
  templateUrl: './main.component.html',
  styleUrl: './main.component.scss',
  standalone: false,
})
export class MainComponent {
  constructor(private router: Router) {}

  navigateTo(path: string, queryParams?: { [key: string]: any }) {
    this.router.navigate([path], { queryParams });
  }
}
