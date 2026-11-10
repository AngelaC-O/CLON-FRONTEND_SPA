import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { entrarComo } from '../../../../testing/sesion';
import { ServicioDTO } from '../../modelos/catalogo.modelos';
import { Promociones } from './promociones';

const SERVICIOS = [
  { idServicio: 1, nombre: 'Corte', idArea: 1, duracionRefMin: 30, tipoRecurso: 'SILLON' },
] as ServicioDTO[];
const LISTA = '/api/v1/promociones?vigentes=false';

describe('Promociones (CUS60)', () => {
  let fixture: ComponentFixture<Promociones>;
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

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [Promociones],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    entrarComo({ idSede: 1, permisos: ['CATALOGO:VER', 'CATALOGO:CREAR'] });
    fixture = TestBed.createComponent(Promociones);
    fixture.componentRef.setInput('servicios', SERVICIOS);
    await estable();
    raiz = fixture.nativeElement;
    http.expectOne(LISTA).flush([
      {
        idPromocion: 7,
        nombre: 'Noviembre feliz',
        tipoDescuento: 'PORCENTAJE',
        valor: 10,
        fechaInicio: '2026-11-01',
        fechaFin: '2026-11-30',
        idsServicio: [1],
        estado: 'ACTIVA',
      },
    ]);
    await estable();
  });

  afterEach(() => http.verify());

  it('lista todas las promociones con descuento, vigencia y estado', () => {
    const fila = raiz.querySelector('#tablaPromociones tbody tr')!;
    expect(fila.textContent).toContain('Noviembre feliz');
    expect(fila.textContent).toContain('10 %');
    expect(fila.textContent).toContain('01/11/2026 a 30/11/2026');
    expect(fila.textContent).toContain('Activa');
  });

  it('valida el porcentaje y la vigencia antes de enviar (RF84)', async () => {
    escribir('promocionNombre', 'Mala');
    escribir('promocionValor', '120');
    escribir('promocionInicio', '2026-12-10');
    escribir('promocionFin', '2026-12-01');
    await enviar();
    expect(raiz.querySelector('.alert.bad')?.textContent).toContain('hasta 100');
    escribir('promocionValor', '20');
    await enviar();
    expect(raiz.querySelector('.alert.bad')?.textContent).toContain('termina el mismo día');
    http.expectNone({ method: 'POST', url: '/api/v1/promociones' });
  });

  it('«Guardar promoción» registra un descuento en monto con sus servicios', async () => {
    [...raiz.querySelectorAll<HTMLButtonElement>('.seg button')][1].click();
    await estable();
    escribir('promocionNombre', 'Cumpleaños');
    escribir('promocionValor', '10');
    escribir('promocionInicio', '2026-12-01');
    escribir('promocionFin', '2026-12-31');
    raiz.querySelector<HTMLInputElement>('app-selector-servicios input')!.click();
    await enviar();
    const peticion = http.expectOne({ method: 'POST', url: '/api/v1/promociones' });
    expect(peticion.request.body).toEqual({
      nombre: 'Cumpleaños',
      tipoDescuento: 'MONTO',
      valor: 10,
      fechaInicio: '2026-12-01',
      fechaFin: '2026-12-31',
      idsServicio: [1],
    });
    peticion.flush({ ...peticion.request.body, idPromocion: 8, estado: 'ACTIVA' });
    await estable();
    expect(raiz.querySelector('#tablaPromociones tbody tr')?.textContent).toContain('S/ 10.00');
  });
});
