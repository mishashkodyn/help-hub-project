export interface SpecializationDto {
  id: string;
  name: string;
}

export interface SpecializationAdminDto extends SpecializationDto {
  psychologistsCount: number;
  applicationsCount: number;
}

export interface CreateUpdateSpecializationDto {
  name: string;
}

export interface Specialization {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}