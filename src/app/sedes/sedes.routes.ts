import { Routes } from '@angular/router';
import { permisoGuard } from '../core/guardas/permiso.guard';
import { PERMISOS } from '../core/sesion/permisos';

export default [
  {
    path: 'recursos',
    canActivate: [permisoGuard(PERMISOS.sedesCrear)],
    loadComponent: () => import('./paginas/recursos/recursos').then((m) => m.Recursos),
  },
] satisfies Routes;
