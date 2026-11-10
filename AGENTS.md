# Cautiva Spa · BackOffice web · Front-end (CS-BO-01, Iteración 2)

El back-end es otro repositorio; aquí solo llega su contrato, `docs/openapi.yaml`. La Iteración 1 está cerrada (`v0.1.0-it1`).

## Fuentes de verdad

| Fuente | Qué decide |
| --- | --- |
| `docs/openapi.yaml` | Endpoints, DTO y el permiso de cada operación (`x-permiso`). **Prohibido inventar** endpoints, campos o códigos. |
| `docs/Iteracion_2_Cautiva_Spa.drawio` | Manda para los 27 CUS nuevos y los 12 modificados: las fronteras `IGU_`, con sus «Leer(...)» (campos) y «Clic en ...» (botones). |
| `docs/Iteracion_1_Cautiva_Spa.drawio` | Los CUS de la Iteración 1 que la Iteración 2 no modifica. |
| `docs/U2.md` | Dominio, reglas de negocio y módulos. |
| `docs/prototipo/` y [Figma](https://www.figma.com/design/NBnRtTNwLTJ9z1rGdXBxbq) | Diseño: escritorio 1440, tablet 834 con menú de íconos, móvil 390 con barra inferior y menú «Más». |

Si dos fuentes no coinciden, no se elige en silencio: se anota en `docs/NOTAS_IT2.md` (Dudas, Diferencias encontradas y Decisiones tomadas). `docs/NOTAS_IT1.md` queda como historia.

## Alcance

Los CUS de la Iteración 2:

| Módulo | Frontera | CUS |
| --- | --- | --- |
| `agenda` | `IGU_Clientas` | CUS03, CUS04 |
| `agenda` | `IGU_Agenda` | CUS09, CUS10, lista de espera de CUS05 y CUS06 |
| `agenda` | `IGU_Atencion` | CUS12 |
| `ventas` | `IGU_VentaProductos` | CUS25, CUS26 |
| `ventas` | `IGU_Anulacion` | CUS22 (solicitud), CUS23 (bandeja), CUS24 (devoluciones) |
| `ventas` | `IGU_SeriesComprobante` | CUS63 |
| `inventario` | `IGU_Inventario` | CUS66, CUS32 a CUS35 y consumos pendientes |
| `caja` | `IGU_Caja` | CUS46, con reapertura |
| `caja` | `IGU_Conciliacion` | CUS47 |
| `reportes` | `IGU_Reportes` | CUS48, CUS49 |
| `seguridad` | `IGU_Usuarios` | CUS54 |
| `seguridad` | `IGU_Auditoria` | CUS55 |
| `seguridad` | `IGU_Parametros` | CUS65 |
| `seguridad` | panel de avisos de Inicio | CUS50 |
| `catalogo` | `IGU_Catalogo` | CUS58 a CUS60 |
| `pagos` | `IGU_MediosPago` | CUS62 |

Los 20 CUS de la Iteración 1 siguen en pie y sus recorridos deben seguir funcionando (`e2e/recorrido.e2e.ts`). El prototipo muestra los 67 CUS: lo que no está en esta tabla ni en la Iteración 1 no se construye.

## Estructura

```text
src/app/
  core/       api (modelos y permisos generados, listas, ProblemDetail), sesion, interceptores, guardas, notificaciones
  layout/     menú lateral, cabecera, barra inferior, inicio con sus avisos y componentes comunes
  seguridad/ catalogo/ sedes/ agenda/ ventas/ pagos/ caja/ inventario/ reportes/
    <modulo>.routes.ts   rutas con carga diferida y guarda por permiso
    paginas/             componentes standalone con Reactive Forms
    servicios/           HttpClient; un método por operación del contrato
    modelos/             reexporta los tipos generados que usa el módulo
src/styles/   tokens.css (variables), base.css, componentes.css, layout.css
src/testing/  apoyo de las pruebas (entrarComo: sesión con GET /auth/sesion)
scripts/      permisos.mjs: genera core/api/permisos.generados.ts desde x-permiso
```

## Reglas de código

- Componentes standalone, rutas con carga diferida por módulo, Reactive Forms y `@angular/cdk`. Otra librería de interfaz solo se agrega justificándola en `docs/NOTAS_IT2.md`.
- `src/app/core/api/modelos.generados.ts` y `permisos.generados.ts` no se editan a mano: se regeneran con `npm run modelos`.
- Las llamadas usan rutas relativas a `environment.apiBase`: así llevan la cookie de sesión (`withCredentials`) y la cabecera `X-XSRF-TOKEN`.
- Sesión: al cargar, `GET /auth/sesion` (401: login). El navegador no guarda la sesión, la venta, la caja ni la atención: se piden al back-end.
- Listas en lugar de códigos: tipos de documento, medios de pago, servicios, promociones y paquetes salen de sus `GET` (`core/api/listas.service.ts`). No hay copias fijas de ids.
- Errores: `erroresInterceptor` muestra el mensaje de la regla en 409 y 422, y atiende 401, 403, 5xx y la falta de conexión. Los 400, 404 y 423 los muestra la página que los causó; las reglas que el usuario debe corregir (RN48, RN49, RN50) también se muestran junto al formulario.
- Permisos: usar `PERMISOS` (`core/sesion/permisos.ts`, cuyos valores salen del `x-permiso` de una operación) con `permisoGuard(...)` en la ruta y en `layout/menu.ts`. La guarda solo ordena la pantalla; quien autoriza es el back-end.
- Colores, tipografía, espaciado y radios salen de `src/styles/tokens.css`; las clases conservan los nombres del prototipo (`.card`, `.btn`, `.nv`, `.chip`...).
- Textos en español. Los botones usan el nombre del «Clic en ...» del draw.io.
- Una prueba de componente por cada página tocada.

## Comandos

```bash
npm start                      # ng serve con proxy.conf.json: /api va a http://localhost:8080
npm run modelos                # regenera modelos y permisos desde docs/openapi.yaml
npm run build
npm test -- --watch=false
npm run e2e:bd                 # crea la base de la prueba e2e (borra solo su propio contenedor)
npm run e2e                    # recorrido de los CUS de la Iteración 1; ver docs/pruebas_it1.md
```

## Git

**Nunca** hagas commits, push ni cambios de rama. Deja los cambios sin confirmar y, al final, entrega el PLAN DE COMMITS.
