import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SesionService } from '../../core/sesion/sesion.service';
import { Shell } from './shell';

describe('Shell', () => {
  const montar = async (permisos: string[]) => {
    TestBed.inject(SesionService)
      .iniciarSesion({ nombreUsuario: 'carmen.soto', clave: 'c' })
      .subscribe();
    TestBed.inject(HttpTestingController)
      .expectOne('/api/v1/auth/login')
      .flush({ idSede: 1, nombreUsuario: 'carmen.soto', permisos });
    const fixture = TestBed.createComponent(Shell);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  };
  const textos = (raiz: HTMLElement, selector: string) =>
    [...raiz.querySelectorAll(selector)].map((e) => e.textContent?.trim());

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
  });

  it('muestra solo los módulos permitidos, agrupados como en el prototipo', async () => {
    const raiz = await montar(['AGENDA:VER', 'SEGURIDAD:VER']);
    expect(textos(raiz, '.side .nvl')).toEqual(['Inicio', 'Agenda', 'Usuarios y seguridad']);
    expect(textos(raiz, '.side .grp')).toEqual(['Recepción', 'Administración']);
    expect(raiz.querySelector('a[href="/caja"]')).toBeNull();
  });

  it('la barra inferior lleva cuatro accesos y «Más»', async () => {
    const raiz = await montar(['AGENDA:VER', 'CLIENTAS:VER', 'VENTAS:CREAR', 'CAJA:VER']);
    expect(textos(raiz, '.bnav .bn')).toEqual(['Inicio', 'Agenda', 'Clientas', 'Sin cita', 'Más']);
  });

  it('la cabecera lleva sede, caja e iniciales', async () => {
    const raiz = await montar(['CAJA:VER']);
    expect(raiz.querySelector('.top')?.textContent).toContain('Sede 1');
    expect(raiz.querySelector('.top a[href="/caja"]')).not.toBeNull();
    expect(raiz.querySelector('.usuario .avatar')?.textContent).toBe('CS');
  });
});
