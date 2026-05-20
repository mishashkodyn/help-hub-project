export type UserCategoryApplicationStatus = 'Pending' | 'Approved' | 'Rejected';

export enum UserCategoryValue {
  Civilian = 0,
  Military = 1,
  Veteran = 2,
  IDP = 3,
}

export interface CreateUserCategoryApplicationDto {
  requestedCategory: UserCategoryValue;
  comment: string;
  documents: File[];
}

export interface ReviewUserCategoryApplicationDto {
  isApproved: boolean;
  rejectionReason?: string;
}

export interface UserCategoryApplicationResponseDto {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  profileImage: string;
  requestedCategory: UserCategoryValue;
  requestedCategoryName: string;
  comment: string;
  documentUrls: string[];
  status: UserCategoryApplicationStatus;
  createdAt: string;
  reviewedAt?: string;
  rejectionReason?: string;
}

export const USER_CATEGORY_OPTIONS: { value: UserCategoryValue; label: string; description: string }[] = [
  {
    value: UserCategoryValue.Military,
    label: 'Військовий',
    description: 'Чинний військовослужбовець Збройних Сил України.',
  },
  {
    value: UserCategoryValue.Veteran,
    label: 'Постраждалий від війни',
    description: 'Особа, яка постраждала внаслідок бойових дій або агресії.',
  },
  {
    value: UserCategoryValue.IDP,
    label: 'Переселенець',
    description: 'Внутрішньо переміщена особа.',
  },
];

export function userCategoryLabel(value: number | UserCategoryValue): string {
  switch (value) {
    case UserCategoryValue.Military:
      return 'Військовий';
    case UserCategoryValue.Veteran:
      return 'Постраждалий від війни';
    case UserCategoryValue.IDP:
      return 'Переселенець';
    default:
      return 'Цивільний';
  }
}
