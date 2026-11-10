import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ConsumoPendienteDTO } from '../../modelos/inventario.modelos';
import { ConsumosPendientes } from './consumos-pendientes';

const CONSUMO: ConsumoPendienteDTO = {
  idConsumo: 12,
  idAtencion: 1532,
  idProducto: 40,
  codigo: 'INS-007',
  producto: 'Keratina',
  unidad: 'ML',
  cantidadEstimada: 30,
  cantidadDescontada: 10,
  cantidadPendiente: 20,
  estado: 'PENDIENTE',
  fechaRegistro: '2026-11-09T10:45:00',
};

describe('ConsumosPendientes (CUS33, RN53)', () => {
  let fixture: ComponentFixture<ConsumosPendientes>;
  let raiz: HTMLElement;
  let http: HttpTestingController;
  let cantidad: number | undefined;

  const estable = () => fixture.whenStable();
  const boton = (texto: string, dentro = '') =>
    [...raiz.querySelectorAll<HTMLButtonElement>(`${dentro} button`.trim())].find(
      (b) => b.textContent?.trim() === texto,
    )!;

  const montar = async (puedeResolver = true) => {
    TestBed.configureTestingModule({
      imports: [ConsumosPendientes],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ConsumosPendientes);
    fixture.componentRef.setInput('puedeResolver', puedeResolver);
    fixture.componentInstance.cantidad.subscribe((n) => (cantidad = n));
    await estable();
    raiz = fixture.nativeElement;
    http.expectOne('/api/v1/consumos-pendientes').flush([CONSUMO]);
    await estable();
  };

  afterEach(() => http.verify());

  it('lista lo que faltó descontar con la atención y las cantidades', async () => {
    await montar();
    const fila = raiz.querySelector('tbody tr')!;
    expect(fila.textContent).toContain('Keratina');
    expect(fila.textContent).toContain('N° 1532');
    expect(fila.textContent).toContain('20 ML');
    expect(fila.textContent).toContain('09/11/2026 10:45');
    expect(cantidad).toBe(1);
  });

  it('«Regularizar» registra la salida y lo quita de la lista', async () => {
    await montar();
    let regularizado = false;
    fixture.componentInstance.regularizado.subscribe(() => (regularizado = true));
    boton('Regularizar').click();
    await estable();
    const peticion = http.expectOne('/api/v1/consumos-pendientes/12/regularizacion');
    expect(peticion.request.method).toBe('POST');
    peticion.flush({ ...CONSUMO, estado: 'REGULARIZADO', idMovimiento: 330 });
    await estable();
    expect(raiz.textContent).toContain('No hay consumos pendientes.');
    expect(regularizado).toBe(true);
    expect(cantidad).toBe(0);
  });

  it('«Descartar» exige el motivo', async () => {
    await montar();
    boton('Descartar', 'tbody').click();
    await estable();
    raiz.querySelector('app-modal form')!.dispatchEvent(new Event('submit'));
    await estable();
    http.expectNone('/api/v1/consumos-pendientes/12/descarte');
    expect(raiz.querySelector('app-modal .alert.bad')?.textContent).toContain('motivo');

    const motivo = raiz.querySelector<HTMLInputElement>('#observacionDescarte')!;
    motivo.value = 'Se usó menos de lo estimado';
    motivo.dispatchEvent(new Event('input'));
    raiz.querySelector('app-modal form')!.dispatchEvent(new Event('submit'));
    await estable();
    const peticion = http.expectOne('/api/v1/consumos-pendientes/12/descarte');
    expect(peticion.request.method).toBe('PATCH');
    expect(peticion.request.body).toEqual({ observacion: 'Se usó menos de lo estimado' });
    peticion.flush({ ...CONSUMO, estado: 'DESCARTADO' });
    await estable();
    expect(raiz.querySelector('app-modal')).toBeNull();
    expect(raiz.textContent).toContain('No hay consumos pendientes.');
  });

  it('el 409 de «aún sin stock» deja el consumo en la lista', async () => {
    await montar();
    boton('Regularizar').click();
    await estable();
    http
      .expectOne('/api/v1/consumos-pendientes/12/regularizacion')
      .flush(
        { detail: 'Aún no hay stock', regla: 'RN53' },
        { status: 409, statusText: 'Conflict' },
      );
    await estable();
    expect(raiz.querySelector('tbody')?.textContent).toContain('Keratina');
  });

  it('sin KARDEX:CREAR solo se ve', async () => {
    await montar(false);
    expect(raiz.textContent).not.toContain('Regularizar');
  });
});
