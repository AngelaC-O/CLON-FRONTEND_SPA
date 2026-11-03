import { PERMISOS } from '../core/sesion/permisos';

export interface ItemMenu {
  ruta: string;
  etiqueta: string;
  corta: string;
  grupo: string;
  /** Trazo del ícono, tomado del NAV del prototipo. */
  icono: string;
  /** Basta con uno; los mismos que pide la guarda de la ruta. */
  permisos: string[];
}

export interface GrupoMenu {
  nombre: string;
  items: ItemMenu[];
}

/** Solo las fronteras IGU_ de la Iteración 1, con el orden y los íconos del prototipo. */
export const MENU: ItemMenu[] = [
  {
    ruta: '/inicio',
    etiqueta: 'Inicio',
    corta: 'Inicio',
    grupo: 'Recepción',
    icono: 'M3 11l9-8 9 8M5 10v10h14V10',
    permisos: [],
  },
  {
    ruta: '/agenda',
    etiqueta: 'Agenda',
    corta: 'Agenda',
    grupo: 'Recepción',
    icono: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
    permisos: [PERMISOS.agendaVer],
  },
  {
    ruta: '/agenda/clientas',
    etiqueta: 'Clientas',
    corta: 'Clientas',
    grupo: 'Recepción',
    icono:
      'M9 11a3 3 0 100-6 3 3 0 000 6zM3 20c0-3.5 3-6 6-6s6 2.5 6 6M17 8a3 3 0 010 6M21 20c0-2.5-1.5-4.5-4-5.2',
    permisos: [PERMISOS.clientasVer],
  },
  {
    ruta: '/ventas/sin-cita',
    etiqueta: 'Atención sin cita',
    corta: 'Sin cita',
    grupo: 'Recepción',
    icono: 'M13 2L4 14h7l-1 8 9-12h-7z',
    permisos: [PERMISOS.ventasCrear],
  },
  {
    ruta: '/ventas/cobros',
    etiqueta: 'Cobros y comprobantes',
    corta: 'Cobros',
    grupo: 'Recepción',
    icono: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6',
    permisos: [PERMISOS.ventasCrear],
  },
  {
    ruta: '/caja',
    etiqueta: 'Caja',
    corta: 'Caja',
    grupo: 'Recepción',
    icono: 'M3 7h18v12H3zM3 11h18M7 15h4',
    permisos: [PERMISOS.cajaVer, PERMISOS.cajaCrear, PERMISOS.cajaEditar],
  },
  {
    ruta: '/agenda/mi-agenda',
    etiqueta: 'Mi agenda',
    corta: 'Mi agenda',
    grupo: 'Especialista',
    icono: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
    permisos: [PERMISOS.atencionCrear, PERMISOS.atencionEditar],
  },
  {
    ruta: '/agenda/atencion',
    etiqueta: 'Atención en curso',
    corta: 'En curso',
    grupo: 'Especialista',
    icono: 'M8 5v14l11-7z',
    permisos: [PERMISOS.atencionCrear, PERMISOS.atencionEditar],
  },
  {
    ruta: '/catalogo',
    etiqueta: 'Catálogo y configuración',
    corta: 'Catálogo',
    grupo: 'Administración',
    icono: 'M3 12V3h9l9 9-9 9zM7.5 7.5h.01',
    permisos: [PERMISOS.catalogoVer],
  },
  {
    ruta: '/sedes/recursos',
    etiqueta: 'Recursos',
    corta: 'Recursos',
    grupo: 'Administración',
    icono: 'M12 21s-7-6-7-11a7 7 0 0114 0c0 5-7 11-7 11zM12 12a2 2 0 100-4 2 2 0 000 4z',
    permisos: [PERMISOS.sedesCrear],
  },
  {
    ruta: '/seguridad/usuarios',
    etiqueta: 'Usuarios y seguridad',
    corta: 'Usuarios',
    grupo: 'Administración',
    icono: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
    permisos: [PERMISOS.seguridadVer],
  },
];

export function agruparMenu(items: ItemMenu[]): GrupoMenu[] {
  const grupos: GrupoMenu[] = [];
  for (const item of items) {
    const grupo = grupos.find((g) => g.nombre === item.grupo);
    if (grupo) {
      grupo.items.push(item);
    } else {
      grupos.push({ nombre: item.grupo, items: [item] });
    }
  }
  return grupos;
}
