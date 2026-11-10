import { Routes } from '@angular/router';
import { permisoGuard } from '../core/guardas/permiso.guard';
import { PERMISOS } from '../core/sesion/permisos';

export default [
  {
    path: '',
    canActivate: [permisoGuard(PERMISOS.reportesVer)],
    loadComponent: () => import('./paginas/reportes/reportes').then((m) => m.Reportes),
  },
] satisfies Routes;
