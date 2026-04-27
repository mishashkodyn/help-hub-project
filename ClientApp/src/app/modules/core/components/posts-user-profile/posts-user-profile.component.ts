import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { UserProfileDto } from '../../../../api/models/user';
import { CommentResponseDto, PostResponseDto } from '../../../../api/models/post.model';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { PostsService } from '../../../../api/services/posts.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../../../../api/services/auth.service';

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

  expandedComments = new Set<string>();
  postComments: { [postId: string]: CommentResponseDto[] } = {};
  loadingComments: { [postId: string]: boolean } = {};
  commentInputs: { [postId: string]: string } = {};
  commentPage: { [postId: string]: number } = {};
  hasMoreComments: { [postId: string]: boolean } = {};

  @Input() isOwnProfile!: boolean;
  @Input() user!: UserProfileDto;
  @Output() mediaSelected = new EventEmitter<{ url: string, type: 'image' | 'video' }>();

  constructor(
    private fb: FormBuilder,
    private postsService: PostsService,
    private snackBar: MatSnackBar,
    public authService: AuthService
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

  openMedia(url: string, type: 'image' | 'video') {
    this.mediaSelected.emit({ url, type });
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
        const isImage = file.type.startsWith('image/');
        const isVideo = file.type.startsWith('video/');
        const isHeicOrRaw = file.name.match(/\.(heic|heif|raw|dng|cr2|nef)$/i) !== null;

        if ((isImage || isVideo || isHeicOrRaw) && this.selectedFiles.length < 4) {
          this.selectedFiles.push(file);

          if (isVideo) {
             const videoUrl = URL.createObjectURL(file);
             this.previewUrls.push(videoUrl);
          } 
          else if (isHeicOrRaw || (!isImage && !isVideo)) {
             this.previewUrls.push('UNSUPPORTED_PREVIEW_FORMAT');
          } 
          else {
            const reader = new FileReader();
            reader.onload = (e: any) => this.previewUrls.push(e.target.result);
            reader.readAsDataURL(file);
          }
        }
      });
    }
    event.target.value = '';
  }

  isPreviewVideo(index: number): boolean {
    if (this.selectedFiles[index]) {
      return this.selectedFiles[index].type.startsWith('video/');
    }
    return false;
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

  toggleComments(post: PostResponseDto): void {
    if (this.expandedComments.has(post.id)) {
      this.expandedComments.delete(post.id);
    } else {
      this.expandedComments.add(post.id);
      if (!this.postComments[post.id]) {
        this.loadComments(post.id);
      }
    }
  }

  loadComments(postId: string, loadMore = false): void {
    if (!loadMore) {
      this.loadingComments[postId] = true;
      this.commentPage[postId] = 1;
      this.postComments[postId] = [];
    } else {
      this.commentPage[postId]++;
    }

    this.postsService.getComments(postId, this.commentPage[postId], 10).subscribe({
      next: (res) => {
        this.postComments[postId] = loadMore 
          ? [...this.postComments[postId], ...res.data] 
          : res.data;
        
        this.hasMoreComments[postId] = res.data.length === 10;
        this.loadingComments[postId] = false;
      },
      error: () => {
        this.loadingComments[postId] = false;
        this.showError('Failed to load comments');
      }
    });
  }

  submitComment(post: PostResponseDto): void {
    const text = this.commentInputs[post.id]?.trim();
    if (!text) return;

    this.postsService.createComment(post.id, { text }).subscribe({
      next: (res) => {
        if (!this.postComments[post.id]) {
          this.postComments[post.id] = [];
        }
        this.postComments[post.id].unshift(res.data);
        post.commentsCount++;
        this.commentInputs[post.id] = '';
      },
      error: () => this.showError('Failed to post comment')
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

  isVideo(url: string): boolean {
    if (!url) return false;
    return url.match(/\.(mp4|webm|ogg|mov)$/i) !== null;
  }
}
