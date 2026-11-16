import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { entrarComo } from '../../../../testing/sesion';
import { Conciliacion } from '../../servicios/conciliacion.service';
import { ConciliacionMes } from './conciliacion';

const CONCILIACION: Conciliacion = {
  idConciliacion: 3,
  anio: 2026,
  mes: 11,
  estado: 'ABIERTA',
  sinJustificar: 2,
  items: [
    {
      idItem: 40,
      estado: 'COINCIDE',
      idVenta: 620,
      referenciaSunat: 'B001-00000125',
      aceptadoSunat: true,
      pagoRespaldado: true,
    },
    {
      idItem: 41,
      estado: 'SIN_JUSTIFICAR',
      idTransaccion: 82,
      aceptadoSunat: false,
      pagoRespaldado: false,
    },
    {
      idItem: 42,
      estado: 'SIN_JUSTIFICAR',
      idVenta: 621,
      referenciaSunat: 'B001-00000126',
      aceptadoSunat: false,
      pagoRespaldado: true,
    },
  ],
};
const TODOS = ['CONCILIACION:VER', 'CONCILIACION:CREAR', 'CONCILIACION:EDITAR'];

describe('ConciliacionMes (CUS47)', () => {
  let fixture: ComponentFixture<ConciliacionMes>;
  let raiz: HTMLElement;
  let http: HttpTestingController;

  const estable = () => fixture.whenStable();
  const boton = (texto: string, dentro: ParentNode = raiz) =>
    [...dentro.querySelectorAll<HTMLButtonElement>('button')].find(
      (b) => b.textContent?.trim() === texto,
    );
  const conciliar = async () => {
    const mes = raiz.querySelector<HTMLSelectElement>('#conciliacionMes')!;
    mes.selectedIndex = 10;
    mes.dispatchEvent(new Event('change'));
    const anio = raiz.querySelector<HTMLInputElement>('#conciliacionAnio')!;
    anio.value = '2026';
    anio.dispatchEvent(new Event('input'));
    raiz.querySelector('form')!.dispatchEvent(new Event('submit'));
    await estable();
    const peticion = http.expectOne('/api/v1/conciliaciones');
    expect(peticion.request.body).toEqual({ anio: 2026, mes: 11 });
    peticion.flush(CONCILIACION, { status: 201, statusText: 'Created' });
    await estable();
  };
  const fila = (referencia: string) =>
    [...raiz.querySelectorAll('.grupo tbody tr')].find((f) => f.textContent?.includes(referencia))!;

  const montar = async (permisos = TODOS) => {
    TestBed.configureTestingModule({
      imports: [ConciliacionMes],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    entrarComo({ idSede: 1, permisos });
    fixture = TestBed.createComponent(ConciliacionMes);
    await estable();
    raiz = fixture.nativeElement;
  };

  afterEach(() => http.verify());

  it('los pasos van en orden: reporte, mes, diferencias y cierre', async () => {
    await montar();
    const titulos = [...raiz.querySelectorAll('h2')].map((t) => t.textContent?.trim());
    expect(titulos).toEqual([
      '1 · Subir reporte de liquidación de Izipay',
      '2 · Mes por conciliar',
    ]);
    await conciliar();
    const despues = [...raiz.querySelectorAll('h2')].map((t) => t.textContent?.trim());
    expect(despues.slice(2)).toEqual([
      '3 · Diferencias de Noviembre 2026',
      '4 · Cerrar conciliación',
    ]);
  });

  it('1 · sube el reporte y muestra cuántas filas casaron y cuáles no', async () => {
    await montar();
    const entrada = raiz.querySelector<HTMLInputElement>('#archivoLiquidacion')!;
    const archivo = new File(['codigo,comision'], 'liquidacion-noviembre.csv', {
      type: 'text/csv',
    });
    Object.defineProperty(entrada, 'files', { value: [archivo] });
    entrada.dispatchEvent(new Event('change'));
    boton('Importar liquidación')!.click();
    await estable();
    const peticion = http.expectOne('/api/v1/conciliaciones/liquidacion');
    expect(peticion.request.body instanceof FormData).toBe(true);
    expect(((peticion.request.body as FormData).get('archivoLiquidacion') as File).name).toBe(
      'liquidacion-noviembre.csv',
    );
    peticion.flush({
      filasLeidas: 3,
      filasRegistradas: 2,
      codigosSinTransaccion: ['CS-0000-DESCONOCIDO'],
    });
    await estable();
    const resumen = raiz.querySelector('#resumenLiquidacion')!.textContent;
    expect(resumen).toContain('Casaron 2 de 3 filas');
    expect(resumen).toContain('No casaron: CS-0000-DESCONOCIDO');
  });

  it('1 · solo acepta CSV o Excel', async () => {
    await montar();
    const entrada = raiz.querySelector<HTMLInputElement>('#archivoLiquidacion')!;
    Object.defineProperty(entrada, 'files', { value: [new File(['x'], 'reporte.pdf')] });
    entrada.dispatchEvent(new Event('change'));
    boton('Importar liquidación')!.click();
    await estable();
    http.expectNone('/api/v1/conciliaciones/liquidacion');
    expect(raiz.querySelector('.alert.bad')?.textContent).toContain('CSV o Excel');
  });

  it('3 · agrupa las diferencias por origen y no lista las que coinciden', async () => {
    await montar();
    await conciliar();
    const grupos = [...raiz.querySelectorAll('.grupo > .b')].map((g) => g.textContent?.trim());
    expect(grupos).toEqual(['Cobro de Izipay sin venta', 'Comprobante no aceptado por SUNAT']);
    expect(raiz.textContent).toContain('1 coinciden');
    expect(raiz.textContent).not.toContain('B001-00000125');
  });

  it('3 · «Justificar» exige el texto; «Excluir» marca el ítem', async () => {
    await montar();
    await conciliar();
    boton('Justificar', fila('Transacción N° 82'))!.click();
    await estable();
    boton('Guardar justificación')!.click();
    await estable();
    http.expectNone('/api/v1/conciliaciones/3/items/41');
    expect(raiz.querySelector('.alert.bad')?.textContent).toContain('justificación');

    const texto = raiz.querySelector<HTMLInputElement>('input[aria-label^="Justificación de"]')!;
    texto.value = 'Devolución de Yape hecha desde la app';
    texto.dispatchEvent(new Event('input'));
    boton('Guardar justificación')!.click();
    await estable();
    const justificar = http.expectOne('/api/v1/conciliaciones/3/items/41');
    expect(justificar.request.method).toBe('PATCH');
    expect(justificar.request.body).toEqual({
      estado: 'JUSTIFICADA',
      justificacion: 'Devolución de Yape hecha desde la app',
    });
    justificar.flush({
      ...CONCILIACION,
      sinJustificar: 1,
      items: [
        {
          ...CONCILIACION.items![1],
          estado: 'JUSTIFICADA',
          justificacion: 'Devolución de Yape hecha desde la app',
        },
      ],
    });
    await estable();
    expect(fila('Transacción N° 82').textContent).toContain('Justificada');
    expect(boton('Cerrar conciliación')!.disabled).toBe(true);

    boton('Excluir', fila('B001-00000126'))!.click();
    await estable();
    const excluir = http.expectOne('/api/v1/conciliaciones/3/items/42');
    expect(excluir.request.body).toEqual({ estado: 'EXCLUIDA' });
    excluir.flush({
      ...CONCILIACION,
      sinJustificar: 0,
      items: [{ ...CONCILIACION.items![2], estado: 'EXCLUIDA' }],
    });
    await estable();
    expect(fila('B001-00000126').textContent).toContain('Excluida');
  });

  it('4 · «Cerrar conciliación» se habilita sin diferencias pendientes', async () => {
    await montar();
    await conciliar();
    expect(boton('Cerrar conciliación')!.disabled).toBe(true);
    fixture.componentInstance['conciliacion'].update((c) => ({ ...c!, sinJustificar: 0 }));
    await estable();
    boton('Cerrar conciliación')!.click();
    await estable();
    const peticion = http.expectOne('/api/v1/conciliaciones/3/cierre');
    expect(peticion.request.method).toBe('PATCH');
    peticion.flush({ ...CONCILIACION, estado: 'CERRADA', sinJustificar: 0, items: [] });
    await estable();
    expect(raiz.textContent).toContain('Cerrada');
    expect(boton('Cerrar conciliación')).toBeUndefined();
    expect(boton('Excluir')).toBeUndefined();
  });

  it('el 409 de un mes ya conciliado queda a la vista', async () => {
    await montar();
    raiz.querySelector('form')!.dispatchEvent(new Event('submit'));
    await estable();
    http
      .expectOne('/api/v1/conciliaciones')
      .flush(
        { detail: 'Ya existe la conciliación de ese mes', regla: 'RF75' },
        { status: 409, statusText: 'Conflict' },
      );
    await estable();
    expect(raiz.querySelector('.alert.bad')?.textContent).toContain('Ya existe la conciliación');
  });

  it('con solo CONCILIACION:VER no importa ni concilia', async () => {
    await montar(['CONCILIACION:VER']);
    expect(raiz.querySelector('#archivoLiquidacion')).toBeNull();
    expect(boton('Conciliar')).toBeUndefined();
  });
});
