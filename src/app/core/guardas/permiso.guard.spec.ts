import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, UrlTree } from '@angular/router';
import { SesionDTO } from '../api/modelos.generados';
import { SesionService } from '../sesion/sesion.service';
import { invitadoGuard, permisoGuard, soloConSesionGuard } from './permiso.guard';

describe('guardas', () => {
  const entrar = (sesion: Partial<SesionDTO>) => {
    TestBed.inject(SesionService).iniciarSesion({ nombreUsuario: 'u', clave: 'c' }).subscribe();
    TestBed.inject(HttpTestingController)
      .expectOne('/api/v1/auth/login')
      .flush({ debeCambiarClave: false, permisos: [], ...sesion });
  };
  const correr = (guarda: () => boolean | UrlTree) => {
    const resultado = TestBed.runInInjectionContext(guarda);
    return resultado instanceof UrlTree ? resultado.toString() : resultado;
  };

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
  });

  it('sin sesión envía al login', () => {
    expect(correr(permisoGuard('AGENDA:VER'))).toBe('/login');
    expect(correr(soloConSesionGuard)).toBe('/login');
  });

  it('con la clave vencida envía al cambio de clave', () => {
    entrar({ debeCambiarClave: true, permisos: ['AGENDA:VER'] });
    expect(correr(permisoGuard('AGENDA:VER'))).toBe('/cambio-clave');
    expect(correr(soloConSesionGuard)).toBe(true);
  });

  it('sin el permiso envía a acceso denegado', () => {
    entrar({ permisos: ['AGENDA:VER'] });
    expect(correr(permisoGuard('CAJA:VER'))).toBe('/acceso-denegado');
  });

  it('deja pasar con alguno de los permisos', () => {
    entrar({ permisos: ['CAJA:EDITAR'] });
    expect(correr(permisoGuard('CAJA:VER', 'CAJA:EDITAR'))).toBe(true);
    expect(correr(permisoGuard())).toBe(true);
  });

  it('quien ya entró no vuelve al login', () => {
    expect(correr(invitadoGuard)).toBe(true);
    entrar({});
    expect(correr(invitadoGuard)).toBe('/');
  });
});
