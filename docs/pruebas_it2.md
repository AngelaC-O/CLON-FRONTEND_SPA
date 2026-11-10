# Pruebas de la Iteración 2 · Recorrido e2e

Prueba de punta a punta con Playwright: `e2e/recorrido-it2.e2e.ts`, 29 pasos en serie, con cinco sesiones (administradora, encargada de almacén, recepcionista y dos especialistas).

**Estado (10/11/2026):** corrieron los pasos 1 · y el primero del 2 · (6 de 29, todos aprobados). El registro del insumo (CUS32) respondió 201, pero su paso falló por un selector de la prueba, ya corregido. El resto quedó **sin correr**:

- **Base dañada:** Docker no pudo borrar el contenedor `cautiva-e2e-oracle` para volver a crearlo y quedó inservible («did not receive an exit event»). Hay que reiniciar Docker Desktop, y eso también detiene `oracle-local`.
- **Horario:** desde el paso 3 · el recorrido agenda y atiende hoy, y la corrida empezó a las 17:20 (hora de Lima).

La columna «Obtenido» dice «Sin correr» en esos pasos. Ver `docs/NOTAS_IT2.md`, séptima entrega.

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
| Base | Contenedor propio `cautiva-e2e-oracle` (`gvenzl/oracle-free:23.26.2`, puerto 1523), con `database/` 00, 14, 13, 15 y 17 |
| Back-end | Perfil `dev` en el puerto 8081 (`JAVA_HOME` con un JDK 21 o posterior): simuladores de Izipay (`respuesta-falsa: APROBADA`; el enlace queda PENDIENTE), APISPERU y facturación |
| Front-end | `ng serve` en el puerto 4300, con `e2e/proxy.e2e.json` |
| Usuarios | `admin` y `especialista1` (con la clave que fija el recorrido 1 o la temporal), `recepcion`, `almacen` y `especialista2` (temporales del script 15 y 17) |

**Cada corrida necesita una base nueva**, porque el recorrido gasta claves temporales y registra códigos únicos. Desde el paso 3 · corre de lunes a sábado, de 09:00 a 17:00 (hora de Lima), porque agenda y atiende el mismo día. Los pasos 1 · y 2 · corren a cualquier hora.

## Orden del recorrido

El orden es el del encargo, con un cambio: el paso **2.5 ·** (la administradora pone el insumo en el servicio y cambia su precio, CUS58) va después de los de la encargada. El servicio necesita el insumo, y ese insumo lo registra la encargada en el paso 2 ·.

| Paso | Actora | CUS |
| --- | --- | --- |
| 1 · | Administradora | CUS65, CUS62, CUS63, CUS59, CUS60, CUS54 |
| 2 · | Encargada (`almacen`) | CUS66, CUS32, CUS34, CUS33, CUS35 |
| 2.5 · | Administradora | CUS58 |
| 3 · | Recepcionista (`recepcion`) | CUS44, CUS02, CUS03, CUS04, CUS06, CUS05, CUS07, CUS09, CUS10 |
| 4 · | `especialista1` y `especialista2` | CUS11, CUS12 |
| 5 · | Encargada | CUS33 (consumo pendiente) |
| 6 · | Recepcionista | CUS25, CUS26, CUS22 |
| 7 · | Administradora | CUS23, CUS24, CUS45, CUS46, CUS47, CUS48, CUS49, CUS55 |

## Casos de uso

| CUS | Caso | Resultado esperado | Obtenido | Resultado |
| --- | --- | --- | --- | --- |
| CUS65 | Cambia AGENDA_PASO_MIN a 30 | Se guarda con su vigencia | AGENDA_PASO_MIN = 30 en `PARAMETRO`; LIMPIEZA_MAX_MIN 11 avisado en pantalla y 422 en la API; AGENDA_PASO_MIN 0, 422 | Aprobado |
| CUS62 | Desactiva Plin | Plin INACTIVO; el efectivo no va por la pasarela | Plin INACTIVO; efectivo por la pasarela, 422 | Aprobado |
| CUS63 | Series de la sede | Las series con su último número; una sola ACTIVA por tipo | B001 en la tabla; serie con letra errada, aviso; F002 con F001 ACTIVA, 409 | Aprobado con límite 1 |
| CUS59 | Registra un paquete | Paquete con sus servicios | «Tres tratamientos E2E», 3 sesiones, 1 fila en `PAQUETE_SERVICIO` | Aprobado |
| CUS60 | Registra una promoción | Promoción ACTIVA | «Promo E2E», 10 % por 30 días | Aprobado |
| CUS54 | Restablece la clave de `especialista2` | Debe cambiarla al entrar; la clave no vuelve | `debe_cambiar_clave = S`; la respuesta no la trae | Aprobado |
| CUS66 | Registra una categoría | Categoría en la lista | «Insumos E2E» registrada | Aprobado |
| CUS32 | Registra un insumo en ml | Insumo con stock 0; precio = costo + 50 % | POST 201; el paso falló al buscar la tabla en otra pestaña (corregido) | Sin correr completo |
| CUS34 | Ajuste por conteo del insumo (20 ml, menos que los 30 que estima el servicio) y del producto de venta | AJUSTE con la diferencia | Sin correr | Pendiente |
| CUS33 | Salida de 5 ml del insumo | SALIDA; alerta de stock mínimo | Sin correr | Pendiente |
| CUS35 | Kardex del insumo | Ajuste, salida y, tras la atención, la salida automática con su atención | Sin correr | Pendiente |
| CUS58 | Pone 30 ml del insumo en el servicio y le sube S/ 10 | `SERVICIO_INSUMO` y precio nuevo | Sin correr | Pendiente |
| CUS44 | La recepcionista abre la caja | Caja ABIERTA | Sin correr | Pendiente |
| CUS02 | Registra dos clientas con pasaporte | Fichas MANUAL | Sin correr | Pendiente |
| CUS03 | Consulta la ficha | Saldo S/ 0.00, sin citas pendientes | Sin correr | Pendiente |
| CUS04 | Actualiza correo y observaciones | PUT 200; correo en `PERSONA` | Sin correr | Pendiente |
| CUS06 | Anota a una clienta en la lista de espera | El panel del día la lista | Sin correr | Pendiente |
| CUS05 | La programa desde la espera | Cita con `idEspera`; espera ASIGNADA | Sin correr | Pendiente |
| CUS07 | Adelantos en efectivo de dos citas | Adelanto en la caja | Sin correr | Pendiente |
| CUS09 | Reprograma una cita con adelanto | Origen REPROGRAMADA; la nueva hereda el adelanto | Sin correr | Pendiente |
| CUS10 | Cancela otra por «No se presentó» | CANCELADA; el adelanto pasa a saldo a favor | Sin correr | Pendiente |
| CUS11 | `especialista1` inicia y finaliza | Atención FINALIZADA | Sin correr | Pendiente |
| CUS12 | Recomienda el producto de venta | Recomendación ligada a la atención | Sin correr | Pendiente |
| CUS33 | Consumo pendiente: aviso, regularizar sin stock, descartar | Aviso en Inicio; 409; DESCARTADO con motivo | Sin correr | Pendiente |
| CUS25 | Busca el producto recomendado | Precio y stock de la sede | Sin correr | Pendiente |
| CUS26 | Vende tres unidades (efectivo y Yape) y una con tarjeta | Ventas CERRADAS; la de tarjeta, ABIERTA hasta aprobarse | Sin correr | Pendiente |
| CUS22 | Solicita tres anulaciones (una SALDO_FAVOR) | PENDIENTES; las ventas siguen CERRADAS | Sin correr | Pendiente |
| CUS23 | Aprueba dos y rechaza una con motivo | Nota de crédito BC01; venta ANULADA; la rechazada sigue CERRADA | Sin correr | Pendiente |
| CUS24 | Devuelve a mano el Yape de la venta anulada | DEVOLUCION QR APROBADA con el número de operación | Sin correr | Pendiente |
| CUS45 | La recepcionista cierra la caja con −3 | Caja CERRADA con observación | Sin correr | Pendiente |
| CUS46 | Aprueba ese cierre y reabre la caja | Revisada; ABIERTA con motivo | Sin correr | Pendiente |
| CUS47 | Sube la liquidación, concilia, justifica y cierra | Filas casadas y no casadas; conciliación CERRADA | Sin correr | Pendiente |
| CUS48 | Reporte de ventas por línea | Tabla y gráfico | Sin correr | Pendiente |
| CUS49 | Exporta a Excel y PDF | Descargas `.xlsx` y `.pdf` | Sin correr | Pendiente |
| CUS55 | Auditoría de `admin` | Filas de lo que hizo | Sin correr | Pendiente |

## Reglas de negocio

| Regla | Cómo se verifica | Obtenido | Resultado |
| --- | --- | --- | --- |
| RN03 | LIMPIEZA_MAX_MIN 11 en la pantalla y en la API; fin de la cita con la limpieza del sillón | Aviso en pantalla; API 422 | Verificada en parte (falta la cita) |
| RN05 | La cita reprogramada hereda el adelanto; la cancelada lo deja como saldo a favor en la ficha | Sin correr | Pendiente |
| RN12 | La venta anulada sigue en la base con su nota de crédito | Sin correr | Pendiente |
| RN13 | El insumo queda INSUMO; venderlo por la API responde 422 | Sin correr | Pendiente |
| RN14 | Precio del insumo = costo × 1,5 | Sin correr | Pendiente |
| RN15 | Salida de 999 y regularizar sin stock: 409 | Sin correr | Pendiente |
| RN16 | La salida deja el insumo en su mínimo: `estaEnMinimo` y alerta | Sin correr | Pendiente |
| RN17 | La recepcionista ajusta stock por la API: 403 | Sin correr | Pendiente |
| RN24 | La encargada no recibe márgenes; la recepcionista pide el reporte de margen: 403 | Sin correr | Pendiente |
| RN25 | El cambio de precio queda en `AUDITORIA` | Sin correr | Pendiente |
| RN30 | Cierre con diferencia aprobado aparte; reapertura con motivo | Sin correr | Pendiente |
| RN31 | La conciliación genera un ítem por venta, comprobante y transacción | Sin correr | Pendiente |
| RN32 | La recepcionista aprueba una anulación por la API: 403 | Sin correr | Pendiente |
| RN33 | La venta anulada no está en `V_VENTA_VALIDA` ni coincide en la conciliación | Sin correr | Pendiente |
| RN36 | Paquete con su servicio; la atención sin paquete comprado no usa sesión | Paquete con 1 servicio en `PAQUETE_SERVICIO` | Verificada en parte (límite 2) |
| RN44 | SALDO_FAVOR de un cliente de paso: 422; devolución QR de Yape | Sin correr | Pendiente |
| RN47 | Una serie ACTIVA por tipo (409); notas de crédito BC01 correlativas | F002 con F001 ACTIVA: 409 | Verificada en parte (faltan las notas) |
| RN48 | Quitarle el rol a la última administradora: 422 | Sin correr | Pendiente |
| RN49 | Fecha pasada: aviso en pantalla y 422 en la API | Sin correr | Pendiente |
| RN50 | `especialista2` recomienda en la atención de `especialista1`: 403 RN50 | Sin correr | Pendiente |
| RN51 | AGENDA_PASO_MIN 0: 422; con 30, las horas libres van cada 30 min | AGENDA_PASO_MIN 0: 422 | Verificada en parte (faltan las horas) |
| RN52 | Venta con tarjeta por enlace: 202 ABIERTA; tras el webhook, se cierra en Cobros | Sin correr | Pendiente |
| RN53 | Estimado 30, hay 15: descuenta 15 y deja 15 pendientes | Sin correr | Pendiente |
| RN54 | Insumo en litros por la API: 422 | Sin correr | Pendiente |

## Límites

1. **CUS63 sin alta exitosa.** La base tiene una sola sede y sus cuatro tipos ya tienen serie ACTIVA (B001, F001, BC01, FC01). La pantalla registra para la sede de la sesión, así que solo se puede comprobar la regla (409). Dar de alta una serie pide otra sede (CUS64, fuera del alcance) o dar de baja una serie, que el contrato no tiene.
2. **RN36 en parte.** El contrato no tiene cómo venderle un paquete a una clienta (solo la proforma lo nombra), así que no se puede ver una atención que descuente una sesión. Se comprueba el paquete con su servicio y que una atención sin paquete no usa sesión.
3. **Izipay simulado.** En el perfil `dev` el cobro por QR sale APROBADO al instante, y el enlace (tarjeta) queda PENDIENTE hasta el webhook firmado. Por eso RN52 se prueba con tarjeta.
