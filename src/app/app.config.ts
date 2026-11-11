import { provideHttpClient, withInterceptors, withXsrfConfiguration } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { routes } from './app.routes';
import { credencialesInterceptor } from './core/interceptores/credenciales.interceptor';
import { erroresInterceptor } from './core/interceptores/errores.interceptor';
import { SesionService } from './core/sesion/sesion.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(
      withInterceptors([credencialesInterceptor, erroresInterceptor]),
      withXsrfConfiguration({ cookieName: 'XSRF-TOKEN', headerName: 'X-XSRF-TOKEN' }),
    ),
    // Antes de la primera navegación: GET /auth/sesion; sin sesión, las guardas llevan al login.
    provideAppInitializer(() => firstValueFrom(inject(SesionService).cargar())),
  ],
};
