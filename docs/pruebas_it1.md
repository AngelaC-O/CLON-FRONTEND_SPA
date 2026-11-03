# Pruebas de la Iteración 1 · Recorrido e2e

Prueba de punta a punta con Playwright: `e2e/recorrido.e2e.ts`, 22 pasos en serie, con cuatro sesiones (administradora, recepcionista, especialista y una segunda pestaña de la recepcionista).

**Última corrida:** 03/11/2026, 22 de 22 pasos aprobados, en Chromium a 1440 px. Los ids de «Obtenido» son los de esa corrida, con la base recién instalada.

## Cómo correrla

```bash
npm run e2e:bd
```

```bash
npm run e2e
```

Hace falta Docker, `JAVA_HOME` y el repositorio del back-end junto a este (o `CAUTIVA_BACKEND_DIR`). La primera vez también `npx playwright install chromium`.

| Pieza | Valor |
| --- | --- |
| Base | Contenedor propio `cautiva-e2e-oracle` (`gvenzl/oracle-free:23.26.2`, puerto 1523), con `database/` 00, 14, 13 y 15 |
| Back-end | Perfil `dev` en el puerto 8081: simuladores de Izipay (`respuesta-falsa: APROBADA`), APISPERU y facturación |
| Front-end | `ng serve` en el puerto 4300, con `e2e/proxy.e2e.json` |

`npm run e2e:bd` borra y crea solo ese contenedor: **cada corrida necesita una base nueva**, porque el recorrido gasta las claves temporales. No usa `oracle-local` ni un back-end en el 8080. Debe correr de lunes a sábado, de 09:00 a 17:30, porque agenda y atiende el mismo día; fuera de ese horario falla con un aviso.

## Casos de uso

| CUS | Caso | Resultado esperado | Obtenido | Resultado |
| --- | --- | --- | --- | --- |
| CUS50 | `admin` entra con la clave temporal y la cambia | Lleva a `/cambio-clave`; lo demás responde 403 hasta cambiarla | Clave errada, aviso; 403 RF82 antes del cambio, 200 después | Aprobado |
| CUS52 | Registra el usuario de la Recepcionista Dos (personal del script 15) | Usuario creado y obligado a cambiar su clave | Usuario 21 del personal 3, `debe_cambiar_clave = S` | Aprobado |
| CUS53 | Le asigna rol y ajusta los permisos del rol | Rol cambiado; permiso nuevo guardado | RECEPCIONISTA; 19 permisos, con `RECORDATORIOS:EDITAR` nuevo | Aprobado |
| CUS57 | Registra un área y un servicio con dos variantes | Área y servicio en la pantalla y en la base | Área «Barbería E2E»; variantes 21 Normal S/ 60 y 22 Niña S/ 35 | Aprobado (ver límite 1) |
| CUS61 | Registra un recurso | Recurso con su limpieza | Recurso 21 con 10 min | Aprobado |
| CUS44 | La recepcionista abre la caja | Caja ABIERTA con el monto inicial | Abierta con S/ 100; la cabecera indica la hora | Aprobado |
| CUS01 | Busca una clienta que no existe | «No se encontraron clientas» | Mensaje mostrado | Aprobado |
| CUS02 | La registra con DNI consultado | Se consulta APISPERU y se guarda la ficha | Consulta HTTP 202 ERROR (simulador), aviso, ficha MANUAL | Aprobado con límite 2 |
| CUS02 | Registra otra con carnet de extranjería a mano | Sin botón de consulta; ficha MANUAL | Ficha MANUAL | Aprobado |
| CUS08 | Consulta la agenda | Columnas por especialista y por recurso | Columnas de especialistas y del recurso 21 | Aprobado |
| CUS05 | Programa una cita | Cita PENDIENTE | Cita 1 a las 16:30 | Aprobado |
| CUS05 | Otra a la misma hora, desde una segunda pestaña | 409 con el mensaje de la regla; el modal sigue abierto | 409 RN02, aviso y modal abierto | Aprobado |
| CUS06 | La anota en la lista de espera | Fila creada; contador en 1 | 1 fila en `LISTA_ESPERA`; «Lista de espera (1)» | Aprobado |
| CUS07 | Adelanto en efectivo | Registrado en la caja abierta | S/ 10 en la caja 1 | Aprobado |
| CUS07 | Adelanto por enlace | Enlace para compartir; cuenta al aprobarlo Izipay | PENDIENTE con adelanto 0; tras el webhook firmado, S/ 20 | Aprobado |
| CUS11 | `especialista1` inicia y finaliza | Atención FINALIZADA, lista para cobro | Atención 1 FINALIZADA; ve el código para cobrarla | Aprobado |
| CUS18 | Cobra con efectivo y Yape | La suma de pagos iguala el total; recién ahí se puede cerrar | Total 50 (60 − 10 de adelanto) = efectivo 20 + Yape 30, APROBADA por QR | Aprobado con límite 3 |
| CUS19 | Emite la boleta | Venta CERRADA con comprobante y estado SUNAT | Boleta B001-1, SUNAT PENDIENTE; atención COBRADA | Aprobado con límite 4 |
| CUS20 | Imprime y comparte | PDF; enlace público firmado | PDF 200; enlace sin sesión 200; firma alterada 403; WhatsApp y correo armados | Aprobado con límite 5 |
| CUS21 | Emite una proforma | Se imprime y no se guarda | 2 × variante 21 = S/ 120; una impresión; ninguna venta nueva | Aprobado con límite 5 |
| CUS13 | Cobra una atención sin cita de un cliente de paso | Atención, cobro y comprobante en una transacción | Atención de «Jorge» COBRADA, boleta B001-2 | Aprobado (ver límite 6) |
| CUS45 | Cierra la caja con diferencia y observación | Caja CERRADA con el arqueo por medio | Efectivo esperado 140, contado 135, −5; Yape 30; Plin 0; Tarjeta 20 | Aprobado |
| CUS51 | La recepcionista cierra sesión | Sesión terminada | La API responde 401 y `/caja` lleva al login | Aprobado |

## Reglas de negocio

| Regla | Cómo se verificó | Obtenido | Resultado |
| --- | --- | --- | --- |
| RN01 | Cita sin clienta por la API; teléfono repetido en la pantalla | HTTP 400 y HTTP 409 | Verificada |
| RN02 | Dos pestañas con la misma hora | 409: «Cruce de horario: la especialista ya tiene la cita N° 1» | Verificada |
| RN03 | Limpieza de 31 min; fin de la cita en la base | 31 no se guarda; 30 min + 10 de limpieza = 40 | Verificada |
| RN04 | Adelanto en efectivo y por enlace | Efectivo al momento; enlace en 0 hasta el webhook | Verificada |
| RN10 | Cierre con comprobante, en la base | Venta CERRADA con su boleta generada, aun con SUNAT pendiente | Verificada |
| RN11 | Cierre incompleto por la API; monto mayor; monto errado en CUS13 | 422; no se envía; 422 sin atención huérfana | Verificada |
| RN27 | Registrar sin consentimiento | Aviso en el formulario, ninguna fila; con él, fecha guardada | Verificada |
| RN29 | `AUDITORIA` al final | admin 13, especialista1 7, especialista2 1, recepcion 1, recepcion2 42 filas; ninguna sin usuario ni fecha | Verificada (ver límite 7) |
| RN30 | Segunda apertura; cierre sin observación; venta con la caja cerrada | 409; la pantalla bloquea y la API responde 422; 422 | Verificada, sin la autorización de la Administradora (CUS46) |
| RN42 | Firma falsa; transacción sin aprobar usada como pago; Yape aprobado | 401; 422 RN42; `VENTA_PAGO` enlazado a una transacción APROBADA | Verificada con límite 3 |
| RN45 | Consulta con error y carnet de extranjería | Ambas fichas MANUAL | Parcial: límite 2 |
| RN46 | Comprobante con el simulador, que no responde | PENDIENTE, en `V_CPE_PENDIENTES` y avisado en el arqueo | Parcial: límite 4 |
| RN47 | Números de la serie B001 | B001 1 y 2, sin saltos, pese al cobro fallido | Parcial: límite 4 |

## Lo que esta prueba no cubre

1. **Área nueva sin uso.** El servicio se registró en «Peluquería y Estilismo»: el área nueva no tiene especialistas, porque asignarlos es de CUS36 (otra iteración), y sin ellos no hay horas libres.
2. **DNI verificado.** El simulador de APISPERU del perfil `dev` siempre responde ERROR. Se comprobó el camino de RN45 con la consulta fallida; la ficha VERIFICADO requiere el perfil `sandbox`.
3. **Espera de un cobro digital.** En `dev`, Izipay aprueba al instante, así que el QR y «Verificar aprobación» de `IGU_Cobro` no se ejercitan aquí; solo los cubre `cobros.spec.ts`, con respuestas simuladas. La espera real sí se comprobó en el adelanto por enlace.
4. **SUNAT.** El simulador siempre deja el comprobante PENDIENTE. No se verificó ACEPTADO, el reenvío de `ReenvioCpeJob`, el plazo de 3 días ni la conservación de XML y CDR.
5. **Impresión.** Se verifica que llega el PDF y que se llama a imprimir, sin abrir el diálogo del navegador. El QR tampoco se escaneó con una aplicación de pago.
6. **Especialista de CUS13.** Se usó `especialista2` con una variante del script 12, porque `especialista1` sigue ocupada hasta el fin de la franja de su cita (ver `docs/NOTAS_IT1.md`, Duda 14).
7. **Códigos leídos de la base.** Personal, variante, recurso y demás se leen con SQL de solo lectura, porque ninguna pantalla los lista (`docs/NOTAS_IT1.md`, Duda 2). Una persona tendría que conocerlos. Las reglas que la pantalla impide romper se prueban llamando a la API con la sesión; el webhook se envía firmado, como lo haría Izipay. `recepcion` y `especialista2` no iniciaron sesión en el recorrido, pero cada una aparece con una fila en `AUDITORIA`; no se investigó de qué operación vienen.
8. **Otros anchos.** El recorrido corre a 1440 px; 834 y 390 solo se revisaron con respuestas simuladas.
