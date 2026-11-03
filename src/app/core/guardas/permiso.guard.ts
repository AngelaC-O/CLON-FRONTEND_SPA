import { inject } from '@angular/core';
import { Router, UrlTree } from '@angular/router';
import { SesionService } from '../sesion/sesion.service';

/** Exige sesión, clave al día y alguno de los permisos indicados. */
export const permisoGuard =
  (...permisos: string[]) =>
  (): boolean | UrlTree => {
    const sesion = inject(SesionService);
    const router = inject(Router);
    if (!sesion.autenticada()) {
      return router.parseUrl('/login');
    }
    if (sesion.debeCambiarClave()) {
      return router.parseUrl('/cambio-clave');
    }
    return sesion.tienePermiso(...permisos) || router.parseUrl('/acceso-denegado');
  };

export const sesionGuard = permisoGuard();

/** Para el cambio de clave: pide sesión, aunque la clave esté vencida. */
export const soloConSesionGuard = (): boolean | UrlTree =>
  inject(SesionService).autenticada() || inject(Router).parseUrl('/login');

/** Para el inicio de sesión: quien ya entró vuelve al inicio. */
export const invitadoGuard = (): boolean | UrlTree =>
  !inject(SesionService).autenticada() || inject(Router).parseUrl('/');
