import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { entrarComo } from '../../../../testing/sesion';
import { ServicioDTO } from '../../modelos/catalogo.modelos';
import { Catalogo } from './catalogo';

const NOVIA: ServicioDTO = {
  idServicio: 21,
  idArea: 1,
  nombre: 'Corte de novia',
  duracionRefMin: 60,
  tipoRecurso: 'SILLON',
  estado: 'ACTIVO',
  variantes: [
    {
      idVariante: 30,
      nombreVariante: 'Estándar',
      precio: 80,
      insumos: [{ idProducto: 4, cantidadEstimada: 15 }],
    },
  ],
};
const FACIAL: ServicioDTO = {
  idServicio: 22,
  idArea: 4,
  nombre: 'Limpieza facial',
  duracionRefMin: 45,
  tipoRecurso: 'CAMILLA',
  estado: 'INACTIVO',
  variantes: [{ idVariante: 31, nombreVariante: 'Profunda', precio: 70 }],
};

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

  const pestanas = () =>
    [...raiz.querySelectorAll('[role="tab"]')].map((t) => t.textContent?.trim());

  const montar = async (permisos: string[], servicios: ServicioDTO[] = []) => {
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
    http.expectOne({ method: 'GET', url: '/api/v1/servicios' }).flush(servicios);
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

  it('CUS58: lista los servicios de GET /servicios, también los inactivos (diferencia 17)', async () => {
    await montar(['CATALOGO:VER'], [NOVIA, FACIAL]);
    const tarjetas = raiz.querySelectorAll('.gf2 .card');
    expect(tarjetas).toHaveLength(2);
    expect(tarjetas[1].textContent).toContain('Inactivo');
    expect(raiz.textContent).not.toContain('Editar servicio');
  });

  it('pestañas de configuración según el permiso de su lectura (diferencia 19)', async () => {
    await montar(['CATALOGO:VER']);
    expect(pestanas()).toEqual(['Servicios', 'Paquetes', 'Promociones', 'Series']);
  });

  it('con VENTAS:VER y SEGURIDAD:VER suma medios de pago y parámetros', async () => {
    await montar(['CATALOGO:VER', 'VENTAS:VER', 'SEGURIDAD:VER']);
    expect(pestanas()).toEqual([
      'Servicios',
      'Paquetes',
      'Promociones',
      'Medios de pago',
      'Series',
      'Parámetros',
    ]);
    await clic('Medios de pago');
    expect(raiz.querySelector('app-medios-pago')).not.toBeNull();
    http.expectOne('/api/v1/medios-pago').flush([]);
    expect(raiz.textContent).not.toContain('+ Servicio');
  });

  it('CUS58: «Guardar cambios» envía datos, estado e insumos con PUT', async () => {
    await montar(['CATALOGO:VER', 'CATALOGO:EDITAR'], [NOVIA]);
    await clic('Editar servicio');
    const modal = raiz.querySelector('app-editar-servicio')!;
    expect(modal.querySelector<HTMLInputElement>('#editarNombre')?.value).toBe('Corte de novia');
    escribir('#editarDuracion', '45');
    const estado = raiz.querySelector<HTMLSelectElement>('#editarEstado')!;
    estado.value = 'INACTIVO';
    estado.dispatchEvent(new Event('change'));
    escribir('[aria-label="Cantidad del insumo 1 de Estándar"]', '20');
    raiz.querySelector('app-editar-servicio form')!.dispatchEvent(new Event('submit'));
    await estable();
    const peticion = http.expectOne('/api/v1/servicios/21');
    expect(peticion.request.method).toBe('PUT');
    expect(peticion.request.body).toEqual({
      idArea: 1,
      nombre: 'Corte de novia',
      duracionRefMin: 45,
      tipoRecurso: 'SILLON',
      estado: 'INACTIVO',
      variantes: [
        {
          idVariante: 30,
          nombreVariante: 'Estándar',
          precio: 80,
          insumos: [{ idProducto: 4, cantidadEstimada: 20 }],
        },
      ],
    });
    peticion.flush({ ...NOVIA, duracionRefMin: 45, estado: 'INACTIVO' });
    await estable();
    expect(raiz.querySelector('app-editar-servicio')).toBeNull();
    expect(raiz.querySelector('.gf2 .card')?.textContent).toContain('Inactivo');
  });

  it('CUS58: «Cambiar precio» cambia solo el precio de la variante (RN25)', async () => {
    await montar(['CATALOGO:VER', 'CATALOGO:EDITAR'], [NOVIA]);
    await clic('Editar servicio');
    escribir('#precioNuevo0', '95');
    await clic('Cambiar precio');
    const peticion = http.expectOne('/api/v1/servicios/21/variantes/30/precio');
    expect(peticion.request.method).toBe('PATCH');
    expect(peticion.request.body).toEqual({ precioNuevo: 95 });
    peticion.flush({ ...NOVIA, variantes: [{ ...NOVIA.variantes[0], precio: 95 }] });
    await estable();
    expect(raiz.querySelector('app-editar-servicio')?.textContent).toContain(
      'Precio actual S/ 95.00',
    );
    expect(raiz.querySelector('.gf2 .card')?.textContent).toContain('S/ 95');
  });
});
