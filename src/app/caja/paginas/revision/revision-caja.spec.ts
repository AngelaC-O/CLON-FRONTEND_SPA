import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CajaAbiertaService } from '../../../core/sesion/caja-abierta.service';
import { entrarComo } from '../../../../testing/sesion';
import { CajaDTO } from '../../modelos/caja.modelos';
import { RevisionCaja } from './revision-caja';

const CON_DIFERENCIA: CajaDTO = {
  idCaja: 12,
  estado: 'CERRADA',
  fechaApertura: '2026-11-09T08:55:00',
  fechaCierre: '2026-11-09T20:05:00',
  idUsuarioCierre: 2,
  nombreUsuarioCierre: 'Rosa Quispe',
  arqueos: [
    {
      idMedioPago: 1,
      montoEsperado: 450,
      montoContado: 440,
      diferencia: -10,
      observacion: 'Faltó vuelto',
    },
    { idMedioPago: 2, montoEsperado: 100, montoContado: 100, diferencia: 0 },
  ],
};
const DEL_DIA: CajaDTO[] = [
  {
    idCaja: 14,
    estado: 'CERRADA',
    fechaApertura: '2026-11-10T08:50:00',
    fechaCierre: '2026-11-10T20:00:00',
    montoInicial: 100,
    idUsuarioApertura: 3,
    nombreUsuarioApertura: 'Carmen Soto',
    idUsuarioCierre: 3,
    nombreUsuarioCierre: 'Carmen Soto',
  },
];

describe('RevisionCaja (CUS46)', () => {
  let fixture: ComponentFixture<RevisionCaja>;
  let raiz: HTMLElement;
  let http: HttpTestingController;

  const estable = () => fixture.whenStable();
  const boton = (texto: string) =>
    [...raiz.querySelectorAll<HTMLButtonElement>('button')].find(
      (b) => b.textContent?.trim() === texto,
    );

  const montar = async (permisos: string[]) => {
    TestBed.configureTestingModule({
      imports: [RevisionCaja],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    entrarComo({ idSede: 1, permisos });
    fixture = TestBed.createComponent(RevisionCaja);
    await estable();
    raiz = fixture.nativeElement;
    http.expectOne('/api/v1/medios-pago').flush([
      { idMedioPago: 1, nombre: 'EFECTIVO', estado: 'ACTIVO', usaPasarela: false },
      { idMedioPago: 2, nombre: 'YAPE', estado: 'ACTIVO', usaPasarela: true },
    ]);
    http.expectOne('/api/v1/cajas/con-diferencia').flush([CON_DIFERENCIA]);
    http.expectOne('/api/v1/cajas/del-dia').flush(DEL_DIA);
    await estable();
  };

  afterEach(() => http.verify());

  it('muestra los cierres con diferencia, solo los medios que no cuadran', async () => {
    await montar(['CONCILIACION:VER', 'CONCILIACION:EDITAR']);
    const cierre = raiz.querySelector('.cierre')!;
    const filas = cierre.querySelectorAll('tbody tr');
    expect(filas).toHaveLength(1);
    expect(filas[0].textContent).toContain('Efectivo');
    expect(filas[0].textContent).toContain('S/ -10.00');
    expect(filas[0].textContent).toContain('Faltó vuelto');
  });

  it('It. 2.1: nombra a quien abrió y cerró la caja, no su id (Duda 25)', async () => {
    await montar(['CONCILIACION:VER']);
    const cierre = raiz.querySelector('.cierre')!.textContent!;
    expect(cierre).toContain('Caja N° 12');
    expect(cierre).toContain('Rosa Quispe');
    expect(cierre).not.toMatch(/usuario\s+2/);
    const delDia = [...raiz.querySelectorAll('tbody tr')].at(-1)!.textContent!;
    expect(delDia).toContain('Carmen Soto');
    expect(delDia).toContain('N° 14');
  });

  it('«Aprobar cierre» lo quita de la lista', async () => {
    await montar(['CONCILIACION:VER', 'CONCILIACION:EDITAR']);
    boton('Aprobar cierre')!.click();
    await estable();
    const peticion = http.expectOne('/api/v1/cajas/12/revision');
    expect(peticion.request.method).toBe('PATCH');
    peticion.flush({ ...CON_DIFERENCIA, fechaRevision: '2026-11-10T09:00:00' });
    await estable();
    expect(raiz.querySelector('.cierre')).toBeNull();
    expect(raiz.textContent).toContain('No hay cierres con diferencia por aprobar.');
  });

  it('«Reabrir caja» pide el motivo, avisa que hay que volver a cerrar y abre la caja', async () => {
    await montar(['CONCILIACION:VER', 'CONCILIACION:EDITAR']);
    boton('Reabrir caja')!.click();
    await estable();
    expect(raiz.querySelector('#avisoReapertura')?.textContent).toContain(
      'arquear y cerrar la caja otra vez',
    );
    raiz.querySelector('app-modal form')!.dispatchEvent(new Event('submit'));
    await estable();
    http.expectNone('/api/v1/cajas/14/reapertura');
    expect(raiz.querySelector('app-modal .alert.bad')?.textContent).toContain('motivo');

    const motivo = raiz.querySelector<HTMLInputElement>('#motivoReapertura')!;
    motivo.value = 'Venta registrada después del cierre';
    motivo.dispatchEvent(new Event('input'));
    raiz.querySelector('app-modal form')!.dispatchEvent(new Event('submit'));
    await estable();
    const peticion = http.expectOne('/api/v1/cajas/14/reapertura');
    expect(peticion.request.body).toEqual({
      motivoReapertura: 'Venta registrada después del cierre',
    });
    peticion.flush({
      idCaja: 14,
      estado: 'ABIERTA',
      motivoReapertura: 'Venta registrada después del cierre',
    });
    await estable();
    expect(raiz.querySelector('app-modal')).toBeNull();
    expect(raiz.querySelector('#cajasHoy tbody tr')?.textContent).toContain('Abierta');
    expect(TestBed.inject(CajaAbiertaService).actual()?.idCaja).toBe(14);
  });

  it('con solo CONCILIACION:VER no aprueba ni reabre', async () => {
    await montar(['CONCILIACION:VER']);
    expect(boton('Aprobar cierre')).toBeUndefined();
    expect(boton('Reabrir caja')).toBeUndefined();
  });
});
