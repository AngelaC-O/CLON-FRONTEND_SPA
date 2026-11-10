import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SesionDTO } from '../api/modelos.generados';
import { SesionService } from './sesion.service';

const SESION: SesionDTO = {
  apellidos: 'Quispe',
  debeCambiarClave: true,
  idPersonal: 3,
  idSede: 1,
  idUsuario: 2,
  nombreUsuario: 'recepcion',
  nombres: 'Rosa',
  permisos: ['AGENDA:VER', 'VENTAS:CREAR'],
  rol: 'RECEPCIONISTA',
};

describe('SesionService', () => {
  let servicio: SesionService;
  let http: HttpTestingController;

  const iniciar = () => {
    servicio.iniciarSesion({ nombreUsuario: 'recepcion', clave: 'clave' }).subscribe();
    http.expectOne('/api/v1/auth/login').flush(SESION);
  };

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    servicio = TestBed.inject(SesionService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('sin sesión no tiene ningún permiso', () => {
    expect(servicio.autenticada()).toBe(false);
    expect(servicio.tienePermiso()).toBe(false);
    expect(servicio.tienePermiso('AGENDA:VER')).toBe(false);
  });

  it('guarda la sesión del login en memoria y evalúa los permisos', () => {
    iniciar();
    expect(servicio.autenticada()).toBe(true);
    expect(servicio.nombreCompleto()).toBe('Rosa Quispe');
    expect(servicio.tienePermiso()).toBe(true);
    expect(servicio.tienePermiso('CAJA:VER', 'VENTAS:CREAR')).toBe(true);
    expect(servicio.tienePermiso('CAJA:VER')).toBe(false);
    expect(sessionStorage.length).toBe(0);
  });

  it('al cargar recupera la sesión de GET /auth/sesion', () => {
    let recibida: SesionDTO | null | undefined;
    servicio.cargar().subscribe((s) => (recibida = s));
    http.expectOne('/api/v1/auth/sesion').flush({ ...SESION, debeCambiarClave: false });
    expect(recibida?.nombreUsuario).toBe('recepcion');
    expect(servicio.autenticada()).toBe(true);
    expect(servicio.debeCambiarClave()).toBe(false);
  });

  it('un 401 al cargar deja la aplicación sin sesión, sin error', () => {
    let recibida: SesionDTO | null | undefined;
    servicio.cargar().subscribe((s) => (recibida = s));
    http
      .expectOne('/api/v1/auth/sesion')
      .flush({ regla: 'SIN_SESION' }, { status: 401, statusText: 'Unauthorized' });
    expect(recibida).toBeNull();
    expect(servicio.autenticada()).toBe(false);
  });

  it('no recupera nada guardado en el navegador', () => {
    sessionStorage.setItem('cautiva.sesion', JSON.stringify(SESION));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    expect(TestBed.inject(SesionService).autenticada()).toBe(false);
    http = TestBed.inject(HttpTestingController);
  });

  it('el cambio de clave quita la marca debeCambiarClave', () => {
    iniciar();
    servicio.cambiarClave({ claveActual: 'a', claveNueva: 'b' }).subscribe();
    http.expectOne('/api/v1/auth/cambio-clave').flush(null);
    expect(servicio.debeCambiarClave()).toBe(false);
  });

  it('cerrar sesión limpia el estado aunque el back-end falle', () => {
    iniciar();
    servicio.cerrarSesion().subscribe({ error: () => undefined });
    http.expectOne('/api/v1/auth/logout').flush(null, { status: 500, statusText: 'Error' });
    expect(servicio.autenticada()).toBe(false);
  });
});
