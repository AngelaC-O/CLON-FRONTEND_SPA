// Crea desde cero la base de la prueba e2e en un contenedor propio: el recorrido gasta las claves
// temporales del script 15, así que cada corrida necesita una base nueva. No toca otros contenedores.
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ARCHIVO_ENTORNO,
  CONTENEDOR,
  DIR_BACKEND,
  ESQUEMA,
  IMAGEN,
  PUERTO_BD,
} from './entorno.mjs';

const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8', stdio: 'pipe' });
const clave = () => `E2e${randomBytes(12).toString('hex')}`;
const esperar = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

const DIR_BD = join(DIR_BACKEND, 'database');
if (!existsSync(DIR_BD)) {
  throw new Error(`No existe ${DIR_BD}: indica el back-end con CAUTIVA_BACKEND_DIR.`);
}

const claves = { system: clave(), dueno: clave(), app: clave() };

function sqlplus(cuenta, contrasena, script) {
  const envoltorio = `WHENEVER OSERROR EXIT 9\n${script}\nEXIT\n`;
  const salida = execFileSync(
    'docker',
    [
      'exec',
      '-i',
      '-w',
      '/tmp/database',
      '-e',
      'NLS_LANG=AMERICAN_AMERICA.WE8MSWIN1252',
      CONTENEDOR,
      'sqlplus',
      '-s',
      `${cuenta}/${contrasena}@//localhost:1521/FREEPDB1`,
    ],
    { input: envoltorio, encoding: 'latin1', maxBuffer: 64 * 1024 * 1024 },
  );
  const errores = salida.split(/\r?\n/).filter((l) => /^(ORA|PLS|SP2)-\d+/.test(l.trim()));
  if (errores.length) {
    throw new Error(`Errores en ${script}:\n${errores.slice(0, 20).join('\n')}`);
  }
}

console.log(`Quitando ${CONTENEDOR}, si existe...`);
try {
  docker('rm', '-f', CONTENEDOR);
} catch {
  // No existía.
}

console.log(`Creando ${CONTENEDOR} en el puerto ${PUERTO_BD}...`);
docker(
  'run',
  '-d',
  '--name',
  CONTENEDOR,
  '-p',
  `${PUERTO_BD}:1521`,
  '-e',
  `ORACLE_PASSWORD=${claves.system}`,
  '-e',
  'TZ=America/Lima',
  '-e',
  `APP_USER=${ESQUEMA}`,
  '-e',
  `APP_USER_PASSWORD=${claves.dueno}`,
  IMAGEN,
);

const limite = Date.now() + 10 * 60_000;
while (!docker('logs', CONTENEDOR).includes('DATABASE IS READY TO USE')) {
  if (Date.now() > limite) {
    throw new Error('Oracle no terminó de arrancar en 10 minutos.');
  }
  esperar(3000);
}

docker('cp', DIR_BD, `${CONTENEDOR}:/tmp/database`);
// Los scripts escriben su log junto a ellos.
docker('exec', '-u', 'root', CONTENEDOR, 'chown', '-R', 'oracle', '/tmp/database');

console.log('Instalando 00, 14, 13, 15 y 17...');
sqlplus(ESQUEMA, claves.dueno, '@00_instalar_v5.sql');
sqlplus('system', claves.system, '@14_cuenta_aplicacion.sql');
sqlplus(ESQUEMA, claves.dueno, '@13_permisos.sql');
sqlplus(ESQUEMA, claves.dueno, '@15_datos_iteracion1.sql');
// Iteración 2: migración v5 -> v5.1 y sus datos (orden del README del back-end: 15 -> 17).
sqlplus(ESQUEMA, claves.dueno, '@17_datos_iteracion2.sql');
sqlplus(
  'system',
  claves.system,
  `ALTER USER CAUTIVA_APP IDENTIFIED BY "${claves.app}" ACCOUNT UNLOCK;`,
);

// Solo sirven para este contenedor, y el archivo no se sube a git.
writeFileSync(
  ARCHIVO_ENTORNO,
  JSON.stringify({ ...claves, hmac: clave(), enlace: clave() }, null, 2),
);

console.log('Base lista.');
