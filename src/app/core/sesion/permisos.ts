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
  clientasEditar: OP.actualizar,
  clientasVer: OP.buscar,
  kardexCrear: OP.registrarSalida,
  kardexVer: OP.consultarKardex,
  productosCrear: OP.registrar_1,
  productosVer: OP.listarCategorias,
  sedesCrear: OP.registrarRecurso,
  sedesVer: OP.listarRecursos,
  seguridadCrear: OP.registrar,
  seguridadEditar: OP.asignarRol,
  seguridadVer: OP.listarUsuarios,
  ventasAnular: OP.solicitarAnulacion,
  ventasCrear: OP.registrarPagos,
  ventasEditar: OP.aprobar,
  ventasVer: OP.obtenerVenta,
} as const satisfies Record<string, CodigoPermiso>;
