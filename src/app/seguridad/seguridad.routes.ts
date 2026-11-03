import { Routes } from '@angular/router';
import { permisoGuard } from '../core/guardas/permiso.guard';
import { PERMISOS } from '../core/sesion/permisos';

export default [
  {
    path: 'usuarios',
    canActivate: [permisoGuard(PERMISOS.seguridadVer)],
    loadComponent: () => import('./paginas/usuarios/usuarios').then((m) => m.Usuarios),
  },
] satisfies Routes;
