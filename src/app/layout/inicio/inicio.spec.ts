import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { entrarComo } from '../../../testing/sesion';
import { Inicio } from './inicio';

describe('Inicio', () => {
  let http: HttpTestingController;

  const montar = async (permisos: string[]) => {
    TestBed.configureTestingModule({
      imports: [Inicio],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    entrarComo({
      idSede: 1,
      nombreSede: 'Pichanaki Centro',
      nombreUsuario: 'patricia.vargas',
      nombres: 'Patricia',
      permisos,
    });
    const fixture = TestBed.createComponent(Inicio);
    fixture.detectChanges();
    http.expectOne('/api/v1/avisos').flush([]);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  };

  afterEach(() => http.verify());

  it('saluda y muestra acciones, avisos y accesos según los permisos', async () => {
    const raiz = await montar(['VENTAS:CREAR', 'AGENDA:VER', 'AGENDA:CREAR']);
    expect(raiz.querySelector('h1')?.textContent).toMatch(/Buen.*, Patricia/);
    // La sede se nombra con SesionDTO.nombreSede, nunca con su id (It. 2.1).
    expect(raiz.querySelector('.eyebrow')?.textContent).toContain('Pichanaki Centro');
    expect(raiz.querySelector('.eyebrow')?.textContent).not.toContain('SEDE 1');
    expect(raiz.querySelector('a.btn.salon')?.textContent).toContain('Atención sin cita');
    expect(raiz.querySelector('a.btn.sec')?.textContent).toContain('Nueva cita');
    expect(raiz.querySelector('app-panel-avisos')).not.toBeNull();
    expect([...raiz.querySelectorAll('.gf .card .h3')].map((e) => e.textContent)).toEqual([
      'Agenda',
      'Atención sin cita',
      'Cobros y comprobantes',
    ]);
  });

  it('oculta las acciones sin permiso', async () => {
    const raiz = await montar(['AGENDA:VER']);
    expect(raiz.querySelector('.row a.btn')).toBeNull();
  });
});
