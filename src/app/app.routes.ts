import { Routes } from '@angular/router';
import { invitadoGuard, sesionGuard, soloConSesionGuard } from './core/guardas/permiso.guard';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [invitadoGuard],
    loadComponent: () => import('./seguridad/paginas/login/login').then((m) => m.Login),
  },
  {
    path: 'cambio-clave',
    canActivate: [soloConSesionGuard],
    loadComponent: () =>
      import('./seguridad/paginas/cambio-clave/cambio-clave').then((m) => m.CambioClave),
  },
  {
    path: '',
    canActivate: [sesionGuard],
    loadComponent: () => import('./layout/shell/shell').then((m) => m.Shell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'inicio' },
      {
        path: 'inicio',
        loadComponent: () => import('./layout/inicio/inicio').then((m) => m.Inicio),
      },
      {
        path: 'acceso-denegado',
        loadComponent: () =>
          import('./layout/acceso-denegado/acceso-denegado').then((m) => m.AccesoDenegado),
      },
      { path: 'agenda', loadChildren: () => import('./agenda/agenda.routes') },
      { path: 'ventas', loadChildren: () => import('./ventas/ventas.routes') },
      { path: 'caja', loadChildren: () => import('./caja/caja.routes') },
      { path: 'inventario', loadChildren: () => import('./inventario/inventario.routes') },
      { path: 'catalogo', loadChildren: () => import('./catalogo/catalogo.routes') },
      { path: 'sedes', loadChildren: () => import('./sedes/sedes.routes') },
      { path: 'seguridad', loadChildren: () => import('./seguridad/seguridad.routes') },
    ],
  },
  { path: '**', redirectTo: '' },
];
