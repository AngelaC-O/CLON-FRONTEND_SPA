import { Routes } from '@angular/router';
import { permisoGuard } from '../core/guardas/permiso.guard';
import { PERMISOS } from '../core/sesion/permisos';

export default [
  {
    path: 'cobros',
    canActivate: [permisoGuard(PERMISOS.ventasCrear)],
    loadComponent: () => import('./paginas/cobros/cobros').then((m) => m.Cobros),
  },
  {
    path: 'productos',
    canActivate: [permisoGuard(PERMISOS.ventasCrear)],
    loadComponent: () =>
      import('./paginas/venta-productos/venta-productos').then((m) => m.VentaProductos),
  },
  {
    path: 'anulaciones',
    canActivate: [permisoGuard(PERMISOS.ventasAnular, PERMISOS.ventasEditar)],
    loadComponent: () => import('./paginas/anulaciones/anulaciones').then((m) => m.Anulaciones),
  },
  {
    path: 'sin-cita',
    canActivate: [permisoGuard(PERMISOS.ventasCrear)],
    loadComponent: () => import('./paginas/sin-cita/sin-cita').then((m) => m.SinCita),
  },
] satisfies Routes;
