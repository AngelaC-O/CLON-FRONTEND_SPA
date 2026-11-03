# Notas de la Iteración 1 · Front-end

## Estado

Pantallas listas (12 CUS): `IGU_Login` (CUS50, CUS51, con cambio de clave), inicio y menú por permisos (RF78), `IGU_Usuarios` (CUS52, CUS53), `IGU_Catalogo` (CUS57), `IGU_Recursos` (CUS61), `IGU_Clientas` (CUS01, CUS02), `IGU_Agenda` (CUS05, CUS06, CUS08) e `IGU_Atencion` (CUS11, con Mi agenda y Atención en curso). Faltan las pantallas de 8 CUS: CUS07, CUS13, CUS18 a CUS21, CUS44 y CUS45.

Comprobado:

- `npm run build` y `npm test -- --watch=false` pasan, con una prueba de componente por página.
- **Contra el back-end real (localhost:8080):** login con el usuario `recepcion` del script 15, redirección a `/cambio-clave`, 403 RF82 en lo demás, cookie XSRF y logout con su cabecera. Dejó sus filas de auditoría; la clave temporal no se cambió.
- **En el navegador, con respuestas simuladas:** inicio, usuarios, matriz y catálogo a 1440; recursos a 1440, 834 y 390; agenda a 1440, 834 y 390; Atención en curso a 1440; clientas a 390. Mi agenda y el modal de clientas se recorrieron a 1440 leyendo su contenido, sin revisar la imagen. El login, sin simular, a 1440 y 390.

**Sin comprobar contra el back-end real:** las escrituras de CUS52, CUS53, CUS57 y CUS61, ni el cambio de clave completo; tampoco ninguna operación de `IGU_Clientas`, `IGU_Agenda` ni `IGU_Atencion`, porque los usuarios de prueba reciben 403 RF82 hasta cambiar su clave temporal. Hacerlo deja datos en la base local y gasta esa clave.

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
5. **Tipos de documento.** El draw.io de CUS02 pide `GET /api/v1/tipos-documento` (CUS65), pero no está en el contrato ni en el back-end. `core/api/tipos-documento.ts` copia el script 07 y **supone los ids 1 a 5 por orden de inserción**: si la base los tiene distintos, la consulta y el registro usarán otro tipo. ¿Se expone ese endpoint?
6. **Quién es «yo» en Mi agenda.** `SesionDTO` no trae `idPersonal`, así que la especialista elige su código en un selector armado con la agenda del día, y solo aparece quien tenga franjas ese día. ¿Se agrega `idPersonal` a la sesión? Además, hoy cualquier usuario con esos permisos puede iniciar la cita de otra especialista.
7. **Atención ya iniciada.** No hay `GET` de la atención de una cita. El id se guarda en `sessionStorage`: en otra pestaña o equipo, o al cerrar la pestaña, no se puede continuar ni finalizar esa atención desde el front-end. ¿Se agrega `GET /atenciones?idCita=`?

## Diferencias encontradas

| N° | Dónde | Diferencia | Qué se hizo |
| --- | --- | --- | --- |
| 1 | `openapi.yaml` | El esquema `ProblemDetail` no declara `regla`, pero todos los ejemplos la traen en la raíz. | `core/api/problema.ts` la agrega al tipo. |
| 2 | `SesionDTO` frente al prototipo | La cabecera muestra nombre completo, rol, nombre de la sede y estado de la caja; la sesión solo da `nombreUsuario` e `idSede`. | Se muestra `nombreUsuario`, «Sede {idSede}» y un acceso a Caja sin estado. |
| 3 | Prototipo frente al draw.io | «Entrar» y «Cerrar sesión» frente a «Clic en Ingresar» y «Clic en Salir». | Manda el draw.io. |
| 4 | Prototipo frente al draw.io | Recursos es una pestaña de Catálogo; en el draw.io es `IGU_Recursos`, del módulo `sedes`. | Tiene su propia opción de menú, con el ícono de Sedes. |
| 5 | Prototipo frente al draw.io | «Mi agenda» y «Atención en curso» son dos opciones; el draw.io tiene una sola `IGU_Atencion`. | Son dos páginas y dos opciones de menú de esa frontera, como pide el encargo con los nodos 4:125 y 4:137. |
| 6 | Prototipo frente al alcance | Tiene 21 opciones de menú, mapa de 67 CUS, usuarios de demostración, «Ver como» y «¿Olvidaste tu contraseña?». | Fuera de esta iteración; no se construyeron. |
| 7 | Prototipo frente al contrato | Inicio muestra indicadores y pendientes sin endpoint. | Inicio solo da accesos a los módulos del rol. |
| 8 | `openapi.yaml` y draw.io | El cambio de clave está en el contrato, pero no en el draw.io (DF-18). | Se implementó: `debeCambiarClave` lo vuelve necesario. |
| 9 | Pedido frente a `U2.md` | El pedido nombra 7 módulos; `U2.md` tiene 10, más `comun`. | Se crean los 7: los demás no tienen CUS en esta iteración. |
| 10 | Módulo `pagos` | No tiene frontera `IGU_`, y el webhook de Izipay no lo llama el navegador. | Solo servicio y modelos del enlace de adelanto, sin rutas. |
| 11 | Figma | La página 01 es una instancia de código y, en la 02, los nodos 4:5, 4:17, 4:29, 4:41, 4:125, 4:137, 4:185 y 4:245 son imágenes: no entregan variables ni capas. | Los tokens salen del prototipo; esas imágenes se usan como referencia visual. |
| 12 | Figma y prototipo (login) | En móvil, el prototipo oculta el panel de la foto y Figma lo muestra encima del formulario. Figma también trae «¿Olvidaste tu contraseña?», acceso de demostración y mapa de CUS. | Manda Figma para el panel. Lo demás no tiene CUS en esta iteración y no se construyó. |
| 13 | Figma frente al contrato (inicio) | 4:17 muestra indicadores, próximas citas, pendientes y ocupación, sin operación en CUS50. El chip «Caja abierta» tampoco tiene dato. | No se inventan cifras: quedan saludo, fecha, sede, las dos acciones y accesos por permiso. |
| 14 | Figma frente al contrato (usuarios) | 4:245 lista a todos los usuarios con persona y último acceso; no hay `GET /usuarios` ni esos campos. | La tabla muestra solo los usuarios tocados en la pantalla, con el código del personal. Para los demás hay un formulario por código de usuario. |
| 15 | Figma frente al alcance (usuarios) | «Restablecer clave», «Desactivar», «Auditoría» e «Incidentes» son CUS54 a CUS56. | Fuera de esta iteración. |
| 16 | Prototipo frente al contrato (roles) | El prototipo dice que roles y permisos son listas fijas y muestra una matriz de solo lectura; el draw.io y `PUT /roles/{idRol}/permisos` permiten editarlos. | Matriz más formulario de edición (CUS53). Sin `GET` de permisos, módulo y acción se escriben, con sugerencias de los ya usados. |
| 17 | Figma y prototipo frente al contrato (catálogo) | 4:185 lista todos los servicios y permite editarlos; no hay `GET /servicios` ni `PUT`. También dice que las cinco áreas son fijas, pero el draw.io y `POST /areas` permiten crearlas. | Las tarjetas muestran solo lo registrado en la pantalla, sin «Editar servicio». Se puede crear área. |
| 18 | Figma frente al contrato (recursos) | El prototipo edita la limpieza y cambia el estado en la tabla, y lista todos los recursos; solo existe `POST /recursos`. | Tabla de solo lectura con lo registrado en la pantalla. Se usan los 7 tipos del contrato (el modal del prototipo omite Lavacabezas). |
| 19 | Figma frente al alcance (catálogo) | Las pestañas Paquetes, Promociones, Medios de pago, Series y Parámetros son de otros CUS. | Solo Servicios y Recursos; esta enlaza a `/sedes/recursos`, del módulo `sedes`. |
| 20 | `openapi.yaml` frente al back-end | `FiltroCambioClave` responde 403 con regla RF82 mientras la clave sea temporal; el contrato solo documenta el 403 `ACCESO_DENEGADO`. | El interceptor lleva a `/cambio-clave` al recibirlo. Conviene documentarlo en el contrato. |
| 21 | Figma frente al contrato (clientas) | 4:41 muestra última visita y saldo a favor; `ClienteDTO` no los trae. | Solo clienta, teléfono y origen de los datos. |
| 22 | Figma y draw.io (búsqueda) | Figma tiene un solo campo; el draw.io lee `nombres` y `telefono` por separado. | Un campo: si solo tiene dígitos busca por teléfono (coincidencia exacta en el back-end); si no, por nombre o apellido. Al abrir lista a todas, como en Figma. |
| 23 | Prototipo frente al contrato (consentimiento) | El prototipo pide consentimiento obligatorio y aparte acepta comunicaciones; el DTO solo trae `aceptaComunicaciones`, y el back-end pone la fecha. | Dos casillas: la obligatoria no se envía, solo impide guardar (RN27). |
| 24 | Figma frente al contrato (agenda) | 4:29 muestra nombres de clienta, especialista, recurso y servicio, y colores y filtro por línea; `BloqueAgendaDTO` solo trae ids. | Se muestran «Cita 950», «Especialista 4», «Variante 2». Sin filtro Salón/Spa. Los colores van por estado. |
| 25 | Figma frente al back-end (agenda) | La leyenda trae «Cancelada», pero `V_AGENDA_BLOQUES` excluye las canceladas. | Leyenda sin «Cancelada». |
| 26 | Prototipo frente al alcance (agenda) | La nueva cita cobra el adelanto en el mismo modal; es CUS07, que no se pidió aquí. Reprogramar y cancelar son otros CUS. | Solo se agenda. El adelanto queda para CUS07. |
| 27 | Figma frente al contrato (lista de espera) | «Lista de espera (1)» abre la lista; no hay `GET`. | El contador y la lista muestran solo lo anotado en la pantalla, con las horas libres que devuelve el `POST`. |
| 28 | Figma frente al contrato (atención) | 4:137 permite cambiar servicio, variante y tiempo durante la atención, y muestra clienta, precio y sesiones del paquete. `PATCH .../fin` solo recibe observaciones y `AtencionDTO` no trae esos datos. | El tiempo se declara al iniciar. Se muestran ids; el paquete se informa al finalizar, si vuelve `idClientePaquete`. |
| 29 | Figma y draw.io (botón) | «Finalizar atención» frente a «Clic en Finalizar». | Manda el draw.io. |
| 30 | Encargo frente a Figma (atención) | 4:137 trae «Recomendar producto» (CUS12). | No se construyó: es de la Iteración 2. |

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
10. **`./mvnw -q verify` no aplica aquí.** Este repositorio solo tiene el front-end; el back-end no se modificó.
11. **Solo los endpoints del CUS.** Inicio no llama a nada; Usuarios lee `GET /roles`; Catálogo lee `GET /areas`; Recursos no lee nada. Por eso no se usa `GET /citas/agenda` en Inicio aunque exista: es de CUS08.
12. **Datos que no vienen de una lista.** Código del personal, de producto y de usuario se escriben a mano (Duda 2). La sede del recurso se propone desde la sesión y se puede cambiar.
13. **Acciones según el permiso.** Además de la guarda de ruta, los botones de crear y editar se ocultan sin `CATALOGO:CREAR`, `SEGURIDAD:CREAR` o `SEGURIDAD:EDITAR`.
14. **Modales de formulario.** No se cierran al hacer clic afuera, para no perder lo escrito; solo con Cancelar o Escape. Cambia lo que hace el prototipo.
15. **Botones.** «+ Crear usuario», «+ Área», «+ Servicio» y «+ Recurso» abren el modal como en Figma; el que envía usa el «Clic en ...» del draw.io.
16. **Plan de commits de la entrega de seguridad y catálogo.** Las pruebas de cada módulo van en su propio commit después de todas las páginas: cabe en 8 y no mezcla módulos.
17. **Ficha verificada.** `fechaVerificacion` solo se envía si la consulta devolvió `ENCONTRADO` y el documento no cambió después. Sin ella, el back-end deja la ficha `MANUAL`. Para un RUC, la razón social va en `nombres`.
18. **Clienta en la cita.** La agenda usa `GET /clientes` por el «include» CUS01 del draw.io. Sin `CLIENTAS:VER`, se escribe su código.
19. **Horas y selectores de la cita.** Especialista y recurso solo ofrecen los ids que la hora libre elegida permite. Los selectores de filtro acumulan los ids vistos, porque no hay lista de personal ni de recursos.
20. **Bloques de la rejilla.** Las franjas `LIBRE` solo sirven para armar las columnas. Dos bloques que se cruzan en una columna se dibujarían encimados; el back-end impide los cruces.
21. **Formularios.** El tiempo exacto se pide al iniciar, en un modal, y no se calcula de la franja, porque su fin incluye la limpieza del recurso.
