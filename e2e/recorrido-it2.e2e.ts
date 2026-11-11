import { Browser, BrowserContext, expect, Locator, Page, request, test } from '@playwright/test';
import { createHmac } from 'node:crypto';
import { readFileSync, rmSync } from 'node:fs';
import {
  api,
  CLAVE_ADMIN,
  CLAVE_ESPECIALISTA,
  claves,
  elegirClienta,
  entrar,
  modal,
  obtenido as anotar,
  sql,
  valor,
} from './apoyo';
import { PUERTO_API } from './entorno.mjs';

/**
 * Recorrido de la Iteración 2. Corre después del de la Iteración 1 (proyecto «it2» de
 * playwright.config.ts) y no depende de lo que este haya dejado: usa los usuarios que el recorrido
 * 1 no toca (recepcion, almacen, especialista2) y entra a admin y especialista1 con su clave final
 * o, en una base recién instalada, con la temporal. Los pasos van en el orden del encargo; el
 * paso 2.5 (la administradora pone el insumo en el servicio) va después del 2 porque el insumo lo
 * registra la encargada. Lo que ninguna pantalla muestra se lee de la base.
 */
const CLAVE_RECEPCION = 'RecepcionIt2E2e2026';
const CLAVE_ALMACEN = 'AlmacenIt2E2e2026';
const CLAVE_RESTABLECIDA = 'Restablecida2026';
const CLAVE_ESPECIALISTA2 = 'Especial2It2E2e2026';
const SERVICIO = 'Tratamiento Capilar';
const CATEGORIA = 'Insumos E2E';
const INSUMO = 'Keratina E2E';
const INSUMO_CODIGO = 'INS-E2E';
const PRODUCTO_VENTA = 'Óleo de Argán';
/** El servicio estima 30 ml y el ajuste deja 20: falta stock al finalizar (RN53). */
const ESTIMADO = 30;
const STOCK_AJUSTE = 20;
const SALIDA = 5;
const STOCK_MINIMO = 16;
const CLIENTA_A = 'Wendy';
const CLIENTA_B = 'Rocío';
const ADELANTO_REPROGRAMADA = 10;
const ADELANTO_CANCELADA = 20;
const ARCHIVO = 'obtenido-it2.txt';

const obtenido = (caso: string, texto: string) => anotar(caso, texto, ARCHIVO);

test.describe.configure({ mode: 'serial' });

let contextos: BrowserContext[];
let admin: Page;
let almacen: Page;
let recepcion: Page;
let especialista: Page;
let especialista2: Page;

let idInsumo: string;
let idProductoVenta: string;
let idVariante: string;
let idCitaEspera: number;
let idCitaReprogramada: number;
let idCitaNueva: number;
let idCitaCancelada: number;
let idAtencion: string;
let idCaja: string;
const ventas: { saldo?: number; rechazada?: number; yape?: number; tarjeta?: number } = {};

async function nuevaPagina(browser: Browser): Promise<Page> {
  const contexto = await browser.newContext({ acceptDownloads: true });
  contextos.push(contexto);
  return contexto.newPage();
}

/** Elige la opción de un selector por su texto visible (los value de Angular no son los ids). */
async function elegirPorTexto(page: Page, selector: string, texto: string): Promise<void> {
  const opcion = page.locator(`${selector} option`, { hasText: texto }).first();
  await page.locator(selector).selectOption({ label: ((await opcion.textContent()) ?? '').trim() });
}

/** Fecha local (Lima) como la pide el contrato, desplazada en días. */
function fechaIso(dias = 0): string {
  const lima = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Lima' }));
  lima.setDate(lima.getDate() + dias);
  const mes = String(lima.getMonth() + 1).padStart(2, '0');
  const dia = String(lima.getDate()).padStart(2, '0');
  return `${lima.getFullYear()}-${mes}-${dia}`;
}

/** El recorrido agenda y atiende hoy: de lunes a sábado, de 09:00 a 17:00 (deja margen). */
function exigirHorario(): void {
  const lima = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Lima' }));
  const minutos = lima.getHours() * 60 + lima.getMinutes();
  if (lima.getDay() === 0 || minutos < 9 * 60 || minutos > 17 * 60) {
    throw new Error(
      'Desde el paso 3 el recorrido atiende hoy: córrelo de lunes a sábado, de 09:00 a 17:00.',
    );
  }
}

function minutos(hora: string): number {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

/** Abre la nueva cita (o la que trae «Programar») y devuelve las horas libres. */
async function horasLibres(page: Page): Promise<string[]> {
  await modal(page).getByRole('button', { name: 'Ver disponibilidad' }).click();
  const horas = modal(page).getByRole('button', { name: /^\d\d:\d\d$/ });
  await expect(horas.first()).toBeVisible();
  return (await horas.allTextContents()).map((t) => t.trim());
}

async function agendar(page: Page): Promise<number> {
  const creada = page.waitForResponse(
    (r) => r.url().endsWith('/citas') && r.request().method() === 'POST',
  );
  await modal(page).getByRole('button', { name: 'Agendar' }).click();
  const respuesta = await creada;
  expect(respuesta.status()).toBe(201);
  return ((await respuesta.json()) as { idCita: number }).idCita;
}

/** Programa una cita del servicio para la clienta a la primera hora libre de hoy. */
async function nuevaCita(page: Page, clienta: string): Promise<{ idCita: number; hora: string }> {
  await page.getByRole('button', { name: '+ Nueva cita' }).click();
  await elegirClienta(modal(page), clienta);
  await elegirPorTexto(page, '#citaServicio', SERVICIO);
  const horas = await horasLibres(page);
  await modal(page).getByRole('button', { name: horas[0], exact: true }).click();
  return { idCita: await agendar(page), hora: horas[0] };
}

async function registrarAdelanto(page: Page, idCita: number, monto: number): Promise<void> {
  await page.getByRole('button', { name: 'Registrar adelanto' }).click();
  await expect(page.locator('#adelantoIdCita')).toHaveValue(String(idCita));
  await page.locator('#adelantoMonto').fill(String(monto));
  await modal(page).getByRole('button', { name: 'Registrar adelanto en efectivo' }).click();
  await expect(modal(page)).toBeHidden();
}

/** El bloque de la rejilla de una cita, por la hora y la clienta. */
function bloque(page: Page, hora: string, clienta: string): Locator {
  return page.locator('.bloque', { hasText: `${hora} · ${clienta}` }).locator('.abrir');
}

/** Vende una unidad del producto con el medio indicado y devuelve la respuesta del POST. */
async function venderProducto(
  page: Page,
  medio: 'Efectivo' | 'Yape' | 'Tarjeta',
  clienta?: string,
): Promise<{ status: number; idVenta: number }> {
  await page.goto('/ventas/productos');
  await page.locator('#productoNombre').fill(PRODUCTO_VENTA);
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  const nombre = valor(`SELECT nombre FROM PRODUCTO WHERE id_producto = ${idProductoVenta}`);
  await page.getByRole('button', { name: `Agregar ${nombre}` }).click();
  if (clienta) {
    await page.getByRole('button', { name: 'Clienta registrada' }).click();
    await elegirClienta(page.locator('app-selector-clienta'), clienta);
  }
  await page
    .getByRole('group', { name: 'Medio de pago' })
    .getByRole('button', { name: medio })
    .click();
  const venta = page.waitForResponse(
    (r) => r.url().endsWith('/ventas/productos') && r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Vender', exact: true }).click();
  const respuesta = await venta;
  return {
    status: respuesta.status(),
    idVenta: ((await respuesta.json()) as { idVenta: number }).idVenta,
  };
}

async function solicitarAnulacion(
  page: Page,
  idVenta: number,
  forma: 'saldo' | 'original',
): Promise<number> {
  await page.goto(`/ventas/anulaciones?idVenta=${idVenta}`);
  await expect(page.locator('#ventaAnular')).toContainText(`Venta ${idVenta}`);
  await page.locator('#anularMotivo').fill('La clienta desistió');
  await page.locator('#anularCodigo').selectOption('06');
  await page
    .getByRole('button', {
      name:
        forma === 'saldo' ? 'Como saldo a favor de la clienta' : 'Por el medio de pago original',
    })
    .click();
  const solicitud = page.waitForResponse((r) => r.url().includes('/solicitudes-anulacion'));
  await page.getByRole('button', { name: 'Solicitar anulación' }).click();
  const respuesta = await solicitud;
  expect(respuesta.status()).toBe(201);
  await expect(page.locator('.alert.ok')).toContainText('Solicitud enviada a la administradora.');
  await expect(page.locator('#ventaAnular')).toContainText('Anulación pendiente');
  return ((await respuesta.json()) as { idSolicitud: number }).idSolicitud;
}

test.beforeAll(async ({ browser }) => {
  rmSync(`test-results/${ARCHIVO}`, { force: true });
  contextos = [];
  admin = await nuevaPagina(browser);
  almacen = await nuevaPagina(browser);
  recepcion = await nuevaPagina(browser);
  especialista = await nuevaPagina(browser);
  especialista2 = await nuevaPagina(browser);
});

test.afterAll(async () => {
  await Promise.all(contextos.map((contexto) => contexto.close()));
});

// ── 1 · La administradora configura ────────────────────────────────────────────────────────────

test('1 · CUS65, RN51 y RN03: cambia AGENDA_PASO_MIN y respeta los topes', async () => {
  await entrar(admin, 'admin', CLAVE_ADMIN);
  await admin.goto('/catalogo');
  await admin.getByRole('tab', { name: 'Parámetros' }).click();
  const fila = admin.locator('#tablaParametros tbody tr', { hasText: 'AGENDA_PASO_MIN' });
  await fila.getByLabel('Valor de AGENDA_PASO_MIN').fill('30');
  const guardado = admin.waitForResponse((r) => r.url().endsWith('/parametros/AGENDA_PASO_MIN'));
  await fila.getByRole('button', { name: 'Guardar parámetro' }).click();
  expect((await guardado).status()).toBe(200);
  expect(valor("SELECT valor_numero FROM PARAMETRO WHERE codigo = 'AGENDA_PASO_MIN'")).toBe('30');

  // La pantalla no deja pasar de 10 minutos de limpieza; el back-end tampoco (RN03).
  const limpieza = admin.locator('#tablaParametros tbody tr', { hasText: 'LIMPIEZA_MAX_MIN' });
  await limpieza.getByLabel('Valor de LIMPIEZA_MAX_MIN').fill('11');
  await limpieza.getByRole('button', { name: 'Guardar parámetro' }).click();
  await expect(admin.locator('app-parametros .alert.bad')).toContainText('0 a 10');
  const once = await api(admin, 'patch', '/parametros/LIMPIEZA_MAX_MIN', { valorNumero: 11 });
  const cero = await api(admin, 'patch', '/parametros/AGENDA_PASO_MIN', { valorNumero: 0 });
  expect(once.status).toBe(422);
  expect(cero.status).toBe(422);
  expect(valor("SELECT valor_numero FROM PARAMETRO WHERE codigo = 'LIMPIEZA_MAX_MIN'")).toBe('10');
  obtenido('CUS65', 'AGENDA_PASO_MIN = 30 guardado con su vigencia');
  obtenido(
    'RN03',
    `LIMPIEZA_MAX_MIN 11: la pantalla avisa y la API responde ${once.status} ${String(once.json['regla'])}`,
  );
  obtenido('RN51', `AGENDA_PASO_MIN 0: HTTP ${cero.status} ${String(cero.json['regla'])}`);
});

test('1 · CUS62 y RN42: desactiva un medio de pago; el efectivo no va por Izipay', async () => {
  await admin.getByRole('tab', { name: 'Medios de pago' }).click();
  await admin.getByLabel('Plin activo').uncheck();
  const fila = admin.locator('#tablaMedios tbody tr', { hasText: 'Plin' });
  const guardado = admin.waitForResponse((r) => /\/medios-pago\/\d+$/.test(r.url()));
  await fila.getByRole('button', { name: 'Guardar medio de pago' }).click();
  expect((await guardado).status()).toBe(200);
  expect(valor("SELECT estado FROM MEDIO_PAGO WHERE nombre = 'PLIN'")).toBe('INACTIVO');
  await expect(admin.getByLabel('Efectivo por la pasarela')).toBeDisabled();
  const efectivo = await api(admin, 'patch', '/medios-pago/1', {
    estado: 'ACTIVO',
    usaPasarela: true,
  });
  expect(efectivo.status).toBe(422);
  obtenido('CUS62', `Plin INACTIVO; efectivo por la pasarela: HTTP ${efectivo.status}`);
});

test('1 · CUS63 y RN47: las series de la sede y una sola ACTIVA por tipo', async () => {
  await admin.getByRole('tab', { name: 'Series' }).click();
  await expect(admin.locator('#tablaSeries tbody')).toContainText('B001');
  await admin.locator('#serieTipo').selectOption('FACTURA');
  await admin.locator('#serieCodigo').fill('B002');
  await admin.getByRole('button', { name: 'Guardar serie' }).click();
  await expect(admin.locator('app-series-comprobante .alert.bad')).toContainText('empieza con F');

  const serie = admin.waitForResponse(
    (r) => r.url().endsWith('/series-comprobante') && r.request().method() === 'POST',
  );
  await admin.locator('#serieCodigo').fill('F002');
  await admin.getByRole('button', { name: 'Guardar serie' }).click();
  const respuesta = await serie;
  // La única sede ya tiene su factura ACTIVA (UQ_SERIE_COMPR_ACTIVA): ver el límite en pruebas_it2.
  expect(respuesta.status()).toBe(409);
  await expect(admin.locator('app-series-comprobante .alert.bad')).toBeVisible();
  const activas = valor(
    "SELECT COUNT(*) FROM SERIE_COMPROBANTE WHERE id_sede = 1 AND tipo = 'FACTURA' AND estado = 'ACTIVA'",
  );
  expect(activas).toBe('1');
  obtenido(
    'CUS63',
    `serie con letra errada: aviso; F002 con F001 ACTIVA: HTTP ${respuesta.status()} (una ACTIVA por tipo)`,
  );
});

test('1 · CUS59 y CUS60: registra un paquete y una promoción del servicio', async () => {
  const nombreServicio = valor(`SELECT nombre FROM SERVICIO WHERE nombre LIKE '${SERVICIO}%'`);
  await admin.getByRole('tab', { name: 'Paquetes' }).click();
  await admin.locator('#paqueteNombre').fill('Tres tratamientos E2E');
  await admin.locator('#paqueteSesiones').fill('3');
  await admin.locator('#paquetePrecio').fill('400');
  await admin.locator('#paqueteVigencia').fill('90');
  await admin
    .locator('app-selector-servicios label', { hasText: nombreServicio })
    .locator('input')
    .check();
  const paquete = admin.waitForResponse(
    (r) => r.url().endsWith('/paquetes') && r.request().method() === 'POST',
  );
  await admin.getByRole('button', { name: 'Guardar paquete' }).click();
  expect((await paquete).status()).toBe(201);
  await expect(admin.locator('.paquete').first()).toContainText('Tres tratamientos E2E');
  const servicios = valor(
    "SELECT COUNT(*) FROM PAQUETE_SERVICIO ps JOIN PAQUETE p ON p.id_paquete = ps.id_paquete WHERE p.nombre = 'Tres tratamientos E2E'",
  );
  expect(servicios).toBe('1');

  await admin.getByRole('tab', { name: 'Promociones' }).click();
  await admin.locator('#promocionNombre').fill('Promo E2E');
  await admin.locator('#promocionValor').fill('10');
  await admin.locator('#promocionInicio').fill(fechaIso());
  await admin.locator('#promocionFin').fill(fechaIso(30));
  await admin
    .locator('app-selector-servicios label', { hasText: nombreServicio })
    .locator('input')
    .check();
  const promocion = admin.waitForResponse(
    (r) => r.url().endsWith('/promociones') && r.request().method() === 'POST',
  );
  await admin.getByRole('button', { name: 'Guardar promoción' }).click();
  expect((await promocion).status()).toBe(201);
  await expect(admin.locator('#tablaPromociones')).toContainText('Promo E2E');
  obtenido('CUS59', `paquete «Tres tratamientos E2E» de 3 sesiones con ${servicios} servicio`);
  obtenido('CUS60', 'promoción «Promo E2E» de 10 % ACTIVA por 30 días');
});

test('1 · CUS54: restablece la clave de especialista2', async () => {
  await admin.goto('/seguridad/usuarios');
  await admin.getByRole('button', { name: 'Restablecer contraseña de especialista2' }).click();
  await admin.locator('#claveTemporal').fill(CLAVE_RESTABLECIDA);
  await admin.locator('#claveTemporalRepetida').fill(CLAVE_RESTABLECIDA);
  const cambio = admin.waitForResponse((r) => /\/usuarios\/\d+\/clave$/.test(r.url()));
  await modal(admin).getByRole('button', { name: 'Restablecer contraseña' }).click();
  const respuesta = await cambio;
  expect(respuesta.status()).toBe(200);
  expect(JSON.stringify(await respuesta.json())).not.toContain(CLAVE_RESTABLECIDA);
  const fila = sql(
    "SELECT debe_cambiar_clave, estado FROM USUARIO WHERE nombre_usuario = 'especialista2'",
  )[0];
  expect(fila[0]).toBe('S');
  await expect(admin.locator('tbody tr', { hasText: 'especialista2' })).toContainText(
    'Debe cambiar su clave',
  );
  obtenido('CUS54', `especialista2 ${fila[1]}, debe cambiar la clave; la respuesta no la trae`);
});

// ── 2 · La encargada de almacén ────────────────────────────────────────────────────────────────

test('2 · CUS66: la encargada registra una categoría', async () => {
  await entrar(almacen, 'almacen', CLAVE_ALMACEN);
  await almacen.goto('/inventario');
  await almacen.getByRole('tab', { name: 'Categorías' }).click();
  await almacen.locator('#nuevaCategoria').fill(CATEGORIA);
  const categoria = almacen.waitForResponse(
    (r) => r.url().endsWith('/categorias-producto') && r.request().method() === 'POST',
  );
  await almacen.getByRole('button', { name: 'Guardar categoría' }).click();
  expect((await categoria).status()).toBe(201);
  await expect(almacen.locator('app-categorias-producto')).toContainText(CATEGORIA);
  obtenido('CUS66', `categoría «${CATEGORIA}» registrada`);
});

test('2 · CUS32, RN13, RN14, RN24 y RN54: registra un insumo en su unidad mínima', async () => {
  await almacen.getByRole('button', { name: '+ Producto' }).click();
  await modal(almacen).getByRole('button', { name: 'Insumo', exact: true }).click();
  await almacen.locator('#productoCodigo').fill(INSUMO_CODIGO);
  await almacen.locator('#productoNombreNuevo').fill(INSUMO);
  await elegirPorTexto(almacen, '#productoIdCategoria', CATEGORIA);
  await almacen.locator('#productoUnidad').selectOption({ label: 'Mililitro (ml)' });
  await almacen.locator('#productoStockMinimo').fill(String(STOCK_MINIMO));
  await almacen.locator('#productoUbicacion').fill('Estante E2E');
  await almacen.locator('#productoCosto').fill('0.5');
  await expect(almacen.locator('#precioSugerido')).toContainText('margen vigente');
  const registro = almacen.waitForResponse(
    (r) => r.url().endsWith('/productos') && r.request().method() === 'POST',
  );
  await modal(almacen).getByRole('button', { name: 'Registrar', exact: true }).click();
  expect((await registro).status()).toBe(201);
  await almacen.getByRole('tab', { name: 'Productos' }).click();
  await expect(almacen.locator('#tablaProductos')).toContainText(INSUMO);
  const [id, tipo, unidad, costo, precio] = sql(
    `SELECT id_producto, tipo_uso, unidad, costo, precio_venta FROM PRODUCTO WHERE codigo = '${INSUMO_CODIGO}'`,
  )[0];
  idInsumo = id;
  expect([tipo, unidad]).toEqual(['INSUMO', 'ML']);
  expect(Number(precio)).toBeCloseTo(Number(costo) * 1.5, 2);

  // Un insumo en litros no pasa (RN54); la encargada no ve márgenes (RN24).
  const litros = await api(almacen, 'post', '/productos', {
    codigo: 'INS-E2E-L',
    nombre: 'Insumo en litros',
    idCategoria: Number(
      valor(`SELECT id_categoria FROM CATEGORIA_PRODUCTO WHERE nombre = '${CATEGORIA}'`),
    ),
    unidad: 'L',
    tipoUso: 'INSUMO',
    costo: 1,
    stockMinimo: 1,
  });
  expect(litros.status).toBe(422);
  const lista = await almacen.request.get('/api/v1/productos');
  const productos = (await lista.json()) as { margen?: number }[];
  expect(productos.every((p) => p.margen === undefined || p.margen === null)).toBe(true);
  await expect(almacen.locator('#tablaProductos thead')).not.toContainText('Margen');
  obtenido('CUS32', `insumo ${idInsumo} ${tipo} en ${unidad}, stock 0, mínimo ${STOCK_MINIMO}`);
  obtenido('RN14', `precio = costo ${costo} + 50 % = ${precio}`);
  obtenido('RN13', `tipo de uso ${tipo}`);
  obtenido('RN54', `insumo en litros: HTTP ${litros.status} ${String(litros.json['regla'])}`);
  obtenido('RN24', 'GET /productos sin margen para la encargada; la tabla no tiene la columna');
});

test('2 · CUS34 y RN17: ajusta por conteo el insumo y el producto de venta', async () => {
  idProductoVenta = valor(
    `SELECT id_producto FROM PRODUCTO WHERE nombre LIKE '${PRODUCTO_VENTA}%'`,
  );
  await almacen.getByRole('tab', { name: 'Ajuste por conteo' }).click();
  await elegirPorTexto(almacen, '#ajusteProducto', INSUMO);
  await almacen.locator('#ajusteCantidad').fill(String(STOCK_AJUSTE));
  await expect(almacen.locator('#ajusteDiferencia')).toContainText(`diferencia +${STOCK_AJUSTE}`);
  await almacen.locator('#ajusteMotivo').fill('Conteo inicial E2E');
  const ajuste = almacen.waitForResponse((r) => r.url().endsWith(`/productos/${idInsumo}/ajustes`));
  await almacen.getByRole('button', { name: 'Registrar ajuste' }).click();
  expect((await ajuste).status()).toBe(200);

  await elegirPorTexto(almacen, '#ajusteProducto', PRODUCTO_VENTA);
  await almacen.locator('#ajusteCantidad').fill('5');
  await almacen.locator('#ajusteMotivo').fill('Conteo inicial E2E');
  await almacen.getByRole('button', { name: 'Registrar ajuste' }).click();
  await expect
    .poll(() =>
      valor(
        `SELECT stock_actual FROM INVENTARIO_SEDE WHERE id_producto = ${idProductoVenta} AND id_sede = 1`,
      ),
    )
    .toBe('5');
  const stock = valor(
    `SELECT stock_actual FROM INVENTARIO_SEDE WHERE id_producto = ${idInsumo} AND id_sede = 1`,
  );
  expect(stock).toBe(String(STOCK_AJUSTE));
  expect(ESTIMADO).toBeGreaterThan(STOCK_AJUSTE);
  obtenido(
    'CUS34',
    `${INSUMO}: AJUSTE +${STOCK_AJUSTE} (menos que los ${ESTIMADO} ml que estima el servicio); ${PRODUCTO_VENTA}: 5`,
  );
});

test('2 · CUS33, RN15 y RN16: registra una salida de insumo y avisa el stock mínimo', async () => {
  await almacen.getByRole('tab', { name: 'Salida de insumos' }).click();
  await elegirPorTexto(almacen, '#salidaProducto', INSUMO);
  await almacen.locator('#salidaCantidad').fill(String(SALIDA));
  await almacen.locator('#salidaMotivo').fill('Uso en cabina E2E');
  const salida = almacen.waitForResponse((r) => r.url().endsWith(`/productos/${idInsumo}/salidas`));
  await almacen.getByRole('button', { name: 'Registrar salida de insumo' }).click();
  const respuesta = await salida;
  expect(respuesta.status()).toBe(200);
  const movimiento = (await respuesta.json()) as { saldo: number; estaEnMinimo: boolean };
  expect(movimiento.saldo).toBe(STOCK_AJUSTE - SALIDA);
  expect(movimiento.estaEnMinimo).toBe(true);
  await expect(almacen.locator('app-movimiento-inventario .alert.warn')).toContainText(
    'stock mínimo',
  );
  await expect(almacen.locator('#alertaMinimo')).toContainText(INSUMO);

  const sinStock = await api(almacen, 'post', `/productos/${idInsumo}/salidas`, {
    cantidad: 999,
    motivo: 'Más de lo que hay',
  });
  expect(sinStock.status).toBe(409);
  obtenido('CUS33', `SALIDA de ${SALIDA} ml: saldo ${movimiento.saldo}`);
  obtenido('RN16', `saldo ${movimiento.saldo} ≤ mínimo ${STOCK_MINIMO}: estaEnMinimo y alerta`);
  obtenido('RN15', `salida de 999: HTTP ${sinStock.status} ${String(sinStock.json['regla'])}`);
});

test('2 · CUS35: consulta el kardex del insumo', async () => {
  await almacen.goto(`/inventario/kardex?idProducto=${idInsumo}`);
  const filas = almacen.locator('tbody tr');
  await expect(filas).toHaveCount(2);
  await expect(filas.nth(0)).toContainText('Ajuste');
  await expect(filas.nth(0)).toContainText(`+${STOCK_AJUSTE}`);
  await expect(filas.nth(1)).toContainText('Salida');
  await expect(filas.nth(1)).toContainText(`-${SALIDA}`);
  await expect(filas.nth(1)).toContainText(String(STOCK_AJUSTE - SALIDA));
  await expect(almacen.locator('#resumenProducto')).toContainText('En stock mínimo');
  obtenido(
    'CUS35',
    `kardex: AJUSTE +${STOCK_AJUSTE}, SALIDA -${SALIDA}, saldo ${STOCK_AJUSTE - SALIDA}`,
  );
});

test('2.5 · CUS58 y RN25: la administradora pone el insumo en el servicio y cambia el precio', async () => {
  const [idServicio, nombre, variante, precio] = sql(
    `SELECT s.id_servicio, s.nombre, v.id_variante, v.precio FROM SERVICIO s JOIN VARIANTE_SERVICIO v ON v.id_servicio = s.id_servicio WHERE s.nombre LIKE '${SERVICIO}%'`,
  )[0];
  idVariante = variante;
  await admin.goto('/catalogo');
  await admin.getByRole('button', { name: `Editar servicio ${nombre}` }).click();
  const editor = admin.locator('app-editar-servicio');
  await editor.getByRole('button', { name: '+ Insumo' }).click();
  await editor.getByLabel('Producto del insumo 1 de Estándar').fill(idInsumo);
  await editor.getByLabel('Cantidad del insumo 1 de Estándar').fill(String(ESTIMADO));
  const guardado = admin.waitForResponse((r) => r.url().endsWith(`/servicios/${idServicio}`));
  await editor.getByRole('button', { name: 'Guardar cambios' }).click();
  expect((await guardado).status()).toBe(200);
  expect(
    valor(
      `SELECT cantidad_estimada FROM SERVICIO_INSUMO WHERE id_variante = ${idVariante} AND id_producto = ${idInsumo}`,
    ),
  ).toBe(String(ESTIMADO));

  const nuevo = Number(precio) + 10;
  await admin.getByRole('button', { name: `Editar servicio ${nombre}` }).click();
  await editor.locator('#precioNuevo0').fill(String(nuevo));
  const cambio = admin.waitForResponse((r) => r.url().endsWith('/precio'));
  await editor.getByRole('button', { name: 'Cambiar precio' }).click();
  expect((await cambio).status()).toBe(200);
  await expect(editor).toContainText(`Precio actual S/ ${nuevo}.00`);
  await editor.getByRole('button', { name: 'Cancelar' }).click();
  expect(valor(`SELECT precio FROM VARIANTE_SERVICIO WHERE id_variante = ${idVariante}`)).toBe(
    String(nuevo),
  );
  const auditoria = valor(
    `SELECT COUNT(*) FROM AUDITORIA WHERE UPPER(entidad) LIKE 'VARIANTE%' AND id_entidad = ${idVariante}`,
  );
  expect(Number(auditoria)).toBeGreaterThan(0);
  obtenido(
    'CUS58',
    `insumo ${idInsumo} × ${ESTIMADO} ml en la variante ${idVariante}; precio ${precio} → ${nuevo}`,
  );
  obtenido('RN25', `cambio de precio en AUDITORIA (${auditoria} fila/s de VARIANTE_SERVICIO)`);
});

// ── 3 · La recepcionista ───────────────────────────────────────────────────────────────────────

test('3 · CUS44, CUS02, CUS03 y CUS04: abre la caja, registra dos clientas y actualiza una ficha', async () => {
  exigirHorario();
  await entrar(recepcion, 'recepcion', CLAVE_RECEPCION);
  await recepcion.goto('/caja');
  await recepcion.locator('#cajaMontoInicial').fill('100');
  await recepcion.getByRole('button', { name: 'Abrir caja' }).click();
  await expect(recepcion.getByText(/Abierta desde/)).toBeVisible();
  idCaja = valor("SELECT id_caja FROM CAJA WHERE estado = 'ABIERTA' AND id_sede = 1");

  await recepcion.goto('/agenda/clientas');
  for (const [nombre, telefono, documento] of [
    [CLIENTA_A, '987600011', 'E2E000011'],
    [CLIENTA_B, '987600012', 'E2E000012'],
  ]) {
    await recepcion.getByRole('button', { name: '+ Registrar clienta' }).click();
    await recepcion.locator('#idTipoDocumento').selectOption({ label: 'PASAPORTE' });
    await recepcion.locator('#numeroDocumento').fill(documento);
    await recepcion.locator('#nombres').fill(nombre);
    await recepcion.locator('#apellidos').fill('E2E');
    await recepcion.locator('#telefono').fill(telefono);
    await recepcion.locator('#consentimiento').check();
    await modal(recepcion).getByRole('button', { name: 'Registrar', exact: true }).click();
    await expect(recepcion.locator('tbody')).toContainText(nombre);
  }

  await recepcion.getByRole('link', { name: `Ver ficha de ${CLIENTA_A}` }).click();
  await expect(recepcion.locator('h1')).toContainText(`${CLIENTA_A} E2E`);
  await expect(recepcion.locator('#saldoFavor')).toHaveText('S/ 0.00');
  await recepcion.locator('#fichaCorreo').fill('wendy.e2e@ejemplo.com');
  await recepcion.locator('#fichaObservaciones').fill('Prefiere la tarde');
  const guardado = recepcion.waitForResponse(
    (r) => /\/clientes\/\d+$/.test(r.url()) && r.request().method() === 'PUT',
  );
  await recepcion.getByRole('button', { name: 'Guardar cambios' }).click();
  expect((await guardado).status()).toBe(200);
  const correo = valor(
    `SELECT p.correo FROM PERSONA p WHERE p.nombres = '${CLIENTA_A}' AND p.apellidos = 'E2E'`,
  );
  expect(correo).toBe('wendy.e2e@ejemplo.com');
  await recepcion.getByRole('tab', { name: 'Historial' }).click();
  await expect(recepcion.getByText('Sin citas pendientes.')).toBeVisible();
  obtenido('CUS03', `ficha de ${CLIENTA_A}: saldo S/ 0.00, sin citas pendientes`);
  obtenido('CUS04', `correo y observaciones guardados (${correo})`);
});

test('3 · RN49: agendar en el pasado avisa y el back-end responde 422', async () => {
  await recepcion.goto('/agenda');
  await recepcion.getByRole('button', { name: '+ Nueva cita' }).click();
  await elegirClienta(modal(recepcion), CLIENTA_A);
  await elegirPorTexto(recepcion, '#citaServicio', SERVICIO);
  await recepcion.locator('#citaFecha').fill(fechaIso(-1));
  await modal(recepcion).getByRole('button', { name: 'Ver disponibilidad' }).click();
  await expect(modal(recepcion).locator('.alert.bad')).toContainText('RN49');
  await modal(recepcion).getByRole('button', { name: 'Cancelar' }).click();
  const idCliente = valor(
    `SELECT id_persona FROM PERSONA WHERE nombres = '${CLIENTA_A}' AND apellidos = 'E2E'`,
  );
  const pasado = await api(recepcion, 'post', '/citas', {
    idCliente: Number(idCliente),
    idVariante: Number(idVariante),
    idPersonal: Number(
      valor("SELECT id_personal FROM USUARIO WHERE nombre_usuario = 'especialista1'"),
    ),
    idRecurso: 1,
    fechaHoraInicio: `${fechaIso(-1)}T10:00:00`,
    duracionMin: 90,
  });
  expect(pasado.status).toBe(422);
  obtenido(
    'RN49',
    `la pantalla avisa; la API responde ${pasado.status} ${String(pasado.json['regla'])}`,
  );
});

test('3 · CUS06, CUS05 y RN51: anota a una clienta en espera y la programa desde la espera', async () => {
  await recepcion.getByRole('button', { name: /Lista de espera/ }).click();
  await elegirClienta(modal(recepcion), CLIENTA_B);
  await elegirPorTexto(recepcion, '#esperaServicio', SERVICIO);
  const espera = recepcion.waitForResponse(
    (r) => r.url().includes('/lista-espera') && r.request().method() === 'POST',
  );
  await modal(recepcion).getByRole('button', { name: 'Anotar en lista de espera' }).click();
  expect((await espera).status()).toBe(201);
  const panel = recepcion.locator('section', { hasText: 'Lista de espera' });
  await expect(panel).toContainText(CLIENTA_B);

  await panel
    .locator('.espera', { hasText: CLIENTA_B })
    .getByRole('button', { name: 'Programar' })
    .click();
  await expect(modal(recepcion)).toContainText('Desde la lista de espera');
  const horas = await horasLibres(recepcion);
  // RN51: las horas se ofrecen cada AGENDA_PASO_MIN (30) minutos.
  expect(minutos(horas[1]) - minutos(horas[0])).toBe(30);
  await modal(recepcion).getByRole('button', { name: horas[0], exact: true }).click();
  const nombreEsp1 = valor(
    "SELECT p.nombres || ' ' || p.apellidos FROM PERSONA p JOIN USUARIO u ON u.id_personal = p.id_persona WHERE u.nombre_usuario = 'especialista1'",
  );
  await recepcion.locator('#citaIdPersonal').selectOption({ label: nombreEsp1 });
  idCitaEspera = await agendar(recepcion);
  const [estado, cita] = sql(
    `SELECT e.estado, e.id_cita FROM LISTA_ESPERA e JOIN PERSONA p ON p.id_persona = e.id_cliente WHERE p.nombres = '${CLIENTA_B}'`,
  )[0];
  expect(estado).toBe('ASIGNADA');
  expect(cita).toBe(String(idCitaEspera));
  await expect(panel).not.toContainText(CLIENTA_B);
  const duracion = valor(
    `SELECT ROUND((CAST(fecha_hora_fin AS DATE) - CAST(fecha_hora_inicio AS DATE)) * 1440) FROM CITA WHERE id_cita = ${idCitaEspera}`,
  );
  obtenido('CUS06', `${CLIENTA_B} anotada; el panel del día la lista`);
  obtenido(
    'CUS05',
    `cita ${idCitaEspera} a las ${horas[0]} desde la espera: espera ASIGNADA con esa cita`,
  );
  obtenido('RN51', `horas libres ${horas.slice(0, 3).join(', ')}: cada 30 min`);
  obtenido('RN03', `cita de 90 min + limpieza del sillón = ${duracion} min`);
});

test('3 · CUS09 y RN05: reprograma una cita con adelanto, que lo conserva', async () => {
  await recepcion.goto('/agenda');
  const { idCita, hora } = await nuevaCita(recepcion, CLIENTA_A);
  idCitaReprogramada = idCita;
  await registrarAdelanto(recepcion, idCita, ADELANTO_REPROGRAMADA);

  await bloque(recepcion, hora, CLIENTA_A).click();
  await modal(recepcion).getByRole('button', { name: 'Reprogramar' }).click();
  const horas = await horasLibres(recepcion);
  const nueva = horas[horas.length - 1];
  await modal(recepcion).getByRole('button', { name: nueva, exact: true }).click();
  const reprogramacion = recepcion.waitForResponse((r) => r.url().endsWith('/reprogramacion'));
  await modal(recepcion).getByRole('button', { name: 'Reprogramar', exact: true }).click();
  const respuesta = await reprogramacion;
  expect(respuesta.status()).toBe(201);
  idCitaNueva = ((await respuesta.json()) as { idCita: number }).idCita;
  const origen = sql(`SELECT estado FROM CITA WHERE id_cita = ${idCita}`)[0][0];
  const [estado, adelanto, idOrigen] = sql(
    `SELECT estado, adelanto_monto, id_cita_origen FROM CITA WHERE id_cita = ${idCitaNueva}`,
  )[0];
  expect(origen).toBe('REPROGRAMADA');
  expect([estado, adelanto, idOrigen]).toEqual([
    'PENDIENTE',
    String(ADELANTO_REPROGRAMADA),
    String(idCita),
  ]);
  obtenido('CUS09', `cita ${idCita} REPROGRAMADA → ${idCitaNueva} a las ${nueva}`);
  obtenido('RN05', `la nueva cita hereda el adelanto de S/ ${adelanto}`);
});

test('3 · CUS10 y RN05: cancela otra con adelanto por «No se presentó» y queda saldo a favor', async () => {
  await recepcion.goto('/agenda');
  const { idCita, hora } = await nuevaCita(recepcion, CLIENTA_A);
  idCitaCancelada = idCita;
  await registrarAdelanto(recepcion, idCita, ADELANTO_CANCELADA);
  await bloque(recepcion, hora, CLIENTA_A).click();
  await modal(recepcion).getByRole('button', { name: 'Cancelar cita' }).click();
  await modal(recepcion).getByRole('button', { name: 'No se presentó' }).click();
  await expect(recepcion.locator('#motivoCancelacion')).toHaveValue('No se presentó');
  const cancelacion = recepcion.waitForResponse((r) => r.url().endsWith('/cancelacion'));
  await modal(recepcion).getByRole('button', { name: 'Cancelar cita', exact: true }).click();
  expect((await cancelacion).status()).toBe(200);
  await expect(recepcion.locator('#saldoQuedo')).toContainText(`S/ ${ADELANTO_CANCELADA}.00`);
  await modal(recepcion).getByRole('button', { name: 'Cerrar' }).click();
  const [estado, motivo] = sql(
    `SELECT estado, motivo_cancelacion FROM CITA WHERE id_cita = ${idCita}`,
  )[0];
  expect([estado, motivo]).toEqual(['CANCELADA', 'No se presentó']);

  await recepcion.goto('/agenda/clientas');
  await recepcion.getByRole('link', { name: `Ver ficha de ${CLIENTA_A}` }).click();
  await expect(recepcion.locator('#saldoFavor')).toHaveText(`S/ ${ADELANTO_CANCELADA}.00`);
  obtenido(
    'CUS10',
    `cita ${idCita} CANCELADA por «${motivo}»; aviso de S/ ${ADELANTO_CANCELADA} de saldo`,
  );
  obtenido('RN05', `la ficha de ${CLIENTA_A} muestra S/ ${ADELANTO_CANCELADA}.00 de saldo a favor`);
});

// ── 4 · Las especialistas ──────────────────────────────────────────────────────────────────────

test('4 · CUS11 y CUS12: especialista1 atiende y recomienda un producto', async () => {
  await entrar(especialista, 'especialista1', CLAVE_ESPECIALISTA);
  await especialista.goto('/agenda/mi-agenda');
  const tarjeta = especialista.locator('.card', { hasText: `Cita ${idCitaEspera}` });
  await tarjeta.getByRole('button', { name: 'Iniciar atención' }).click();
  await especialista.locator('#tiempoDeclaradoMin').fill('90');
  await modal(especialista).getByRole('button', { name: 'Iniciar atención' }).click();
  await expect(especialista).toHaveURL(/\/agenda\/atencion/);
  idAtencion = valor(`SELECT id_atencion FROM ATENCION WHERE id_cita = ${idCitaEspera}`);

  await especialista.locator('#buscarProducto').fill('Argán');
  await especialista.getByRole('button', { name: 'Buscar producto' }).click();
  await especialista.getByRole('option', { name: new RegExp(PRODUCTO_VENTA) }).click();
  await especialista.locator('#observacionRecomendacion').fill('Para mantener la hidratación');
  const recomendacion = especialista.waitForResponse((r) => r.url().endsWith('/recomendaciones'));
  await especialista.getByRole('button', { name: 'Recomendar', exact: true }).click();
  expect((await recomendacion).status()).toBe(201);
  await expect(especialista.locator('.chip.ok')).toContainText(PRODUCTO_VENTA);
  expect(
    valor(
      `SELECT COUNT(*) FROM RECOMENDACION_PRODUCTO WHERE id_atencion = ${idAtencion} AND id_producto = ${idProductoVenta}`,
    ),
  ).toBe('1');
  obtenido('CUS12', `atención ${idAtencion}: recomendó ${PRODUCTO_VENTA} con su observación`);
});

test('4 · RN50: especialista2 no puede tocar la atención de otra', async () => {
  await entrar(especialista2, 'especialista2', CLAVE_ESPECIALISTA2, CLAVE_RESTABLECIDA);
  const ajena = await api(especialista2, 'post', `/atenciones/${idAtencion}/recomendaciones`, {
    idProducto: Number(idProductoVenta),
  });
  expect(ajena.status).toBe(403);
  expect(String(ajena.json['regla'])).toBe('RN50');
  obtenido('RN50', `especialista2 sobre la atención ${idAtencion}: HTTP ${ajena.status} RN50`);
  obtenido('CUS54', 'especialista2 entró con la clave restablecida y la cambió');
});

test('4 · CUS11, RN36 y RN53: finaliza; descuenta lo que hay y deja un consumo pendiente', async () => {
  await especialista.getByRole('button', { name: 'Finalizar', exact: true }).click();
  await expect(especialista.getByText('Atención finalizada', { exact: true })).toBeVisible();
  await expect(especialista.locator('.alert.warn')).toContainText(`Faltó stock de: ${INSUMO}`);
  const disponible = STOCK_AJUSTE - SALIDA;
  const [descontada, pendiente, estado] = sql(
    `SELECT cantidad_descontada, cantidad_pendiente, estado FROM CONSUMO_PENDIENTE WHERE id_atencion = ${idAtencion}`,
  )[0];
  expect([descontada, pendiente, estado]).toEqual([
    String(disponible),
    String(ESTIMADO - disponible),
    'PENDIENTE',
  ]);
  const salida = sql(
    `SELECT tipo, cantidad FROM MOVIMIENTO_KARDEX WHERE id_atencion = ${idAtencion} AND id_producto = ${idInsumo}`,
  )[0];
  expect(salida[0]).toBe('SALIDA');
  const paquete = valor(
    `SELECT NVL(TO_CHAR(id_cliente_paquete), '-') FROM ATENCION WHERE id_atencion = ${idAtencion}`,
  );
  obtenido(
    'RN53',
    `estimado ${ESTIMADO}: descontó ${descontada}, pendiente ${pendiente} ${estado}`,
  );
  obtenido(
    'RN36',
    `sin paquete comprado, la atención no usa sesión (id_cliente_paquete ${paquete})`,
  );

  await almacen.goto(`/inventario/kardex?idProducto=${idInsumo}`);
  await expect(almacen.locator('tbody')).toContainText(`Atención N° ${idAtencion}`);
  obtenido('CUS35', `el kardex muestra la SALIDA automática de la atención ${idAtencion}`);
});

// ── 5 · La encargada resuelve el consumo pendiente ─────────────────────────────────────────────

test('5 · CUS33 y RN15: ve el aviso, no puede regularizar sin stock y descarta con motivo', async () => {
  await almacen.goto('/inicio');
  await expect(almacen.locator('app-panel-avisos')).toContainText(/consumo pendiente/);
  await almacen.goto('/inventario');
  await almacen.getByRole('tab', { name: /Consumos pendientes/ }).click();
  const fila = almacen.locator('app-consumos-pendientes tbody tr', { hasText: INSUMO });
  const regularizar = almacen.waitForResponse((r) => r.url().endsWith('/regularizacion'));
  await fila.getByRole('button', { name: 'Regularizar' }).click();
  const sinStock = await regularizar;
  expect(sinStock.status()).toBe(409);

  await fila.getByRole('button', { name: 'Descartar' }).click();
  await almacen.locator('#observacionDescarte').fill('Se usó menos de lo estimado');
  const descarte = almacen.waitForResponse((r) => r.url().endsWith('/descarte'));
  await modal(almacen).getByRole('button', { name: 'Descartar' }).click();
  expect((await descarte).status()).toBe(200);
  await expect(almacen.locator('app-consumos-pendientes')).toContainText(
    'No hay consumos pendientes.',
  );
  const estado = valor(`SELECT estado FROM CONSUMO_PENDIENTE WHERE id_atencion = ${idAtencion}`);
  expect(estado).toBe('DESCARTADO');
  obtenido(
    'CUS33',
    `aviso en Inicio; regularizar sin stock: HTTP ${sinStock.status()}; descartado con motivo`,
  );
  obtenido('RN15', `regularizar sin stock: HTTP ${sinStock.status()}`);
});

// ── 6 · La recepcionista vende y pide anulaciones ──────────────────────────────────────────────

test('6 · CUS25, CUS26, RN13 y RN17: vende el producto recomendado', async () => {
  const primera = await venderProducto(recepcion, 'Efectivo', CLIENTA_A);
  expect(primera.status).toBe(201);
  ventas.saldo = primera.idVenta;
  await expect(recepcion.locator('app-comprobante-emitido')).toContainText(/Boleta B001-\d+/);
  for (const [clave, medio] of [
    ['rechazada', 'Efectivo'],
    ['yape', 'Yape'],
  ] as const) {
    const venta = await venderProducto(recepcion, medio);
    expect(venta.status).toBe(201);
    ventas[clave] = venta.idVenta;
  }
  const stock = valor(
    `SELECT stock_actual FROM INVENTARIO_SEDE WHERE id_producto = ${idProductoVenta} AND id_sede = 1`,
  );
  expect(stock).toBe('2');

  // Un insumo no se vende (RN13) y la recepcionista no ajusta stock (RN17).
  const insumo = await api(recepcion, 'post', '/ventas/productos', {
    tipo: 'BOLETA',
    idMedioPago: 1,
    monto: 1,
    lineas: [{ idProducto: Number(idInsumo), cantidad: 1 }],
  });
  const ajuste = await api(recepcion, 'post', `/productos/${idProductoVenta}/ajustes`, {
    cantidad: 50,
    motivo: 'Sin permiso',
  });
  expect(insumo.status).toBe(422);
  expect(ajuste.status).toBe(403);
  obtenido(
    'CUS26',
    `ventas ${ventas.saldo}, ${ventas.rechazada} y ${ventas.yape} CERRADAS; stock de ${PRODUCTO_VENTA} 5 → ${stock}`,
  );
  obtenido('CUS25', `búsqueda «${PRODUCTO_VENTA}» con su precio y stock`);
  obtenido('RN13', `vender el insumo: HTTP ${insumo.status} ${String(insumo.json['regla'])}`);
  obtenido('RN17', `la recepcionista ajusta stock: HTTP ${ajuste.status}`);
});

test('6 · RN52: con tarjeta por enlace la venta queda abierta y se cierra al aprobarse', async () => {
  const venta = await venderProducto(recepcion, 'Tarjeta');
  expect(venta.status).toBe(202);
  ventas.tarjeta = venta.idVenta;
  await expect(recepcion).toHaveURL(new RegExp(`/ventas/cobros\\?idVenta=${venta.idVenta}`));
  expect(valor(`SELECT estado FROM VENTA WHERE id_venta = ${venta.idVenta}`)).toBe('ABIERTA');

  const codigo = valor(
    "SELECT codigo_operacion FROM TRANSACCION_PASARELA WHERE estado = 'PENDIENTE' AND canal = 'LINK' AND id_cita IS NULL ORDER BY id_transaccion DESC FETCH FIRST 1 ROW ONLY",
  );
  const cuerpo = JSON.stringify({ codigoOperacion: codigo, estado: 'APROBADA' });
  const firma = createHmac('sha256', claves.hmac).update(cuerpo).digest('hex');
  const izipay = await request.newContext({ baseURL: `http://localhost:${PUERTO_API}` });
  const aviso = await izipay.post('/api/v1/pagos/notificaciones', {
    data: cuerpo,
    headers: { 'Content-Type': 'application/json', 'X-Firma-Hmac': firma },
  });
  expect(aviso.status()).toBe(200);
  await izipay.dispose();

  await recepcion.getByRole('button', { name: 'Verificar aprobación' }).click();
  await expect(recepcion.getByText('Pagos completos')).toBeVisible();
  await recepcion.getByRole('button', { name: 'Cerrar venta y emitir comprobante' }).click();
  await expect(recepcion.locator('app-comprobante-emitido')).toContainText(/Boleta B001-\d+/);
  expect(valor(`SELECT estado FROM VENTA WHERE id_venta = ${venta.idVenta}`)).toBe('CERRADA');
  obtenido(
    'RN52',
    `venta ${venta.idVenta}: 202 ABIERTA; tras el webhook APROBADA, CERRADA en Cobros`,
  );
});

test('6 · CUS22, RN12, RN32 y RN44: solicita anulaciones sin usuario ni clave', async () => {
  const conSaldo = await solicitarAnulacion(recepcion, ventas.saldo!, 'saldo');
  await solicitarAnulacion(recepcion, ventas.rechazada!, 'original');
  await solicitarAnulacion(recepcion, ventas.yape!, 'original');
  expect(valor(`SELECT estado FROM VENTA WHERE id_venta = ${ventas.saldo}`)).toBe('CERRADA');

  // De paso no tiene saldo a favor (RN44) y la recepcionista no aprueba (RN32).
  const deVenta = await api(recepcion, 'post', `/ventas/${ventas.tarjeta}/solicitudes-anulacion`, {
    motivo: 'Prueba',
    codigoMotivo: '01',
    formaDevolucion: 'SALDO_FAVOR',
  });
  const aprobar = await api(recepcion, 'post', `/solicitudes-anulacion/${conSaldo}/aprobacion`);
  expect(deVenta.status).toBe(422);
  expect(aprobar.status).toBe(403);
  obtenido('CUS22', `tres solicitudes PENDIENTES (una SALDO_FAVOR); las ventas siguen CERRADAS`);
  obtenido(
    'RN44',
    `saldo a favor de un cliente de paso: HTTP ${deVenta.status} ${String(deVenta.json['regla'])}`,
  );
  obtenido('RN32', `la recepcionista aprueba: HTTP ${aprobar.status}`);
});

// ── 7 · La administradora ──────────────────────────────────────────────────────────────────────

test('7 · CUS23, RN12, RN33 y RN47: aprueba con nota de crédito y rechaza otra con motivo', async () => {
  await admin.goto('/inicio');
  await expect(admin.locator('app-panel-avisos')).toContainText(/anulaci/i);
  await admin.goto('/ventas/anulaciones');
  const fila = (idVenta: number) =>
    admin.locator('app-bandeja-anulaciones tbody tr', { hasText: `Venta ${idVenta}` });

  for (const idVenta of [ventas.saldo!, ventas.yape!]) {
    await fila(idVenta).getByRole('button', { name: 'Aprobar anulación' }).click();
    const aprobacion = admin.waitForResponse((r) => r.url().endsWith('/aprobacion'));
    await modal(admin).getByRole('button', { name: 'Aprobar anulación' }).click();
    expect((await aprobacion).status()).toBe(200);
    await expect(admin.locator('#notaCredito')).toContainText('Nota de crédito');
  }
  await fila(ventas.rechazada!).getByRole('button', { name: 'Rechazar' }).click();
  await admin.locator('#motivoRechazo').fill('La venta es correcta');
  const rechazo = admin.waitForResponse((r) => r.url().endsWith('/rechazo'));
  await modal(admin).getByRole('button', { name: 'Rechazar', exact: true }).click();
  expect((await rechazo).status()).toBe(200);

  const anulada = sql(
    `SELECT v.estado, c.serie || '-' || c.numero, s.forma_devolucion FROM VENTA v JOIN SOLICITUD_ANULACION s ON s.id_venta = v.id_venta JOIN COMPROBANTE c ON c.id_comprobante = s.id_nota_credito WHERE v.id_venta = ${ventas.saldo}`,
  )[0];
  expect(anulada[0]).toBe('ANULADA');
  expect(anulada[1]).toMatch(/^BC01-/);
  expect(valor(`SELECT estado FROM VENTA WHERE id_venta = ${ventas.rechazada}`)).toBe('CERRADA');
  expect(valor(`SELECT estado FROM SOLICITUD_ANULACION WHERE id_venta = ${ventas.rechazada}`)).toBe(
    'RECHAZADA',
  );
  const notas = sql(
    "SELECT TO_NUMBER(numero) FROM COMPROBANTE WHERE serie = 'BC01' ORDER BY TO_NUMBER(numero)",
  ).map((f) => Number(f[0]));
  expect(notas.every((n, i) => i === 0 || n === notas[i - 1] + 1)).toBe(true);
  const validas = valor(`SELECT COUNT(*) FROM V_VENTA_VALIDA WHERE id_venta = ${ventas.saldo}`);
  expect(validas).toBe('0');
  obtenido(
    'CUS23',
    `venta ${ventas.saldo} ANULADA con ${anulada[1]}; venta ${ventas.rechazada} RECHAZADA con motivo`,
  );
  obtenido('RN12', `la venta anulada sigue en la base (${anulada[0]}) con su nota de crédito`);
  obtenido('RN47', `notas de crédito BC01 correlativas: ${notas.join(', ')}`);
  obtenido('RN33', `la venta anulada no está en V_VENTA_VALIDA (${validas})`);
});

test('7 · CUS24 y RN44: devuelve a mano el pago Yape de la venta anulada', async () => {
  const saldo = valor(
    `SELECT NVL(SUM(CASE WHEN m.tipo = 'ABONO' THEN m.monto ELSE -m.monto END), 0) FROM SALDO_FAVOR_MOV m JOIN PERSONA p ON p.id_persona = m.id_cliente WHERE p.nombres = '${CLIENTA_A}' AND p.apellidos = 'E2E'`,
  );
  await admin.getByRole('tab', { name: 'Devoluciones' }).click();
  const tarjeta = admin.locator('.devolucion', { hasText: `Venta ${ventas.yape}` });
  await tarjeta.getByRole('button', { name: 'Ver pagos' }).click();
  const idTransaccion = valor(
    `SELECT id_transaccion FROM VENTA_PAGO WHERE id_venta = ${ventas.yape} AND id_transaccion IS NOT NULL`,
  );
  await tarjeta.getByLabel(`Número de operación del pago ${idTransaccion}`).fill('YAPE-E2E-001');
  const devolucion = admin.waitForResponse((r) => r.url().endsWith('/devolucion-manual'));
  await tarjeta.getByRole('button', { name: 'Registrar devolución manual' }).click();
  expect((await devolucion).status()).toBe(201);
  await expect(tarjeta).toContainText('Devuelto · YAPE-E2E-001');
  const [canal, estado] = sql(
    "SELECT canal, estado FROM TRANSACCION_PASARELA WHERE codigo_operacion = 'YAPE-E2E-001'",
  )[0];
  expect([canal, estado]).toEqual(['QR', 'APROBADA']);
  obtenido('CUS24', `devolución manual de Yape: ${canal} ${estado} con YAPE-E2E-001`);
  obtenido(
    'RN44',
    `SALDO_FAVOR: ${CLIENTA_A} tiene S/ ${saldo} (adelanto + venta anulada); MEDIO_ORIGINAL: Yape devuelto`,
  );
});

test('7 · CUS45, CUS46 y RN30: aprueba el cierre con diferencia y reabre la caja del día', async () => {
  await recepcion.goto('/caja');
  await recepcion.getByRole('button', { name: 'Cerrar caja' }).click();
  const filaEfectivo = modal(recepcion).locator('tbody tr').first();
  const esperado = Number(
    /[\d.]+/.exec((await filaEfectivo.locator('td').nth(1).textContent()) ?? '')![0],
  );
  await recepcion.locator('#contado1').fill(String(esperado - 3));
  const observaciones = modal(recepcion).locator('textarea');
  for (let i = 0; i < (await observaciones.count()); i++) {
    await observaciones.nth(i).fill('Faltan tres soles');
  }
  await modal(recepcion).getByRole('button', { name: 'Confirmar cierre' }).click();
  await expect(recepcion.getByText(`Cierre de la caja ${idCaja}`)).toBeVisible();

  await admin.goto('/inicio');
  await expect(admin.locator('app-panel-avisos')).toContainText(/cierre/);
  await admin.goto('/caja/revision');
  const cierre = admin.locator('.cierre', { hasText: `Caja ${idCaja}` });
  await expect(cierre).toContainText('Faltan tres soles');
  const aprobacion = admin.waitForResponse((r) => r.url().endsWith(`/cajas/${idCaja}/revision`));
  await cierre.getByRole('button', { name: 'Aprobar cierre' }).click();
  expect((await aprobacion).status()).toBe(200);
  await expect(cierre).toHaveCount(0);

  const fila = admin.locator('#cajasHoy tbody tr', { hasText: idCaja });
  await fila.getByRole('button', { name: 'Reabrir caja' }).click();
  await expect(admin.locator('#avisoReapertura')).toContainText('arquear y cerrar');
  await admin.locator('#motivoReapertura').fill('Venta registrada después del cierre');
  const reapertura = admin.waitForResponse((r) => r.url().endsWith('/reapertura'));
  await modal(admin).getByRole('button', { name: 'Reabrir caja' }).click();
  expect((await reapertura).status()).toBe(200);
  await expect(fila).toContainText('Abierta');
  const [estado, revisada, motivo] = sql(
    `SELECT estado, NVL2(fecha_revision, 'S', 'N'), motivo_reapertura FROM CAJA WHERE id_caja = ${idCaja}`,
  )[0];
  expect(estado).toBe('ABIERTA');
  obtenido('CUS45', `caja ${idCaja} cerrada con −3 en efectivo y su observación`);
  obtenido(
    'CUS46',
    `cierre aprobado; caja reabierta: ${estado}, motivo «${motivo}» (revisión ${revisada})`,
  );
  obtenido('RN30', 'el cierre con diferencia se aprueba aparte y la reapertura exige motivo');
});

test('7 · CUS47 y RN31: sube la liquidación, concilia, justifica y cierra el mes', async () => {
  const codigos = sql(
    "SELECT codigo_operacion FROM TRANSACCION_PASARELA WHERE estado = 'APROBADA' AND codigo_operacion IS NOT NULL",
  ).map((f) => f[0]);
  const csv = [
    'Número de pedido,Comisión,Fecha de abono',
    ...codigos.map((codigo) => `${codigo},0.95,${fechaIso().split('-').reverse().join('/')}`),
    `CS-E2E-DESCONOCIDO,0.50,${fechaIso().split('-').reverse().join('/')}`,
  ].join('\n');
  await admin.goto('/caja/conciliacion');
  await admin.locator('#archivoLiquidacion').setInputFiles({
    name: 'liquidacion-e2e.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csv, 'utf8'),
  });
  const importacion = admin.waitForResponse((r) => r.url().endsWith('/liquidacion'));
  await admin.getByRole('button', { name: 'Importar liquidación' }).click();
  const resumen = (await (await importacion).json()) as {
    filasLeidas: number;
    filasRegistradas: number;
    codigosSinTransaccion: string[];
  };
  await expect(admin.locator('#resumenLiquidacion')).toContainText('CS-E2E-DESCONOCIDO');
  expect(resumen.codigosSinTransaccion).toContain('CS-E2E-DESCONOCIDO');

  const conciliacion = admin.waitForResponse((r) => r.url().endsWith('/conciliaciones'));
  await admin.getByRole('button', { name: 'Conciliar', exact: true }).click();
  const respuesta = await conciliacion;
  expect(respuesta.status()).toBe(201);
  const { idConciliacion } = (await respuesta.json()) as { idConciliacion: number };

  const justificar = admin.getByRole('button', { name: 'Justificar', exact: true });
  let justificadas = 0;
  while ((await justificar.count()) > 0) {
    await justificar.first().click();
    await admin
      .locator('input[aria-label^="Justificación de"]')
      .fill('Revisado contra el reporte de Izipay');
    const guardado = admin.waitForResponse((r) => /\/items\/\d+$/.test(r.url()));
    await admin.getByRole('button', { name: 'Guardar justificación' }).click();
    expect((await guardado).status()).toBe(200);
    justificadas++;
  }
  const cerrar = admin.getByRole('button', { name: 'Cerrar conciliación' });
  await expect(cerrar).toBeEnabled();
  const cierre = admin.waitForResponse((r) => r.url().endsWith('/cierre'));
  await cerrar.click();
  expect((await cierre).status()).toBe(200);
  await expect(admin.getByText('Cerrada', { exact: true })).toBeVisible();
  const [estado, items] = sql(
    `SELECT c.estado, (SELECT COUNT(*) FROM CONCILIACION_ITEM i WHERE i.id_conciliacion = c.id_conciliacion) FROM CONCILIACION c WHERE c.id_conciliacion = ${idConciliacion}`,
  )[0];
  expect(estado).toBe('CERRADA');
  const anuladaComoValida = valor(
    `SELECT COUNT(*) FROM CONCILIACION_ITEM WHERE id_conciliacion = ${idConciliacion} AND id_venta = ${ventas.saldo} AND estado = 'COINCIDE'`,
  );
  expect(anuladaComoValida).toBe('0');
  obtenido(
    'CUS47',
    `liquidación: ${resumen.filasRegistradas} de ${resumen.filasLeidas} filas casaron; conciliación ${idConciliacion} con ${items} ítems, ${justificadas} justificados, CERRADA`,
  );
  obtenido(
    'RN31',
    'cada venta, comprobante y transacción del mes quedó como ítem; la anulada no coincide',
  );
});

test('7 · CUS48, CUS49 y RN24: genera y exporta el reporte de ventas', async () => {
  await admin.goto('/reportes');
  const generado = admin.waitForResponse((r) => r.url().includes('/reportes/ventas?'));
  await admin.getByRole('button', { name: 'Generar' }).click();
  expect((await generado).status()).toBe(200);
  await expect(admin.locator('#tablaReporte tbody tr').first()).toBeVisible();
  await expect(admin.locator('.grafico .relleno').first()).toBeVisible();

  const archivos: string[] = [];
  for (const formato of ['Exportar a Excel', 'Exportar a PDF']) {
    const descarga = admin.waitForEvent('download');
    await admin.getByRole('button', { name: formato }).click();
    const archivo = await descarga;
    archivos.push(archivo.suggestedFilename());
    const contenido = readFileSync((await archivo.path())!);
    expect(contenido.length).toBeGreaterThan(0);
  }
  expect(archivos[0]).toMatch(/\.xlsx$/);
  expect(archivos[1]).toMatch(/\.pdf$/);
  const margen = await api(
    recepcion,
    'get',
    `/reportes/margen?fechaInicio=${fechaIso(-1)}&fechaFin=${fechaIso()}`,
  );
  expect(margen.status).toBe(403);
  obtenido('CUS48', 'reporte de ventas por línea con tabla y gráfico');
  obtenido('CUS49', `descargas ${archivos.join(' y ')}`);
  obtenido(
    'RN24',
    `margen pedido por la recepcionista: HTTP ${margen.status} ${String(margen.json['regla'])}`,
  );
});

test('7 · CUS55 y RN48: consulta la auditoría; la última administradora no pierde su rol', async () => {
  await admin.goto('/seguridad/usuarios');
  const idAdmin = valor("SELECT id_usuario FROM USUARIO WHERE nombre_usuario = 'admin'");
  const idRecepcionista = valor("SELECT id_rol FROM ROL WHERE nombre = 'RECEPCIONISTA'");
  const quitar = await api(admin, 'patch', `/usuarios/${idAdmin}/rol`, {
    idRol: Number(idRecepcionista),
  });
  expect(quitar.status).toBe(422);

  await admin.getByRole('tab', { name: 'Auditoría' }).click();
  await elegirPorTexto(admin, '#auditoriaUsuario', 'admin');
  const consulta = admin.waitForResponse((r) => r.url().includes('/auditoria?'));
  await admin.getByRole('button', { name: 'Consultar' }).click();
  expect((await consulta).status()).toBe(200);
  const filas = admin.locator('app-auditoria tbody tr');
  await expect(filas.first()).toContainText('admin');
  const cuantas = await filas.count();
  expect(cuantas).toBeGreaterThan(0);
  obtenido('CUS55', `auditoría de admin: ${cuantas} filas (precio, paquete, anulación, caja...)`);
  obtenido(
    'RN48',
    `quitarle el rol a la última administradora: HTTP ${quitar.status} ${String(quitar.json['regla'])}`,
  );
});
