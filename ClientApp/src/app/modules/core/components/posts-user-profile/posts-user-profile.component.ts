import { Component, Input, OnInit } from '@angular/core';
import { UserProfileDto } from '../../../../api/models/user';
import { PostResponseDto } from '../../../../api/models/post.model';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { PostsService } from '../../../../api/services/posts.service';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-posts-user-profile',
  standalone: false,
  templateUrl: './posts-user-profile.component.html',
  styleUrl: './posts-user-profile.component.scss',
})
export class PostsUserProfileComponent implements OnInit {
  posts: PostResponseDto[] = [];
  isLoading = true;
  isSubmitting = false;

  page = 1;
  pageSize = 10;
  hasMorePosts = true;

  postForm: FormGroup;
  selectedFiles: File[] = [];
  previewUrls: string[] = [];

  @Input() isOwnProfile!: boolean;
  @Input() user!: UserProfileDto;

  constructor(
    private fb: FormBuilder,
    private postsService: PostsService,
    private snackBar: MatSnackBar,
  ) {
    this.postForm = this.fb.group({
      content: ['', [Validators.required, Validators.maxLength(2000)]],
    });
  }

  ngOnInit(): void {
    this.loadPosts();
  }

  loadPosts(loadMore = false): void {
    if (!loadMore) {
      this.isLoading = true;
      this.page = 1;
    }

    this.postsService
      .getPosts(this.page, this.pageSize, this.user.id)
      .subscribe({
        next: (res) => {
          if (loadMore) {
            this.posts = [...this.posts, ...res.data];
          } else {
            this.posts = res.data;
          }

          this.hasMorePosts = res.data.length === this.pageSize;
          this.isLoading = false;
        },
        error: () => {
          this.isLoading = false;
          this.showError('Failed to load posts');
        },
      });
  }

  loadMore(): void {
    if (this.hasMorePosts && !this.isLoading) {
      this.page++;
      this.loadPosts(true);
    }
  }

  onFileSelected(event: any): void {
    const files: FileList = event.target.files;
    if (files) {
      Array.from(files).forEach((file) => {
        if (file.type.match(/image\/*/) && this.selectedFiles.length < 4) {
          this.selectedFiles.push(file);

          const reader = new FileReader();
          reader.onload = (e: any) => this.previewUrls.push(e.target.result);
          reader.readAsDataURL(file);
        }
      });
    }
    event.target.value = '';
  }

  removePreview(index: number): void {
    this.selectedFiles.splice(index, 1);
    this.previewUrls.splice(index, 1);
  }

  submitPost(): void {
    if (this.postForm.invalid && this.selectedFiles.length === 0) return;

    this.isSubmitting = true;
    const content = this.postForm.get('content')?.value;

    this.postsService
      .createPost({ content, mediaFiles: this.selectedFiles })
      .subscribe({
        next: (res) => {
          this.posts.unshift(res.data);
          this.postForm.reset();
          this.selectedFiles = [];
          this.previewUrls = [];
          this.isSubmitting = false;
          this.showSuccess('Post published!');
        },
        error: () => {
          this.isSubmitting = false;
          this.showError('Failed to publish post');
        },
      });
  }

  toggleLike(post: PostResponseDto): void {
    post.isLikedByMe = !post.isLikedByMe;
    post.likesCount += post.isLikedByMe ? 1 : -1;

    this.postsService.toggleLike(post.id).subscribe({
      error: () => {
        post.isLikedByMe = !post.isLikedByMe;
        post.likesCount += post.isLikedByMe ? 1 : -1;
        this.showError('Something went wrong');
      }
    });
  }

  private showSuccess(msg: string) {
    this.snackBar.open(msg, 'Close', {
      duration: 3000,
      panelClass: ['bg-green-600', 'text-white'],
    });
  }

  private showError(msg: string) {
    this.snackBar.open(msg, 'Close', {
      duration: 4000,
      panelClass: ['bg-red-600', 'text-white'],
    });
  }
}
