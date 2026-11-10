import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';
import { AvisoDTO } from '../../core/api/modelos.generados';
import { PanelAvisos } from './panel-avisos';

const AVISOS: AvisoDTO[] = [
  {
    cantidad: 3,
    mensaje: '3 productos en stock mínimo',
    permisoRequerido: 'PRODUCTOS:VER',
    ruta: '/inventario/productos',
    tipo: 'STOCK_MINIMO',
  },
  { cantidad: 2, mensaje: '2 cajas con diferencia', ruta: '/caja', tipo: 'CAJA_DIFERENCIA' },
];

describe('PanelAvisos (CUS50)', () => {
  let http: HttpTestingController;

  const montar = async (respuesta: AvisoDTO[] | null, status = 200) => {
    const fixture = TestBed.createComponent(PanelAvisos);
    fixture.detectChanges();
    http
      .expectOne('/api/v1/avisos')
      .flush(respuesta, { status, statusText: status === 200 ? 'OK' : 'Error' });
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [PanelAvisos],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('muestra el mensaje y la cantidad de cada aviso, con un enlace a su ruta', async () => {
    const raiz = (await montar(AVISOS)).nativeElement as HTMLElement;
    const filas = [...raiz.querySelectorAll('li')];
    expect(filas).toHaveLength(2);
    expect(filas[0].querySelector('.chip')?.textContent?.trim()).toBe('3');
    expect(filas[0].textContent).toContain('3 productos en stock mínimo');
    expect(filas[0].querySelector('a')?.getAttribute('href')).toBe('/inventario/productos');
    expect(filas[1].querySelector('a')?.getAttribute('href')).toBe('/caja');
  });

  it('lleva a la pantalla del aviso al hacer clic', async () => {
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const raiz = (await montar(AVISOS)).nativeElement as HTMLElement;
    raiz.querySelector<HTMLAnchorElement>('li a')!.click();
    expect(navegar).toHaveBeenCalled();
    expect(String(navegar.mock.calls[0][0])).toBe('/inventario/productos');
  });

  it('sin avisos dice «No hay avisos»', async () => {
    const raiz = (await montar([])).nativeElement as HTMLElement;
    expect(raiz.querySelector('li')?.textContent?.trim()).toBe('No hay avisos');
  });

  it('si falla, permite reintentar', async () => {
    const fixture = await montar(null, 500);
    const raiz = fixture.nativeElement as HTMLElement;
    expect(raiz.textContent).toContain('No se pudieron cargar los avisos.');
    raiz.querySelector<HTMLButtonElement>('button')!.click();
    http.expectOne('/api/v1/avisos').flush(AVISOS);
    fixture.detectChanges();
    expect(raiz.querySelectorAll('li')).toHaveLength(2);
  });
});
