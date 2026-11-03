import { Routes } from '@angular/router';
import { permisoGuard } from '../core/guardas/permiso.guard';
import { PERMISOS } from '../core/sesion/permisos';

export default [
  {
    path: '',
    canActivate: [permisoGuard(PERMISOS.cajaVer, PERMISOS.cajaCrear, PERMISOS.cajaEditar)],
    loadComponent: () => import('./paginas/caja/caja').then((m) => m.Caja),
  },
] satisfies Routes;
