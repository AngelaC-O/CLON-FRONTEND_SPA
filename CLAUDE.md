# Cautiva Spa · BackOffice web · Front-end (CS-BO-01, Iteración 1)

El back-end es otro repositorio; aquí solo llega su contrato, `docs/openapi.yaml`.

## Fuentes de verdad

| Fuente | Qué decide |
| --- | --- |
| `docs/openapi.yaml` | Endpoints y DTO. **Prohibido inventar** endpoints, campos o códigos. |
| `docs/Iteracion_1_Cautiva_Spa.drawio` | Las fronteras `IGU_` de cada CUS, con sus «Leer(...)» (campos) y «Clic en ...» (botones). |
| `docs/U2.md` | Dominio, reglas de negocio y módulos. |
| `docs/prototipo/` y [Figma](https://www.figma.com/design/NBnRtTNwLTJ9z1rGdXBxbq) | Diseño: escritorio 1440, tablet 834 con menú de íconos, móvil 390 con barra inferior y menú «Más». |

Si dos fuentes no coinciden, no se elige en silencio: se anota en `docs/NOTAS_IT1.md`.

## Alcance

Los 20 CUS de la iteración:

| Módulo | Frontera | CUS |
| --- | --- | --- |
| `seguridad` | `IGU_Login` | CUS50, CUS51 |
| `seguridad` | `IGU_Usuarios` | CUS52, CUS53 |
| `catalogo` | `IGU_Catalogo` | CUS57 |
| `sedes` | `IGU_Recursos` | CUS61 |
| `agenda` | `IGU_Clientas` | CUS01, CUS02 |
| `agenda` | `IGU_Agenda` | CUS05, CUS06, CUS07, CUS08 |
| `agenda` | `IGU_Atencion` | CUS11 |
| `ventas` | `IGU_VentaRapida` | CUS13 |
| `ventas` | `IGU_Cobro` | CUS18, CUS19, CUS20, CUS21 |
| `caja` | `IGU_Caja` | CUS44, CUS45 |
| `pagos` | sin frontera propia | cobro digital de CUS07 |

El prototipo muestra los 67 CUS: lo que está fuera de esta tabla no se construye.

## Estructura

```text
src/app/
  core/       api (modelos generados, ProblemDetail), sesion, interceptores, guardas, notificaciones
  layout/     menú lateral, cabecera, barra inferior, inicio y páginas comunes
  seguridad/ catalogo/ sedes/ agenda/ ventas/ pagos/ caja/
    <modulo>.routes.ts   rutas con carga diferida y guarda por permiso
    paginas/             componentes standalone con Reactive Forms
    servicios/           HttpClient; un método por operación del contrato
    modelos/             reexporta los tipos generados que usa el módulo
src/styles/   tokens.css (variables), base.css, componentes.css, layout.css
```

## Reglas de código

- Componentes standalone, rutas con carga diferida por módulo, Reactive Forms y `@angular/cdk`. Otra librería de interfaz solo se agrega justificándola en `docs/NOTAS_IT1.md`.
- `src/app/core/api/modelos.generados.ts` no se edita a mano: se regenera con `npm run modelos`.
- Las llamadas usan rutas relativas a `environment.apiBase`: así llevan la cookie de sesión (`withCredentials`) y la cabecera `X-XSRF-TOKEN`.
- Errores: `erroresInterceptor` muestra el mensaje de la regla en 409 y 422, y atiende 401, 403, 5xx y la falta de conexión. Los 400, 404 y 423 los muestra la página que los causó.
- Permisos: usar `PERMISOS` (`core/sesion/permisos.ts`) con `permisoGuard(...)` en la ruta y en `layout/menu.ts`. La guarda solo ordena la pantalla; quien autoriza es el back-end.
- Colores, tipografía, espaciado y radios salen de `src/styles/tokens.css`; las clases conservan los nombres del prototipo (`.card`, `.btn`, `.nv`, `.chip`...).
- Textos en español. Los botones usan el nombre del «Clic en ...» del draw.io.

## Comandos

```bash
npm start                      # ng serve con proxy.conf.json: /api va a http://localhost:8080
npm run modelos                # regenera los modelos desde docs/openapi.yaml
npm run build
npm test -- --watch=false
npm run e2e:bd                 # crea la base de la prueba e2e (borra solo su propio contenedor)
npm run e2e                    # recorrido de los 20 CUS; ver docs/pruebas_it1.md
```

## Git

**Nunca** hagas commits, push ni cambios de rama. Deja los cambios sin confirmar y, al final, entrega el PLAN DE COMMITS.
