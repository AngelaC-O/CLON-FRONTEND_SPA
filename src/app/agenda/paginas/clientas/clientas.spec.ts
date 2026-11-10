import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TipoDocumentoDTO } from '../../../core/api/modelos.generados';
import { entrarComo } from '../../../../testing/sesion';
import { Clientas } from './clientas';

const CONSULTA = '/api/v1/clientes/consulta-documento';
const tipo = (
  idTipoDocumento: number,
  abreviatura: string,
  min: number,
  max: number,
  soloNumeros: boolean,
  consultaApi: boolean,
  estado: TipoDocumentoDTO['estado'] = 'ACTIVO',
): TipoDocumentoDTO => ({
  idTipoDocumento,
  abreviatura,
  longitudMin: min,
  longitudMax: max,
  soloNumeros,
  consultaApi,
  estado,
});
const TIPOS: TipoDocumentoDTO[] = [
  tipo(1, 'DNI', 8, 8, true, true),
  tipo(2, 'CE', 8, 12, false, false, 'INACTIVO'),
  tipo(3, 'RUC', 11, 11, true, true),
  tipo(4, 'PASAPORTE', 6, 12, false, false),
];

describe('Clientas', () => {
  let fixture: ComponentFixture<Clientas>;
  let raiz: HTMLElement;
  let http: HttpTestingController;

  const estable = () => fixture.whenStable();
  const boton = (texto: string) =>
    [...raiz.querySelectorAll('button')].find((b) => b.textContent?.includes(texto));
  const escribir = (id: string, valor: string) => {
    const entrada = raiz.querySelector<HTMLInputElement>(`#${id}`)!;
    entrada.value = valor;
    entrada.dispatchEvent(new Event('input'));
  };
  const elegirTipo = async (abreviatura: string) => {
    const lista = raiz.querySelector<HTMLSelectElement>('#idTipoDocumento')!;
    lista.selectedIndex = [...lista.options].findIndex((o) => o.text === abreviatura);
    lista.dispatchEvent(new Event('change'));
    await estable();
  };
  const marcarConsentimiento = () => {
    raiz.querySelector<HTMLInputElement>('#consentimiento')!.click();
  };
  const enviar = async () => {
    raiz.querySelector('app-modal form')!.dispatchEvent(new Event('submit'));
    await estable();
  };
  const abrir = async () => {
    boton('+ Registrar clienta')!.click();
    await estable();
  };

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [Clientas],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    entrarComo({ idSede: 1, permisos: ['CLIENTAS:VER', 'CLIENTAS:CREAR'] });
    fixture = TestBed.createComponent(Clientas);
    await estable();
    raiz = fixture.nativeElement;
    http.expectOne('/api/v1/tipos-documento').flush(TIPOS);
    http.expectOne('/api/v1/clientes').flush([
      {
        idCliente: 407,
        nombres: 'Marisol',
        apellidos: 'Quispe',
        telefono: '987654321',
        origenDatos: 'MANUAL',
        aceptaComunicaciones: false,
      },
      {
        idCliente: 408,
        nombres: 'Lucía',
        apellidos: 'Paredes',
        telefono: '964120331',
        idTipoDocumento: 1,
        origenDatos: 'VERIFICADO',
        aceptaComunicaciones: true,
      },
    ]);
    await estable();
  });

  afterEach(() => http.verify());

  it('ofrece los tipos activos de GET /tipos-documento, sin ids fijos (Duda 5)', async () => {
    await abrir();
    const opciones = [...raiz.querySelectorAll('#idTipoDocumento option')].map((o) =>
      o.textContent?.trim(),
    );
    expect(opciones.slice(1)).toEqual(['DNI', 'RUC', 'PASAPORTE']);
  });

  it('CUS01: lista las clientas con el origen de sus datos', () => {
    const filas = raiz.querySelectorAll('tbody tr');
    expect(filas[0].textContent).toContain('Ingresada a mano');
    expect(filas[0].textContent).toContain('No desea comunicaciones');
    expect(filas[1].textContent).toContain('DNI verificado');
  });

  it('CUS01: busca por nombre o por teléfono según lo escrito', async () => {
    escribir('buscarClienta', 'Quispe');
    raiz.querySelector('form')!.dispatchEvent(new Event('submit'));
    http.expectOne('/api/v1/clientes?nombres=Quispe').flush([]);
    await estable();
    expect(raiz.querySelector('.vacio')).not.toBeNull();

    escribir('buscarClienta', '987 654 321');
    raiz.querySelector('form')!.dispatchEvent(new Event('submit'));
    http.expectOne('/api/v1/clientes?telefono=987654321').flush([]);
  });

  it('solo ofrece consultar DNI y RUC', async () => {
    await abrir();
    expect(boton('Consultar documento')).toBeUndefined();
    await elegirTipo('DNI');
    expect(boton('Consultar documento')).toBeDefined();
    await elegirTipo('RUC');
    expect(boton('Consultar documento')).toBeDefined();
    await elegirTipo('PASAPORTE');
    expect(boton('Consultar documento')).toBeUndefined();
    expect(raiz.querySelector('app-modal')?.textContent).toContain('ingresada a mano');
  });

  it('CUS02: con DNI encontrado completa los datos y la ficha queda verificada', async () => {
    await abrir();
    await elegirTipo('DNI');
    escribir('numeroDocumento', '70000002');
    boton('Consultar documento')!.click();
    http.expectOne(`${CONSULTA}?idTipoDocumento=1&numeroDocumento=70000002`).flush({
      resultado: 'ENCONTRADO',
      nombres: 'Rosa',
      apellidos: 'Mendoza',
      fechaVerificacion: '2026-11-03T10:00:00',
    });
    await estable();
    expect(raiz.querySelector<HTMLInputElement>('#nombres')?.value).toBe('Rosa');
    expect(raiz.querySelector('app-modal .chip.ok')?.textContent).toContain('Verificada');

    escribir('telefono', '912450678');
    marcarConsentimiento();
    await enviar();
    const peticion = http.expectOne('/api/v1/clientes');
    expect(peticion.request.body).toEqual({
      idTipoDocumento: 1,
      numeroDocumento: '70000002',
      nombres: 'Rosa',
      apellidos: 'Mendoza',
      telefono: '912450678',
      fechaVerificacion: '2026-11-03T10:00:00',
      aceptaComunicaciones: false,
    });
    peticion.flush({ idCliente: 500, nombres: 'Rosa', telefono: '912450678' });
    await estable();
    expect(raiz.querySelector('app-modal')).toBeNull();
    expect(raiz.querySelector('tbody')?.textContent).toContain('Rosa');
  });

  it('cambiar el número quita la verificación', async () => {
    await abrir();
    await elegirTipo('DNI');
    escribir('numeroDocumento', '70000002');
    boton('Consultar documento')!.click();
    http.expectOne(`${CONSULTA}?idTipoDocumento=1&numeroDocumento=70000002`).flush({
      resultado: 'ENCONTRADO',
      nombres: 'Rosa',
      fechaVerificacion: '2026-11-03T10:00:00',
    });
    await estable();
    escribir('numeroDocumento', '70000003');
    await estable();
    expect(raiz.querySelector('app-modal .chip.ok')).toBeNull();
  });

  it.each([
    ['responde que no lo encontró', 202],
    ['falla', 500],
  ])('si la consulta %s, la ficha queda ingresada a mano', async (_, status) => {
    await abrir();
    await elegirTipo('RUC');
    escribir('numeroDocumento', '20123456789');
    boton('Consultar documento')!.click();
    http
      .expectOne(`${CONSULTA}?idTipoDocumento=3&numeroDocumento=20123456789`)
      .flush(status === 202 ? { resultado: 'ERROR' } : null, { status, statusText: 'x' });
    await estable();
    expect(raiz.querySelector('app-modal .alert.warn')?.textContent).toContain('a mano');

    escribir('nombres', 'Spa SAC');
    escribir('telefono', '912450678');
    marcarConsentimiento();
    await enviar();
    const cuerpo = http.expectOne('/api/v1/clientes');
    expect(cuerpo.request.body.fechaVerificacion).toBeUndefined();
    cuerpo.flush({ idCliente: 501 });
  });

  it('no guarda sin consentimiento ni con un número inválido', async () => {
    await abrir();
    escribir('nombres', 'Ana');
    escribir('telefono', '912450678');
    await enviar();
    expect(raiz.querySelector('app-modal .alert.bad')?.textContent).toContain('consentimiento');
    marcarConsentimiento();
    await elegirTipo('DNI');
    escribir('numeroDocumento', '123');
    await enviar();
    expect(raiz.querySelector('app-modal .alert.bad')?.textContent).toContain('DNI');
    http.expectNone('/api/v1/clientes');
  });

  it('avisa en el formulario el teléfono o documento repetido', async () => {
    await abrir();
    escribir('nombres', 'Ana');
    escribir('telefono', '987654321');
    marcarConsentimiento();
    await enviar();
    http
      .expectOne('/api/v1/clientes')
      .flush(
        { detail: 'El teléfono o el documento ya pertenecen a otra ficha', regla: 'RF05' },
        { status: 409, statusText: 'Conflict' },
      );
    await estable();
    expect(raiz.querySelector('app-modal .alert.bad')?.textContent).toContain('otra ficha');
  });
});
