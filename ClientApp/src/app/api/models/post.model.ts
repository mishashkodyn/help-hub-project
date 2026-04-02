export interface PostResponseDto {
  id: string;
  content: string;
  mediaUrls: string[];
  createdAt: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl?: string;
  authorCategory: number;
  likesCount: number;
  commentsCount: number;
  isLikedByMe: boolean;
}

export interface CreatePostDto {
  content: string;
  mediaFiles?: File[];
}

export interface CommentResponseDto {
  id: string;
  text: string;
  createdAt: string;
  authorId: string;
  authorName: string;
}

export interface CreateCommentDto {
  text: string;
}