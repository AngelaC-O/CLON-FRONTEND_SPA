import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { entrarComo } from '../../../../testing/sesion';
import { Anulaciones } from './anulaciones';

describe('Anulaciones (IGU_Anulacion)', () => {
  let fixture: ComponentFixture<Anulaciones>;
  let raiz: HTMLElement;
  let http: HttpTestingController;

  const estable = () => fixture.whenStable();
  const pestanas = () =>
    [...raiz.querySelectorAll('[role="tab"]')].map((t) => t.textContent?.trim());
  const activa = () => raiz.querySelector('[role="tab"].on')?.textContent?.trim();

  const montar = async (permisos: string[], idVenta?: number) => {
    TestBed.configureTestingModule({
      imports: [Anulaciones],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap(idVenta ? { idVenta: String(idVenta) } : {}),
            },
          },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    entrarComo({ idSede: 1, permisos });
    fixture = TestBed.createComponent(Anulaciones);
    await estable();
    raiz = fixture.nativeElement;
  };
  /** La bandeja y las devoluciones se montan juntas y piden sus listas. */
  const responderAdministradora = async () => {
    http.expectOne('/api/v1/solicitudes-anulacion?estado=PENDIENTE').flush([]);
    http.expectOne('/api/v1/solicitudes-anulacion?estado=APROBADA').flush([]);
    http.expectOne('/api/v1/medios-pago').flush([]);
    await estable();
  };

  afterEach(() => http.verify());

  it('con VENTAS:ANULAR solo ve la solicitud (CUS22)', async () => {
    await montar(['VENTAS:ANULAR', 'VENTAS:VER']);
    expect(pestanas()).toEqual(['Solicitar anulación']);
    expect(raiz.querySelector('app-bandeja-anulaciones')).toBeNull();
    http.expectNone((req) => req.url.includes('/solicitudes-anulacion'));
  });

  it('con VENTAS:EDITAR abre en la bandeja y ve las devoluciones (CUS23, CUS24)', async () => {
    await montar(['VENTAS:EDITAR', 'VENTAS:VER']);
    await responderAdministradora();
    expect(pestanas()).toEqual(['Bandeja', 'Devoluciones']);
    expect(activa()).toBe('Bandeja');
    raiz.querySelectorAll<HTMLButtonElement>('[role="tab"]')[1].click();
    await estable();
    expect(activa()).toBe('Devoluciones');
    const vista = raiz.querySelector('app-devoluciones')!.parentElement!;
    expect(vista.hidden).toBe(false);
  });

  it('con una venta en la ruta abre su solicitud', async () => {
    await montar(['VENTAS:ANULAR', 'VENTAS:EDITAR', 'VENTAS:VER'], 620);
    await responderAdministradora();
    http.expectOne('/api/v1/ventas/620').flush({ idVenta: 620, estado: 'CERRADA', total: 90 });
    await estable();
    expect(pestanas()).toEqual(['Solicitar anulación', 'Bandeja', 'Devoluciones']);
    expect(activa()).toBe('Solicitar anulación');
    expect(raiz.querySelector('#ventaAnular')).not.toBeNull();
  });
});
