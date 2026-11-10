import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { entrarComo } from '../../../../testing/sesion';
import { Catalogo } from './catalogo';

describe('Catalogo', () => {
  let fixture: ComponentFixture<Catalogo>;
  let raiz: HTMLElement;
  let http: HttpTestingController;

  const estable = () => fixture.whenStable();
  const clic = async (texto: string) => {
    [...raiz.querySelectorAll('button')].find((b) => b.textContent?.includes(texto))!.click();
    await estable();
  };
  const escribir = (selector: string, valor: string) => {
    const entrada = raiz.querySelector<HTMLInputElement>(selector)!;
    entrada.value = valor;
    entrada.dispatchEvent(new Event('input'));
  };
  const enviar = async () => {
    raiz.querySelector('app-modal form')!.dispatchEvent(new Event('submit'));
    await estable();
  };

  const montar = async (permisos: string[]) => {
    TestBed.configureTestingModule({
      imports: [Catalogo],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    entrarComo({ idSede: 1, permisos });
    fixture = TestBed.createComponent(Catalogo);
    await estable();
    raiz = fixture.nativeElement;
    http.expectOne('/api/v1/areas').flush([
      { idArea: 1, linea: 'SALON', nombreArea: 'Peluquería y Estilismo' },
      { idArea: 4, linea: 'SPA', nombreArea: 'Cuidado Facial' },
    ]);
    await estable();
  };

  afterEach(() => http.verify());

  it('sin CATALOGO:CREAR no ofrece registrar y oculta Recursos sin SEDES:VER', async () => {
    await montar(['CATALOGO:VER']);
    expect(raiz.textContent).toContain('Peluquería y Estilismo');
    expect(raiz.textContent).not.toContain('+ Servicio');
    expect(raiz.querySelector('a[href="/sedes/recursos"]')).toBeNull();
  });

  it('CUS57: registra un área con su línea', async () => {
    await montar(['CATALOGO:VER', 'CATALOGO:CREAR']);
    await clic('+ Área');
    await clic('Spa');
    escribir('#nombreArea', 'Masajes');
    await enviar();
    const peticion = http.expectOne('/api/v1/areas');
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual({ linea: 'SPA', nombreArea: 'Masajes' });
    peticion.flush({ idArea: 6, linea: 'SPA', nombreArea: 'Masajes' });
    await estable();
    expect(raiz.querySelector('app-modal')).toBeNull();
    expect(
      [...raiz.querySelectorAll('button')].some((b) => b.textContent?.includes('Masajes')),
    ).toBe(true);
  });

  it('CUS57: registra un servicio con tipo de recurso, variante e insumo', async () => {
    await montar(['CATALOGO:VER', 'CATALOGO:CREAR']);
    await clic('+ Servicio');
    escribir('#nombre', 'Corte de novia');
    const area = raiz.querySelector<HTMLSelectElement>('#idArea')!;
    area.selectedIndex = 0;
    area.dispatchEvent(new Event('change'));
    escribir('#duracionRefMin', '60');
    const tipo = raiz.querySelector<HTMLSelectElement>('#tipoRecurso')!;
    tipo.value = 'CABINA';
    tipo.dispatchEvent(new Event('change'));
    escribir('[aria-label="Nombre de la variante 1"]', 'Estándar');
    escribir('[aria-label="Precio de la variante 1"]', '80');
    await clic('+ Insumo');
    escribir('[aria-label="Producto del insumo 1"]', '4');
    escribir('[aria-label="Cantidad del insumo 1"]', '1.5');
    await enviar();
    const peticion = http.expectOne('/api/v1/servicios');
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual({
      nombre: 'Corte de novia',
      idArea: 1,
      duracionRefMin: 60,
      tipoRecurso: 'CABINA',
      variantes: [
        {
          nombreVariante: 'Estándar',
          precio: 80,
          insumos: [{ idProducto: 4, cantidadEstimada: 1.5 }],
        },
      ],
    });
    peticion.flush({
      ...peticion.request.body,
      idServicio: 21,
      estado: 'ACTIVO',
    });
    await estable();
    const tarjeta = raiz.querySelector('.gf2 .card')!;
    expect(tarjeta.textContent).toContain('Corte de novia');
    expect(tarjeta.textContent).toContain('Peluquería y Estilismo · ref. 60 min');
    expect(tarjeta.querySelector('.chip.salon')).not.toBeNull();
    expect(tarjeta.textContent).toContain('S/ 80');

    await clic('Cuidado Facial');
    expect(raiz.querySelector('.gf2 .vacio')).not.toBeNull();
  });

  it('no envía un servicio sin variantes', async () => {
    await montar(['CATALOGO:VER', 'CATALOGO:CREAR']);
    await clic('+ Servicio');
    await clic('Quitar');
    escribir('#nombre', 'Corte');
    await enviar();
    http.expectNone('/api/v1/servicios');
    expect(raiz.querySelector('app-modal .alert.bad')).not.toBeNull();
  });
});
