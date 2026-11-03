import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RolDTO } from '../../modelos/seguridad.modelos';
import { Usuarios } from './usuarios';

const ROLES: RolDTO[] = [
  {
    idRol: 1,
    nombre: 'ADMINISTRADORA',
    estado: 'ACTIVO',
    descripcion: 'Todo',
    permisos: [{ modulo: 'SEGURIDAD', accion: 'VER' }],
  },
  {
    idRol: 2,
    nombre: 'RECEPCIONISTA',
    estado: 'ACTIVO',
    permisos: [{ modulo: 'AGENDA', accion: 'VER' }],
  },
];

describe('Usuarios', () => {
  let fixture: ComponentFixture<Usuarios>;
  let raiz: HTMLElement;
  let http: HttpTestingController;

  const estable = () => fixture.whenStable();
  const boton = (texto: string) =>
    [...raiz.querySelectorAll('button')].find((b) => b.textContent?.includes(texto))!;
  const clic = async (texto: string) => {
    boton(texto).click();
    await estable();
  };
  const escribir = (selector: string, valor: string) => {
    const entrada = raiz.querySelector<HTMLInputElement>(selector)!;
    entrada.value = valor;
    entrada.dispatchEvent(new Event('input'));
  };
  const elegir = (selector: string, indice: number) => {
    const lista = raiz.querySelector<HTMLSelectElement>(selector)!;
    lista.selectedIndex = indice;
    lista.dispatchEvent(new Event('change'));
  };
  const enviar = async (selector: string) => {
    raiz.querySelector(selector)!.dispatchEvent(new Event('submit'));
    await estable();
  };

  const montar = async (permisos: string[]) => {
    sessionStorage.setItem('cautiva.sesion', JSON.stringify({ idSede: 1, permisos }));
    TestBed.configureTestingModule({
      imports: [Usuarios],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Usuarios);
    await estable();
    raiz = fixture.nativeElement;
    http.expectOne('/api/v1/roles').flush(ROLES);
    await estable();
  };

  afterEach(() => {
    http.verify();
    sessionStorage.clear();
  });

  it('solo carga los roles al abrir', async () => {
    await montar(['SEGURIDAD:VER']);
    expect(raiz.querySelector('.vacio')).not.toBeNull();
  });

  it('sin permisos de escritura no ofrece crear, asignar ni guardar', async () => {
    await montar(['SEGURIDAD:VER']);
    expect(boton('Crear usuario')).toBeUndefined();
    expect(boton('Asignar rol')).toBeUndefined();
    await clic('Matriz de permisos');
    expect(boton('Guardar permisos')).toBeUndefined();
    expect(raiz.querySelector('tbody')?.textContent).toContain('SEGURIDAD');
  });

  it('CUS52: registra el usuario con los campos de la frontera y lo lista', async () => {
    await montar(['SEGURIDAD:VER', 'SEGURIDAD:CREAR']);
    await clic('Crear usuario');
    escribir('#idPersonal', '3');
    escribir('#nombreUsuario', 'recepcion2');
    escribir('#clave', 'ClaveTemporal2026');
    elegir('#idRol', 1);
    await enviar('app-modal form');
    const peticion = http.expectOne('/api/v1/usuarios');
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual({
      idPersonal: 3,
      nombreUsuario: 'recepcion2',
      clave: 'ClaveTemporal2026',
      idRol: 2,
    });
    peticion.flush({
      idUsuario: 5,
      idPersonal: 3,
      nombreUsuario: 'recepcion2',
      idRol: 2,
      estado: 'ACTIVO',
      debeCambiarClave: true,
    });
    await estable();
    expect(raiz.querySelector('app-modal')).toBeNull();
    expect(raiz.querySelector('tbody')?.textContent).toContain('recepcion2');
    expect(raiz.querySelector('tbody')?.textContent).toContain('Debe cambiar su clave');
  });

  it('no envía un usuario con clave corta', async () => {
    await montar(['SEGURIDAD:VER', 'SEGURIDAD:CREAR']);
    await clic('Crear usuario');
    escribir('#clave', 'corta');
    await enviar('app-modal form');
    http.expectNone('/api/v1/usuarios');
    expect(raiz.querySelector('app-modal .alert.bad')).not.toBeNull();
  });

  it('CUS53: asigna el rol por código y muestra el 404 en el formulario', async () => {
    await montar(['SEGURIDAD:VER', 'SEGURIDAD:EDITAR']);
    escribir('#asignarIdUsuario', '99');
    elegir('#asignarIdRol', 0);
    await enviar('form');
    http
      .expectOne('/api/v1/usuarios/99/rol')
      .flush({ detail: 'No existe el usuario' }, { status: 404, statusText: 'Not Found' });
    await estable();
    expect(raiz.querySelector('.alert.bad')?.textContent).toContain('No existe el usuario');

    await enviar('form');
    const peticion = http.expectOne('/api/v1/usuarios/99/rol');
    expect(peticion.request.method).toBe('PATCH');
    expect(peticion.request.body).toEqual({ idRol: 1 });
    peticion.flush({ idUsuario: 99, nombreUsuario: 'otra', idRol: 1, estado: 'ACTIVO' });
    await estable();
    expect(raiz.querySelector('tbody')?.textContent).toContain('otra');
  });

  it('CUS53: guarda los permisos del rol y actualiza la matriz', async () => {
    await montar(['SEGURIDAD:VER', 'SEGURIDAD:EDITAR']);
    await clic('Matriz de permisos');
    elegir('#rolIdRol', 1);
    await estable();
    await clic('+ Permiso');
    escribir('[aria-label="Módulo del permiso 2"]', 'ventas');
    escribir('[aria-label="Acción del permiso 2"]', 'crear');
    await enviar('form');
    const peticion = http.expectOne('/api/v1/roles/2/permisos');
    expect(peticion.request.method).toBe('PUT');
    expect(peticion.request.body).toEqual({
      nombre: 'RECEPCIONISTA',
      descripcion: '',
      estado: 'ACTIVO',
      permisos: [
        { modulo: 'AGENDA', accion: 'VER' },
        { modulo: 'VENTAS', accion: 'CREAR' },
      ],
    });
    peticion.flush({ ...ROLES[1], permisos: peticion.request.body.permisos });
    await estable();
    expect(raiz.querySelector('tbody')?.textContent).toContain('VENTAS');
  });
});
