# Notas de la Iteración 2 · Front-end

`docs/NOTAS_IT1.md` queda como historia: aquí se dice qué Dudas de entonces cierra el contrato nuevo.

## Estado

Primera entrega de la Iteración 2 (rama `tineo-feature/f5-base-modificados`): la base común y las páginas «modificado It. 2». Los CUS nuevos de la tabla de alcance (CUS03, CUS04, CUS09, CUS10, CUS12, CUS22 a CUS26, CUS32 a CUS35, CUS46 a CUS49, CUS54, CUS55, CUS58 a CUS60, CUS62, CUS63, CUS65, CUS66) quedan para las entregas siguientes.

Hecho:

- Contrato nuevo: `npm run modelos` regenera `core/api/modelos.generados.ts` y, con `scripts/permisos.mjs`, `core/api/permisos.generados.ts` desde el `x-permiso` de las 103 operaciones. Volver a correrlo no cambia nada.
- Sesión con `GET /auth/sesion` al cargar; cabecera con nombres, rol, sede y estado de la caja (`GET /cajas/abierta`).
- Inicio con el panel de avisos (`GET /avisos`, CUS50).
- Listas en lugar de códigos: tipos de documento, medios de pago, servicios y variantes, promociones, paquetes, usuarios, permisos, personal sin usuario, recursos, filtros de la agenda, Mi agenda, «Por cobrar».
- Páginas tocadas: `IGU_Usuarios`, `IGU_Recursos`, `IGU_Agenda`, `IGU_Clientas` (tipos de documento), `IGU_Atencion` (Mi agenda y Atención en curso), `IGU_Cobro` (con la proforma y el comprobante), `IGU_VentaRapida`, `IGU_Caja` y el catálogo (pestaña Recursos con `SEDES:VER`).

Comprobado:

- `npm run build` sin errores ni advertencias.
- `npm test -- --watch=false`: 21 archivos, 137 pruebas, todas aprobadas. Hay una prueba de componente por cada página tocada y una del panel de avisos (`layout/inicio/panel-avisos.spec.ts`).
- `npm run e2e:bd` crea la base de la prueba con el script 17 del back-end, sin errores.

### Segunda entrega: agenda (rama `tineo-feature/f6-agenda`)

CUS03, CUS04, CUS09, CUS10, CUS12 y la lista de espera del día de CUS05 y CUS06.

- `IGU_Clientas` (Figma 4:41): «Ver ficha» abre `/agenda/clientas/:idCliente` con `GET /clientes/{idCliente}`. La ficha tiene cabecera con el saldo a favor y cuatro pestañas: Datos (edición con «Consultar documento» y «Guardar cambios», `PUT /clientes/{idCliente}`), Historial (citas pendientes, servicios con sus recomendaciones y productos comprados), Paquetes y membresías, y Saldo a favor.
- `IGU_Agenda` (Figma 4:29): el bloque de una cita abre su detalle, con «Reprogramar» (`POST /citas/{idCita}/reprogramacion`, eligiendo entre las horas libres de `GET /citas/disponibilidad`) y «Cancelar cita» (`PATCH /citas/{idCita}/cancelacion`, con la opción rápida «No se presentó» y el saldo a favor que quedó). El panel «Lista de espera» lee `GET /citas/lista-espera` del día de la vista: «Programar» abre la nueva cita con los datos de la espera y envía `idEspera`; «Descartar espera» pide confirmación y llama a `PATCH /citas/lista-espera/{idEspera}/descarte`.
- `IGU_Atencion` (Figma 4:137): «Recomendar producto» con «Buscar producto» (`GET /atenciones/productos`), observación y «Recomendar» (`POST /atenciones/{idAtencion}/recomendaciones`). Cierra la diferencia 30 de NOTAS_IT1.
- `npm run build` sin errores ni advertencias; `npm test -- --watch=false`: 22 archivos, 159 pruebas, todas aprobadas. Pruebas de componente: `ficha-clienta.spec.ts` (nueva), `clientas.spec.ts`, `agenda.spec.ts` y `atencion.spec.ts`.
- El paso CUS06 del recorrido e2e espera el `POST` de la espera, porque ahora el panel vuelve a leer la lista. El recorrido tampoco se corrió en esta entrega (mismo horario).

### Tercera entrega: ventas (rama `tineo-feature/f7-ventas`)

CUS22 a CUS26. Cierra la diferencia 32 de NOTAS_IT1: Cobros ya ofrece la venta de productos y la anulación.

- `IGU_VentaProductos` (Figma 4:77, `/ventas/productos`): «Buscar» por nombre, marca y categoría con `GET /ventas/productos` (precio y stock de la sede; sin stock no se agrega, RN15). El carrito suma unidades hasta el stock y cada línea lleva, si se elige, la especialista que lo recomendó (`idPersonal`). «Vender» llama a `POST /ventas/productos` con el medio de pago y el comprobante como en `IGU_Cobro`: 201 muestra el comprobante; 202 (cobro digital PENDIENTE, venta ABIERTA, RN52) lleva a Cobros con la venta.
- `IGU_Anulacion` (dentro de Figma 4:65, `/ventas/anulaciones`), con tres vistas:
  - «Solicitar anulación» (CUS22, `VENTAS:ANULAR`): se busca la venta por número o se llega desde el comprobante emitido. Una venta CERRADA pide motivo, código SUNAT (01, 02 o 06) y forma de devolución, y llama a `POST /ventas/{idVenta}/solicitudes-anulacion`. Al enviar dice «Solicitud enviada a la administradora» y la venta muestra «Anulación pendiente». Ya no se pide usuario ni clave.
  - «Bandeja» (CUS23, `VENTAS:EDITAR`): `GET /solicitudes-anulacion?estado=PENDIENTE` con venta, total, motivo, quién y cuándo. «Aprobar anulación» confirma, aprueba y muestra la nota de crédito con su estado SUNAT (`GET /comprobantes/{idNotaCredito}`). «Rechazar» pide el motivo.
  - «Devoluciones» (CUS24, `VENTAS:EDITAR`): las solicitudes APROBADAS con `MEDIO_ORIGINAL`. «Ver pagos» lee `GET /ventas/{idVenta}`; la tarjeta se devuelve con «Devolver pago» (`POST .../devolucion`, por Izipay) y Yape o Plin con el número de operación y «Registrar devolución manual» (`POST .../devolucion-manual`).
- `npm run build` sin errores ni advertencias; `npm test -- --watch=false`: 27 archivos, 185 pruebas, todas aprobadas. Pruebas nuevas: `venta-productos.spec.ts`, `anulaciones.spec.ts` (la página) y una por vista (`solicitud-anulacion.spec.ts`, `bandeja-anulaciones.spec.ts`, `devoluciones.spec.ts`). En `cobros.spec.ts`, la prueba que exigía no ofrecer anulación ni venta de productos pasó a comprobar los dos enlaces.

### Cuarta entrega: inventario (rama `tineo-feature/f8-inventario`)

Módulo nuevo `inventario` (CUS32 a CUS35 y CUS66), con el grupo «Almacén» en el menú: «Productos e insumos» para quien tenga `PRODUCTOS:VER` o `KARDEX:VER`, y «Kardex» para `KARDEX:VER`.

- `IGU_Inventario` (Figma 4:149, `/inventario`), con pestañas:
  - «Productos»: `GET /productos` filtrado por nombre y categoría, con stock, mínimo, ubicación y precio. Costo y margen se muestran solo si vienen en la respuesta (RN24). Arriba, la alerta de stock mínimo (RF47). «+ Producto» abre el registro (CUS32, «Registrar»): tipo de uso, unidad mínima para insumos (ml, g o unidad, RN54), stock mínimo, ubicación, costo y margen opcional con el precio sugerido a la vista.
  - «Categorías» (CUS66): la lista con cuántos productos tiene cada una y «Guardar categoría».
  - «Salida de insumos» (CUS33): solo insumos, con cantidad, motivo y atención opcional; «Registrar salida de insumo». Si el movimiento deja el producto en su mínimo, lo avisa (RF47).
  - «Ajuste por conteo» (CUS34): lo contado y el motivo, con el stock del sistema y la diferencia a la vista antes de guardar; «Registrar ajuste».
  - «Consumos pendientes» (CUS33, RN53): `GET /consumos-pendientes`, con «Regularizar» y «Descartar» (motivo obligatorio). La pestaña muestra cuántos hay.
- «Kardex» (Figma 4:161, `/inventario/kardex`, CUS35): producto y fechas (por defecto, los últimos 30 días) y «Ver kardex». Muestra fecha, tipo, origen (la atención en las salidas automáticas, la venta o la compra), motivo, cantidad con signo, saldo y usuario. Desde la tabla de productos, «Kardex» lo abre con el producto.
- `npm run build` sin errores ni advertencias; `npm test -- --watch=false`: 32 archivos, 211 pruebas, todas aprobadas. Pruebas nuevas: `inventario.spec.ts` y `kardex.spec.ts` (las dos páginas), y `registro-producto.spec.ts`, `movimiento-inventario.spec.ts` y `consumos-pendientes.spec.ts`. `shell.spec.ts` comprueba el grupo «Almacén» del menú.

### Quinta entrega: administración y configuración (rama `tineo-feature/f9-config`)

CUS46, CUS47, CUS54, CUS55, CUS58 a CUS60, CUS62, CUS63 y CUS65. Cierra las diferencias 15, 17 y 19 de NOTAS_IT1.

- `IGU_Caja` para la administradora (Figma 4:89, `/caja/revision`, CUS46, `CONCILIACION:VER`): «Cierres con diferencia» (`GET /cajas/con-diferencia`) muestra solo los medios que no cuadraron, con su observación, y «Aprobar cierre» (`PATCH .../revision`). «Cajas de hoy» (`GET /cajas/del-dia`) ofrece «Reabrir caja» en la cerrada: pide el motivo, avisa que luego hay que arquear y cerrar otra vez (CUS45) y la cabecera vuelve a mostrar la caja abierta. Aprobar y reabrir piden `CONCILIACION:EDITAR`.
- `IGU_Conciliacion` (Figma 4:233, `/caja/conciliacion`, CUS47), en este orden: 1) «Subir reporte de liquidación de Izipay» (CSV o Excel) con «Importar liquidación», que dice cuántas filas casaron y cuáles no; 2) año y mes con «Conciliar»; 3) diferencias agrupadas por origen, cada una con «Justificar» (texto obligatorio, «Guardar justificación») o «Excluir»; 4) «Cerrar conciliación», habilitado solo cuando no queda ninguna sin justificar.
- `IGU_Usuarios` (Figma 4:245): «Restablecer contraseña» en cada fila (CUS54), con la clave temporal escrita dos veces. La pestaña «Auditoría» es `IGU_Auditoria` (CUS55): filtros de usuario, módulo, entidad y fechas (por defecto, los últimos 30 días) y «Consultar».
- «Catálogo y configuración» (Figma 4:185), con pestañas: Servicios (`GET /servicios`, con «Editar servicio»: «Guardar cambios» y «Cambiar precio»), Paquetes («Guardar paquete»), Promociones («Guardar promoción»), Medios de pago (`IGU_MediosPago`, módulo `pagos`, «Guardar medio de pago»), Series (`IGU_SeriesComprobante`, módulo `ventas`, «Guardar serie») y Parámetros (`IGU_Parametros`, módulo `seguridad`, «Guardar parámetro» y «Guardar tipo de documento»; LIMPIEZA_MAX_MIN de 0 a 10). Recursos sigue como enlace a `/sedes/recursos`.
- Menú: «Revisión de caja» y «Conciliación» en Administración, con los permisos de CONCILIACION.
- `npm run build` sin errores ni advertencias; `npm test -- --watch=false`: 40 archivos, 252 pruebas, todas aprobadas. Pruebas nuevas: `revision-caja.spec.ts`, `conciliacion.spec.ts`, `auditoria.spec.ts`, `parametros.spec.ts`, `paquetes.spec.ts`, `promociones.spec.ts`, `medios-pago.spec.ts` y `series-comprobante.spec.ts`. Se ampliaron `catalogo.spec.ts` (lista, pestañas y edición), `usuarios.spec.ts` (restablecer y auditoría) y `shell.spec.ts` (menú).

### Sexta entrega: reportes (rama `tineo-feature/f10-reportes`)

Módulo nuevo `reportes` (CUS48 y CUS49), con «Reportes» en el menú de Administración solo para `REPORTES:VER`.

- La pantalla sí está en la página 02 de Figma: «18 · Reportes (CUS48–CUS49)», nodo 4:221 (no hizo falta tomar el estilo de 4:233). Se construyó su pestaña «Reportes»; el «Panel de indicadores» no tiene operación en el contrato (ver la diferencia 28).
- `IGU_Reportes` (`/reportes`): tipo de reporte (ventas, productos, margen, demanda, ocupación, ingresos por especialista), fechas, agrupación (solo ventas: día, mes, línea, servicio, especialista, medio de pago o tipo de atención) y sede, con «Todas» para el consolidado (RF93). «Generar» llama a `GET /reportes/{tipoReporte}` y muestra un gráfico de barras y la tabla con las columnas que trae la respuesta. «Exportar a Excel» y «Exportar a PDF» descargan `GET .../exportacion` con el nombre del `Content-Disposition`; solo con `REPORTES:EXPORTAR`. Productos y margen solo se ofrecen a la administradora (RN24).
- `npm run build` sin errores ni advertencias; `npm test -- --watch=false`: 41 archivos, 261 pruebas, todas aprobadas. Prueba nueva: `reportes.spec.ts`; `shell.spec.ts` comprueba el menú.

### Séptima entrega: recorrido e2e de la Iteración 2 (rama `tineo-test/f11-e2e-it2`)

- `e2e/recorrido-it2.e2e.ts`: 29 pasos en serie, en el orden del encargo (con el paso 2.5 ·, ver `docs/pruebas_it2.md`). Usa el mismo entorno que la Iteración 1: contenedor `cautiva-e2e-oracle` con `database/` 00, 14, 13, 15 y 17, back-end `dev` en el 8081 y `ng serve` en el 4300.
- `playwright.config.ts` tiene dos proyectos: `it1` (`recorrido.e2e.ts`) e `it2`, que depende de `it1`. Así `npm run e2e` corre primero el recorrido 1 sobre la base recién creada, que sigue igual, y después el 2. `npm run e2e:it2` corre solo el 2 sobre una base nueva.
- `e2e/apoyo.ts` comparte las claves que fija el recorrido 1 (`CLAVE_ADMIN`, `CLAVE_ESPECIALISTA`) y suma `entrar()`, que entra con la clave final o, si aún es temporal, la cambia. `obtenido()` escribe en un archivo por recorrido (`obtenido-it2.txt`).
- `docs/pruebas_it2.md`: CUS, caso, resultado esperado, obtenido y resultado, y las reglas pedidas.

**Corrida del 10/11/2026 (6 de 29 pasos):** pasaron los cinco pasos de la administradora (1 ·) y el de la categoría (2 ·). El registro del insumo respondió 201, pero el paso falló porque buscaba la tabla en la pestaña «Categorías»; ya está corregido. Lo demás **no se corrió**:

- **Docker:** para repetir desde una base limpia hacía falta recrear `cautiva-e2e-oracle`, y Docker no pudo borrarlo ni detenerlo («tried to kill container, but did not receive an exit event»). El contenedor quedó inservible: Docker lo da por «Up», pero `docker exec` falla y el back-end no conecta. Hay que reiniciar Docker Desktop, lo que también detiene `oracle-local`, y después correr `npm run e2e:bd`.
- **Horario:** desde el paso 3 · el recorrido agenda y atiende hoy, y la corrida empezó a las 17:20 (hora de Lima). El recorrido de la Iteración 1 tampoco se corrió por lo mismo.
- **`JAVA_HOME`:** la terminal de esta sesión no lo tenía. Se usó `C:\Users\Laptop\.jdks\openjdk-26.0.2.1`. El back-end pide Java 21, y con el JDK 26 arrancó.

Pendiente: reiniciar Docker Desktop, `npm run e2e:bd` y `npm run e2e` un día de lunes a sábado antes de las 17:00. Después hay que completar la columna «Obtenido» de `docs/pruebas_it2.md`.

**Sin comprobar:** el recorrido `npm run e2e` no se corrió. Agenda y atiende el mismo día, así que solo corre de lunes a sábado de 09:00 a 17:30 (hora de Lima), y esta entrega se cerró a las 03:20. Sus selectores se adaptaron a las pantallas nuevas y el archivo compila (`playwright test --list` da los 22 pasos), pero falta verlo pasar contra el back-end de la Iteración 2: correr `npm run e2e:bd` y `npm run e2e` en ese horario. Tampoco se revisaron las pantallas en el navegador a 1440, 834 y 390.

`./mvnw -q verify` no aplica: este repositorio es solo el front-end y el back-end no se modificó.

## Dudas

1. **Mi agenda sin nombres.** `CitaAtencionDTO` trae `idCliente`, `idVariante` e `idRecurso`, pero no sus nombres, a diferencia de `FranjaAgendaDTO`. La especialista ve «Cita 950 · Clienta 407 · Variante 2». ¿Se agregan `nombreCliente`, `nombreServicio` y el nombre del recurso?
2. **Usuarios sin persona.** `UsuarioDTO` no trae el nombre de la persona ni el último acceso que muestra Figma (4:245). La tabla dice «Personal 3». ¿Se agregan?
3. **Catálogo para la recepción.** `GET /servicios`, `/promociones` y `/paquetes` piden `CATALOGO:VER`. El script 17 se lo da a RECEPCIONISTA; sin ese permiso las pantallas vuelven a pedir el código (ver la decisión 5). ¿Algún otro rol que agenda o cobra lo necesita?
4. **Cobro digital pendiente al retomar.** Si `GET /ventas/{idVenta}` no trae en `pagos` el pago PENDIENTE con su medio y monto, al retomar la venta en otro equipo solo se conoce `cobrosPendientes` (id y enlace) y no se puede reenviar con `idTransaccion` (RN42); la pantalla ofrece quitarlo. Tampoco está claro si, aprobado por el webhook, el pago ya suma o hay que reenviarlo: la pantalla cubre los dos casos (decisión 8).
5. **Correo de la clienta.** Se supone que `GET /comprobantes/{id}/enlace?canal=CORREO` sin `correo` devuelve el de la ficha de la clienta, como en el ejemplo del contrato. Si viene vacío, se pide escribirlo.
6. **Rutas de los avisos.** Los avisos traen rutas de pantallas que aún no existen en el front-end (por ejemplo, `/inventario/productos`). Hasta construirlas, el enlace lleva a Inicio. ¿Las rutas del back-end son las definitivas del front-end?
7. **Nombre de la sede.** `SesionDTO` sigue trayendo solo `idSede`: la cabecera dice «Sede 1» (diferencia 2 de NOTAS_IT1).
8. **Especialista libre tras terminar antes** (Duda 14 de NOTAS_IT1): no se volvió a revisar.
9. **Ficha sin nombres.** En `GET /clientes/{idCliente}`, `AtencionFicha` y las citas pendientes traen `idVariante` e `idPersonal`; `RecomendacionDTO`, solo `idProducto`; `PaqueteFicha`, solo `idPaquete`. La ficha muestra «Variante 2», «Especialista 4» y «Paquete 3»; el producto recomendado se nombra solo si la clienta lo compró. Para no llamar a operaciones de otros CUS, no se cruzan con `GET /servicios` ni `GET /paquetes`. ¿Se agregan los nombres a esos DTO?
10. **Saldo a favor al cancelar.** El draw.io de CUS10 termina en `mostrarSaldoFavor(saldoDisponible)`, pero la respuesta de `PATCH /citas/{idCita}/cancelacion` es la `CitaDTO`, con `adelantoMonto` y sin el saldo total de la clienta. La agenda muestra el adelanto que pasó a saldo a favor; el saldo total se ve en la ficha. ¿El contrato debe devolver el saldo disponible?
11. **Adelanto antes de cancelar.** `FranjaAgendaDTO` no trae `adelantoMonto`, así que el modal de cancelación no puede anticipar, como el prototipo, si habrá saldo a favor: lo dice después, con la respuesta.
12. **¿Tiene la venta una anulación pendiente?** `VentaDTO` no lo dice. La solicitud lo sabe al enviarla o por el 409 `UQ_SOL_ANUL_PENDIENTE`; al volver a buscar la venta, el chip «Anulación pendiente» no aparece hasta intentar enviarla. ¿Se agrega a `VentaDTO`?
13. **No hay lista de ventas.** Figma 4:65 tiene «Ventas y comprobantes», pero el contrato no tiene `GET /ventas`: la venta se busca por número o se llega desde su comprobante.
14. **Quién solicitó.** `SolicitudAnulacionDTO` trae `idUsuarioSolicita` sin nombre: la bandeja dice «Usuario 2». ¿Se agrega el nombre?
15. **Devoluciones hechas.** No hay forma de saber qué pagos de una venta anulada ya se devolvieron: la vista lo marca al hacerlo, y si ya estaba hecho el back-end responde 409 (RN44). Tampoco se sabe cuándo una venta ya no tiene nada por devolver, así que la lista muestra todas las APROBADAS con `MEDIO_ORIGINAL`. ¿Se agrega el estado de la devolución?
16. **Categorías y especialistas en la venta de productos.** `GET /categorias-producto` pide `PRODUCTOS:VER` y `GET /citas/filtros`, `AGENDA:VER`. Sin el primero se busca sin categoría; sin el segundo, la especialista se escribe por código. ¿La recepción tiene `PRODUCTOS:VER`?
17. **Efectivo en una venta anulada.** CUS24 solo cubre tarjeta, Yape y Plin; un pago en efectivo con `MEDIO_ORIGINAL` no tiene operación. La vista dice que se devuelve desde la caja.
18. **Unidad del margen.** `ProductoDTO.margen` es un número sin unidad. Por el ejemplo del contrato (costo 0.5 y precio 0.75) se supone que es una fracción: la pantalla lo pide en porcentaje, envía 50 % como 0.5 y muestra 0.5 como «50 %». Si fuera un porcentaje, hay que cambiar `inventario.vista.ts` y el registro.
19. **Margen del negocio.** El margen por defecto está en PARAMETRO, que se lee con `GET /parametros` (CUS65, otro CUS). Sin margen escrito, la pantalla no puede anticipar el precio: dice que lo calculará el back-end con el margen vigente y el precio aparece en la lista al registrar.
20. **Registrar movimientos sin `PRODUCTOS:VER`.** Para elegir el producto de una salida o un ajuste hace falta `GET /productos` (`PRODUCTOS:VER`); con solo `KARDEX:CREAR` las pestañas no aparecen. En el kardex, sin ese permiso, el producto se escribe por su código. ¿La encargada de almacén tiene los dos?
21. **Origen de las ventas y compras en el kardex.** `MovimientoKardexDTO` trae `idDetalleVenta` e `idDetalleCompra` (líneas), no el comprobante ni la compra: el origen dice «Venta (línea 900)».
22. **Ítems de la conciliación.** En el contrato, `ConciliacionDTO.items` apunta a `Item`, que es la línea de una venta (`cantidad`, `tipoItem`...). Los ejemplos de `/conciliaciones` muestran otra cosa: `idItem`, `estado`, `idVenta`, `idTransaccion`, `referenciaSunat`, `aceptadoSunat`, `pagoRespaldado` y `justificacion`. El front-end usa una interfaz propia con esos campos (`ItemConciliacion` en `caja.modelos.ts`) y espera que el back-end corrija el esquema.
23. **Retomar una conciliación.** No hay `GET` de una conciliación: si se recarga la página, la del mes no se puede volver a abrir (conciliar otra vez responde 409). ¿Se agrega `GET /conciliaciones?anio=&mes=`?
24. **Origen de una diferencia.** El contrato no dice por qué un ítem no coincide. La pantalla lo deduce: cobro de Izipay sin venta (`idTransaccion` sin `idVenta`), pago sin respaldo (`pagoRespaldado` falso) o comprobante no aceptado por SUNAT (`aceptadoSunat` falso).
25. **Nombres en la revisión de caja.** `CajaDTO` trae `idUsuarioCierre` sin nombre: dice «cerró el usuario 2».
26. **Listas en memoria tras configurar.** Medios de pago y tipos de documento se guardan una vez por carga en `ListasService`. La configuración los lee aparte, pero cobros y clientas ven el cambio al recargar la aplicación.
27. **Insumos del servicio.** Al editar un servicio, el insumo se indica por el código del producto, como al registrarlo (CUS57). Elegirlo de `GET /productos` pediría `PRODUCTOS:VER`, de otro módulo.
28. **Valores de agrupación.** El contrato no enumera `agrupacion`; su ejemplo usa `LINEA`. Se envían DIA, MES, LINEA, SERVICIO, ESPECIALISTA, MEDIO_PAGO y TIPO_ATENCION, como en RF68. Si el back-end usa otros nombres, responde 422 y hay que cambiar `AGRUPACIONES_VENTAS` en `reportes.vista.ts`.
29. **Lista de sedes.** No hay `GET /sedes`: el filtro ofrece la sede de la sesión y «Todas» (consolidado, RF93), pero no las demás sedes una por una.
30. **Quién es administradora.** RN24 se aplica por rol: el front-end oculta productos y margen si `SesionDTO.rol` no es ADMINISTRADORA, y el back-end responde 403 igual. ¿Hay un permiso propio para costos que convenga usar en lugar del nombre del rol?
31. **Alta de una serie en la prueba.** La única sede ya tiene sus cuatro series ACTIVAS. El e2e solo puede comprobar el 409 de UQ_SERIE_COMPR_ACTIVA, no un alta. ¿Se agrega una segunda sede al script 17, o una baja de serie al contrato?
32. **Vender un paquete.** No hay operación para venderle un paquete a una clienta, así que RN36 (una sesión menos por atención) no se puede ver de punta a punta.

Dudas de NOTAS_IT1 que el contrato cierra: 1 (`x-permiso`), 2 (listas, salvo producto y sedes), 3 (`GET /auth/sesion`), 5 (`GET /tipos-documento`), 6 (`GET /atenciones/mi-agenda`), 7 (`GET /atenciones/en-curso`), 8 (`GET /ventas/{idVenta}`), 10 (`GET /cajas/abierta` y `GET /ventas/por-cobrar`), 11 (`GET /medios-pago`), 12 (`GET /comprobantes/{id}`) y 13 (202 de `/ventas/rapidas`, RN52). Siguen abiertas la 4 (plan de commits, ver la decisión 15), la 9 (no se puede anular una transacción en espera), la 14 y la 15.

## Diferencias encontradas

| N° | Dónde | Diferencia | Qué se hizo |
| --- | --- | --- | --- |
| 1 | Contrato frente a la Iteración 1 (RN03) | La limpieza va de 0 a `LIMPIEZA_MAX_MIN` (10) minutos; antes, de 0 a 30. | `IGU_Recursos` la elige en un selector de 0 a 10. El e2e comprueba que 11 responde 422. |
| 2 | `x-permiso` frente a `PERMISOS` | Mi agenda y retomar la atención piden `ATENCION:VER`; listar recursos, `SEDES:VER`; la caja abierta, `CAJA:VER`. | Rutas y menú usan esos permisos: Mi agenda ya no pide `AGENDA:VER`, Recursos se ve con `SEDES:VER` y crear sigue pidiendo `SEDES:CREAR`. |
| 3 | Figma 4:17 frente al contrato | Indicadores, próximas citas y ocupación siguen sin operación. «Pendientes» es `GET /avisos`. | Inicio muestra saludo, acciones, la tarjeta «Avisos» y los accesos. |
| 4 | Figma 4:245 frente al contrato | La asignación de rol por código de usuario sobra con `GET /usuarios`. | Se quitó el formulario por código (diferencia 14 de NOTAS_IT1): el rol se asigna en la fila. |
| 5 | Prototipo frente al contrato (roles) | Módulo y acción se escribían a mano (diferencia 16 de NOTAS_IT1). | Casillas con los permisos de `GET /permisos`, agrupadas por módulo. |
| 6 | Figma 4:29 frente a la Iteración 1 | La franja ya trae nombres de clienta, especialista y servicio (diferencia 24 de NOTAS_IT1); el recurso se nombra con `GET /citas/filtros`. | Columnas, bloques, filtros y selectores de la cita con nombres. |
| 7 | `FranjaAgendaDTO` | `fin` incluye la limpieza; `finServicio`, no (RN03). | Por especialista el bloque llega a `finServicio`; por recurso se pinta además un bloque «Limpieza» hasta `fin`. |
| 8 | Figma 4:65 frente a la Iteración 1 | «Por cobrar» ya tiene operación (diferencia 31 de NOTAS_IT1). | Lista de atenciones por cobrar y de ventas abiertas; se quitó el código de la atención. «Ir a cobrar» pone primero la atención que llega. |
| 9 | Contrato (CUS13, RN52) | El pago digital no aprobado responde 202 con la venta ABIERTA. | `IGU_VentaRapida` lleva a `IGU_Cobro` con esa venta; se cambió el aviso que decía que nada quedaba registrado. |
| 10 | Contrato (CUS20, D-12) | El back-end no envía correos: el enlace firmado se abre con `mailto`. | «Enviar por correo» pide el enlace y abre el correo del equipo. WhatsApp sigue con «Compartir comprobante». |
| 11 | `IGU_VentaRapida` | `GET /ventas/rapidas/libres` da ids de especialista y recurso, sin nombres. | Siguen como «Especialista 4» y «Recurso 1»: los nombres salen de `GET /citas/filtros`, que es de la agenda (`AGENDA:VER`). |
| 12 | Lista de espera | `GET /citas/lista-espera` ya existe (diferencia 27 de NOTAS_IT1). | Cerrada en la segunda entrega: el panel y su contador leen las esperas del día de la vista. |
| 13 | Encargo frente al draw.io (CUS06) | El encargo llama «Descartar» al botón; el draw.io, «Clic en Descartar espera». | Manda el draw.io: «Descartar espera», en el panel y en la confirmación. «Programar» no tiene «Clic en» propio (lleva a CUS05) y queda con el nombre del encargo; el prototipo decía «Asignar cita». |
| 14 | Prototipo frente al encargo (CUS10) | El prototipo elige el motivo en una lista fija (no puede asistir, enfermedad, especialista no disponible, otro) y no tiene «No se presentó». | El motivo se escribe, con un botón rápido «No se presentó» que lo completa. CITA no tiene estado NO_ASISTIO (decisión del 08/11/2026 en el draw.io). |
| 15 | Prototipo frente al contrato (CUS03) | La pestaña «Saldo a favor» del prototipo lista movimientos; `FichaClienteDTO` solo trae `saldoFavor`. | La pestaña muestra el total y de dónde sale (RN05). El prototipo también ofrecía «Agendar cita» desde la ficha: no se construyó, porque no es parte de CUS03. |
| 16 | Prototipo frente al draw.io (CUS12) | El prototipo elige el producto en una lista; el draw.io lee `nombre` y tiene «Clic en Buscar producto». | Se busca por nombre y se elige entre los resultados, que muestran precio y stock (sin costo, RN24). |
| 17 | Encargo frente al draw.io (CUS23, CUS24) | El encargo llama «Aprobar» y «Devolver por Izipay» a los botones; el draw.io, «Clic en Aprobar anulación» y «Clic en Devolver pago». | Mandan los del draw.io; debajo de «Devolver pago» se aclara que devuelve por Izipay. «Rechazar» y «Registrar devolución manual» coinciden. |
| 18 | Prototipo frente al encargo (CUS22) | El prototipo pide usuario y contraseña de la administradora y anula en el acto. | Se quitaron: la solicitud va a la bandeja (RN32), como pide el encargo y el draw.io v5.1. |
| 19 | Prototipo frente al draw.io (CUS26) | El botón del prototipo es «Cobrar y emitir comprobante»; el draw.io dice «Clic en Vender». | «Vender». Las «Recomendaciones de hoy» del prototipo no tienen operación y no se construyeron. |
| 20 | Diferencia 32 de NOTAS_IT1 | Anulación, nota de crédito y venta de productos estaban ocultas. | Cerrada: Cobros enlaza «Venta de productos» y, con `VENTAS:ANULAR` o `VENTAS:EDITAR`, «Anulaciones». Comisión y pago con paquete siguen fuera del alcance. |
| 21 | Prototipo frente al contrato (CUS32) | El prototipo calcula el precio con el margen vigente y lo esconde a quien no es administradora; el contrato deja escribir el margen (RF87). | El margen es opcional: con él se ve el precio sugerido antes de guardar; sin él, el back-end usa el del negocio. |
| 22 | Prototipo frente al encargo (inventario) | El prototipo junta salida y ajuste en un modal con «Guardar movimiento» y lleva el kardex dentro de la misma pantalla. | Una pestaña para cada uno, con los botones del draw.io («Registrar salida de insumo», «Registrar ajuste»), y el kardex como página propia (nodo 4:161). «Crear requerimiento» y «Exportar Excel» no son de esta entrega. |
| 23 | Prototipo frente al contrato (unidades) | El prototipo ofrece Unidad, Kilo, Litro y Caja; RN54 pide la unidad mínima para insumos. | Un insumo elige ml, g o unidad; un producto de venta escribe su unidad (por defecto UND). |
| 24 | Diferencias 15, 17 y 19 de NOTAS_IT1 | Restablecer clave, auditoría, edición de servicios y las pestañas de configuración no estaban en el alcance. | Cerradas: «Restablecer contraseña» y la pestaña «Auditoría» en Usuarios; `GET /servicios` y «Editar servicio» en el catálogo; las pestañas Paquetes, Promociones, Medios de pago, Series y Parámetros. «Desactivar» usuario e «Incidentes» siguen fuera (CUS56). |
| 25 | Encargo frente al draw.io (CUS47) | El encargo llama al primer paso «Subir reporte de liquidación de Izipay»; el draw.io dice «Clic en Importar liquidación», y para justificar, «Clic en Guardar justificación». | El paso se titula como el encargo y sus botones son los del draw.io. «Justificar» abre el texto y «Excluir» marca el ítem sin texto. |
| 26 | Figma frente al contrato (conciliación) | Figma 4:233 muestra la conciliación del mes al entrar; el contrato no tiene cómo leerla. | Se concilia cada vez con «Conciliar» (ver la Duda 23). |
| 27 | Prototipo frente al contrato (catálogo) | El prototipo edita el precio dentro del formulario del servicio; el contrato lo cambia aparte (RN25). | El modal «Editar servicio» tiene «Guardar cambios» para datos e insumos y, por variante, «Cambiar precio». |
| 28 | Figma 4:221 frente al contrato (reportes) | Figma tiene dos pestañas: «Panel de indicadores» (ventas del mes, ticket promedio, cobro digital, clientas recurrentes, Salón vs. Spa, servicios más vendidos) y «Reportes». El contrato solo tiene `GET /reportes/{tipoReporte}`. | Se construyó «Reportes». Los indicadores no tienen operación y quedan fuera, como los de Inicio (diferencia 3). |
| 29 | Prototipo frente al contrato (reportes) | El prototipo tiene reportes de comprobantes, áreas y clientas recurrentes, y filtra por línea; el contrato tiene seis tipos y agrupa las ventas por línea. | Los seis tipos del contrato; «Línea» es una agrupación de ventas. |
| 30 | Draw.io frente al encargo (CUS49) | El draw.io tiene un solo «Clic en Exportar» con el formato como dato; el encargo pide dos botones. | «Exportar a Excel» y «Exportar a PDF», que envían `formato=EXCEL` o `formato=PDF`. |

## Decisiones tomadas

1. **Permisos generados.** `scripts/permisos.mjs` lee el `x-permiso` de `docs/openapi.yaml` sin dependencias y escribe `PERMISO_DE_OPERACION` y `CODIGOS_PERMISO`. `PERMISOS` conserva sus nombres (`agendaVer`...), pero cada valor es el permiso de una operación (`agendaVer: OP.consultarAgenda`), así que no hay códigos copiados a mano. `npm run modelos` lo ejecuta después de `openapi-typescript`.
2. **Sesión del servidor.** `provideAppInitializer` espera `GET /auth/sesion` antes de la primera navegación; con 401 la aplicación queda sin sesión y las guardas llevan al login. El interceptor no avisa ese 401: solo significa «aún no entró». Reemplaza la decisión 3 de NOTAS_IT1: nada se guarda en `sessionStorage`. Las pruebas cargan la sesión igual, con `src/testing/sesion.ts`.
3. **Caja abierta en `core/`.** `CajaAbiertaService` la usan la cabecera y `IGU_Caja`, así `layout/` no depende de `caja/`. Se quitó «Retomar una caja abierta» por código; si al abrir responde 409, se vuelve a leer la caja abierta.
4. **Listas compartidas.** `core/api/listas.service.ts` pide una vez por carga los tipos de documento, los medios de pago y los servicios activos; promociones y paquetes se piden cada vez, porque su vigencia cambia con la fecha. Solo se ofrecen los ACTIVOS. Las ayudas sin datos fijos están en `core/api/medios.ts` y `core/api/documentos.ts`; se borraron `medios-pago.ts` y `tipos-documento.ts`, con `MEDIOS_PAGO` y `TIPOS_DOCUMENTO`.
5. **Selector de servicio y variante.** `layout/selector-variante` lo usan la nueva cita, la lista de espera, la proforma y la venta rápida. Con una sola variante la elige solo. Sin `CATALOGO:VER` muestra el código de la variante, para no dejar sin trabajo a un rol que agenda pero no ve el catálogo (Duda 3).
6. **Medios de pago.** El canal se propone por `usaPasarela`: la tarjeta por enlace y las billeteras por QR; el efectivo no pasa por la pasarela (RN42). Se propone el primer medio activo sin pasarela.
7. **Atención en curso.** `IGU_Atencion` se abre con `?idCita=` y lee `GET /atenciones/en-curso`; desde el menú, sin parámetro, busca la cita EN_CURSO de Mi agenda. Se borraron `AtencionEnCursoService` y `VentaEnCursoService`.
8. **Verificar un cobro digital.** «Verificar aprobación» lee `GET /ventas/{idVenta}`: si la transacción está APROBADA y aún pendiente, se reenvía con `idTransaccion` (RN42); si ya no está pendiente, se da por sumada; si está RECHAZADA, deja de esperarse y se avisa; si sigue PENDIENTE, solo se avisa. Ya no se provoca el 422 de la Iteración 1 (Duda 8).
9. **Estado SUNAT.** Al mostrar un comprobante PENDIENTE o ENVIADO se lee una vez `GET /comprobantes/{id}`, y «Actualizar estado SUNAT» lo vuelve a leer (RN46).
10. **Reglas junto al formulario.** RN48: antes de enviar se avisa si se quitaría un permiso de seguridad a ADMINISTRADORA o el rol a su última titular activa; el 422 del back-end se muestra igual. RN49: una fecha pasada no consulta horas y el 422 queda en el modal. RN50: el 403 queda en el modal de inicio y en la atención.
11. **Paso de la agenda.** Las horas libres se muestran tal como llegan, cada `AGENDA_PASO_MIN` (RN51): el paso no se calcula en el navegador.
12. **Consumos pendientes.** Si `PATCH .../fin` trae `consumosPendientes`, se muestra «Faltó stock de: …; almacén lo regularizará.» con el nombre del producto (o su código si no viene).
13. **Precio propuesto.** En la venta rápida, elegir la variante propone su precio como monto: con cliente de paso y efectivo bastan 5 clics (RNF29). El back-end igual lo compara (RN11).
14. **E2E.** `e2e/preparar-bd.mjs` agrega el script 17 del back-end después del 15, como pide su README. El recorrido elige servicio, personal y permisos en las listas, cobra desde «Por cobrar» y abre la segunda pestaña sin copiar la sesión.
15. **Plan de commits.** El contrato regenerado quita `BloqueAgendaDTO`, así que `agenda` no compila con el `core/` nuevo si van separados: el primer commit lleva configuración, `core/`, `layout/`, `src/testing` y `agenda`. Para que los demás módulos compilen mientras tanto, las ayudas nuevas de `core/api` van en archivos nuevos y las copias fijas se borran en un commit propio, cuando ya nadie las usa. Cada commit se compiló por separado sobre una copia de `HEAD` (`ng build`), y el último da las 137 pruebas en verde. Las pruebas de cada módulo van en su commit; hasta el suyo, las de los módulos que aún sembraban la sesión en `sessionStorage` fallan, aunque el código compile.
16. **Ficha como página.** CUS03 tiene su ruta (`/agenda/clientas/:idCliente`, con `CLIENTAS:VER`) en lugar de un modal, para poder enlazarla y probarla aparte. Sin `CLIENTAS:EDITAR` (`PERMISOS.clientasEditar`, nuevo) los datos se ven deshabilitados y sin «Guardar cambios».
17. **Edición y verificación.** «Guardar cambios» envía los datos del formulario y `fechaVerificacion` solo si en esa edición una consulta dio ENCONTRADO; cambiar el tipo o el número la borra. El back-end deja MANUAL un documento cambiado sin consulta (RN45).
18. **Reprogramar.** Se parte del día de la cita (o de hoy, si ya pasó) y se consulta `GET /citas/disponibilidad` con su variante. Al elegir la hora se proponen la especialista y el recurso de la cita si siguen libres; si no, los primeros que da el back-end. El 409 de cruce lo avisa el interceptor; el 422 de RN49 queda en el modal.
19. **Cancelar.** El modal queda abierto tras cancelar para mostrar el saldo a favor; la rejilla y el panel se vuelven a leer en ese momento.
20. **Lista de espera del día.** Se lee junto con la agenda, para la fecha de la vista. Una espera anotada para ese día, una cita programada desde una espera y un 409 al descartar vuelven a leer la lista. Una espera de un día pasado se programa desde hoy.
21. **Recomendaciones de la atención.** Pide `ATENCION:EDITAR`, como `PATCH .../fin`. Las registradas se muestran como fichas junto al botón; el 409 (ya recomendado) lo avisa el interceptor y el 403 de RN50 queda junto al formulario.
22. **Permisos nuevos.** `PERMISOS.ventasAnular` (de `solicitarAnulacion`), `ventasEditar` (de `aprobar`) y `productosVer` (de `listarCategorias`). La ruta `/ventas/anulaciones` pide `VENTAS:ANULAR` o `VENTAS:EDITAR`, y cada vista se muestra solo con el suyo.
23. **Una página, tres vistas.** `IGU_Anulacion` es una página con pestañas. Abre en la solicitud si llega una venta en la ruta o si quien entra solo puede solicitar; si no, en la bandeja. Las vistas quedan montadas, y aprobar en la bandeja vuelve a leer las devoluciones.
24. **Carrito.** Las líneas son un `FormArray` con `idProducto`, `cantidad` e `idPersonal`. El monto es la suma de las líneas (IGV 0 %, RN06) y el back-end lo compara (RN11). Se propone el efectivo, como en la venta rápida.
25. **Categorías en `ListasService`.** `GET /categorias-producto` se pide una vez por carga, como las demás listas.
26. **Aprobar con confirmación.** «Aprobar anulación» abre una confirmación con el comprobante y el total, porque emite la nota de crédito y no se deshace. Un 409 (ya resuelta o SUNAT aún no acepta) vuelve a leer la bandeja.
27. **Permisos del inventario.** `PERMISOS.productosCrear` (de `registrar_1`), `kardexVer` (de `consultarKardex`) y `kardexCrear` (de `registrarSalida`). `/inventario` pide `PRODUCTOS:VER` o `KARDEX:VER`, y cada pestaña se muestra con el suyo.
28. **Stock tras un movimiento.** La salida y el ajuste devuelven el saldo: la tabla se actualiza con él sin volver a pedir la lista. Una regularización sí la vuelve a pedir, porque solo devuelve el consumo.
29. **Validaciones antes de enviar.** La salida no pasa del stock (RN15) y el ajuste no se envía si lo contado es igual al stock, porque el back-end respondería 422 (RF48). El back-end igual valida las dos.
30. **Categorías nuevas.** Se agregan a la lista de la pantalla. `ListasService` guarda las categorías una vez por carga, así que la venta de productos verá la nueva al recargar la aplicación.
31. **Permisos nuevos.** `PERMISOS.catalogoEditar` (de `actualizarServicio`), `conciliacionVer` (de `listarConDiferencia`), `conciliacionCrear` (de `conciliar`) y `conciliacionEditar` (de `aprobarCierre`). `/caja/revision` pide `CONCILIACION:VER`; `/caja/conciliacion`, cualquiera de los tres.
32. **Configuración en sus módulos.** Medios de pago (`pagos`), series (`ventas`) y parámetros (`seguridad`) son componentes de su módulo que el catálogo muestra en pestañas, como en Figma 4:185. Cada pestaña aparece con el permiso de su lectura: Medios con `VENTAS:VER`, Parámetros con `SEGURIDAD:VER`.
33. **Validaciones antes de enviar.** LIMPIEZA_MAX_MIN entero de 0 a 10 (RN03), AGENDA_PASO_MIN entero mayor que 0 (RN51), serie de 4 caracteres con B o F según el tipo (RF107), promoción con descuento mayor que 0 y hasta 100 % y fin no anterior al inicio (RF84), paquete con al menos una sesión y un día de vigencia. El back-end valida lo mismo.
34. **Reapertura y cabecera.** Al reabrir, la caja devuelta pasa a `CajaAbiertaService`, así que la cabecera dice «Caja abierta» sin recargar.
35. **Plan de commits de esta entrega.** Toca siete módulos (`core`, `caja`, `seguridad`, `pagos`, `ventas`, `catalogo` y `layout`). Para no mezclarlos y no pasar de ocho commits, cada módulo lleva sus pruebas en su propio commit y la documentación va al final.
36. **Gráfico sin librería.** El gráfico es de barras horizontales con CSS y los tokens del prototipo, sobre la columna de importe (o la primera numérica). No se agregó una librería de gráficos.
37. **Exportar lo que se ve.** La exportación usa el tipo y los filtros del último «Generar», no lo que esté escrito en el formulario después; así el archivo coincide con la tabla.
38. **Validación de fechas.** Antes de enviar se exige el rango, que el inicio no pase el fin y que no supere 366 días (RF68). El back-end valida lo mismo.
39. **Un recorrido después del otro.** El recorrido 2 no depende de lo que deja el 1, pero corre después de él (proyecto con dependencia). El 1 necesita las claves temporales de `admin` y `especialista1`, que el 2 también cambia. El 2 usa los usuarios que el 1 no toca (`recepcion`, `almacen`, `especialista2`) y abre su propia caja.
40. **Horario por paso.** El recorrido 2 exige el horario de atención (lunes a sábado, de 09:00 a 17:00) desde el paso 3 ·, no al empezar. Así los pasos de configuración e inventario pueden correr a cualquier hora con `--grep`.
41. **Datos de la base en la prueba.** Como en la Iteración 1, lo que ninguna pantalla muestra (ids, estados, kardex, saldo a favor, auditoría) se lee de la base como dueño del esquema, solo con SELECT.
