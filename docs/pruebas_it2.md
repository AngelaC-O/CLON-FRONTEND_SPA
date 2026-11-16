# Pruebas de la Iteración 2 · Recorrido e2e

Prueba de punta a punta con Playwright: `e2e/recorrido-it2.e2e.ts`, 30 pasos en serie, con cinco sesiones (administradora, encargada de almacén, recepcionista, la especialista del día y `especialista2`).

**Estado (16/11/2026, Iteración 2.1):** se corrieron los dos recorridos completos (`npm run e2e`) sobre una base nueva, de 09:24 a 09:27 (hora de Lima): **51 de 52 pasos aprobados** (los 22 de la Iteración 1 y 29 de los 30 de este). Falla `8 · RN52`: la venta con tarjeta por enlace responde 422 `CK_TRANS_PAS_LINK`, una falla del back-end (Duda 6 de la sección «Iteración 2.1» de `docs/NOTAS_IT2.md`). Las corridas anteriores de esa mañana y por qué cayeron están en la misma sección.

Los números de cita, venta y caja de «Obtenido» son los de esa corrida.

## Cómo correrla

```bash
npm run e2e:bd
```

```bash
npm run e2e
```

`npm run e2e` corre primero el recorrido de la Iteración 1 (proyecto `it1`) y después este (proyecto `it2`, que depende del primero). Para correr solo este, sobre una base recién creada:

```bash
npm run e2e:it2
```

| Pieza | Valor |
| --- | --- |
| Base | Contenedor propio `cautiva-e2e-oracle` (`gvenzl/oracle-free:23.26.2`, puerto 1523), con `database/` 00, 14, 13, 15, 17, 18 (`18_ajustes_v52.sql`, sin limpieza) y 19 (`19_datos_prueba_horario.sql`, horario de prueba) |
| Back-end | Perfil `dev` en el puerto 8081 (`JAVA_HOME` con un JDK 21 o posterior; se usó el 26): simuladores de Izipay (`respuesta-falsa: APROBADA`), APISPERU y facturación (todo comprobante queda PENDIENTE) |
| Front-end | `ng serve` en el puerto 4300, con `e2e/proxy.e2e.json` |
| Usuarios | `admin` (con la clave que fija el recorrido 1), `recepcion`, `almacen`, `especialista2` y la especialista del día (temporales de los scripts 15, 17 y 19) |

**Cada corrida necesita una base nueva**, porque el recorrido gasta claves temporales y registra códigos únicos. Desde el paso 3 · corre **cualquier día, de 09:00 a 18:00** (hora de Lima), porque agenda y atiende el mismo día; fuera de esa hora falla con un aviso (`exigirHorario`, en `e2e/apoyo.ts`). Los pasos 1 · y 2 · corren a cualquier hora.

### La especialista del día

El script 19 da a cada persona un día de descanso en `HORARIO_PERSONAL` (`dia_semana` 1 = lunes … 7 = domingo). El recorrido lo lee (solo SELECT, como dueño del esquema) y elige:

| Titular | Si descansa hoy, entra | Dónde |
| --- | --- | --- |
| `especialista1` | `especialista3` | Recorrido 1 (CUS08, CUS05, CUS11, RN29) y este (CUS05 desde la espera, RN03, CUS11, CUS12, RN49) |
| `especialista2` | `especialista4` | No hizo falta: RN50 y CUS54 siguen siempre con `especialista2` |

La que entra usa la misma clave final que la titular. Si un paso agenda a otra persona que descansa hoy, el recorrido elige a una que trabaja y lo anota en «Obtenido». El 16/11/2026 (lunes) descansaba `especialista1` y atendió `especialista3` («Especialista Salón 2»); CUS13 del recorrido 1 eligió a «Especialista Spa», que trabaja ese día.

## Orden del recorrido

El orden es el del encargo, con dos cambios:

- El paso **2.5 ·** (la administradora pone el insumo en el servicio y cambia su precio, CUS58) va después de los de la encargada. El servicio necesita el insumo, y ese insumo lo registra la encargada en el paso 2 ·.
- **RN52** (venta con tarjeta por enlace) pasó del paso 6 · al **8 ·**, al final. Falla por el back-end (Duda 6) y el modo en serie saltaba todo lo que venía después. La caja sigue ABIERTA tras la reapertura de CUS46, así que el paso es el mismo. RN44 ya no usa esa venta: usa la de efectivo de un cliente de paso, antes de pedir su anulación.

| Paso | Actora | CUS |
| --- | --- | --- |
| 1 · | Administradora | CUS65, CUS62, CUS63, CUS59, CUS60, CUS54 |
| 2 · | Encargada (`almacen`) | CUS66, CUS32, CUS34, CUS33, CUS35 |
| 2.5 · | Administradora | CUS58 |
| 3 · | Recepcionista (`recepcion`) | CUS44, CUS02, CUS03, CUS04, CUS06, CUS05, RN03 (cita al fin de otra), CUS07, CUS09, CUS10 |
| 4 · | La especialista del día y `especialista2` | CUS11, CUS12 |
| 5 · | Encargada | CUS33 (consumo pendiente) |
| 6 · | Recepcionista | CUS25, CUS26, CUS22 |
| 7 · | Administradora | CUS23, CUS24, CUS45, CUS46, CUS47, CUS48, CUS49, CUS55 |
| 8 · | Recepcionista | RN52 |

## Casos de uso

| CUS | Caso | Resultado esperado | Obtenido | Resultado |
| --- | --- | --- | --- | --- |
| CUS65 | Cambia AGENDA_PASO_MIN a 30 | Se guarda con su vigencia | AGENDA_PASO_MIN = 30 guardado con su vigencia; AGENDA_PASO_MIN 0, 422 RN51 | Aprobado |
| CUS62 | Desactiva Plin | Plin INACTIVO; el efectivo no va por la pasarela | Plin INACTIVO; efectivo por la pasarela, 422 | Aprobado |
| CUS63 | Series de la sede | Las series con su último número; una sola ACTIVA por tipo | Serie con letra errada, aviso; F002 con F001 ACTIVA, 409 | Aprobado con límite 1 |
| CUS59 | Registra un paquete | Paquete con sus servicios, nombrados | «Tres tratamientos E2E», 3 sesiones, 1 servicio en `PAQUETE_SERVICIO`, con su nombre en la tabla | Aprobado |
| CUS60 | Registra una promoción | Promoción ACTIVA | «Promo E2E», 10 % ACTIVA por 30 días, con el nombre del servicio | Aprobado |
| CUS54 | Restablece la clave de `especialista2` | Debe cambiarla al entrar; la clave no vuelve | `especialista2` ACTIVO con `debe_cambiar_clave = S`, fila con su nombre; la respuesta no la trae. En el paso 4 · entró con ella y la cambió | Aprobado |
| CUS66 | Registra una categoría | Categoría en la lista | «Insumos E2E» registrada | Aprobado |
| CUS32 | Registra un insumo en ml | Insumo con stock 0; precio = costo + 50 % | Insumo 21 INSUMO en ML, stock 0, mínimo 16; precio S/ 0.75 sobre costo S/ 0.50 | Aprobado |
| CUS34 | Ajuste por conteo del insumo (20 ml, menos que los 30 que estima el servicio) y del producto de venta | AJUSTE con la diferencia | Keratina E2E: AJUSTE +20; Óleo de Argán: 5 | Aprobado |
| CUS33 | Salida de 5 ml del insumo | SALIDA; alerta de stock mínimo | SALIDA de 5 ml, saldo 15 (mínimo 16) | Aprobado |
| CUS35 | Kardex del insumo | Ajuste, salida y, tras la atención, la salida automática con su atención | AJUSTE +20, SALIDA −5, saldo 15; tras el paso 4 ·, la SALIDA automática de la atención 4 | Aprobado |
| CUS58 | Pone 30 ml del insumo en el servicio y le sube S/ 10 | `SERVICIO_INSUMO` y precio nuevo | Insumo 21 × 30 ml en la variante 6; precio 140 → 150 | Aprobado |
| CUS44 | La recepcionista abre la caja | Caja ABIERTA | Caja 2 ABIERTA con S/ 100 | Aprobado |
| CUS02 | Registra dos clientas con pasaporte | Fichas MANUAL | Wendy y Rocío en la tabla de clientas | Aprobado |
| CUS03 | Consulta la ficha | Saldo S/ 0.00, sin citas pendientes | Ficha de Wendy: saldo S/ 0.00, sin citas pendientes | Aprobado |
| CUS04 | Actualiza correo y observaciones | PUT 200; correo en `PERSONA` | PUT 200; `wendy.e2e@ejemplo.com` en `PERSONA` | Aprobado |
| CUS06 | Anota a una clienta en la lista de espera | El panel del día la lista | Rocío anotada; el panel del día la lista | Aprobado |
| CUS05 | La programa desde la espera | Cita con `idEspera`; espera ASIGNADA | Cita 3 a las 09:30 con `especialista3`, de 90 min; espera ASIGNADA con esa cita | Aprobado |
| CUS07 | Adelantos en efectivo de dos citas | Adelanto en la caja | S/ 10 y S/ 20 en efectivo en la caja 2 (se ven en CUS09 y CUS10) | Aprobado |
| CUS09 | Reprograma una cita con adelanto | Origen REPROGRAMADA; la nueva hereda el adelanto | Cita 5 REPROGRAMADA → 6 a las 18:00; la nueva hereda S/ 10 | Aprobado |
| CUS10 | Cancela otra por «No se presentó» | CANCELADA; el adelanto pasa a saldo a favor | Cita 7 CANCELADA; aviso de S/ 20 de saldo; la ficha muestra S/ 20.00 | Aprobado |
| CUS11 | La especialista del día inicia y finaliza | Atención FINALIZADA | `especialista3` inicia y finaliza la atención 4 | Aprobado |
| CUS12 | Recomienda el producto de venta | Recomendación ligada a la atención | `especialista3`, atención 4: recomendó Óleo de Argán con su observación | Aprobado |
| CUS33 | Consumo pendiente: aviso, regularizar sin stock, descartar | Aviso en Inicio; 409; DESCARTADO con motivo | Aviso en Inicio; regularizar sin stock, 409; descartado con motivo | Aprobado |
| CUS25 | Busca el producto recomendado | Precio y stock de la sede | Búsqueda «Óleo de Argán» con su precio y stock | Aprobado |
| CUS26 | Vende tres unidades (efectivo y Yape) y una con tarjeta | Ventas CERRADAS; la de tarjeta, ABIERTA hasta aprobarse | Ventas 4, 5 y 6 CERRADAS; stock 5 → 2. La de tarjeta está en RN52 | Aprobado (la de tarjeta, ver RN52) |
| CUS22 | Solicita tres anulaciones (una SALDO_FAVOR) | PENDIENTES; las ventas siguen CERRADAS | Tres solicitudes PENDIENTES (una SALDO_FAVOR); las ventas siguen CERRADAS | Aprobado |
| CUS23 | Aprueba una y rechaza otra con motivo | Nota de crédito BC01; venta ANULADA; la rechazada sigue CERRADA | Aprobar la venta 4 (boleta B001-3 PENDIENTE en SUNAT): 409 RN46 «la nota de crédito se emite cuando SUNAT lo acepta», con el mensaje en pantalla; la venta 5, RECHAZADA con motivo y CERRADA | Aprobado con límite 4 |
| CUS24 | Devuelve a mano el Yape de la venta anulada | DEVOLUCION QR APROBADA con el número de operación | Sin venta ANULADA (RN46): la venta Yape B001-5 no aparece en Devoluciones | No verificable en `dev` (límite 4) |
| CUS45 | La recepcionista cierra la caja con −3 | Caja CERRADA con observación | Caja 2 cerrada con −3 en efectivo y su observación | Aprobado |
| CUS46 | Aprueba ese cierre y reabre la caja | Revisada; ABIERTA con motivo | Cierre aprobado (con el nombre de quien cerró); caja ABIERTA, motivo «Venta registrada después del cierre» | Aprobado |
| CUS47 | Sube la liquidación, concilia, justifica y cierra | Filas casadas y no casadas; conciliación CERRADA | 3 de 4 filas casaron; conciliación 1 con 5 ítems, 5 justificados, CERRADA | Aprobado |
| CUS48 | Reporte de ventas por línea | Tabla y gráfico | Tabla y gráfico | Aprobado |
| CUS49 | Exporta a Excel y PDF | Descargas `.xlsx` y `.pdf` | `reporte_ventas_2026-11-01_2026-11-16.xlsx` y `.pdf` | Aprobado |
| CUS55 | Auditoría de `admin` | Filas de lo que hizo | 41 filas | Aprobado |

## Reglas de negocio

| Regla | Cómo se verifica | Obtenido | Resultado |
| --- | --- | --- | --- |
| RN03 | Sin limpieza (It. 2.1): LIMPIEZA_MAX_MIN ya no existe; fin = inicio + duración; una cita a la hora exacta del fin de otra, con el mismo sillón y la misma especialista, se agenda | LIMPIEZA_MAX_MIN no está en la tabla ni en `PARAMETRO` (0 filas); cita 3 de 90 min, de 09:30 a 11:00; cita 4 a las 11:00 con `especialista3` en Sillón 1: 201, sin cruce | Verificada |
| RN05 | La cita reprogramada hereda el adelanto; la cancelada lo deja como saldo a favor en la ficha | Hereda S/ 10; la ficha de Wendy muestra S/ 20.00 | Verificada |
| RN12 | La venta anulada sigue en la base con su nota de crédito | Sin anular en `dev` (RN46): la venta 4 sigue CERRADA | No verificable en `dev` (límite 4) |
| RN13 | El insumo queda INSUMO; venderlo por la API responde 422 | Tipo de uso INSUMO; con stock 15 y el monto exacto (S/ 0.75): 422 RN13. Sin stock y con S/ 1 (paso 6 ·): 409 RN15 (Duda 7) | Verificada |
| RN14 | Precio del insumo = costo × 1,5 | Costo 0.50 → precio 0.75 | Verificada |
| RN15 | Salida de 999 y regularizar sin stock: 409 | Salida de 999: 409 RN15; regularizar sin stock: 409 | Verificada |
| RN16 | La salida deja el insumo en su mínimo: `estaEnMinimo` y alerta | Saldo 15 ≤ mínimo 16: `estaEnMinimo` y alerta | Verificada |
| RN17 | La recepcionista ajusta stock por la API: 403 | 403 | Verificada |
| RN24 | La encargada no recibe márgenes; la recepcionista pide el reporte de margen: 403 | `GET /productos` sin margen y sin la columna; margen: 403 ACCESO_DENEGADO | Verificada |
| RN25 | El cambio de precio queda en `AUDITORIA` | 1 fila de `VARIANTE_SERVICIO` | Verificada |
| RN30 | Cierre con diferencia aprobado aparte; reapertura con motivo | Aprobado aparte; la reapertura exige motivo | Verificada |
| RN31 | La conciliación genera un ítem por venta, comprobante y transacción | 5 ítems, uno por venta, comprobante y transacción del mes | Verificada |
| RN32 | La recepcionista aprueba una anulación por la API: 403 | 403 | Verificada |
| RN33 | La venta anulada no está en `V_VENTA_VALIDA` ni coincide en la conciliación | Sin venta anulada en `dev` (RN46): 0 ANULADAS | No verificable en `dev` (límite 4) |
| RN36 | Paquete con su servicio; la atención sin paquete comprado no usa sesión | Paquete con 1 servicio; la atención 4 sin `id_cliente_paquete` | Verificada en parte (límite 2) |
| RN44 | SALDO_FAVOR de un cliente de paso: 422; devolución QR de Yape | Cliente de paso: 422 RN44; Wendy con S/ 20 de saldo (cita cancelada). La devolución de Yape pide una venta ANULADA | Verificada en parte (límite 4) |
| RN46 | Aprobar una anulación con el comprobante PENDIENTE en SUNAT | 409 RN46; ninguna nota de crédito | Verificada |
| RN47 | Una serie ACTIVA por tipo (409); notas de crédito BC01 correlativas | F002 con F001 ACTIVA: 409; BC01 sin notas en `dev` (RN46) | Verificada en parte (límite 4) |
| RN48 | Quitarle el rol a la última administradora: 422 | 422 RN48 | Verificada |
| RN49 | Fecha pasada: aviso en pantalla y 422 en la API | La pantalla avisa; la API, 422 RN49 | Verificada |
| RN50 | `especialista2` recomienda en la atención de la especialista del día: 403 RN50 | Atención 4: 403 RN50 | Verificada |
| RN51 | AGENDA_PASO_MIN 0: 422; con 30, las horas libres van cada 30 min | 422 RN51; horas 09:30, 10:00, 10:30 | Verificada |
| RN52 | Venta con tarjeta por enlace: 202 ABIERTA; tras el webhook, se cierra en Cobros | 422 `CK_TRANS_PAS_LINK` «El dato no cumple una regla de la base de datos.» | **Fallida** (back-end, Duda 6) |
| RN53 | Estimado 30, hay 15: descuenta 15 y deja 15 pendientes | Descontó 15; 15 PENDIENTE | Verificada |
| RN54 | Insumo en litros por la API: 422 | 422 RN54 | Verificada |

## Iteración 2.1

Pasos nuevos o cambiados en los dos recorridos (16/11/2026):

| Paso | Recorrido | Qué comprueba | Obtenido | Resultado |
| --- | --- | --- | --- | --- |
| Base 18 y 19 | Los dos | `npm run e2e:bd` instala la migración sin limpieza y el horario de prueba | Base lista con 00, 14, 13, 15, 17, 18 y 19 | Aprobado |
| Ventana horaria | Los dos | `exigirHorario`: cualquier día, de 09:00 a 18:00 (Lima) | Corrida de 09:24 a 09:27 del lunes | Aprobado |
| Especialista del día | Los dos | Si `especialista1` descansa, entra `especialista3` con la misma clave final | Lunes: `especialista3` («Especialista Salón 2») agendó, atendió y recomendó; RN29 le cuenta 7 filas | Aprobado |
| CUS61 sin limpieza | 1 | Sin selector ni columna «Limpieza»; `MINUTOS_LIMPIEZA` no existe | Recurso 21 SILLON registrado; sin selector ni columna | Aprobado |
| CUS05 sin limpieza | 1 | Fin = inicio + 30 min | Cita 1 a las 09:30; fin a los 30 min | Aprobado |
| LIMPIEZA_MAX_MIN | 2 | El parámetro ya no está en la tabla ni en `PARAMETRO` | 0 filas | Aprobado |
| RN03 al fin de otra cita | 2 | A la hora exacta del fin de la cita 3, mismo sillón y especialista, se agenda sin cruce | Cita 4 a las 11:00 con `especialista3` en Sillón 1: 201 | Aprobado |
| Nombres, nunca ids | Los dos | En cada pantalla que visita el recorrido, ningún texto con `/\b(Clienta\|Variante\|Recurso\|Especialista\|Usuario\|Personal\|Sede\|Paquete\|Producto\|Servicio\|Medio) \d+\b/` | Ninguna coincidencia en 48 visitas (14 + 34) | Verificada |
| Textos con nombre | Los dos | «Cita N° x», «Atención N° x», «Caja N° x»; la venta por su comprobante en la bandeja y en devoluciones; quien solicitó y quien cerró, por su nombre; paquete, promoción y usuarios con nombres | Todos se encontraron | Aprobado |

**Regla «nombres, nunca ids»: verificada.** Pantallas revisadas (`sinIds`, en `e2e/apoyo.ts`; la lista sale en `test-results/pantallas-it1.txt` y `pantallas-it2.txt`):

- Recorrido 1: Usuarios, Catálogo, Recursos, Caja, Clientas, Agenda por especialista, Agenda por recurso, Mi agenda, Atención en curso, Cobro de la atención, Comprobante emitido, Proforma, Atención sin cita y Cierre de caja.
- Recorrido 2: Parámetros, Medios de pago, Series, Paquetes, Promociones, Usuarios, Categorías, Productos, Salida de insumos, Kardex, Editar servicio, Caja, Clientas, Ficha de la clienta, Nueva cita desde la espera, Agenda, Detalle de la cita, Reprogramar cita, Cancelar cita, Mi agenda, Atención en curso, Kardex tras la atención, Inicio (dos veces), Consumos pendientes, Venta de productos, Solicitud de anulación, Bandeja de anulaciones, Devoluciones, Cierre de caja, Revisión de caja, Conciliación, Reportes y Auditoría.

«Cobro de la venta abierta» (RN52) no se revisó: el paso cae antes de llegar a esa pantalla.

## Límites

1. **CUS63 sin alta exitosa.** La base tiene una sola sede y sus cuatro tipos ya tienen serie ACTIVA (B001, F001, BC01, FC01). La pantalla registra para la sede de la sesión, así que solo se puede comprobar la regla (409). Dar de alta una serie pide otra sede (CUS64, fuera del alcance) o dar de baja una serie, que el contrato no tiene.
2. **RN36 en parte.** El contrato no tiene cómo venderle un paquete a una clienta (solo la proforma lo nombra), así que no se puede ver una atención que descuente una sesión. Se comprueba el paquete con su servicio y que una atención sin paquete no usa sesión.
3. **Izipay simulado.** En el perfil `dev` el cobro sale con `respuesta-falsa: APROBADA`. El adelanto por enlace (recorrido 1) queda PENDIENTE hasta el webhook firmado, pero el cobro de una venta por enlace sale APROBADO y choca con `CK_TRANS_PAS_LINK` (Duda 6).
4. **Anulación sin SUNAT.** En `dev` la facturación simulada deja todo comprobante PENDIENTE, y el contrato responde 409 RN46 al aprobar una anulación hasta que SUNAT lo acepte. Por eso no hay venta ANULADA ni nota de crédito: CUS24, RN12, RN33 y las notas de RN47 no se pueden ver aquí. El recorrido no cambia el estado SUNAT en la base (el dueño solo lee). Hace falta el perfil `sandbox` o un simulador que acepte (Duda 8).
5. **Otros anchos.** El recorrido corre a 1440 px; 834 y 390 no se revisaron.
