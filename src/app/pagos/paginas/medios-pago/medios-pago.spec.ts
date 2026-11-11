import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { entrarComo } from '../../../../testing/sesion';
import { MediosPago } from './medios-pago';

describe('MediosPago (CUS62)', () => {
  let fixture: ComponentFixture<MediosPago>;
  let raiz: HTMLElement;
  let http: HttpTestingController;

  const estable = () => fixture.whenStable();
  const casilla = (etiqueta: string) =>
    raiz.querySelector<HTMLInputElement>(`input[aria-label="${etiqueta}"]`)!;
  const guardar = async (fila: number) => {
    raiz.querySelectorAll<HTMLButtonElement>('#tablaMedios tbody button')[fila].click();
    await estable();
  };

  const montar = async (permisos: string[]) => {
    TestBed.configureTestingModule({
      imports: [MediosPago],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    entrarComo({ idSede: 1, permisos });
    fixture = TestBed.createComponent(MediosPago);
    await estable();
    raiz = fixture.nativeElement;
    http.expectOne('/api/v1/medios-pago').flush([
      { idMedioPago: 1, nombre: 'EFECTIVO', estado: 'ACTIVO', usaPasarela: false },
      { idMedioPago: 3, nombre: 'PLIN', estado: 'INACTIVO', usaPasarela: true },
    ]);
    await estable();
  };

  afterEach(() => http.verify());

  it('el efectivo no puede cobrarse por la pasarela (RN42)', async () => {
    await montar(['VENTAS:VER', 'CATALOGO:EDITAR']);
    expect(casilla('Efectivo por la pasarela').disabled).toBe(true);
    expect(casilla('Plin activo').checked).toBe(false);
    expect(casilla('Plin por la pasarela').checked).toBe(true);
  });

  it('«Guardar medio de pago» activa Plin', async () => {
    await montar(['VENTAS:VER', 'CATALOGO:EDITAR']);
    casilla('Plin activo').click();
    await guardar(1);
    const peticion = http.expectOne('/api/v1/medios-pago/3');
    expect(peticion.request.method).toBe('PATCH');
    expect(peticion.request.body).toEqual({ estado: 'ACTIVO', usaPasarela: true });
    peticion.flush({ idMedioPago: 3, nombre: 'PLIN', estado: 'ACTIVO', usaPasarela: true });
    await estable();
  });

  it('sin CATALOGO:EDITAR solo se ve', async () => {
    await montar(['VENTAS:VER']);
    expect(raiz.querySelector('#tablaMedios tbody button')).toBeNull();
    expect(casilla('Plin activo').disabled).toBe(true);
  });
});
