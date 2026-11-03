import { Routes } from '@angular/router';
import { permisoGuard } from '../core/guardas/permiso.guard';
import { PERMISOS } from '../core/sesion/permisos';

export default [
  {
    path: '',
    pathMatch: 'full',
    canActivate: [permisoGuard(PERMISOS.agendaVer)],
    loadComponent: () => import('./paginas/agenda/agenda').then((m) => m.Agenda),
  },
  {
    path: 'clientas',
    canActivate: [permisoGuard(PERMISOS.clientasVer)],
    loadComponent: () => import('./paginas/clientas/clientas').then((m) => m.Clientas),
  },
  {
    path: 'atencion',
    canActivate: [permisoGuard(PERMISOS.atencionCrear, PERMISOS.atencionEditar)],
    loadComponent: () => import('./paginas/atencion/atencion').then((m) => m.Atencion),
  },
] satisfies Routes;
