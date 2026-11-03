import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Inicio } from './inicio';

describe('Inicio', () => {
  const montar = async (permisos: string[]) => {
    sessionStorage.setItem(
      'cautiva.sesion',
      JSON.stringify({ idSede: 1, nombreUsuario: 'patricia.vargas', permisos }),
    );
    TestBed.configureTestingModule({
      imports: [Inicio],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    const fixture = TestBed.createComponent(Inicio);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  };

  afterEach(() => sessionStorage.clear());

  it('saluda y muestra acciones y accesos según los permisos, sin llamar al back-end', async () => {
    const raiz = await montar(['VENTAS:CREAR', 'AGENDA:VER', 'AGENDA:CREAR']);
    expect(raiz.querySelector('h1')?.textContent).toMatch(/Buen.*, Patricia/);
    expect(raiz.querySelector('.eyebrow')?.textContent).toContain('SEDE 1');
    expect(raiz.querySelector('a.btn.salon')?.textContent).toContain('Atención sin cita');
    expect(raiz.querySelector('a.btn.sec')?.textContent).toContain('Nueva cita');
    expect([...raiz.querySelectorAll('.card .h3')].map((e) => e.textContent)).toEqual([
      'Agenda',
      'Atención sin cita',
      'Cobros y comprobantes',
    ]);
    TestBed.inject(HttpTestingController).verify();
  });

  it('oculta las acciones sin permiso', async () => {
    const raiz = await montar(['AGENDA:VER']);
    expect(raiz.querySelector('a.btn')).toBeNull();
  });
});
