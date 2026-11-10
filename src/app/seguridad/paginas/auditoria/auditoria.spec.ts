import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Auditoria } from './auditoria';

describe('Auditoria (CUS55)', () => {
  let fixture: ComponentFixture<Auditoria>;
  let raiz: HTMLElement;
  let http: HttpTestingController;

  const estable = () => fixture.whenStable();
  const escribir = (id: string, valor: string) => {
    const entrada = raiz.querySelector<HTMLInputElement>(`#${id}`)!;
    entrada.value = valor;
    entrada.dispatchEvent(new Event('input'));
  };
  const consultar = async () => {
    raiz.querySelector('form')!.dispatchEvent(new Event('submit'));
    await estable();
  };

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [Auditoria],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Auditoria);
    fixture.componentRef.setInput('usuarios', [
      { idUsuario: 1, nombreUsuario: 'admin', clave: '' },
      { idUsuario: 2, nombreUsuario: 'recepcion1', clave: '' },
    ]);
    await estable();
    raiz = fixture.nativeElement;
    // Al abrirse consulta los últimos 30 días.
    http.expectOne((req) => req.url === '/api/v1/auditoria').flush([]);
    await estable();
  });

  afterEach(() => http.verify());

  it('filtra por usuario, módulo, entidad y fechas, y muestra quién hizo qué', async () => {
    const usuario = raiz.querySelector<HTMLSelectElement>('#auditoriaUsuario')!;
    usuario.selectedIndex = 1;
    usuario.dispatchEvent(new Event('change'));
    escribir('auditoriaModulo', 'Ventas');
    escribir('auditoriaEntidad', 'VENTA');
    escribir('auditoriaInicio', '2026-11-01');
    escribir('auditoriaFin', '2026-11-09');
    await consultar();
    http
      .expectOne(
        '/api/v1/auditoria?idUsuario=1&modulo=Ventas&entidad=VENTA&fechaInicio=2026-11-01&fechaFin=2026-11-09',
      )
      .flush([
        {
          idAuditoria: 900,
          fechaHora: '2026-11-09T11:30:00',
          usuario: 'admin',
          rol: 'ADMINISTRADORA',
          modulo: 'Ventas',
          accion: 'EDITAR',
          entidad: 'VENTA',
          idEntidad: 620,
          detalle: 'estado: CERRADA -> ANULADA',
        },
      ]);
    await estable();
    const fila = raiz.querySelector('tbody tr')!.textContent?.replace(/\s+/g, ' ');
    expect(fila).toContain('09/11/2026 11:30');
    expect(fila).toContain('ADMINISTRADORA');
    expect(fila).toContain('VENTA N° 620');
    expect(fila).toContain('estado: CERRADA -> ANULADA');
  });

  it('no consulta si la fecha de inicio es posterior a la de fin (RF80)', async () => {
    escribir('auditoriaInicio', '2026-11-10');
    escribir('auditoriaFin', '2026-11-01');
    await consultar();
    http.expectNone((req) => req.url === '/api/v1/auditoria');
    expect(raiz.querySelector('.alert.bad')?.textContent).toContain('posterior');
  });
});
