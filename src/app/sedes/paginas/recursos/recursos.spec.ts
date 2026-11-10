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
    minutosLimpieza: 10,
    estado: 'DISPONIBLE',
  },
  {
    idRecurso: 2,
    idSede: 1,
    nombre: 'Camilla 1',
    tipo: 'CAMILLA',
    minutosLimpieza: 5,
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
  const elegirMinutos = (minutos: number) => {
    const lista = raiz.querySelector<HTMLSelectElement>('#minutosLimpieza')!;
    lista.selectedIndex = minutos + 1;
    lista.dispatchEvent(new Event('change'));
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
    entrarComo({ idSede: 1, permisos });
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

  it('la limpieza se elige de 0 a 10 minutos (RN03)', async () => {
    await montar(['SEDES:VER', 'SEDES:CREAR']);
    await abrir();
    const opciones = [...raiz.querySelectorAll('#minutosLimpieza option')].map((o) =>
      o.textContent?.trim(),
    );
    expect(opciones.slice(1)).toEqual(Array.from({ length: 11 }, (_, i) => `${i} min`));
  });

  it('CUS61: registra el recurso con la sede de la sesión y lo agrega a la tabla', async () => {
    await montar(['SEDES:VER', 'SEDES:CREAR']);
    await abrir();
    expect(raiz.querySelector<HTMLInputElement>('#idSede')?.value).toBe('1');
    escribir('nombre', 'Sillón 11');
    elegirMinutos(10);
    await enviar();
    const peticion = http.expectOne('/api/v1/recursos');
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual({
      idSede: 1,
      nombre: 'Sillón 11',
      tipo: 'SILLON',
      minutosLimpieza: 10,
    });
    peticion.flush({ ...peticion.request.body, idRecurso: 21, estado: 'DISPONIBLE' });
    await estable();
    expect(raiz.querySelector('app-modal')).toBeNull();
    const filas = raiz.querySelectorAll('tbody tr');
    expect(filas).toHaveLength(3);
    expect(filas[2].textContent).toContain('Sillón 11');
  });

  it('no envía sin minutos de limpieza', async () => {
    await montar(['SEDES:VER', 'SEDES:CREAR']);
    await abrir();
    escribir('nombre', 'Camilla 2');
    await enviar();
    http.expectNone('/api/v1/recursos');
    expect(raiz.querySelector('app-modal .alert.bad')?.textContent).toContain('0 a 10');
  });

  it('acepta 0 minutos de limpieza', async () => {
    await montar(['SEDES:VER', 'SEDES:CREAR']);
    await abrir();
    escribir('nombre', 'Camilla 2');
    elegirMinutos(0);
    await enviar();
    http.expectOne('/api/v1/recursos').flush({ idRecurso: 22, idSede: 1 });
  });
});
