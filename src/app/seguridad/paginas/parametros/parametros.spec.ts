import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { entrarComo } from '../../../../testing/sesion';
import { Parametros } from './parametros';

describe('Parametros (CUS65)', () => {
  let fixture: ComponentFixture<Parametros>;
  let raiz: HTMLElement;
  let http: HttpTestingController;

  const estable = () => fixture.whenStable();
  const valor = (codigo: string) =>
    raiz.querySelector<HTMLInputElement>(`input[aria-label="Valor de ${codigo}"]`)!;
  const escribir = (entrada: HTMLInputElement, texto: string) => {
    entrada.value = texto;
    entrada.dispatchEvent(new Event('input'));
  };
  const boton = (tabla: string, fila: number) =>
    raiz.querySelectorAll<HTMLButtonElement>(`#${tabla} tbody button`)[fila];

  const montar = async (permisos: string[]) => {
    TestBed.configureTestingModule({
      imports: [Parametros],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    entrarComo({ idSede: 1, permisos });
    fixture = TestBed.createComponent(Parametros);
    await estable();
    raiz = fixture.nativeElement;
    http.expectOne('/api/v1/parametros').flush([
      {
        codigo: 'AGENDA_PASO_MIN',
        descripcion: 'Minutos entre horas libres de la agenda (RN51)',
        valorNumero: 15,
        fechaVigencia: '2026-11-08',
      },
      {
        codigo: 'LIMPIEZA_MAX_MIN',
        descripcion: 'Minutos máximos de limpieza del recurso (RN03)',
        valorNumero: 10,
        fechaVigencia: '2026-11-08',
      },
    ]);
    http.expectOne('/api/v1/tipos-documento').flush([
      {
        idTipoDocumento: 1,
        abreviatura: 'DNI',
        nombre: 'DNI',
        estado: 'ACTIVO',
        consultaApi: true,
      },
      {
        idTipoDocumento: 4,
        abreviatura: 'PAS',
        nombre: 'Pasaporte',
        estado: 'ACTIVO',
        consultaApi: false,
      },
    ]);
    await estable();
  };

  afterEach(() => http.verify());

  it('LIMPIEZA_MAX_MIN va hasta 10 y no se envía más (RN03)', async () => {
    await montar(['SEGURIDAD:VER', 'SEGURIDAD:EDITAR']);
    expect(valor('LIMPIEZA_MAX_MIN').getAttribute('max')).toBe('10');
    escribir(valor('LIMPIEZA_MAX_MIN'), '11');
    boton('tablaParametros', 1).click();
    await estable();
    http.expectNone('/api/v1/parametros/LIMPIEZA_MAX_MIN');
    expect(raiz.querySelector('.alert.bad')?.textContent).toContain('0 a 10');
  });

  it('«Guardar parámetro» cambia el valor con su vigencia', async () => {
    await montar(['SEGURIDAD:VER', 'SEGURIDAD:EDITAR']);
    escribir(valor('LIMPIEZA_MAX_MIN'), '8');
    escribir(
      raiz.querySelector<HTMLInputElement>('input[aria-label="Vigencia de LIMPIEZA_MAX_MIN"]')!,
      '2026-11-15',
    );
    boton('tablaParametros', 1).click();
    await estable();
    const peticion = http.expectOne('/api/v1/parametros/LIMPIEZA_MAX_MIN');
    expect(peticion.request.method).toBe('PATCH');
    expect(peticion.request.body).toEqual({ valorNumero: 8, fechaVigencia: '2026-11-15' });
    peticion.flush({ codigo: 'LIMPIEZA_MAX_MIN', valorNumero: 8, fechaVigencia: '2026-11-15' });
    await estable();
  });

  it('AGENDA_PASO_MIN es un entero mayor que 0 (RN51)', async () => {
    await montar(['SEGURIDAD:VER', 'SEGURIDAD:EDITAR']);
    escribir(valor('AGENDA_PASO_MIN'), '0');
    boton('tablaParametros', 0).click();
    await estable();
    http.expectNone('/api/v1/parametros/AGENDA_PASO_MIN');
    expect(raiz.querySelector('.alert.bad')?.textContent).toContain('RN51');
  });

  it('tipos de documento: solo DNI y RUC se consultan; «Guardar tipo de documento»', async () => {
    await montar(['SEGURIDAD:VER', 'SEGURIDAD:EDITAR']);
    const consultaPas = raiz.querySelector<HTMLInputElement>(
      'input[aria-label="Consultar PAS en APISPERU"]',
    )!;
    expect(consultaPas.disabled).toBe(true);
    raiz.querySelector<HTMLInputElement>('input[aria-label="PAS activo"]')!.click();
    boton('tablaTipos', 1).click();
    await estable();
    const peticion = http.expectOne('/api/v1/tipos-documento/4');
    expect(peticion.request.method).toBe('PATCH');
    expect(peticion.request.body).toEqual({ estado: 'INACTIVO', consultaApi: false });
    peticion.flush({ idTipoDocumento: 4, abreviatura: 'PAS', estado: 'INACTIVO' });
    await estable();
  });

  it('sin SEGURIDAD:EDITAR solo se leen', async () => {
    await montar(['SEGURIDAD:VER']);
    expect(raiz.querySelector('#tablaParametros tbody button')).toBeNull();
    expect(raiz.querySelector('#tablaParametros tbody')?.textContent).toContain('15');
  });
});
