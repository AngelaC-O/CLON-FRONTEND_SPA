import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { entrarComo } from '../../../../testing/sesion';
import { RecursoDTO } from '../../modelos/sedes.modelos';
import { Recursos } from './recursos';

const RECURSOS: RecursoDTO[] = [
  {
    idRecurso: 1,
    idSede: 1,
    nombre: 'Sillón 1',
    tipo: 'SILLON',
    estado: 'DISPONIBLE',
  },
  {
    idRecurso: 2,
    idSede: 1,
    nombre: 'Camilla 1',
    tipo: 'CAMILLA',
    estado: 'MANTENIMIENTO',
  },
];

describe('Recursos', () => {
  let fixture: ComponentFixture<Recursos>;
  let raiz: HTMLElement;
  let http: HttpTestingController;

  const estable = () => fixture.whenStable();
  const abrir = async () => {
    [...raiz.querySelectorAll('button')].find((b) => b.textContent?.includes('+ Recurso'))!.click();
    await estable();
  };
  const escribir = (id: string, valor: string) => {
    const entrada = raiz.querySelector<HTMLInputElement>(`#${id}`)!;
    entrada.value = valor;
    entrada.dispatchEvent(new Event('input'));
  };
  const enviar = async () => {
    raiz.querySelector('app-modal form')!.dispatchEvent(new Event('submit'));
    await estable();
  };

  const montar = async (permisos: string[]) => {
    TestBed.configureTestingModule({
      imports: [Recursos],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    entrarComo({ idSede: 1, nombreSede: 'Pichanaki Centro', permisos });
    fixture = TestBed.createComponent(Recursos);
    await estable();
    raiz = fixture.nativeElement;
    http.expectOne('/api/v1/recursos?idSede=1').flush(RECURSOS);
    await estable();
  };

  afterEach(() => http.verify());

  it('lista los recursos de la sede con GET /recursos (diferencia 18)', async () => {
    await montar(['SEDES:VER']);
    const filas = raiz.querySelectorAll('tbody tr');
    expect(filas).toHaveLength(2);
    expect(filas[0].textContent).toContain('Sillón 1');
    expect(filas[1].querySelector('.chip.warn')?.textContent).toContain('MANTENIMIENTO');
    expect(raiz.querySelector('a[href="/catalogo"]')).toBeNull();
    expect(
      [...raiz.querySelectorAll('button')].some((b) => b.textContent?.includes('Recurso')),
    ).toBe(false);
  });

  it('nombra la sede de la sesión, no su id (It. 2.1)', async () => {
    await montar(['SEDES:VER']);
    const encabezado = raiz.querySelector('.mut')!.textContent!;
    expect(encabezado).toContain('Pichanaki Centro');
    expect(encabezado).not.toMatch(/sede 1/);
  });

  it('sin tiempo de limpieza: ni columna ni selector (RN03, It. 2.1)', async () => {
    await montar(['SEDES:VER', 'SEDES:CREAR']);
    expect(raiz.querySelector('thead')!.textContent).not.toContain('Limpieza');
    await abrir();
    expect(raiz.querySelector('#minutosLimpieza')).toBeNull();
  });

  it('CUS61: registra el recurso con la sede de la sesión y lo agrega a la tabla', async () => {
    await montar(['SEDES:VER', 'SEDES:CREAR']);
    await abrir();
    expect(raiz.querySelector<HTMLInputElement>('#idSede')?.value).toBe('1');
    escribir('nombre', 'Sillón 11');
    await enviar();
    const peticion = http.expectOne('/api/v1/recursos');
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual({
      idSede: 1,
      nombre: 'Sillón 11',
      tipo: 'SILLON',
    });
    peticion.flush({ ...peticion.request.body, idRecurso: 21, estado: 'DISPONIBLE' });
    await estable();
    expect(raiz.querySelector('app-modal')).toBeNull();
    const filas = raiz.querySelectorAll('tbody tr');
    expect(filas).toHaveLength(3);
    expect(filas[2].textContent).toContain('Sillón 11');
  });

  it('no envía sin nombre', async () => {
    await montar(['SEDES:VER', 'SEDES:CREAR']);
    await abrir();
    await enviar();
    http.expectNone('/api/v1/recursos');
    expect(raiz.querySelector('app-modal .alert.bad')?.textContent).toContain('nombre');
  });
});
