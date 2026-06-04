import {
  provideTransloco,
  TranslocoModule
} from '@ngneat/transloco';
import { inject, NgModule, provideAppInitializer } from '@angular/core';
import { TranslocoHttpLoader } from './transloco-loader';
import { environment } from '../environments/environment';
import { LanguageService } from './api/services/language.service';

@NgModule({
  exports: [ TranslocoModule ],
  providers: [
      provideTransloco({
        config: {
          availableLangs: ['en', 'ua'],
          defaultLang: 'ua',
          fallbackLang: 'ua',
          // Remove this option if your application doesn't support changing language in runtime.
          reRenderOnLangChange: true,
          prodMode: environment.production,
        },
        loader: TranslocoHttpLoader
      }),
      // Apply the user's saved language (default: Ukrainian) before the app renders.
      provideAppInitializer(() => inject(LanguageService).init()),
  ],
})
export class TranslocoRootModule {}
