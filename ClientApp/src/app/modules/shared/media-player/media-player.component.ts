import {
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';

@Component({
  selector: 'app-media-player',
  standalone: false,
  templateUrl: './media-player.component.html',
  styleUrl: './media-player.component.scss',
})
export class MediaPlayerComponent implements OnInit, OnDestroy {
  @Input() media!: { url: string, type: 'image' | 'video' };
  @Input() downloadable: boolean = false;
  @Output() closeViewer = new EventEmitter<void>();

  ngOnInit() {
    document.body.style.overflow = 'hidden';
  }

  ngOnDestroy() {
    document.body.style.overflow = 'auto';
  }

  closeMedia() {
    this.closeViewer.emit();
  }
}
