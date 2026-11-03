import { Routes } from '@angular/router';
import { permisoGuard } from '../core/guardas/permiso.guard';
import { PERMISOS } from '../core/sesion/permisos';

export default [
  {
    path: '',
    canActivate: [permisoGuard(PERMISOS.catalogoVer)],
    loadComponent: () => import('./paginas/catalogo/catalogo').then((m) => m.Catalogo),
  },
] satisfies Routes;
