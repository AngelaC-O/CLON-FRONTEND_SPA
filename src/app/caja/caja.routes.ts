import { Routes } from '@angular/router';
import { permisoGuard } from '../core/guardas/permiso.guard';
import { PERMISOS } from '../core/sesion/permisos';

export default [
  {
    path: '',
    pathMatch: 'full',
    canActivate: [permisoGuard(PERMISOS.cajaVer)],
    loadComponent: () => import('./paginas/caja/caja').then((m) => m.Caja),
  },
  {
    path: 'revision',
    canActivate: [permisoGuard(PERMISOS.conciliacionVer)],
    loadComponent: () => import('./paginas/revision/revision-caja').then((m) => m.RevisionCaja),
  },
  {
    path: 'conciliacion',
    canActivate: [
      permisoGuard(
        PERMISOS.conciliacionVer,
        PERMISOS.conciliacionCrear,
        PERMISOS.conciliacionEditar,
      ),
    ],
    loadComponent: () =>
      import('./paginas/conciliacion/conciliacion').then((m) => m.ConciliacionMes),
  },
] satisfies Routes;
