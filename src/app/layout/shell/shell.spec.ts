import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SesionDTO } from '../../core/api/modelos.generados';
import { entrarComo } from '../../../testing/sesion';
import { Shell } from './shell';

describe('Shell', () => {
  let http: HttpTestingController;

  const montar = async (permisos: string[], extra: Partial<SesionDTO> = {}) => {
    entrarComo({
      idSede: 1,
      nombreSede: 'Pichanaki Centro',
      nombreUsuario: 'carmen.soto',
      permisos,
      ...extra,
    });
    const fixture = TestBed.createComponent(Shell);
    fixture.detectChanges();
    return { fixture, raiz: fixture.nativeElement as HTMLElement };
  };
  const textos = (raiz: HTMLElement, selector: string) =>
    [...raiz.querySelectorAll(selector)].map((e) => e.textContent?.trim());

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('muestra solo los módulos permitidos, agrupados como en el prototipo', async () => {
    const { raiz } = await montar(['AGENDA:VER', 'SEGURIDAD:VER']);
    expect(textos(raiz, '.side .nvl')).toEqual(['Inicio', 'Agenda', 'Usuarios y seguridad']);
    expect(textos(raiz, '.side .grp')).toEqual(['Recepción', 'Administración']);
    expect(raiz.querySelector('a[href="/caja"]')).toBeNull();
  });

  it('el inventario aparece con PRODUCTOS:VER o KARDEX:VER, y el kardex solo con KARDEX:VER', async () => {
    const { raiz } = await montar(['KARDEX:VER']);
    expect(textos(raiz, '.side .nvl')).toEqual(['Inicio', 'Productos e insumos', 'Kardex']);
    expect(textos(raiz, '.side .grp')).toEqual(['Recepción', 'Almacén']);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    const otra = await montar(['PRODUCTOS:VER']);
    expect(textos(otra.raiz, '.side .nvl')).toEqual(['Inicio', 'Productos e insumos']);
  });

  it('la revisión de caja y la conciliación aparecen con CONCILIACION:VER', async () => {
    const { raiz } = await montar(['CONCILIACION:VER']);
    expect(textos(raiz, '.side .nvl')).toEqual(['Inicio', 'Revisión de caja', 'Conciliación']);
    expect(textos(raiz, '.side .grp')).toEqual(['Recepción', 'Administración']);
  });

  it('los reportes aparecen solo con REPORTES:VER', async () => {
    const { raiz } = await montar(['REPORTES:VER']);
    expect(textos(raiz, '.side .nvl')).toEqual(['Inicio', 'Reportes']);
    expect(raiz.querySelector('a[href="/reportes"]')).not.toBeNull();
  });

  it('la barra inferior lleva cuatro accesos y «Más»', async () => {
    const { raiz } = await montar(['AGENDA:VER', 'CLIENTAS:VER', 'VENTAS:CREAR']);
    expect(textos(raiz, '.bnav .bn')).toEqual(['Inicio', 'Agenda', 'Clientas', 'Sin cita', 'Más']);
  });

  it('la cabecera lleva nombres, rol, sede y la caja abierta de GET /cajas/abierta', async () => {
    const { fixture, raiz } = await montar(['CAJA:VER'], {
      nombres: 'Carmen',
      apellidos: 'Soto',
      rol: 'RECEPCIONISTA',
    });
    http.expectOne('/api/v1/cajas/abierta').flush({ idCaja: 214, estado: 'ABIERTA' });
    fixture.detectChanges();
    // La sede se nombra con SesionDTO.nombreSede, nunca con su id (It. 2.1).
    expect(raiz.querySelector('.top')?.textContent).toContain('Pichanaki Centro');
    expect(raiz.querySelector('.top')?.textContent).not.toContain('Sede 1');
    expect(raiz.querySelector('.usuario')?.textContent).toContain('Carmen Soto');
    expect(raiz.querySelector('.usuario')?.textContent).toContain('Recepcionista');
    expect(raiz.querySelector('.usuario .avatar')?.textContent).toBe('CS');
    expect(raiz.querySelector('.top a[href="/caja"]')?.textContent?.trim()).toBe('Caja abierta');
  });

  it('con 204 la cabecera dice «Caja cerrada»', async () => {
    const { fixture, raiz } = await montar(['CAJA:VER']);
    http.expectOne('/api/v1/cajas/abierta').flush(null, { status: 204, statusText: 'No Content' });
    fixture.detectChanges();
    expect(raiz.querySelector('.top a[href="/caja"]')?.textContent?.trim()).toBe('Caja cerrada');
  });
});
