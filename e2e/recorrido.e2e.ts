import { Browser, BrowserContext, expect, Page, request, test } from '@playwright/test';
import { createHmac } from 'node:crypto';
import { rmSync } from 'node:fs';
import {
  api,
  aviso,
  cambiarClaveTemporal,
  CLAVE_ADMIN,
  CLAVE_ESPECIALISTA,
  CLAVE_TEMPORAL,
  claves,
  elegirClienta,
  iniciarSesion,
  modal,
  obtenido,
  sql,
  valor,
} from './apoyo';
import { PUERTO_API } from './entorno.mjs';

/**
 * Recorrido de la Iteración 1 contra el back-end en perfil dev y una base recién instalada.
 * Los pasos dependen unos de otros. Los códigos que ninguna pantalla muestra se leen de la base
 * (ver docs/NOTAS_IT1.md, Duda 2); lo demás se hace con clics, como lo haría cada actora.
 */
const CLAVE_INICIAL_RECEPCION = 'InicialRecep2026';
const CLAVE_RECEPCION = 'RecepcionE2e2026';
const CLIENTA_DNI = 'Zoraida';
const CLIENTA_CE = 'Yolanda';
const PRECIO = 60;
const ADELANTO_EFECTIVO = 10;
const ADELANTO_ENLACE = 20;

test.describe.configure({ mode: 'serial' });

let contextos: BrowserContext[];
let admin: Page;
let recepcion: Page;
let especialista: Page;

let idUsuarioRecepcion: string;
let idVariante: string;
let idRecurso: string;
let idEspecialista: string;
let idCitaEfectivo: number;
let idCitaEnlace: number;
let idAtencion: string;
let primeraBoleta: string;

async function nuevaPagina(browser: Browser): Promise<Page> {
  const contexto = await browser.newContext();
  contextos.push(contexto);
  const pagina = await contexto.newPage();
  // Sin diálogo de impresión en la prueba: basta con saber que se llamó.
  await pagina.addInitScript(() => {
    (window as unknown as { impresiones: number }).impresiones = 0;
    window.print = () => {
      (window as unknown as { impresiones: number }).impresiones++;
    };
  });
  return pagina;
}

/** Elige la opción de un selector por su texto visible (los value de Angular no son los ids). */
async function elegirPorTexto(page: Page, selector: string, texto: string): Promise<void> {
  const opcion = page.locator(`${selector} option`, { hasText: texto }).first();
  await page.locator(selector).selectOption({ label: ((await opcion.textContent()) ?? '').trim() });
}

/**
 * Servicio y variante desde GET /servicios (It. 2). Sin CATALOGO:VER la pantalla deja el código de
 * la variante, como en la Iteración 1.
 */
async function elegirVariante(
  page: Page,
  prefijo: string,
  servicio: string,
  variante: string | null,
  idVariante: string,
): Promise<void> {
  const servicios = page.locator(`#${prefijo}Servicio`);
  if ((await servicios.count()) === 0) {
    await page.locator(`#${prefijo}IdVariante`).fill(idVariante);
    return;
  }
  await elegirPorTexto(page, `#${prefijo}Servicio`, servicio);
  if (variante) {
    await elegirPorTexto(page, `#${prefijo}IdVariante`, variante);
  }
}

async function verHoras(page: Page, variante: string): Promise<string[]> {
  await page.getByRole('button', { name: '+ Nueva cita' }).click();
  await elegirVariante(page, 'cita', 'Corte E2E', 'Normal', variante);
  await page.getByRole('button', { name: 'Ver disponibilidad' }).click();
  const horas = modal(page).getByRole('button', { name: /^\d\d:\d\d$/ });
  await expect(horas.first()).toBeVisible();
  return horas.allTextContents().then((textos) => textos.map((t) => t.trim()));
}

async function elegirHoraYRecurso(page: Page, hora: string): Promise<void> {
  await modal(page).getByRole('button', { name: hora, exact: true }).click();
  // It. 2: el recurso se muestra con su nombre (GET /citas/filtros).
  await page.locator('#citaIdRecurso').selectOption({ label: 'Sillón E2E' });
}

test.beforeAll(async ({ browser }) => {
  const ahora = new Date();
  const lima = new Date(ahora.toLocaleString('en-US', { timeZone: 'America/Lima' }));
  const minutos = lima.getHours() * 60 + lima.getMinutes();
  if (lima.getDay() === 0 || minutos < 9 * 60 || minutos > 17 * 60 + 30) {
    throw new Error('El recorrido atiende hoy: córrelo de lunes a sábado, de 09:00 a 17:30.');
  }
  rmSync('test-results/obtenido.txt', { force: true });
  contextos = [];
  admin = await nuevaPagina(browser);
  recepcion = await nuevaPagina(browser);
  especialista = await nuevaPagina(browser);
});

test.afterAll(async () => {
  await Promise.all(contextos.map((contexto) => contexto.close()));
});

test('CUS50: la administradora entra con la clave temporal y la cambia', async () => {
  await iniciarSesion(admin, 'admin', 'ClaveEquivocada1');
  await expect(admin.locator('.alert.bad')).toBeVisible();
  await iniciarSesion(admin, 'admin', CLAVE_TEMPORAL);
  // RF82: con la clave temporal, lo demás responde 403.
  await expect(admin).toHaveURL(/\/cambio-clave/);
  const bloqueado = await api(admin, 'get', '/roles');
  expect(bloqueado.status).toBe(403);
  await cambiarClaveTemporal(admin, CLAVE_TEMPORAL, CLAVE_ADMIN);
  expect((await api(admin, 'get', '/roles')).status).toBe(200);
  obtenido('CUS50', `403 ${String(bloqueado.json['regla'])} antes del cambio; 200 después`);
});

test('CUS52: registra el usuario de la Recepcionista Dos', async () => {
  const idPersonal = valor("SELECT id_persona FROM PERSONA WHERE numero_documento = '70000003'");
  const nombre = valor(
    "SELECT nombres || ' ' || apellidos FROM PERSONA WHERE numero_documento = '70000003'",
  );
  await admin.goto('/seguridad/usuarios');
  await admin.getByRole('button', { name: '+ Crear usuario' }).click();
  // It. 2: el personal sin usuario sale de GET /usuarios/personal-sin-usuario.
  await expect(admin.locator('#idPersonal option', { hasText: nombre })).toHaveCount(1);
  await elegirPorTexto(admin, '#idPersonal', nombre);
  await admin.locator('#nombreUsuario').fill('recepcion2');
  await admin.locator('#clave').fill(CLAVE_INICIAL_RECEPCION);
  await admin.locator('#idRol').selectOption({ label: 'ENCARGADA_ALMACEN' });
  await admin.getByRole('button', { name: 'Registrar usuario' }).click();
  await expect(admin.locator('tbody')).toContainText('recepcion2');
  idUsuarioRecepcion = valor("SELECT id_usuario FROM USUARIO WHERE nombre_usuario = 'recepcion2'");
  expect(
    valor(`SELECT debe_cambiar_clave FROM USUARIO WHERE id_usuario = ${idUsuarioRecepcion}`),
  ).toBe('S');
  obtenido(
    'CUS52',
    `usuario ${idUsuarioRecepcion} del personal ${idPersonal}, debe cambiar su clave`,
  );
});

test('CUS53: le asigna el rol y ajusta los permisos del rol', async () => {
  // It. 2: la tabla lista a todos los usuarios (GET /usuarios).
  const fila = admin.locator('tbody tr', { hasText: 'recepcion2' });
  await fila.getByLabel('Rol del usuario').selectOption({ label: 'RECEPCIONISTA' });
  const asignacion = admin.waitForResponse((r) => r.url().endsWith('/rol'));
  await fila.getByRole('button', { name: 'Asignar rol' }).click();
  expect((await asignacion).ok()).toBe(true);
  expect(
    valor(
      `SELECT r.nombre FROM USUARIO u JOIN ROL r ON r.id_rol = u.id_rol WHERE u.id_usuario = ${idUsuarioRecepcion}`,
    ),
  ).toBe('RECEPCIONISTA');

  await admin.getByRole('tab', { name: 'Matriz de permisos' }).click();
  await admin.locator('#rolIdRol').selectOption({ label: 'RECEPCIONISTA' });
  // It. 2: casillas con los permisos de GET /permisos, en lugar de escribir módulo y acción.
  const nuevo = admin.locator('input[name="RECORDATORIOS:EDITAR"]');
  await expect(nuevo).not.toBeChecked();
  const total = (await admin.locator('fieldset input[type="checkbox"]:checked').count()) + 1;
  await nuevo.check();
  const guardado = admin.waitForResponse((r) => r.url().includes('/permisos'));
  await admin.getByRole('button', { name: 'Guardar permisos del rol' }).click();
  expect((await guardado).ok()).toBe(true);
  const cuantos = valor(
    "SELECT COUNT(*) FROM ROL_PERMISO rp JOIN ROL r ON r.id_rol = rp.id_rol JOIN PERMISO p ON p.id_permiso = rp.id_permiso WHERE r.nombre = 'RECEPCIONISTA' AND p.modulo = 'RECORDATORIOS' AND p.accion = 'EDITAR'",
  );
  expect(cuantos).toBe('1');
  obtenido('CUS53', `rol RECEPCIONISTA; ${total} permisos, con RECORDATORIOS:EDITAR nuevo`);
});

test('CUS57: registra un área y un servicio con dos variantes', async () => {
  await admin.goto('/catalogo');
  await admin.getByRole('button', { name: '+ Área' }).click();
  await admin.locator('#nombreArea').fill('Barbería E2E');
  await modal(admin).getByRole('button', { name: 'Nueva área' }).click();
  await expect(admin.getByRole('button', { name: 'Barbería E2E' })).toBeVisible();

  // En el área de especialista1: la nueva no tiene personal y CUS36 es de otra iteración.
  await admin.getByRole('button', { name: '+ Servicio' }).click();
  await admin.locator('#nombre').fill('Corte E2E');
  await admin.locator('#idArea').selectOption({ label: 'Peluquería y Estilismo' });
  await admin.locator('#duracionRefMin').fill('30');
  await admin.locator('#tipoRecurso').selectOption({ label: 'Sillón' });
  await admin.getByLabel('Nombre de la variante 1').fill('Normal');
  await admin.getByLabel('Precio de la variante 1').fill(String(PRECIO));
  await admin.getByRole('button', { name: '+ Variante' }).click();
  await admin.getByLabel('Nombre de la variante 2').fill('Niña');
  await admin.getByLabel('Precio de la variante 2').fill('35');
  await modal(admin).getByRole('button', { name: 'Guardar servicio' }).click();
  await expect(admin.locator('.gf2')).toContainText('Corte E2E');
  await expect(admin.locator('.gf2')).toContainText('Niña');
  const variantes = sql(
    "SELECT v.id_variante, v.nombre, v.precio FROM VARIANTE_SERVICIO v JOIN SERVICIO s ON s.id_servicio = v.id_servicio WHERE s.nombre = 'Corte E2E' ORDER BY v.precio DESC",
  );
  expect(variantes).toHaveLength(2);
  idVariante = variantes[0][0];
  obtenido('CUS57', `área Barbería E2E; variantes ${variantes.map((v) => v.join(' ')).join(', ')}`);
});

test('CUS61 y RN03: registra un recurso con su limpieza, de 0 a 10 min', async () => {
  await admin.goto('/sedes/recursos');
  // It. 2: la tabla lista los recursos de la sede (GET /recursos).
  const antes = Number(valor('SELECT COUNT(*) FROM RECURSO WHERE id_sede = 1'));
  await expect(admin.locator('tbody tr')).toHaveCount(antes);
  await admin.getByRole('button', { name: '+ Recurso' }).click();
  await admin.locator('#nombre').fill('Sillón E2E');
  await admin.locator('#tipo').selectOption({ label: 'Sillón' });
  // La pantalla solo ofrece de 0 a 10; el back-end también rechaza 11.
  await expect(admin.locator('#minutosLimpieza option')).toHaveCount(12);
  const fuera = await api(admin, 'post', '/recursos', {
    idSede: 1,
    nombre: 'Sillón E2E',
    tipo: 'SILLON',
    minutosLimpieza: 11,
  });
  expect(fuera.status).toBe(422);
  expect(valor("SELECT COUNT(*) FROM RECURSO WHERE nombre = 'Sillón E2E'")).toBe('0');

  await admin.locator('#minutosLimpieza').selectOption({ label: '10 min' });
  await modal(admin).getByRole('button', { name: 'Guardar recurso' }).click();
  await expect(admin.locator('tbody')).toContainText('Sillón E2E');
  idRecurso = valor("SELECT id_recurso FROM RECURSO WHERE nombre = 'Sillón E2E'");
  obtenido('CUS61', `recurso ${idRecurso} con 10 min; 11 min responde ${fuera.status} (RN03)`);
});

test('CUS44 y RN30: la recepcionista abre la caja, y solo una por sede', async () => {
  await iniciarSesion(recepcion, 'recepcion2', CLAVE_INICIAL_RECEPCION);
  await cambiarClaveTemporal(recepcion, CLAVE_INICIAL_RECEPCION, CLAVE_RECEPCION);
  await recepcion.goto('/caja');
  await recepcion.locator('#cajaMontoInicial').fill('100');
  await recepcion.getByRole('button', { name: 'Abrir caja' }).click();
  await expect(recepcion.getByText(/Abierta desde/)).toBeVisible();
  await expect(recepcion.locator('.gf1')).toContainText('S/ 100.00');
  const segunda = await api(recepcion, 'post', '/cajas', { montoInicial: 50 });
  expect(segunda.status).toBe(409);
  obtenido(
    'CUS44',
    `caja abierta con S/ 100; otra apertura responde 409 ${String(segunda.json['regla'])}`,
  );
});

test('CUS01, CUS02, RN27 y RN45: busca, no existe y la registra con DNI consultado', async () => {
  await recepcion.goto('/agenda/clientas');
  await recepcion.locator('#buscarClienta').fill(CLIENTA_DNI);
  await recepcion.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(recepcion.getByText('No se encontraron clientas.')).toBeVisible();

  await recepcion.getByRole('button', { name: '+ Registrar clienta' }).click();
  await recepcion.locator('#idTipoDocumento').selectOption({ label: 'DNI' });
  await recepcion.locator('#numeroDocumento').fill('45678912');
  const consulta = recepcion.waitForResponse((r) => r.url().includes('/consulta-documento'));
  await recepcion.getByRole('button', { name: 'Consultar documento' }).click();
  const respuesta = await consulta;
  const resultado = (await respuesta.json()) as { resultado: string };
  // El simulador de APISPERU del perfil dev siempre responde ERROR: la ficha se completa a mano.
  await expect(modal(recepcion).locator('.alert.warn')).toBeVisible();

  await recepcion.locator('#nombres').fill(CLIENTA_DNI);
  await recepcion.locator('#apellidos').fill('Quispe');
  await recepcion.locator('#telefono').fill('987654321');
  await modal(recepcion).getByRole('button', { name: 'Registrar', exact: true }).click();
  await expect(modal(recepcion).locator('.alert.bad')).toContainText('RN27');
  expect(valor(`SELECT COUNT(*) FROM PERSONA WHERE nombres = '${CLIENTA_DNI}'`)).toBe('0');

  await recepcion.locator('#consentimiento').check();
  await modal(recepcion).getByRole('button', { name: 'Registrar', exact: true }).click();
  await expect(recepcion.locator('tbody')).toContainText(CLIENTA_DNI);
  const ficha = sql(
    `SELECT p.origen_datos, c.fecha_consentimiento FROM PERSONA p JOIN CLIENTE c ON c.id_cliente = p.id_persona WHERE p.nombres = '${CLIENTA_DNI}'`,
  )[0];
  expect(ficha[0]).toBe('MANUAL');
  expect(ficha[1]).not.toBe('');
  obtenido(
    'CUS02',
    `consulta DNI: HTTP ${respuesta.status()} ${resultado.resultado}; ficha ${ficha[0]}, consentimiento con fecha`,
  );
});

test('CUS02, RN01 y RN45: registra otra con carnet de extranjería a mano', async () => {
  await recepcion.getByRole('button', { name: '+ Registrar clienta' }).click();
  await recepcion.locator('#idTipoDocumento').selectOption({ label: 'CE' });
  await expect(modal(recepcion).getByRole('button', { name: 'Consultar documento' })).toHaveCount(
    0,
  );
  await recepcion.locator('#numeroDocumento').fill('X12345678');
  await recepcion.locator('#nombres').fill(CLIENTA_CE);
  await recepcion.locator('#apellidos').fill('Mendoza');
  await recepcion.locator('#telefono').fill('987654321');
  await recepcion.locator('#consentimiento').check();
  const repetido = recepcion.waitForResponse(
    (r) => r.url().endsWith('/clientes') && r.request().method() === 'POST',
  );
  await modal(recepcion).getByRole('button', { name: 'Registrar', exact: true }).click();
  const estadoRepetido = (await repetido).status();
  expect(estadoRepetido).toBe(409);
  await expect(modal(recepcion)).toBeVisible();

  await recepcion.locator('#telefono').fill('987654322');
  await modal(recepcion).getByRole('button', { name: 'Registrar', exact: true }).click();
  await expect(recepcion.locator('tbody')).toContainText(CLIENTA_CE);
  expect(valor(`SELECT origen_datos FROM PERSONA WHERE nombres = '${CLIENTA_CE}'`)).toBe('MANUAL');
  obtenido('CUS02', `CE a mano: ficha MANUAL; teléfono repetido responde ${estadoRepetido} (RN01)`);
});

test('CUS08: consulta la agenda del día', async () => {
  idEspecialista = valor("SELECT id_personal FROM USUARIO WHERE nombre_usuario = 'especialista1'");
  await recepcion.goto('/agenda');
  await expect(recepcion.locator('.cabeza').first()).toBeVisible();
  // It. 2: columnas con nombres, no códigos (diferencia 24).
  const nombreEspecialista = valor(
    `SELECT nombres || ' ' || apellidos FROM PERSONA WHERE id_persona = ${idEspecialista}`,
  );
  await expect(recepcion.locator('.rejilla')).toContainText(nombreEspecialista);
  await recepcion.getByRole('button', { name: 'Por recurso' }).click();
  await expect(recepcion.locator('.rejilla')).toContainText('Sillón E2E');
  obtenido('CUS08', `columnas por especialista y por recurso, con el recurso ${idRecurso}`);
});

test('CUS05, RN01, RN02 y RN03: programa una cita; otra a la misma hora responde 409', async () => {
  // Una cita sin clienta no llega ni a la base (RN01).
  const sinClienta = await api(recepcion, 'post', '/citas', {
    idVariante: Number(idVariante),
    idPersonal: Number(idEspecialista),
    idRecurso: Number(idRecurso),
    fechaHoraInicio: '2030-01-07T10:00:00',
    duracionMin: 30,
  });
  expect(sinClienta.status).toBe(400);

  // Otra pestaña ve las mismas horas libres antes de que la primera agende. La sesión sale de la
  // cookie con GET /auth/sesion: el navegador ya no la guarda (It. 2).
  const otra = await recepcion.context().newPage();
  await otra.goto('/agenda');

  const horas = await verHoras(recepcion, idVariante);
  await verHoras(otra, idVariante);
  const hora = horas[0];
  await elegirClienta(modal(recepcion), CLIENTA_DNI);
  await elegirClienta(modal(otra), CLIENTA_CE);
  await elegirHoraYRecurso(recepcion, hora);
  await elegirHoraYRecurso(otra, hora);

  const creada = recepcion.waitForResponse(
    (r) => r.url().endsWith('/citas') && r.request().method() === 'POST',
  );
  await modal(recepcion).getByRole('button', { name: 'Agendar' }).click();
  const cita = await creada;
  expect(cita.status()).toBe(201);
  idCitaEfectivo = ((await cita.json()) as { idCita: number }).idCita;
  await expect(recepcion.getByText(`Cita ${idCitaEfectivo} agendada.`).first()).toBeVisible();

  const cruce = otra.waitForResponse(
    (r) => r.url().endsWith('/citas') && r.request().method() === 'POST',
  );
  await modal(otra).getByRole('button', { name: 'Agendar' }).click();
  const respuesta = await cruce;
  expect(respuesta.status()).toBe(409);
  const problema = (await respuesta.json()) as { regla: string; detail: string };
  await expect(aviso(otra)).toContainText(problema.detail);
  await expect(modal(otra)).toBeVisible();
  await otra.close();

  const minutos = valor(
    `SELECT ROUND((CAST(fecha_hora_fin AS DATE) - CAST(fecha_hora_inicio AS DATE)) * 1440) FROM CITA WHERE id_cita = ${idCitaEfectivo}`,
  );
  expect(minutos).toBe('40');
  obtenido(
    'CUS05',
    `cita ${idCitaEfectivo} a las ${hora}; 30 min + 10 de limpieza = ${minutos} (RN03)`,
  );
  obtenido('RN02', `misma hora: HTTP 409 regla ${problema.regla}: ${problema.detail}`);
  obtenido('RN01', `cita sin clienta: HTTP ${sinClienta.status}`);
});

test('CUS06: la anota en la lista de espera', async () => {
  await recepcion.getByRole('button', { name: /Lista de espera/ }).click();
  await elegirClienta(modal(recepcion), CLIENTA_CE);
  await elegirVariante(recepcion, 'espera', 'Corte E2E', 'Normal', idVariante);
  // Al anotarla, el panel del día vuelve a leer GET /citas/lista-espera: se espera el POST.
  const espera = recepcion.waitForResponse(
    (r) => r.url().includes('/lista-espera') && r.request().method() === 'POST',
  );
  await modal(recepcion).getByRole('button', { name: 'Anotar en lista de espera' }).click();
  expect((await espera).status()).toBe(201);
  await expect(recepcion.getByRole('button', { name: 'Lista de espera (1)' })).toBeVisible();
  expect(valor('SELECT COUNT(*) FROM LISTA_ESPERA')).toBe('1');
  obtenido('CUS06', 'una fila en LISTA_ESPERA; el panel del día la lista y el contador marca (1)');
});

test('CUS07 y RN04: registra un adelanto en efectivo', async () => {
  await recepcion.getByRole('button', { name: 'Registrar adelanto' }).click();
  await expect(recepcion.locator('#adelantoIdCita')).toHaveValue(String(idCitaEfectivo));
  await recepcion.locator('#adelantoMonto').fill(String(ADELANTO_EFECTIVO));
  await modal(recepcion).getByRole('button', { name: 'Registrar adelanto en efectivo' }).click();
  await expect(modal(recepcion)).toBeHidden();
  const fila = sql(
    `SELECT adelanto_monto, id_medio_pago, id_caja FROM CITA WHERE id_cita = ${idCitaEfectivo}`,
  )[0];
  expect(fila[0]).toBe(String(ADELANTO_EFECTIVO));
  expect(fila[2]).not.toBe('');
  obtenido('CUS07', `efectivo: S/ ${fila[0]} en la caja ${fila[2]}`);
});

test('CUS07, RN04 y RN42: el adelanto por enlace solo cuenta cuando Izipay lo aprueba', async () => {
  await recepcion.reload();
  const horas = await verHoras(recepcion, idVariante);
  await elegirClienta(modal(recepcion), CLIENTA_CE);
  await elegirHoraYRecurso(recepcion, horas[horas.length - 1]);
  const creada = recepcion.waitForResponse(
    (r) => r.url().endsWith('/citas') && r.request().method() === 'POST',
  );
  await modal(recepcion).getByRole('button', { name: 'Agendar' }).click();
  idCitaEnlace = ((await (await creada).json()) as { idCita: number }).idCita;

  await recepcion.getByRole('button', { name: 'Registrar adelanto' }).click();
  await recepcion.locator('#adelantoMonto').fill(String(ADELANTO_ENLACE));
  await modal(recepcion).getByRole('button', { name: 'Tarjeta' }).click();
  await modal(recepcion).getByRole('button', { name: 'Generar enlace de pago' }).click();
  const enlace = modal(recepcion).locator('app-compartir-enlace input');
  await expect(enlace).toHaveValue(/pasarela-falsa/);
  await expect(modal(recepcion).getByRole('link', { name: 'Enviar por WhatsApp' })).toBeVisible();
  await modal(recepcion).getByRole('button', { name: 'Listo' }).click();

  const adelanto = () => valor(`SELECT adelanto_monto FROM CITA WHERE id_cita = ${idCitaEnlace}`);
  expect(adelanto()).toBe('0');
  const [estado, codigo] = sql(
    `SELECT estado, codigo_operacion FROM TRANSACCION_PASARELA WHERE id_cita = ${idCitaEnlace}`,
  )[0];
  expect(estado).toBe('PENDIENTE');

  const cuerpo = JSON.stringify({ codigoOperacion: codigo, estado: 'APROBADA' });
  const firma = createHmac('sha256', claves.hmac).update(cuerpo).digest('hex');
  const izipay = await request.newContext({ baseURL: `http://localhost:${PUERTO_API}` });
  const enviar = (cabecera: string) =>
    izipay.post('/api/v1/pagos/notificaciones', {
      data: cuerpo,
      headers: { 'Content-Type': 'application/json', 'X-Firma-Hmac': cabecera },
    });
  const falsa = await enviar('firma-falsa');
  expect(falsa.status()).toBe(401);
  expect(adelanto()).toBe('0');
  expect((await enviar(firma)).status()).toBe(200);
  await izipay.dispose();
  expect(adelanto()).toBe(String(ADELANTO_ENLACE));
  obtenido(
    'CUS07',
    `enlace: PENDIENTE con adelanto 0; firma falsa 401; webhook firmado deja S/ ${adelanto()}`,
  );
});

test('CUS11: la especialista inicia y finaliza la atención', async () => {
  await iniciarSesion(especialista, 'especialista1', CLAVE_TEMPORAL);
  await cambiarClaveTemporal(especialista, CLAVE_TEMPORAL, CLAVE_ESPECIALISTA);
  // It. 2: Mi agenda es la de la especialista de la sesión (GET /atenciones/mi-agenda).
  await especialista.goto('/agenda/mi-agenda');
  await expect(especialista.locator('#miEspecialista')).toHaveCount(0);
  const tarjeta = especialista.locator('.card', { hasText: `Cita ${idCitaEfectivo}` });
  await tarjeta.getByRole('button', { name: 'Iniciar atención' }).click();
  await especialista.locator('#tiempoDeclaradoMin').fill('20');
  await modal(especialista).getByRole('button', { name: 'Iniciar atención' }).click();
  await expect(especialista).toHaveURL(/\/agenda\/atencion/);
  await expect(especialista.locator('.reloj')).toContainText('EN ATENCIÓN');
  await especialista.locator('#observaciones').fill('Sin novedad');
  await especialista.getByRole('button', { name: 'Finalizar', exact: true }).click();
  await expect(especialista.getByText('Atención finalizada', { exact: true })).toBeVisible();
  const texto = await especialista.getByText(/Atención \d+ · cita/).textContent();
  idAtencion = /Atención (\d+)/.exec(texto ?? '')![1];
  expect(valor(`SELECT estado FROM ATENCION WHERE id_atencion = ${idAtencion}`)).toBe('FINALIZADA');
  obtenido('CUS11', `atención ${idAtencion} FINALIZADA; la especialista ve su código`);
});

test('CUS18, RN11 y RN42: cobra con efectivo y Yape, sin cerrar antes de completar', async () => {
  await recepcion.goto('/ventas/cobros');
  // It. 2: la atención se elige de «Por cobrar» (GET /ventas/por-cobrar).
  await recepcion.getByLabel(`Cobrar la atención ${idAtencion}`).click();
  const total = PRECIO - ADELANTO_EFECTIVO;
  await expect(recepcion.locator('.kpi')).toContainText(`S/ ${total}.00`);
  await expect(recepcion.getByText('Adelanto aplicado')).toBeVisible();
  const cerrar = recepcion.getByRole('button', { name: 'Cerrar venta y emitir comprobante' });
  await expect(cerrar).toBeDisabled();
  const idVenta = valor('SELECT MAX(id_venta) FROM VENTA');

  // La pantalla no deja: se comprueba que el back-end tampoco.
  const antes = await api(recepcion, 'post', `/ventas/${idVenta}/cierre`, { tipo: 'BOLETA' });
  expect(antes.status).toBe(422);

  await recepcion.locator('#pagoMonto2').fill(String(total + 1));
  await recepcion.getByLabel('Registrar pago en Yape').click();
  await expect(recepcion.locator('.alert.bad')).toContainText('RN11');

  await recepcion.locator('#pagoMonto1').fill('20');
  await recepcion.getByLabel('Registrar pago en Efectivo').click();
  await expect(recepcion.locator('.kpi')).toContainText(`S/ ${total - 20}.00`);
  await recepcion.locator('#pagoMonto2').fill(String(total - 20));
  const yape = recepcion.waitForResponse((r) => r.url().endsWith('/pagos'));
  await recepcion.getByLabel('Registrar pago en Yape').click();
  const estadoYape = (await yape).status();
  await expect(recepcion.getByText('Pagos completos')).toBeVisible();
  await expect(cerrar).toBeEnabled();

  // Una transacción sin aprobar no se puede usar como pago (RN42).
  const pendiente = await api(recepcion, 'post', `/citas/${idCitaEnlace}/enlace-adelanto`, {
    adelantoMonto: 1,
    idMedioPago: 2,
  });
  let rechazo = 'sin probar';
  if (pendiente.status === 201) {
    const noAprobada = await api(recepcion, 'post', `/ventas/${idVenta}/pagos`, {
      pagos: [{ idMedioPago: 2, monto: 1, idTransaccion: pendiente.json['idTransaccion'] }],
    });
    expect(noAprobada.status).toBe(422);
    rechazo = `HTTP ${noAprobada.status} ${String(noAprobada.json['regla'])}`;
  }
  const yapeBd = sql(
    `SELECT t.estado, t.canal, p.monto FROM VENTA_PAGO p JOIN TRANSACCION_PASARELA t ON t.id_transaccion = p.id_transaccion WHERE p.id_venta = ${idVenta}`,
  )[0];
  expect(yapeBd[0]).toBe('APROBADA');
  obtenido(
    'RN11',
    `cierre incompleto: HTTP ${antes.status} ${String(antes.json['regla'])}; S/ ${total + 1} en Yape no se envía`,
  );
  obtenido(
    'CUS18',
    `venta ${idVenta}: total ${total} = efectivo 20 + Yape ${yapeBd[2]}; Yape HTTP ${estadoYape}, ${yapeBd[0]} por ${yapeBd[1]}`,
  );
  obtenido('RN42', `transacción sin aprobar usada como pago: ${rechazo}`);
});

test('CUS19, RN10, RN46 y RN47: emite la boleta, que queda pendiente de SUNAT', async () => {
  await recepcion.getByRole('button', { name: 'Cerrar venta y emitir comprobante' }).click();
  const comprobante = recepcion.locator('app-comprobante-emitido');
  await expect(comprobante).toContainText(/Boleta B001-\d+/);
  await expect(comprobante).toContainText('SUNAT: PENDIENTE');
  await expect(comprobante).toContainText('RN46');
  const idVenta = valor('SELECT MAX(id_venta) FROM VENTA');
  const fila = sql(
    `SELECT v.estado, c.serie, c.numero, c.estado_sunat FROM VENTA v JOIN COMPROBANTE c ON c.id_venta = v.id_venta WHERE v.id_venta = ${idVenta}`,
  )[0];
  expect(fila[0]).toBe('CERRADA');
  expect(valor(`SELECT estado FROM ATENCION WHERE id_atencion = ${idAtencion}`)).toBe('COBRADA');
  expect(valor(`SELECT COUNT(*) FROM V_CPE_PENDIENTES WHERE id_venta = ${idVenta}`)).toBe('1');
  primeraBoleta = fila[2];
  obtenido(
    'CUS19',
    `venta CERRADA, boleta ${fila[1]}-${fila[2]}, SUNAT ${fila[3]}, en V_CPE_PENDIENTES; atención COBRADA`,
  );
});

test('CUS20: imprime y comparte la boleta', async () => {
  const comprobante = recepcion.locator('app-comprobante-emitido');
  const pdf = recepcion.waitForResponse((r) => r.url().includes('/representacion'));
  await comprobante.getByRole('button', { name: 'Imprimir comprobante' }).click();
  const respuesta = await pdf;
  expect(respuesta.status()).toBe(200);
  expect(respuesta.headers()['content-type']).toContain('application/pdf');
  expect((await respuesta.body()).subarray(0, 4).toString()).toBe('%PDF');
  await expect(recepcion.locator('iframe[title="Comprobante para imprimir"]')).toHaveCount(1);

  await comprobante.getByRole('button', { name: 'Compartir comprobante' }).click();
  const enlace = comprobante.locator('app-compartir-enlace input');
  await expect(enlace).toHaveValue(/comprobantes\/publico/);
  await expect(comprobante.getByRole('link', { name: 'Enviar por WhatsApp' })).toHaveAttribute(
    'href',
    /wa\.me/,
  );

  // El enlace firmado se abre sin sesión.
  const url = await enlace.inputValue();
  const anonimo = await request.newContext();
  const publico = await anonimo.get(url);
  expect(publico.status()).toBe(200);
  expect(publico.headers()['content-type']).toContain('application/pdf');
  const alterado = await anonimo.get(url.replace(/firma=[^&]+/, 'firma=alterada'));
  expect(alterado.status()).toBe(403);
  await anonimo.dispose();

  // It. 2 (D-12): «Enviar por correo» pide el enlace y abre mailto en el navegador.
  await comprobante.getByRole('button', { name: 'Correo' }).click();
  await comprobante.locator('#entregaCorreo').fill('zoraida@ejemplo.com');
  const correo = recepcion.waitForResponse((r) => r.url().includes('canal=CORREO'));
  await comprobante.getByRole('button', { name: 'Enviar por correo' }).click();
  const enlaceCorreo = (await (await correo).json()) as { enlace?: string };
  expect(enlaceCorreo.enlace).toMatch(/comprobantes\/publico/);
  await recepcion.getByRole('button', { name: 'Listo' }).click();
  obtenido(
    'CUS20',
    `PDF ${respuesta.status()} y enlace público ${publico.status()}; firma alterada ${alterado.status()}`,
  );
});

test('CUS21: emite una proforma, que se imprime y no se guarda', async () => {
  const antes = valor('SELECT COUNT(*) FROM VENTA');
  await recepcion.getByRole('button', { name: 'Emitir proforma' }).click();
  await recepcion.locator('#proformaNombre').fill('Novia');
  await elegirVariante(recepcion, 'proforma0', 'Corte E2E', 'Normal', idVariante);
  await recepcion.locator('#proformaCantidad0').fill('2');
  await modal(recepcion).getByRole('button', { name: 'Emitir proforma' }).click();
  const documento = recepcion.locator('.imprimible');
  await expect(documento).toContainText(`S/ ${PRECIO * 2}.00`);
  await expect(documento).toContainText('RN09');
  await modal(recepcion).getByRole('button', { name: 'Imprimir' }).click();
  const impresiones = await recepcion.evaluate(
    () => (window as unknown as { impresiones: number }).impresiones,
  );
  expect(impresiones).toBe(1);
  await modal(recepcion).getByRole('button', { name: 'Cerrar' }).click();
  expect(valor('SELECT COUNT(*) FROM VENTA')).toBe(antes);
  obtenido(
    'CUS21',
    `2 × variante ${idVariante} = S/ ${PRECIO * 2}; una impresión; sin filas nuevas`,
  );
});

test('CUS13, RN11 y RN47: cobra una atención sin cita de un cliente de paso', async () => {
  await recepcion.goto('/ventas/sin-cita');
  const atenciones = valor('SELECT COUNT(*) FROM ATENCION');
  // Con la otra especialista: especialista1 sigue ocupada hasta el fin de la franja de su cita,
  // aunque la haya terminado antes (ver docs/NOTAS_IT1.md, Duda 14).
  const [variante, precio] = sql(
    "SELECT v.id_variante, v.precio FROM VARIANTE_SERVICIO v JOIN SERVICIO s ON s.id_servicio = v.id_servicio WHERE s.nombre = 'Perfilado de Cejas'",
  )[0];
  await recepcion.locator('#rapidaPaso').fill('Jorge');
  const libres = recepcion.waitForResponse((r) => r.url().includes('/rapidas/libres'));
  await elegirVariante(recepcion, 'rapida', 'Perfilado de Cejas', null, variante);
  await recepcion.locator('#rapidaIdVariante').blur();
  await libres;
  await expect(recepcion.locator('#rapidaDuracion')).toHaveValue('20');

  await recepcion.locator('#rapidaMonto').fill(String(Number(precio) - 1));
  const errada = recepcion.waitForResponse((r) => r.url().endsWith('/rapidas'));
  await recepcion.getByRole('button', { name: 'Cobrar', exact: true }).click();
  const respuestaErrada = await errada;
  expect(respuestaErrada.status()).toBe(422);
  // Todo o nada: el cobro fallido no deja una atención huérfana.
  expect(valor('SELECT COUNT(*) FROM ATENCION')).toBe(atenciones);

  await recepcion.locator('#rapidaMonto').fill(precio);
  await recepcion.getByRole('button', { name: 'Cobrar', exact: true }).click();
  const comprobante = recepcion.locator('app-comprobante-emitido');
  await expect(comprobante).toContainText(/Boleta B001-\d+/);
  const numeros = sql(
    "SELECT numero FROM COMPROBANTE WHERE serie = 'B001' ORDER BY TO_NUMBER(numero)",
  ).map((fila) => Number(fila[0]));
  expect(numeros).toEqual([Number(primeraBoleta), Number(primeraBoleta) + 1]);
  const paso = sql(
    'SELECT nombre_cliente_paso, id_cliente, estado FROM ATENCION ORDER BY id_atencion DESC FETCH FIRST 1 ROW ONLY',
  )[0];
  expect(paso[0]).toBe('Jorge');
  obtenido(
    'CUS13',
    `atención de ${paso[0]}, ${paso[paso.length - 1]}; monto errado HTTP 422 sin atención huérfana`,
  );
  obtenido('RN47', `boletas correlativas: B001 ${numeros.join(', ')}`);
});

test('CUS45 y RN30: cierra la caja con una diferencia y su observación', async () => {
  await recepcion.goto('/caja');
  await recepcion.getByRole('button', { name: 'Cerrar caja' }).click();
  await expect(modal(recepcion)).toContainText('pendientes de envío a SUNAT');
  await modal(recepcion).getByRole('button', { name: '+ Egreso' }).click();
  await recepcion.locator('#egresoConcepto0').fill('Compra menor');
  await recepcion.locator('#egresoMonto0').fill('10');

  const filaEfectivo = modal(recepcion).locator('tbody tr').first();
  const esperadoTexto = await filaEfectivo.locator('td').nth(1).textContent();
  const esperado = Number(/[\d.]+/.exec(esperadoTexto ?? '')![0]);
  const contado = esperado - 5;
  await recepcion.locator('#contado1').fill(String(contado));
  await expect(filaEfectivo).toContainText('-5.00');

  const confirmar = modal(recepcion).getByRole('button', { name: 'Confirmar cierre' });
  await confirmar.click();
  await expect(modal(recepcion).locator('.alert.bad')).toContainText('RN30');

  const idCaja = valor("SELECT id_caja FROM CAJA WHERE estado = 'ABIERTA'");
  const sinMotivo = await api(recepcion, 'post', `/cajas/${idCaja}/cierre`, {
    arqueos: [{ idMedioPago: 1, montoContado: contado }],
  });
  expect(sinMotivo.status).toBe(422);

  const observaciones = modal(recepcion).locator('textarea');
  for (let i = 0; i < (await observaciones.count()); i++) {
    await observaciones.nth(i).fill('Faltan cinco soles');
  }
  await confirmar.click();
  await expect(recepcion.getByText(`Cierre de la caja ${idCaja}`)).toBeVisible();
  const arqueo = sql(
    `SELECT m.nombre, a.monto_esperado, a.monto_contado, a.diferencia, a.observacion FROM CAJA_ARQUEO a JOIN MEDIO_PAGO m ON m.id_medio_pago = a.id_medio_pago WHERE a.id_caja = ${idCaja} ORDER BY a.id_medio_pago`,
  );
  expect(arqueo[0].slice(1, 4)).toEqual([String(esperado), String(contado), '-5']);
  expect(arqueo[0][4]).toBe('Faltan cinco soles');
  expect(valor(`SELECT estado FROM CAJA WHERE id_caja = ${idCaja}`)).toBe('CERRADA');

  // Caja cerrada: no se admiten más ventas (RN30).
  const tarde = await api(recepcion, 'post', '/ventas', { idAtencion: Number(idAtencion) });
  expect(tarde.status).toBe(422);
  obtenido(
    'CUS45',
    `caja ${idCaja} CERRADA: ${arqueo.map((a) => a.slice(0, 4).join(' ')).join('; ')}`,
  );
  obtenido(
    'RN30',
    `sin observación: pantalla bloquea y API ${sinMotivo.status}; venta con caja cerrada ${tarde.status}`,
  );
});

test('RN29: cada cambio dejó usuario y fecha', async () => {
  const filas = sql(
    'SELECT u.nombre_usuario, COUNT(*), SUM(CASE WHEN a.fecha_hora IS NULL THEN 1 ELSE 0 END) FROM AUDITORIA a JOIN USUARIO u ON u.id_usuario = a.id_usuario GROUP BY u.nombre_usuario ORDER BY 1',
  );
  const usuarios = filas.map((fila) => fila[0]);
  for (const usuario of ['admin', 'recepcion2', 'especialista1']) {
    expect(usuarios).toContain(usuario);
  }
  expect(filas.every((fila) => fila[2] === '0')).toBe(true);
  expect(valor('SELECT COUNT(*) FROM AUDITORIA WHERE id_usuario IS NULL')).toBe('0');
  obtenido('RN29', filas.map((fila) => `${fila[0]}: ${fila[1]} filas`).join('; '));
});

test('CUS51: la recepcionista cierra sesión', async () => {
  await recepcion.getByRole('button', { name: 'Menú del usuario' }).click();
  const salida = recepcion.waitForResponse((r) => r.url().includes('/auth/logout'));
  await recepcion.getByRole('menuitem', { name: 'Salir' }).click();
  expect((await salida).ok()).toBe(true);
  await expect(recepcion).toHaveURL(/\/login/);
  const despues = await api(recepcion, 'get', '/roles');
  expect(despues.status).toBe(401);
  await recepcion.goto('/caja');
  await expect(recepcion).toHaveURL(/\/login/);
  obtenido('CUS51', `sesión cerrada: la API responde ${despues.status} y /caja lleva al login`);
});
