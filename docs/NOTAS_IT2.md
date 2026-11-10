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
| 12 | Lista de espera | `GET /citas/lista-espera` ya existe (diferencia 27 de NOTAS_IT1). | No se usó en esta entrega: va con CUS09 y CUS10 (asignar y descartar). El contador sigue contando lo anotado en la pantalla. |

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
