// Generado por scripts/permisos.mjs desde el x-permiso de docs/openapi.yaml.
// No editar a mano: se regenera con `npm run modelos`.

/** Permiso MODULO:ACCION de cada operación (SESION: basta la sesión; PUBLICO: sin sesión). */
export const PERMISO_DE_OPERACION = {
  /** POST /api/v1/cajas */
  abrir: 'CAJA:CREAR',
  /** PUT /api/v1/clientes/{idCliente} */
  actualizar: 'CLIENTAS:EDITAR',
  /** PUT /api/v1/servicios/{idServicio} */
  actualizarServicio: 'CATALOGO:EDITAR',
  /** POST /api/v1/citas */
  agendar: 'AGENDA:CREAR',
  /** PATCH /api/v1/ventas/{idVenta}/descuentos */
  aplicarDescuentos: 'VENTAS:CREAR',
  /** POST /api/v1/solicitudes-anulacion/{idSolicitud}/aprobacion */
  aprobar: 'VENTAS:EDITAR',
  /** PATCH /api/v1/cajas/{idCaja}/revision */
  aprobarCierre: 'CONCILIACION:EDITAR',
  /** POST /api/v1/proformas */
  armarProforma: 'VENTAS:CREAR',
  /** PATCH /api/v1/usuarios/{idUsuario}/rol */
  asignarRol: 'SEGURIDAD:EDITAR',
  /** GET /api/v1/clientes */
  buscar: 'CLIENTAS:VER',
  /** GET /api/v1/ventas/productos */
  buscarProductos: 'VENTAS:VER',
  /** GET /api/v1/atenciones/productos */
  buscarProductos_1: 'ATENCION:VER',
  /** GET /api/v1/cajas/{idCaja}/esperado */
  calcularEsperado: 'CAJA:VER',
  /** POST /api/v1/auth/cambio-clave */
  cambiarClave: 'SESION',
  /** PATCH /api/v1/servicios/{idServicio}/variantes/{idVariante}/precio */
  cambiarPrecio: 'CATALOGO:EDITAR',
  /** PATCH /api/v1/parametros/{codigo} */
  cambiarValor: 'SEGURIDAD:EDITAR',
  /** PATCH /api/v1/citas/{idCita}/cancelacion */
  cancelar: 'AGENDA:EDITAR',
  /** POST /api/v1/ventas/{idVenta}/cierre */
  cerrar: 'VENTAS:CREAR',
  /** POST /api/v1/cajas/{idCaja}/cierre */
  cerrar_1: 'CAJA:EDITAR',
  /** PATCH /api/v1/conciliaciones/{idConciliacion}/cierre */
  cerrar_2: 'CONCILIACION:EDITAR',
  /** POST /api/v1/auth/logout */
  cerrarSesion: 'SESION',
  /** POST /api/v1/conciliaciones */
  conciliar: 'CONCILIACION:CREAR',
  /** PATCH /api/v1/medios-pago/{idMedioPago} */
  configurarMedioPago: 'CATALOGO:EDITAR',
  /** PUT /api/v1/roles/{idRol}/permisos */
  configurarPermisos: 'SEGURIDAD:EDITAR',
  /** PATCH /api/v1/tipos-documento/{idTipoDocumento} */
  configurarTipoDocumento: 'SEGURIDAD:EDITAR',
  /** GET /api/v1/auditoria */
  consultar: 'SEGURIDAD:VER',
  /** GET /api/v1/citas/agenda */
  consultarAgenda: 'AGENDA:VER',
  /** GET /api/v1/citas/disponibilidad */
  consultarDisponibilidad: 'AGENDA:VER',
  /** GET /api/v1/clientes/consulta-documento */
  consultarDocumento: 'CLIENTAS:VER',
  /** GET /api/v1/productos/{idProducto}/kardex */
  consultarKardex: 'KARDEX:VER',
  /** GET /api/v1/ventas/consulta-ruc/{ruc} */
  consultarRuc: 'VENTAS:VER',
  /** POST /api/v1/ventas */
  crearDesdeAtencion: 'VENTAS:CREAR',
  /** PATCH /api/v1/consumos-pendientes/{idConsumo}/descarte */
  descartar: 'KARDEX:CREAR',
  /** PATCH /api/v1/citas/lista-espera/{idEspera}/descarte */
  descartarEspera: 'AGENDA:EDITAR',
  /** POST /api/v1/ventas/{idVenta}/devolucion */
  devolverPago: 'VENTAS:EDITAR',
  /** GET /api/v1/reportes/{tipoReporte}/exportacion */
  exportar: 'REPORTES:EXPORTAR',
  /** PATCH /api/v1/atenciones/{idAtencion}/fin */
  finalizar: 'ATENCION:EDITAR',
  /** GET /api/v1/reportes/{tipoReporte} */
  generar: 'REPORTES:VER',
  /** POST /api/v1/citas/{idCita}/enlace-adelanto */
  generarEnlaceAdelanto: 'AGENDA:EDITAR',
  /** POST /api/v1/conciliaciones/liquidacion */
  importarLiquidacion: 'CONCILIACION:CREAR',
  /** POST /api/v1/atenciones */
  iniciar: 'ATENCION:CREAR',
  /** POST /api/v1/auth/login */
  iniciarSesion: 'PUBLICO',
  /** PATCH /api/v1/conciliaciones/{idConciliacion}/items/{idItem} */
  justificarItem: 'CONCILIACION:EDITAR',
  /** GET /api/v1/ventas/rapidas/libres */
  libresAhora: 'VENTAS:VER',
  /** GET /api/v1/areas */
  listarAreas: 'CATALOGO:VER',
  /** GET /api/v1/avisos */
  listarAvisos: 'SESION',
  /** GET /api/v1/categorias-producto */
  listarCategorias: 'PRODUCTOS:VER',
  /** GET /api/v1/cajas/con-diferencia */
  listarConDiferencia: 'CONCILIACION:VER',
  /** GET /api/v1/consumos-pendientes */
  listarConsumosPendientes: 'KARDEX:VER',
  /** GET /api/v1/citas/lista-espera */
  listarEspera: 'AGENDA:VER',
  /** GET /api/v1/citas/filtros */
  listarFiltros: 'AGENDA:VER',
  /** GET /api/v1/medios-pago */
  listarMediosPago: 'VENTAS:VER',
  /** GET /api/v1/atenciones/mi-agenda */
  listarMiAgenda: 'ATENCION:VER',
  /** GET /api/v1/paquetes */
  listarPaquetes: 'CATALOGO:VER',
  /** GET /api/v1/parametros */
  listarParametros: 'SEGURIDAD:VER',
  /** GET /api/v1/solicitudes-anulacion */
  listarPendientes: 'VENTAS:EDITAR',
  /** GET /api/v1/permisos */
  listarPermisos: 'SEGURIDAD:VER',
  /** GET /api/v1/usuarios/personal-sin-usuario */
  listarPersonalSinUsuario: 'SEGURIDAD:VER',
  /** GET /api/v1/ventas/por-cobrar */
  listarPorCobrar: 'VENTAS:VER',
  /** GET /api/v1/productos */
  listarProductos: 'PRODUCTOS:VER',
  /** GET /api/v1/promociones */
  listarPromociones: 'CATALOGO:VER',
  /** GET /api/v1/recursos */
  listarRecursos: 'SEDES:VER',
  /** GET /api/v1/roles */
  listarRoles: 'SEGURIDAD:VER',
  /** GET /api/v1/series-comprobante */
  listarSeries: 'CATALOGO:VER',
  /** GET /api/v1/servicios */
  listarServicios: 'CATALOGO:VER',
  /** GET /api/v1/tipos-documento */
  listarTiposDocumento: 'SESION',
  /** GET /api/v1/usuarios */
  listarUsuarios: 'SEGURIDAD:VER',
  /** GET /api/v1/cajas/abierta */
  obtenerAbierta: 'CAJA:VER',
  /** GET /api/v1/comprobantes/{idComprobante} */
  obtenerComprobante: 'VENTAS:VER',
  /** GET /api/v1/cajas/del-dia */
  obtenerDelDia: 'CONCILIACION:VER',
  /** GET /api/v1/atenciones/en-curso */
  obtenerEnCurso: 'ATENCION:VER',
  /** GET /api/v1/comprobantes/{idComprobante}/enlace */
  obtenerEnlace: 'VENTAS:VER',
  /** GET /api/v1/clientes/{idCliente} */
  obtenerFicha: 'CLIENTAS:VER',
  /** GET /api/v1/comprobantes/publico/{idComprobante} */
  obtenerPublico: 'PUBLICO',
  /** GET /api/v1/comprobantes/{idComprobante}/representacion */
  obtenerRepresentacion: 'VENTAS:VER',
  /** GET /api/v1/auth/sesion */
  obtenerSesion: 'SESION',
  /** GET /api/v1/ventas/{idVenta} */
  obtenerVenta: 'VENTAS:VER',
  /** PATCH /api/v1/cajas/{idCaja}/reapertura */
  reabrir: 'CONCILIACION:EDITAR',
  /** POST /api/v1/solicitudes-anulacion/{idSolicitud}/rechazo */
  rechazar: 'VENTAS:EDITAR',
  /** POST /api/v1/pagos/notificaciones */
  recibir: 'PUBLICO',
  /** POST /api/v1/atenciones/{idAtencion}/recomendaciones */
  recomendarProducto: 'ATENCION:EDITAR',
  /** POST /api/v1/usuarios */
  registrar: 'SEGURIDAD:CREAR',
  /** POST /api/v1/productos */
  registrar_1: 'PRODUCTOS:CREAR',
  /** POST /api/v1/clientes */
  registrar_2: 'CLIENTAS:CREAR',
  /** POST /api/v1/citas/{idCita}/adelanto */
  registrarAdelantoEfectivo: 'AGENDA:EDITAR',
  /** POST /api/v1/productos/{idProducto}/ajustes */
  registrarAjuste: 'KARDEX:CREAR',
  /** POST /api/v1/areas */
  registrarArea: 'CATALOGO:CREAR',
  /** POST /api/v1/categorias-producto */
  registrarCategoria: 'PRODUCTOS:CREAR',
  /** POST /api/v1/ventas/{idVenta}/devolucion-manual */
  registrarDevolucionManual: 'VENTAS:EDITAR',
  /** POST /api/v1/citas/lista-espera */
  registrarEspera: 'AGENDA:CREAR',
  /** POST /api/v1/ventas/{idVenta}/pagos */
  registrarPagos: 'VENTAS:CREAR',
  /** POST /api/v1/paquetes */
  registrarPaquete: 'CATALOGO:CREAR',
  /** POST /api/v1/promociones */
  registrarPromocion: 'CATALOGO:CREAR',
  /** POST /api/v1/recursos */
  registrarRecurso: 'SEDES:CREAR',
  /** POST /api/v1/productos/{idProducto}/salidas */
  registrarSalida: 'KARDEX:CREAR',
  /** POST /api/v1/series-comprobante */
  registrarSerie: 'CATALOGO:CREAR',
  /** POST /api/v1/servicios */
  registrarServicio: 'CATALOGO:CREAR',
  /** POST /api/v1/ventas/rapidas */
  registrarYCobrar: 'VENTAS:CREAR',
  /** POST /api/v1/consumos-pendientes/{idConsumo}/regularizacion */
  regularizar: 'KARDEX:CREAR',
  /** POST /api/v1/citas/{idCita}/reprogramacion */
  reprogramar: 'AGENDA:EDITAR',
  /** PATCH /api/v1/usuarios/{idUsuario}/clave */
  restablecerClave: 'SEGURIDAD:EDITAR',
  /** POST /api/v1/ventas/{idVenta}/solicitudes-anulacion */
  solicitarAnulacion: 'VENTAS:ANULAR',
  /** POST /api/v1/ventas/productos */
  venderProductos: 'VENTAS:CREAR',
} as const;

/** Todos los códigos MODULO:ACCION que exige el contrato. */
export const CODIGOS_PERMISO = [
  'AGENDA:CREAR',
  'AGENDA:EDITAR',
  'AGENDA:VER',
  'ATENCION:CREAR',
  'ATENCION:EDITAR',
  'ATENCION:VER',
  'CAJA:CREAR',
  'CAJA:EDITAR',
  'CAJA:VER',
  'CATALOGO:CREAR',
  'CATALOGO:EDITAR',
  'CATALOGO:VER',
  'CLIENTAS:CREAR',
  'CLIENTAS:EDITAR',
  'CLIENTAS:VER',
  'CONCILIACION:CREAR',
  'CONCILIACION:EDITAR',
  'CONCILIACION:VER',
  'KARDEX:CREAR',
  'KARDEX:VER',
  'PRODUCTOS:CREAR',
  'PRODUCTOS:VER',
  'REPORTES:EXPORTAR',
  'REPORTES:VER',
  'SEDES:CREAR',
  'SEDES:VER',
  'SEGURIDAD:CREAR',
  'SEGURIDAD:EDITAR',
  'SEGURIDAD:VER',
  'VENTAS:ANULAR',
  'VENTAS:CREAR',
  'VENTAS:EDITAR',
  'VENTAS:VER',
] as const;

export type CodigoPermiso = (typeof CODIGOS_PERMISO)[number];
