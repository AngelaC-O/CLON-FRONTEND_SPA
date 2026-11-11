import { Routes } from '@angular/router';
import { permisoGuard } from '../core/guardas/permiso.guard';
import { PERMISOS } from '../core/sesion/permisos';

export default [
  {
    path: '',
    pathMatch: 'full',
    canActivate: [permisoGuard(PERMISOS.productosVer, PERMISOS.kardexVer)],
    loadComponent: () => import('./paginas/inventario/inventario').then((m) => m.Inventario),
  },
  {
    path: 'kardex',
    canActivate: [permisoGuard(PERMISOS.kardexVer)],
    loadComponent: () => import('./paginas/kardex/kardex').then((m) => m.Kardex),
  },
] satisfies Routes;
