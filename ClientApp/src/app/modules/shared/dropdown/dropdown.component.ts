import { Component, input, model, signal } from '@angular/core';
import { DropdownItem } from '../../../api/models/dropdown-item';

@Component({
  selector: 'app-dropdown',
  templateUrl: './dropdown.component.html',
  styleUrl: './dropdown.component.scss',
  standalone: false
})
export class DropdownComponent {
  items = input.required<DropdownItem[]>();
  icon = input<string | null>(null);
  placeholder = input<string>('Select');

  selected = model<DropdownItem | null>(null);

  isOpen = signal(false);

  toggle() {
    this.isOpen.update(v => !v);
  }

  select(item: DropdownItem) {
    this.selected.set(item);
    this.isOpen.set(false);
  }
}
