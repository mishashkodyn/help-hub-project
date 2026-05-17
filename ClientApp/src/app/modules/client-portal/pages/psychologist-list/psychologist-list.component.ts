import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import {
  Subject,
  debounceTime,
  distinctUntilChanged,
  finalize,
  takeUntil,
} from 'rxjs';
import { PsychologistService } from '../../../../api/services/psychologist.service';
import { SpecializationService } from '../../../../api/services/specializations.service';
import { SpecializationDto } from '../../../../api/models/specialization.model';
import {
  CatalogSort,
  PsychologistCatalogFilter,
  PsychologistCatalogItemDto,
  PsychologistCatalogPageDto,
} from '../../../../api/models/psychologist.model';

interface SortOption {
  value: CatalogSort;
  label: string;
}

@Component({
  selector: 'app-psychologist-list',
  standalone: false,
  templateUrl: './psychologist-list.component.html',
  styleUrl: './psychologist-list.component.scss',
})
export class PsychologistListComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  isLoading = true;
  isLoadingMore = false;

  page: PsychologistCatalogPageDto | null = null;
  items: PsychologistCatalogItemDto[] = [];

  searchControl = new FormControl<string>('', { nonNullable: true });

  availableSpecializations: SpecializationDto[] = [];
  selectedSpecializationIds = new Set<string>();

  readonly Array = Array;

  priceRange = { min: 0, max: 5000 };
  selectedMaxPrice: number | null = null;
  minExperience: number | null = null;

  worksWithMilitary = false;
  hasTraumaTraining = false;
  offersFreeSessionsForMilitary = false;

  isFiltersDrawerOpen = false;
  isSortOpen = false;

  expandedIds = new Set<string>();
  bookingTarget: PsychologistCatalogItemDto | null = null;

  readonly sortOptions: SortOption[] = [
    { value: 'recommended', label: 'Best match' },
    { value: 'experience_desc', label: 'Most experience' },
    { value: 'price_asc', label: 'Lowest price' },
    { value: 'price_desc', label: 'Highest price' },
    { value: 'experience_asc', label: 'New on platform' },
  ];
  currentSort: CatalogSort = 'recommended';

  readonly pageSize = 12;

  constructor(
    private psychologistService: PsychologistService,
    private specializationService: SpecializationService,
  ) {}

  ngOnInit(): void {
    this.loadSpecializations();
    this.loadCatalog(true);

    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(() => this.loadCatalog(true));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  @HostListener('document:keydown.escape')
  onEsc(): void {
    if (this.isSortOpen) this.isSortOpen = false;
    if (this.isFiltersDrawerOpen) this.isFiltersDrawerOpen = false;
  }

  private loadSpecializations(): void {
    this.specializationService.getSpecializations().subscribe({
      next: (res) => {
        if (res?.isSuccess && res.data) {
          this.availableSpecializations = res.data;
        }
      },
    });
  }

  private buildFilter(page: number): PsychologistCatalogFilter {
    return {
      search: this.searchControl.value?.trim() || undefined,
      specializationIds:
        this.selectedSpecializationIds.size > 0
          ? Array.from(this.selectedSpecializationIds)
          : undefined,
      maxPrice:
        this.selectedMaxPrice != null &&
        this.selectedMaxPrice < this.priceRange.max
          ? this.selectedMaxPrice
          : undefined,
      minExperience: this.minExperience ?? undefined,
      worksWithMilitary: this.worksWithMilitary || undefined,
      hasTraumaTraining: this.hasTraumaTraining || undefined,
      offersFreeSessionsForMilitary:
        this.offersFreeSessionsForMilitary || undefined,
      sort: this.currentSort,
      page,
      pageSize: this.pageSize,
    };
  }

  loadCatalog(reset: boolean): void {
    const targetPage = reset ? 1 : (this.page?.page ?? 0) + 1;

    if (reset) {
      this.isLoading = true;
    } else {
      this.isLoadingMore = true;
    }

    this.psychologistService
      .getCatalog(this.buildFilter(targetPage))
      .pipe(
        finalize(() => {
          this.isLoading = false;
          this.isLoadingMore = false;
        }),
      )
      .subscribe({
        next: (res) => {
          this.page = res;
          this.items = reset ? res.items : [...this.items, ...res.items];

          if (reset && res.maxPrice > 0) {
            this.priceRange = {
              min: Math.floor(res.minPrice),
              max: Math.ceil(res.maxPrice),
            };
            if (
              this.selectedMaxPrice == null ||
              this.selectedMaxPrice > this.priceRange.max
            ) {
              this.selectedMaxPrice = this.priceRange.max;
            }
          }
        },
        error: (err) => {
          console.warn(err);
        },
      });
  }

  get hasMore(): boolean {
    if (!this.page) return false;
    return this.items.length < this.page.total;
  }

  get activeFilterCount(): number {
    let n = 0;
    if (this.selectedSpecializationIds.size > 0) n++;
    if (
      this.selectedMaxPrice != null &&
      this.selectedMaxPrice < this.priceRange.max
    )
      n++;
    if (this.minExperience != null && this.minExperience > 0) n++;
    if (this.worksWithMilitary) n++;
    if (this.hasTraumaTraining) n++;
    if (this.offersFreeSessionsForMilitary) n++;
    return n;
  }

  toggleSpecialization(id: string): void {
    if (this.selectedSpecializationIds.has(id)) {
      this.selectedSpecializationIds.delete(id);
    } else {
      this.selectedSpecializationIds.add(id);
    }
    this.loadCatalog(true);
  }

  isSpecializationSelected(id: string): boolean {
    return this.selectedSpecializationIds.has(id);
  }

  specName(id: string): string {
    return this.availableSpecializations.find((s) => s.id === id)?.name ?? '';
  }

  onPriceChange(): void {
    this.loadCatalog(true);
  }

  onExperienceChange(value: number | null): void {
    this.minExperience = value;
    this.loadCatalog(true);
  }

  toggleFlag(
    field:
      | 'worksWithMilitary'
      | 'hasTraumaTraining'
      | 'offersFreeSessionsForMilitary',
  ): void {
    this[field] = !this[field];
    this.loadCatalog(true);
  }

  setSort(sort: CatalogSort): void {
    this.currentSort = sort;
    this.isSortOpen = false;
    this.loadCatalog(true);
  }

  get currentSortLabel(): string {
    return (
      this.sortOptions.find((s) => s.value === this.currentSort)?.label ?? 'Sort'
    );
  }

  resetFilters(): void {
    this.selectedSpecializationIds.clear();
    this.selectedMaxPrice = this.priceRange.max;
    this.minExperience = null;
    this.worksWithMilitary = false;
    this.hasTraumaTraining = false;
    this.offersFreeSessionsForMilitary = false;
    this.searchControl.setValue('');
    this.loadCatalog(true);
  }

  toggleExpand(id: string): void {
    if (this.expandedIds.has(id)) {
      this.expandedIds.delete(id);
    } else {
      this.expandedIds.add(id);
    }
  }

  isExpanded(id: string): boolean {
    return this.expandedIds.has(id);
  }

  needsTruncation(bio: string | undefined | null): boolean {
    if (!bio) return false;
    return bio.length > 220;
  }

  openBooking(item: PsychologistCatalogItemDto): void {
    this.bookingTarget = item;
  }

  closeBooking(): void {
    this.bookingTarget = null;
  }

  initials(item: PsychologistCatalogItemDto): string {
    const f = (item.firstName?.[0] ?? '').toUpperCase();
    const l = (item.lastName?.[0] ?? '').toUpperCase();
    return `${f}${l}` || '?';
  }
}
