import { expect, Locator, Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import { ARCHIVO_ENTORNO, CONTENEDOR, ESQUEMA } from './entorno.mjs';

export const CLAVE_TEMPORAL = 'CambiarAlEntrar2026';
/** Claves que fija el recorrido de la Iteración 1; el de la Iteración 2 entra con ellas. */
export const CLAVE_ADMIN = 'AdminE2e2026';
export const CLAVE_ESPECIALISTA = 'EspecialE2e2026';
export const claves = JSON.parse(readFileSync(ARCHIVO_ENTORNO, 'utf8')) as {
  dueno: string;
  hmac: string;
};

/** Solo lectura, como dueño del esquema: comprueba lo que la pantalla no muestra. */
export function sql(consulta: string): string[][] {
  const script = `SET HEADING OFF FEEDBACK OFF PAGESIZE 0 LINESIZE 2000 TRIMOUT ON COLSEP '|'\n${consulta};\nEXIT\n`;
  const salida = execFileSync(
    'docker',
    [
      'exec',
      '-i',
      '-e',
      'NLS_LANG=AMERICAN_AMERICA.AL32UTF8',
      CONTENEDOR,
      'sqlplus',
      '-s',
      `${ESQUEMA}/${claves.dueno}@//localhost:1521/FREEPDB1`,
    ],
    { input: script, encoding: 'utf8' },
  );
  if (/^(ORA|SP2)-\d+/m.test(salida)) {
    throw new Error(`Consulta fallida: ${consulta}\n${salida}`);
  }
  return salida
    .split(/\r?\n/)
    .filter((linea) => linea.trim())
    .map((linea) => linea.split('|').map((columna) => columna.trim()));
}

export const valor = (consulta: string): string => sql(consulta)[0]?.[0] ?? '';

/** Deja escrito lo obtenido, para docs/pruebas_it1.md y docs/pruebas_it2.md. */
export function obtenido(caso: string, texto: string, archivo = 'obtenido.txt'): void {
  mkdirSync('test-results', { recursive: true });
  appendFileSync(`test-results/${archivo}`, `${caso}: ${texto}\n`);
  console.log(`   ${caso}: ${texto}`);
}

/**
 * Entra con la clave final del usuario; si aún tiene la temporal (base recién instalada o clave
 * restablecida), entra con ella y la cambia.
 */
export async function entrar(
  page: Page,
  usuario: string,
  clave: string,
  temporal = CLAVE_TEMPORAL,
): Promise<void> {
  const respuesta = page.waitForResponse((r) => r.url().includes('/auth/login'));
  await iniciarSesion(page, usuario, clave);
  if ((await respuesta).ok()) {
    await expect(page).not.toHaveURL(/\/login/);
    return;
  }
  await iniciarSesion(page, usuario, temporal);
  await cambiarClaveTemporal(page, temporal, clave);
}

export async function iniciarSesion(page: Page, usuario: string, clave: string): Promise<void> {
  await page.goto('/login');
  await page.locator('#nombreUsuario').fill(usuario);
  await page.locator('#clave').fill(clave);
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
}

export async function cambiarClaveTemporal(
  page: Page,
  actual: string,
  nueva: string,
): Promise<void> {
  await expect(page).toHaveURL(/\/cambio-clave/);
  await page.locator('#claveActual').fill(actual);
  await page.locator('#claveNueva').fill(nueva);
  const cambio = page.waitForResponse((r) => r.url().includes('/auth/cambio-clave'));
  await page.getByRole('button', { name: 'Cambiar clave', exact: true }).click();
  expect((await cambio).ok()).toBe(true);
  await expect(page).not.toHaveURL(/\/cambio-clave/);
}

/** Llama a la API con la sesión de la página, para las reglas que la pantalla ya impide romper. */
export async function api(
  page: Page,
  metodo: 'get' | 'post' | 'put' | 'patch',
  ruta: string,
  cuerpo?: unknown,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const cookies = await page.context().cookies();
  const xsrf = cookies.find((c) => c.name === 'XSRF-TOKEN')?.value ?? '';
  const respuesta = await page.request[metodo](`/api/v1${ruta}`, {
    headers: { 'X-XSRF-TOKEN': xsrf, 'Content-Type': 'application/json' },
    ...(cuerpo === undefined ? {} : { data: cuerpo }),
  });
  const texto = await respuesta.text();
  return { status: respuesta.status(), json: texto.startsWith('{') ? JSON.parse(texto) : {} };
}

export async function elegirClienta(zona: Locator, nombre: string): Promise<void> {
  await zona.locator('#buscarClientaCita').fill(nombre);
  await zona.getByRole('button', { name: 'Buscar', exact: true }).click();
  await zona.getByRole('button', { name: new RegExp(nombre) }).click();
}

export const aviso = (page: Page): Locator => page.locator('.toast');
export const modal = (page: Page): Locator => page.getByRole('dialog');
