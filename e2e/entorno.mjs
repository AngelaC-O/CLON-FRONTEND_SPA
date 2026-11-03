// Puertos propios: la prueba convive con el back-end y la base de desarrollo, sin usarlos.
// Las rutas parten de la raíz del proyecto, desde donde corren los scripts de npm.
import { resolve } from 'node:path';

export const DIR_BACKEND = resolve(
  process.env.CAUTIVA_BACKEND_DIR ?? '../Synapsis_Spa_Cautiva_Back-End',
);
export const ARCHIVO_ENTORNO = resolve('e2e/.entorno.json');
export const CONTENEDOR = 'cautiva-e2e-oracle';
export const IMAGEN = 'gvenzl/oracle-free:23.26.2';
export const ESQUEMA = 'SYNAPSIS_SPA_CAUTIVA';
export const PUERTO_BD = 1523;
export const PUERTO_API = 8081;
export const PUERTO_WEB = 4300;
