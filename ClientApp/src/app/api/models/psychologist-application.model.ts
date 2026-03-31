import { SpecializationDto } from "./specialization.model";

export type ApplicationStatus = 'Pending' | 'Approved' | 'Rejected';

export interface CreatePsychologistApplicationDto {
  phone: string;
  education: string;
  experienceYears: number | null;
  specializations: string[];
  documents: File[];
}

export interface PsychologistApplicationResponseDto {
    id: string;
  userId: string;
  
  firstName: string;
  lastName: string;
  email: string;
  
  phone: string;
  education: string;
  experienceYears: number;
  specializations: SpecializationDto[];
  documentUrls: string[];
  
  status: ApplicationStatus;
  createdAt: string;
}