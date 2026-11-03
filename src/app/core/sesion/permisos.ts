/**
 * Códigos MODULO:ACCION que exige el back-end en sus @PreAuthorize.
 * docs/openapi.yaml solo trae tres de ejemplo (ver docs/NOTAS_IT1.md, Dudas).
 */
export const PERMISOS = {
  agendaCrear: 'AGENDA:CREAR',
  agendaEditar: 'AGENDA:EDITAR',
  agendaVer: 'AGENDA:VER',
  atencionCrear: 'ATENCION:CREAR',
  atencionEditar: 'ATENCION:EDITAR',
  cajaCrear: 'CAJA:CREAR',
  cajaEditar: 'CAJA:EDITAR',
  cajaVer: 'CAJA:VER',
  catalogoCrear: 'CATALOGO:CREAR',
  catalogoVer: 'CATALOGO:VER',
  clientasCrear: 'CLIENTAS:CREAR',
  clientasVer: 'CLIENTAS:VER',
  sedesCrear: 'SEDES:CREAR',
  seguridadCrear: 'SEGURIDAD:CREAR',
  seguridadEditar: 'SEGURIDAD:EDITAR',
  seguridadVer: 'SEGURIDAD:VER',
  ventasCrear: 'VENTAS:CREAR',
  ventasVer: 'VENTAS:VER',
} as const;
