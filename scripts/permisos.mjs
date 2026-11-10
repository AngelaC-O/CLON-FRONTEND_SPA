// Genera src/app/core/api/permisos.generados.ts con el x-permiso de cada operación de
// docs/openapi.yaml. Lo ejecuta `npm run modelos`; el archivo generado no se edita a mano.
import { readFileSync, writeFileSync } from 'node:fs';

const CONTRATO = 'docs/openapi.yaml';
const SALIDA = 'src/app/core/api/permisos.generados.ts';

const lineas = readFileSync(CONTRATO, 'utf8').split(/\r?\n/);
const operaciones = [];
let ruta = null;
let actual = null;
for (const linea of lineas) {
  if (/^\S/.test(linea) && !linea.startsWith('paths:')) {
    ruta = null;
  }
  const r = /^ {2}(\/\S*):\s*$/.exec(linea);
  if (r) {
    ruta = r[1];
    continue;
  }
  const m = /^ {4}(get|post|put|patch|delete):\s*$/.exec(linea);
  if (ruta && m) {
    actual = { metodo: m[1].toUpperCase(), ruta };
    operaciones.push(actual);
    continue;
  }
  const o = /^ {6}operationId:\s*(\S+)\s*$/.exec(linea);
  if (actual && o) {
    actual.operacion = o[1];
  }
  const p = /^ {6}x-permiso:\s*(\S+)\s*$/.exec(linea);
  if (actual && p) {
    actual.permiso = p[1];
  }
}

const sinPermiso = operaciones.filter((op) => !op.permiso || !op.operacion);
if (sinPermiso.length) {
  console.error('Operaciones sin operationId o x-permiso:', sinPermiso);
  process.exit(1);
}

operaciones.sort((a, b) => a.operacion.localeCompare(b.operacion));
const codigos = [...new Set(operaciones.map((op) => op.permiso))]
  .filter((c) => c.includes(':'))
  .sort();

const salida = `// Generado por scripts/permisos.mjs desde el x-permiso de docs/openapi.yaml.
// No editar a mano: se regenera con \`npm run modelos\`.

/** Permiso MODULO:ACCION de cada operación (SESION: basta la sesión; PUBLICO: sin sesión). */
export const PERMISO_DE_OPERACION = {
${operaciones.map((op) => `  /** ${op.metodo} ${op.ruta} */\n  ${op.operacion}: '${op.permiso}',`).join('\n')}
} as const;

/** Todos los códigos MODULO:ACCION que exige el contrato. */
export const CODIGOS_PERMISO = [
${codigos.map((c) => `  '${c}',`).join('\n')}
] as const;

export type CodigoPermiso = (typeof CODIGOS_PERMISO)[number];
`;
writeFileSync(SALIDA, salida);
console.log(`${SALIDA}: ${operaciones.length} operaciones, ${codigos.length} permisos`);
