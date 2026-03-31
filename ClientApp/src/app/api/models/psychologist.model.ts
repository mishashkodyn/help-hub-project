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
