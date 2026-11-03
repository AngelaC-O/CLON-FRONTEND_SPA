# Notas de la Iteración 1 · Front-end

## Estado

Está lista la base: configuración, tokens, `core/`, layout, rutas, servicios HTTP y modelos de los 7 módulos, inicio y cierre de sesión (CUS50 y CUS51) y cambio de clave. Las demás fronteras `IGU_` son páginas de reserva, sin formularios: faltan las pantallas de 18 CUS.

Comprobado: `npm run build` y `npm test -- --watch=false` pasan, y el layout se revisó en el navegador a 1440, 834 y 390. **Sin comprobar:** el flujo contra el back-end real (cookie de sesión, XSRF, respuestas de login), porque no estaba corriendo durante el trabajo; el proxy respondió 502. Las pruebas usan respuestas simuladas.

## Dudas

1. **Códigos de permiso.** `openapi.yaml` no dice qué permiso exige cada operación y solo trae tres códigos de ejemplo (`AGENDA:VER`, `CLIENTAS:CREAR`, `VENTAS:CREAR`). `core/sesion/permisos.ts` usa los `@PreAuthorize` del repositorio del back-end. ¿Se puede agregar el permiso al contrato (por ejemplo, `x-permiso`)?
2. **Listas que faltan en el contrato.** Sin estas lecturas, varios campos de las fronteras solo se pueden llenar escribiendo el id a mano. ¿Se agregan al back-end o las pantallas piden el id?

   | Falta `GET` de | Lo necesita |
   | --- | --- |
   | Servicios y variantes (`idVariante`) | CUS05, CUS06, CUS13, CUS21 |
   | Personal (`idPersonal`) | CUS08, CUS13, CUS52 |
   | Recursos (`idRecurso`) | CUS08, CUS13 |
   | Medios de pago (`idMedioPago`) | CUS07, CUS13, CUS18, CUS45 |
   | Tipos de documento (`idTipoDocumento`) | CUS02, CUS13, CUS19 |
   | Sedes (`idSede`) | CUS61 |
   | Usuarios (`idUsuario`) | CUS53 |
   | Citas por atender (`idCita`) y atenciones por cobrar (`idAtencion`) | CUS07, CUS11, CUS18 |
   | Promociones y paquetes | CUS18, CUS21 |
   | Producto (`idProducto`) | CUS57 |
   | Caja abierta (`idCaja`) | CUS45 y el estado de la cabecera |

3. **Sesión al recargar.** No hay un `GET` de la sesión actual. Ver la decisión 3. ¿Conviene agregarlo?
4. **Plan de commits.** Con 7 módulos, un commit por módulo más configuración, `core/`, pruebas y documentación no cabe en 8 commits. Ver la decisión 9.

## Diferencias encontradas

| N° | Dónde | Diferencia | Qué se hizo |
| --- | --- | --- | --- |
| 1 | `openapi.yaml` | El esquema `ProblemDetail` no declara `regla`, pero todos los ejemplos la traen en la raíz. | `core/api/problema.ts` la agrega al tipo. |
| 2 | `SesionDTO` frente al prototipo | La cabecera muestra nombre completo, rol, nombre de la sede y estado de la caja; la sesión solo da `nombreUsuario` e `idSede`. | Se muestra `nombreUsuario`, «Sede {idSede}» y un acceso a Caja sin estado. |
| 3 | Prototipo frente al draw.io | «Entrar» y «Cerrar sesión» frente a «Clic en Ingresar» y «Clic en Salir». | Manda el draw.io. |
| 4 | Prototipo frente al draw.io | Recursos es una pestaña de Catálogo; en el draw.io es `IGU_Recursos`, del módulo `sedes`. | Tiene su propia opción de menú, con el ícono de Sedes. |
| 5 | Prototipo frente al draw.io | «Mi agenda» y «Atención en curso» son dos opciones; el draw.io tiene una sola `IGU_Atencion`. | Queda solo «Atención en curso». |
| 6 | Prototipo frente al alcance | Tiene 21 opciones de menú, mapa de 67 CUS, usuarios de demostración, «Ver como» y «¿Olvidaste tu contraseña?». | Fuera de esta iteración; no se construyeron. |
| 7 | Prototipo frente al contrato | Inicio muestra indicadores y pendientes sin endpoint. | Inicio solo da accesos a los módulos del rol. |
| 8 | `openapi.yaml` y draw.io | El cambio de clave está en el contrato, pero no en el draw.io (DF-18). | Se implementó: `debeCambiarClave` lo vuelve necesario. |
| 9 | Pedido frente a `U2.md` | El pedido nombra 7 módulos; `U2.md` tiene 10, más `comun`. | Se crean los 7: los demás no tienen CUS en esta iteración. |
| 10 | Módulo `pagos` | No tiene frontera `IGU_`, y el webhook de Izipay no lo llama el navegador. | Solo servicio y modelos del enlace de adelanto, sin rutas. |
| 11 | Figma | La página 01 es una instancia de código y `get_variable_defs` exige una capa seleccionada. No se revisaron los marcos de la página 02. | Los tokens salen del prototipo; sus cortes (1100 y 700 px) dan los tres tamaños pedidos. Falta contrastar con la página 02. |

## Decisiones tomadas

1. **Sin otra librería de interfaz.** Solo `@angular/cdk`: `Dialog` para «Más» y `CdkMenu` para el menú del usuario. Por eso `angular.json` carga `overlay-prebuilt.css`.
2. **Modelos generados con `openapi-typescript`, sin instalarlo.** Pide TypeScript 5 y el proyecto usa el 6, así que `npm run modelos` lo ejecuta con `npx` y versiones fijas. Conserva los nombres del contrato (`CitaDTO`).
3. **Sesión en `sessionStorage`.** Guarda solo el `SesionDTO`, sin credenciales, para conservar el menú al recargar. La autoridad sigue siendo la cookie: el primer 401 limpia el estado y lleva al login. Se pierde al cerrar la pestaña.
4. **Sesión en `core/`.** Login, logout y cambio de clave están en `SesionService`; así `core/` y `layout/` no dependen de ningún módulo.
5. **Guardas.** `permisoGuard` exige alguno de los permisos indicados. Con `debeCambiarClave` lleva primero a `/cambio-clave`.
6. **Quién muestra cada error.** El interceptor avisa 401, 403, 409, 422, 5xx y falta de conexión; siempre devuelve el error. Los 400 y 423 del login y del cambio de clave se muestran en su formulario.
7. **CUS13 en `ventas`.** Sus endpoints y `IGU_VentaRapida` son de venta rápida, aunque `U2.md` reparte el caso entre `agenda` (atención) y `ventas` (cobro).
8. **Accesibilidad.** Las clases son las del prototipo; los botones de navegación pasaron a enlaces (`routerLink`) y los campos tienen `label` asociado.
9. **Plan de commits.** Para no pasar de 8 commits ni mezclar dos módulos: configuración, `core/`, layout y `pagos` van juntos en el primero, y las pruebas de `seguridad` y `agenda` van en el commit de su módulo, no al final. `app.routes.ts` va en el último porque importa todos los módulos.
10. **`./mvnw -q verify` no aplica aquí.** Este repositorio solo tiene el front-end; el back-end no se ejecutó ni se modificó.
