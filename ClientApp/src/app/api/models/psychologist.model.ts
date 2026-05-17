import { SpecializationDto } from './specialization.model';

export interface PsychologistProfileDto {
  id: string;
  userId: string;

  firstName: string;
  lastName: string;
  profileImage?: string;

  bio: string;
  videoGreetingUrl: string;
  pricePerSession: number;
  sessionDurationMinutes: number;
  isPublished: boolean;

  education: string;
  experienceYears: number;
  contactPhone: string;
  specializations: SpecializationDto[];

  worksWithMilitary: boolean;
  hasTraumaTraining: boolean;
  offersFreeSessionsForMilitary: boolean;
  discountForAffected: number;

  workingHours?: WorkingHourDto[];
}

export interface UpdatePsychologistProfileDto {
  bio: string;
  videoGreetingUrl: string;
  pricePerSession: number;
  sessionDurationMinutes: number;
  contactPhone: string;
  education: string;
  experienceYears: number;

  worksWithMilitary: boolean;
  hasTraumaTraining: boolean;
  offersFreeSessionsForMilitary: boolean;
  discountForAffected: number;

  specializationIds: string[];

  isPublished: boolean;
}

export interface TimeSlot {
  start: string;
  end: string;
}

export interface WeekDay {
  id: number;
  name: string;
  isActive: boolean;
  slots: TimeSlot[];
}

export interface TimeSlotDto {
  startTime: string;
  endTime: string;
}

export interface DayScheduleDto {
  dayOfWeek: number;
  slots: TimeSlotDto[];
}

export interface WorkingHourDto {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export interface PsychologistResumeDto {
  id: string;
  bio: string;
  videoGreetingUrl: string;
  pricePerSession: number;
  sessionDurationMinutes: number;
  education: string;
  experienceYears: number;
  contactPhone: string;
  worksWithMilitary: boolean;
  hasTraumaTraining: boolean;
  offersFreeSessionsForMilitary: boolean;
  discountForAffected: number;
  isPublished: boolean;
  specializations: SpecializationDto[];
}

export interface UpdatePsychologistResumeDto {
  bio: string;
  videoGreetingUrl: string;
  pricePerSession: number;
  sessionDurationMinutes: number;
  education: string;
  experienceYears: number;
  contactPhone: string;
  worksWithMilitary: boolean;
  hasTraumaTraining: boolean;
  offersFreeSessionsForMilitary: boolean;
  discountForAffected: number;
  isPublished: boolean;
  specializationIds: string[];
}

export interface PsychologistCatalogItemDto {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  profileImage?: string;
  bio: string;
  videoGreetingUrl: string;
  pricePerSession: number;
  sessionDurationMinutes: number;
  experienceYears: number;
  worksWithMilitary: boolean;
  hasTraumaTraining: boolean;
  offersFreeSessionsForMilitary: boolean;
  discountForAffected: number;
  specializations: SpecializationDto[];
}

export interface PsychologistCatalogPageDto {
  items: PsychologistCatalogItemDto[];
  total: number;
  page: number;
  pageSize: number;
  minPrice: number;
  maxPrice: number;
}

export type CatalogSort =
  | 'recommended'
  | 'price_asc'
  | 'price_desc'
  | 'experience_desc'
  | 'experience_asc';

export interface PsychologistCatalogFilter {
  search?: string;
  specializationIds?: string[];
  minPrice?: number | null;
  maxPrice?: number | null;
  minExperience?: number | null;
  worksWithMilitary?: boolean;
  hasTraumaTraining?: boolean;
  offersFreeSessionsForMilitary?: boolean;
  sort?: CatalogSort;
  page?: number;
  pageSize?: number;
}

export interface CreateAppointmentDto {
  psychologistId: string;
  date: string;
  startTime: string;
  clientNotes?: string;
}

export interface AppointmentApplicationDto {
  id: string;
  clientName: string;
  clientEmail: string;
  startTime: string;
  endTime: string;
  status: 'Pending' | 'Confirmed' | 'Completed' | 'Cancelled' | 'NoShow';
  price: number;
  clientNotes?: string;
}

export type FilterType = 'All' | 'Pending' | 'Confirmed' | 'Completed' | 'Cancelled';


