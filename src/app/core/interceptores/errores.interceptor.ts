import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { mensajeDelProblema } from '../api/problema';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { SesionService } from '../sesion/sesion.service';

const URL_LOGIN = `${environment.apiBase}/auth/login`;

/**
 * Atiende los errores comunes del ProblemDetail y siempre deja pasar el error a quien llamó.
 * Los 400, 404 y 423 los muestra cada página junto al formulario que los causó.
 */
export const erroresInterceptor: HttpInterceptorFn = (req, next) => {
  const notificaciones = inject(NotificacionesService);
  const sesion = inject(SesionService);
  const router = inject(Router);

  return next(req).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse) {
        const { status } = error;
        if (status === 401 && req.url !== URL_LOGIN) {
          sesion.limpiar();
          notificaciones.mostrar(mensajeDelProblema(error, 'Inicie sesión para continuar.'));
          void router.navigateByUrl('/login');
        } else if (status === 403) {
          notificaciones.mostrar(
            mensajeDelProblema(error, 'No tiene permiso para esta operación.'),
            'error',
          );
        } else if (status === 409 || status === 422) {
          notificaciones.mostrar(
            mensajeDelProblema(error, 'No se pudo completar la operación.'),
            'error',
          );
        } else if (status === 0 || status >= 500) {
          notificaciones.mostrar(
            'No se pudo conectar con el servidor. Inténtelo de nuevo.',
            'error',
          );
        }
      }
      return throwError(() => error);
    }),
  );
};
