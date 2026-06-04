import { inject, Injectable } from '@angular/core';
import { TranslocoService } from '@ngneat/transloco';

export type AppLang = 'en' | 'ua';

const STORAGE_KEY = 'app-language';
const DEFAULT_LANG: AppLang = 'ua';

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private transloco = inject(TranslocoService);

  /** Reads the saved language, falling back to the default (Ukrainian). */
  getStoredLang(): AppLang {
    const saved = this.readStorage();
    return saved && this.transloco.isLang(saved) ? (saved as AppLang) : DEFAULT_LANG;
  }

  /** Applies the saved (or default) language as the active one. Called at app startup. */
  init(): void {
    this.transloco.setActiveLang(this.getStoredLang());
  }

  /** Switches the active language and persists the choice for the user. */
  setLang(lang: AppLang): void {
    this.transloco.setActiveLang(lang);
    this.writeStorage(lang);
  }

  getActiveLang(): AppLang {
    return this.transloco.getActiveLang() as AppLang;
  }

  private readStorage(): string | null {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  }

  private writeStorage(lang: AppLang): void {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* storage unavailable (private mode) — language just won't persist */
    }
  }
}
