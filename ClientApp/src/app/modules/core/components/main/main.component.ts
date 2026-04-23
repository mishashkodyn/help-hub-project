import { AfterViewInit, Component } from '@angular/core';
import { Router } from '@angular/router';
import * as AOS from 'aos';

@Component({
  selector: 'app-main',
  templateUrl: './main.component.html',
  styleUrl: './main.component.scss',
  standalone: false,
})
export class MainComponent implements AfterViewInit {
  constructor(
    private router: Router
  ) {}

  ngAfterViewInit(): void {
    AOS.init({
      once: true,
      offset: 50,
      duration: 300,
      easing: 'ease-in-out-cubic',
    });
  }

  navigateTo(path: string, queryParams?: { [key: string]: any }) {
    this.router.navigate([path], { queryParams });
  }
}
