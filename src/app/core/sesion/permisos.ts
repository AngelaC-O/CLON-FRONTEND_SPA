import { CodigoPermiso, PERMISO_DE_OPERACION as OP } from '../api/permisos.generados';

/**
 * Permisos MODULO:ACCION que usan las guardas y el menú. Cada valor sale del x-permiso de una
 * operación de docs/openapi.yaml (core/api/permisos.generados.ts), no de una copia a mano: si el
 * contrato cambia el permiso de esa operación, `npm run modelos` lo cambia aquí.
 */
export const PERMISOS = {
  agendaCrear: OP.agendar,
  agendaEditar: OP.registrarAdelantoEfectivo,
  agendaVer: OP.consultarAgenda,
  atencionCrear: OP.iniciar,
  atencionEditar: OP.finalizar,
  atencionVer: OP.listarMiAgenda,
  cajaCrear: OP.abrir,
  cajaEditar: OP.cerrar_1,
  cajaVer: OP.obtenerAbierta,
  catalogoCrear: OP.registrarServicio,
  catalogoVer: OP.listarServicios,
  clientasCrear: OP.registrar_2,
  clientasVer: OP.buscar,
  sedesCrear: OP.registrarRecurso,
  sedesVer: OP.listarRecursos,
  seguridadCrear: OP.registrar,
  seguridadEditar: OP.asignarRol,
  seguridadVer: OP.listarUsuarios,
  ventasCrear: OP.registrarPagos,
  ventasVer: OP.obtenerVenta,
} as const satisfies Record<string, CodigoPermiso>;
