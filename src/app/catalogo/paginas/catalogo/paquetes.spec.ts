import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { entrarComo } from '../../../../testing/sesion';
import { ServicioDTO } from '../../modelos/catalogo.modelos';
import { Paquetes } from './paquetes';

const SERVICIOS = [
  { idServicio: 1, nombre: 'Corte', idArea: 1, duracionRefMin: 30, tipoRecurso: 'SILLON' },
  { idServicio: 2, nombre: 'Tinte', idArea: 1, duracionRefMin: 90, tipoRecurso: 'SILLON' },
] as ServicioDTO[];

describe('Paquetes (CUS59)', () => {
  let fixture: ComponentFixture<Paquetes>;
  let raiz: HTMLElement;
  let http: HttpTestingController;

  const estable = () => fixture.whenStable();
  const escribir = (id: string, valor: string) => {
    const entrada = raiz.querySelector<HTMLInputElement>(`#${id}`)!;
    entrada.value = valor;
    entrada.dispatchEvent(new Event('input'));
  };
  const enviar = async () => {
    raiz.querySelector('form')!.dispatchEvent(new Event('submit'));
    await estable();
  };

  const montar = async (permisos: string[]) => {
    TestBed.configureTestingModule({
      imports: [Paquetes],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    entrarComo({ idSede: 1, permisos });
    fixture = TestBed.createComponent(Paquetes);
    fixture.componentRef.setInput('servicios', SERVICIOS);
    await estable();
    raiz = fixture.nativeElement;
    http.expectOne('/api/v1/paquetes').flush([
      {
        idPaquete: 3,
        nombre: 'Tres cortes',
        tipo: 'PAQUETE',
        numSesiones: 3,
        precio: 90,
        vigenciaDias: 90,
        idsServicio: [1],
        estado: 'ACTIVO',
      },
    ]);
    await estable();
  };

  afterEach(() => http.verify());

  it('lista los paquetes con sesiones, precio, vigencia y servicios', async () => {
    await montar(['CATALOGO:VER']);
    const tarjeta = raiz.querySelector('.paquete')!;
    expect(tarjeta.textContent).toContain('3 sesiones · S/ 90.00 · vigencia 90 días');
    expect(tarjeta.textContent).toContain('Corte');
    expect(raiz.querySelector('form')).toBeNull();
  });

  it('«Guardar paquete» registra una membresía con sus servicios', async () => {
    await montar(['CATALOGO:VER', 'CATALOGO:CREAR']);
    [...raiz.querySelectorAll<HTMLButtonElement>('.seg button')][1].click();
    escribir('paqueteNombre', 'Mensual');
    escribir('paqueteSesiones', '4');
    escribir('paquetePrecio', '150');
    escribir('paqueteVigencia', '30');
    await enviar();
    http.expectNone('/api/v1/paquetes');
    expect(raiz.querySelector('.alert.bad')?.textContent).toContain('al menos un servicio');

    const casillas = raiz.querySelectorAll<HTMLInputElement>('app-selector-servicios input');
    casillas[0].click();
    casillas[1].click();
    await enviar();
    const peticion = http.expectOne({ method: 'POST', url: '/api/v1/paquetes' });
    expect(peticion.request.body).toEqual({
      tipo: 'MEMBRESIA',
      nombre: 'Mensual',
      numSesiones: 4,
      precio: 150,
      vigenciaDias: 30,
      idsServicio: [1, 2],
    });
    peticion.flush({ ...peticion.request.body, idPaquete: 4, estado: 'ACTIVO' });
    await estable();
    expect(raiz.querySelectorAll('.paquete')).toHaveLength(2);
    expect(raiz.querySelector('.paquete')?.textContent).toContain('Membresía');
  });

  it('exige al menos una sesión y una vigencia de un día (RF84)', async () => {
    await montar(['CATALOGO:VER', 'CATALOGO:CREAR']);
    escribir('paqueteNombre', 'Vacío');
    escribir('paqueteSesiones', '0');
    escribir('paquetePrecio', '10');
    escribir('paqueteVigencia', '0');
    await enviar();
    http.expectNone('/api/v1/paquetes');
    expect(raiz.querySelector('.alert.bad')?.textContent).toContain('al menos una sesión');
  });
});
