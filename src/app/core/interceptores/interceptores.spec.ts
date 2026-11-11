import {
  HttpClient,
  provideHttpClient,
  withInterceptors,
  withXsrfConfiguration,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { SesionService } from '../sesion/sesion.service';
import { credencialesInterceptor } from './credenciales.interceptor';
import { erroresInterceptor } from './errores.interceptor';

describe('interceptores', () => {
  let cliente: HttpClient;
  let http: HttpTestingController;
  let notificaciones: NotificacionesService;
  let sesion: SesionService;
  let navegar: ReturnType<typeof vi.spyOn>;

  const fallar = (url: string, status: number, cuerpo: object | null) => {
    let recibido: unknown;
    cliente.post(url, {}).subscribe({ error: (e) => (recibido = e) });
    http.expectOne(url).flush(cuerpo, { status, statusText: 'Error' });
    return recibido;
  };

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(
          withInterceptors([credencialesInterceptor, erroresInterceptor]),
          withXsrfConfiguration({ cookieName: 'XSRF-TOKEN', headerName: 'X-XSRF-TOKEN' }),
        ),
        provideHttpClientTesting(),
      ],
    });
    cliente = TestBed.inject(HttpClient);
    http = TestBed.inject(HttpTestingController);
    notificaciones = TestBed.inject(NotificacionesService);
    sesion = TestBed.inject(SesionService);
    navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  });

  afterEach(() => http.verify());

  it('envía credenciales solo al back-end', () => {
    cliente.get('/api/v1/areas').subscribe();
    expect(http.expectOne('/api/v1/areas').request.withCredentials).toBe(true);
    cliente.get('https://otro.test/x').subscribe();
    expect(http.expectOne('https://otro.test/x').request.withCredentials).toBe(false);
  });

  it('agrega la cabecera X-XSRF-TOKEN con la cookie del back-end', () => {
    document.cookie = 'XSRF-TOKEN=abc123';
    cliente.post('/api/v1/areas', {}).subscribe();
    expect(http.expectOne('/api/v1/areas').request.headers.get('X-XSRF-TOKEN')).toBe('abc123');
    document.cookie = 'XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  });

  it.each([409, 422])('muestra el mensaje de la regla en %i y devuelve el error', (status) => {
    const error = fallar('/api/v1/citas', status, {
      detail: 'El horario cruza con otra cita',
      regla: 'RN02',
      status,
    });
    expect(notificaciones.actual()).toEqual({
      texto: 'El horario cruza con otra cita',
      tipo: 'error',
    });
    expect(error).toBeTruthy();
  });

  it('usa un mensaje genérico si el 422 no trae ProblemDetail', () => {
    fallar('/api/v1/citas', 422, null);
    expect(notificaciones.actual()?.texto).toBe('No se pudo completar la operación.');
  });

  it('en 401 limpia la sesión y vuelve al login', () => {
    const limpiar = vi.spyOn(sesion, 'limpiar');
    fallar('/api/v1/citas', 401, { detail: 'Inicie sesión para continuar.' });
    expect(limpiar).toHaveBeenCalled();
    expect(navegar).toHaveBeenCalledWith('/login');
    expect(notificaciones.actual()?.texto).toBe('Inicie sesión para continuar.');
  });

  it('el 401 de GET /auth/sesion al cargar no avisa ni navega: lo resuelven las guardas', () => {
    const limpiar = vi.spyOn(sesion, 'limpiar');
    let recibido: unknown;
    cliente.get('/api/v1/auth/sesion').subscribe({ error: (e) => (recibido = e) });
    http
      .expectOne('/api/v1/auth/sesion')
      .flush({ regla: 'SIN_SESION' }, { status: 401, statusText: 'Unauthorized' });
    expect(recibido).toBeTruthy();
    expect(limpiar).toHaveBeenCalled();
    expect(navegar).not.toHaveBeenCalled();
    expect(notificaciones.actual()).toBeNull();
  });

  it('el 401 del login lo atiende su formulario', () => {
    fallar('/api/v1/auth/login', 401, { detail: 'Usuario o clave incorrectos' });
    expect(navegar).not.toHaveBeenCalled();
    expect(notificaciones.actual()).toBeNull();
  });

  it('no avisa los 400 y 404, que atiende cada página', () => {
    fallar('/api/v1/clientes', 400, { detail: 'Dato inválido' });
    fallar('/api/v1/clientes', 404, { detail: 'No existe' });
    expect(notificaciones.actual()).toBeNull();
  });

  it('el 403 de la regla RF82 lleva al cambio de clave', () => {
    fallar('/api/v1/areas', 403, { detail: 'Debe cambiar su clave', regla: 'RF82' });
    expect(navegar).toHaveBeenCalledWith('/cambio-clave');
    expect(notificaciones.actual()).toBeNull();
  });

  it('avisa el 403 y los errores del servidor', () => {
    fallar('/api/v1/areas', 403, { detail: 'No tiene permiso para esta operación.' });
    expect(notificaciones.actual()?.texto).toBe('No tiene permiso para esta operación.');
    fallar('/api/v1/areas', 500, null);
    expect(notificaciones.actual()?.texto).toContain('No se pudo conectar');
  });
});
