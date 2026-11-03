import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';
import { erroresInterceptor } from '../../../core/interceptores/errores.interceptor';
import { Login } from './login';

describe('Login', () => {
  let raiz: HTMLElement;
  let http: HttpTestingController;
  let navegar: ReturnType<typeof vi.spyOn>;
  let estable: () => Promise<void>;

  const enviar = async (usuario: string, clave: string) => {
    for (const [id, valor] of [
      ['nombreUsuario', usuario],
      ['clave', clave],
    ]) {
      const entrada = raiz.querySelector<HTMLInputElement>(`#${id}`)!;
      entrada.value = valor;
      entrada.dispatchEvent(new Event('input'));
    }
    raiz.querySelector('form')!.dispatchEvent(new Event('submit'));
    await estable();
  };

  beforeEach(async () => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      imports: [Login],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([erroresInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const fixture = TestBed.createComponent(Login);
    estable = () => fixture.whenStable();
    await estable();
    raiz = fixture.nativeElement;
  });

  it('usa los campos y el botón de la frontera IGU_Login', async () => {
    expect(raiz.querySelector('button[type=submit]')?.textContent).toContain('Ingresar');
    await enviar('recepcion', 'Clave2026');
    const peticion = http.expectOne('/api/v1/auth/login');
    expect(peticion.request.body).toEqual({ nombreUsuario: 'recepcion', clave: 'Clave2026' });
    peticion.flush({ debeCambiarClave: false, permisos: [] });
    expect(navegar).toHaveBeenCalledWith('/');
  });

  it('pide cambiar la clave si el back-end lo marca', async () => {
    await enviar('recepcion', 'Clave2026');
    http.expectOne('/api/v1/auth/login').flush({ debeCambiarClave: true, permisos: [] });
    expect(navegar).toHaveBeenCalledWith('/cambio-clave');
  });

  it('no llama al back-end con el formulario vacío', async () => {
    await enviar('', '');
    http.expectNone('/api/v1/auth/login');
    expect(raiz.querySelector('.alert.bad')?.textContent).toContain('Ingrese el usuario');
  });

  it.each([
    [401, 'Usuario o clave incorrectos'],
    [423, 'La cuenta está bloqueada por intentos fallidos o inactiva'],
  ])('muestra el mensaje del %i en el formulario', async (status, detail) => {
    await enviar('recepcion', 'mala');
    http
      .expectOne('/api/v1/auth/login')
      .flush({ detail, regla: 'RF77', status }, { status, statusText: 'Error' });
    await estable();
    expect(raiz.querySelector('.alert.bad')?.textContent).toContain(detail);
    expect(navegar).not.toHaveBeenCalled();
  });
});
