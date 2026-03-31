import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-loading-spinner',
  standalone: false,
  templateUrl: './loading-spinner.component.html',
  styleUrl: './loading-spinner.component.scss'
})
export class LoadingSpinnerComponent {
  @Input() text: string = ''; 
  @Input() isOverlay: boolean = false;
}
