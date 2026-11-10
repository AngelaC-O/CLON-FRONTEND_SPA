import { defineConfig } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  ARCHIVO_ENTORNO,
  DIR_BACKEND,
  ESQUEMA,
  PUERTO_API,
  PUERTO_BD,
  PUERTO_WEB,
} from './e2e/entorno.mjs';

if (!existsSync(ARCHIVO_ENTORNO)) {
  throw new Error('Falta la base de la prueba: ejecuta primero «npm run e2e:bd».');
}
const claves = JSON.parse(readFileSync(ARCHIVO_ENTORNO, 'utf8'));
const mvnw = process.platform === 'win32' ? '.\\mvnw.cmd' : './mvnw';

export default defineConfig({
  testDir: './e2e',
  // El recorrido de la Iteración 2 sigue sobre la base que deja el de la Iteración 1.
  projects: [
    { name: 'it1', testMatch: 'recorrido.e2e.ts' },
    { name: 'it2', testMatch: 'recorrido-it2.e2e.ts', dependencies: ['it1'] },
  ],
  timeout: 60_000,
  expect: { timeout: 15_000 },
  workers: 1,
  reporter: [['list'], ['json', { outputFile: 'test-results/resultados.json' }]],
  use: {
    baseURL: `http://localhost:${PUERTO_WEB}`,
    locale: 'es-PE',
    timezoneId: 'America/Lima',
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: `${mvnw} -q spring-boot:run`,
      cwd: DIR_BACKEND,
      url: `http://localhost:${PUERTO_API}/v3/api-docs`,
      timeout: 240_000,
      reuseExistingServer: true,
      env: {
        SPRING_PROFILES_ACTIVE: 'dev',
        SERVER_PORT: String(PUERTO_API),
        CAUTIVA_DB_URL: `jdbc:oracle:thin:@//localhost:${PUERTO_BD}/FREEPDB1`,
        CAUTIVA_DB_USER: 'CAUTIVA_APP',
        CAUTIVA_DB_PASSWORD: claves.app,
        CAUTIVA_DB_SCHEMA: ESQUEMA,
        CAUTIVA_ARCHIVOS_DIR: join(tmpdir(), 'cautiva-e2e-archivos'),
        CAUTIVA_URL_PUBLICA: `http://localhost:${PUERTO_API}`,
        CAUTIVA_ENLACE_CLAVE: claves.enlace,
        IZIPAY_HMAC_CLAVE: claves.hmac,
        CAUTIVA_EMPRESA_RUC: '20000000001',
        CAUTIVA_EMPRESA_RAZON_SOCIAL: 'Cautiva Spa E.I.R.L.',
        CAUTIVA_EMPRESA_DIRECCION: 'Pichanaki',
        CAUTIVA_EMPRESA_UBIGEO: '120606',
        CAUTIVA_EMPRESA_DEPARTAMENTO: 'Junín',
        CAUTIVA_EMPRESA_PROVINCIA: 'Chanchamayo',
        CAUTIVA_EMPRESA_DISTRITO: 'Pichanaki',
      },
    },
    {
      command: `npx ng serve --port ${PUERTO_WEB} --proxy-config e2e/proxy.e2e.json`,
      url: `http://localhost:${PUERTO_WEB}`,
      timeout: 120_000,
      reuseExistingServer: true,
    },
  ],
});
