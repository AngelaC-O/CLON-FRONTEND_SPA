import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { entrarComo } from '../../../../testing/sesion';
import { PermisoDTO, RolDTO, UsuarioDTO } from '../../modelos/seguridad.modelos';
import { MENSAJE_RN48_PERMISOS, MENSAJE_RN48_ROL, Usuarios } from './usuarios';

const SEGURIDAD: PermisoDTO[] = [
  { modulo: 'SEGURIDAD', accion: 'VER' },
  { modulo: 'SEGURIDAD', accion: 'CREAR' },
  { modulo: 'SEGURIDAD', accion: 'EDITAR' },
];
const PERMISOS: PermisoDTO[] = [
  { modulo: 'AGENDA', accion: 'VER' },
  { modulo: 'VENTAS', accion: 'CREAR' },
  ...SEGURIDAD,
];
const ROLES: RolDTO[] = [
  {
    idRol: 1,
    nombre: 'ADMINISTRADORA',
    estado: 'ACTIVO',
    descripcion: 'Todo',
    permisos: SEGURIDAD,
  },
  {
    idRol: 2,
    nombre: 'RECEPCIONISTA',
    estado: 'ACTIVO',
    permisos: [{ modulo: 'AGENDA', accion: 'VER' }],
  },
];
const USUARIOS: UsuarioDTO[] = [
  { idUsuario: 1, idPersonal: 1, nombreUsuario: 'admin', idRol: 1, estado: 'ACTIVO', clave: '' },
  {
    idUsuario: 5,
    idPersonal: 3,
    nombreUsuario: 'recepcion2',
    idRol: 2,
    estado: 'ACTIVO',
    clave: '',
  },
];

describe('Usuarios', () => {
  let fixture: ComponentFixture<Usuarios>;
  let raiz: HTMLElement;
  let http: HttpTestingController;

  const estable = () => fixture.whenStable();
  const boton = (texto: string, dentro: ParentNode = raiz) =>
    [...dentro.querySelectorAll('button')].find((b) => b.textContent?.includes(texto))!;
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
  const marcar = (nombre: string, valor: boolean) => {
    const casilla = raiz.querySelector<HTMLInputElement>(`input[name="${nombre}"]`)!;
    casilla.checked = valor;
    casilla.dispatchEvent(new Event('change'));
  };

  const montar = async (permisos: string[], usuarios = USUARIOS) => {
    TestBed.configureTestingModule({
      imports: [Usuarios],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    entrarComo({ idSede: 1, permisos });
    fixture = TestBed.createComponent(Usuarios);
    await estable();
    raiz = fixture.nativeElement;
    http.expectOne('/api/v1/roles').flush(ROLES);
    http.expectOne('/api/v1/usuarios').flush(usuarios);
    http.expectOne('/api/v1/permisos').flush(PERMISOS);
    await estable();
  };

  afterEach(() => http.verify());

  it('lista a todos los usuarios con GET /usuarios (diferencia 14)', async () => {
    await montar(['SEGURIDAD:VER']);
    const filas = [...raiz.querySelectorAll('tbody tr')].map((f) => f.textContent);
    expect(filas).toHaveLength(2);
    expect(filas[1]).toContain('recepcion2');
    expect(filas[1]).toContain('RECEPCIONISTA');
  });

  it('sin permisos de escritura no ofrece crear, asignar ni guardar', async () => {
    await montar(['SEGURIDAD:VER']);
    expect(boton('Crear usuario')).toBeUndefined();
    expect(boton('Asignar rol')).toBeUndefined();
    await clic('Matriz de permisos');
    expect(boton('Guardar permisos')).toBeUndefined();
    expect(raiz.querySelector('tbody')?.textContent).toContain('SEGURIDAD');
  });

  it('CUS52: elige el personal sin usuario de la lista y registra el usuario', async () => {
    await montar(['SEGURIDAD:VER', 'SEGURIDAD:CREAR']);
    await clic('Crear usuario');
    http
      .expectOne('/api/v1/usuarios/personal-sin-usuario')
      .flush([{ idPersonal: 7, nombres: 'Lucía', apellidos: 'Ramos', cargo: 'ESPECIALISTA' }]);
    await estable();
    const opciones = [...raiz.querySelectorAll('#idPersonal option')].map((o) => o.textContent);
    expect(opciones[1]).toContain('Lucía Ramos · ESPECIALISTA');
    elegir('#idPersonal', 1);
    escribir('#nombreUsuario', 'lucia.ramos');
    escribir('#clave', 'ClaveTemporal2026');
    elegir('#idRol', 1);
    await enviar('app-modal form');
    const peticion = http.expectOne('/api/v1/usuarios');
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual({
      idPersonal: 7,
      nombreUsuario: 'lucia.ramos',
      clave: 'ClaveTemporal2026',
      idRol: 2,
    });
    peticion.flush({
      idUsuario: 9,
      idPersonal: 7,
      nombreUsuario: 'lucia.ramos',
      idRol: 2,
      estado: 'ACTIVO',
      debeCambiarClave: true,
    });
    await estable();
    expect(raiz.querySelector('app-modal')).toBeNull();
    expect(raiz.querySelector('tbody')?.textContent).toContain('lucia.ramos');
    expect(raiz.querySelector('tbody')?.textContent).toContain('Debe cambiar su clave');
  });

  it('no envía un usuario sin personal o con clave corta', async () => {
    await montar(['SEGURIDAD:VER', 'SEGURIDAD:CREAR']);
    await clic('Crear usuario');
    http.expectOne('/api/v1/usuarios/personal-sin-usuario').flush([]);
    escribir('#clave', 'corta');
    await enviar('app-modal form');
    http.expectNone('/api/v1/usuarios');
    expect(raiz.querySelector('app-modal .alert.bad')).not.toBeNull();
  });

  it('CUS53: asigna el rol desde la fila del usuario', async () => {
    await montar(['SEGURIDAD:VER', 'SEGURIDAD:EDITAR']);
    const fila = raiz.querySelectorAll('tbody tr')[1];
    const lista = fila.querySelector<HTMLSelectElement>('select')!;
    lista.selectedIndex = 0;
    boton('Asignar rol', fila).click();
    const peticion = http.expectOne('/api/v1/usuarios/5/rol');
    expect(peticion.request.method).toBe('PATCH');
    expect(peticion.request.body).toEqual({ idRol: 1 });
    peticion.flush({ ...USUARIOS[1], idRol: 1 });
    await estable();
    expect(raiz.querySelector('.alert.bad')).toBeNull();
  });

  it('RN48: no le quita el rol a la última administradora activa', async () => {
    await montar(['SEGURIDAD:VER', 'SEGURIDAD:EDITAR']);
    const fila = raiz.querySelectorAll('tbody tr')[0];
    fila.querySelector<HTMLSelectElement>('select')!.selectedIndex = 1;
    boton('Asignar rol', fila).click();
    await estable();
    http.expectNone('/api/v1/usuarios/1/rol');
    expect(raiz.querySelector('.alert.bad')?.textContent).toContain(MENSAJE_RN48_ROL);
  });

  it('CUS53: guarda los permisos del rol con las casillas de GET /permisos', async () => {
    await montar(['SEGURIDAD:VER', 'SEGURIDAD:EDITAR']);
    await clic('Matriz de permisos');
    elegir('#rolIdRol', 1);
    await estable();
    expect(raiz.querySelector<HTMLInputElement>('input[name="AGENDA:VER"]')!.checked).toBe(true);
    marcar('VENTAS:CREAR', true);
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

  it('RN48: no deja a la administradora sin los permisos de seguridad', async () => {
    await montar(['SEGURIDAD:VER', 'SEGURIDAD:EDITAR']);
    await clic('Matriz de permisos');
    marcar('SEGURIDAD:EDITAR', false);
    await enviar('form');
    http.expectNone('/api/v1/roles/1/permisos');
    expect(raiz.querySelector('.alert.bad')?.textContent).toContain(MENSAJE_RN48_PERMISOS);
  });

  it('CUS54: «Restablecer contraseña» pide la clave temporal dos veces', async () => {
    await montar(['SEGURIDAD:VER', 'SEGURIDAD:EDITAR']);
    raiz
      .querySelector<HTMLButtonElement>(
        'button[aria-label="Restablecer contraseña de recepcion2"]',
      )!
      .click();
    await estable();
    const modal = () => raiz.querySelector('app-restablecer-clave')!;
    expect(modal().textContent).toContain('recepcion2');
    escribir('#claveTemporal', 'corta');
    escribir('#claveTemporalRepetida', 'corta');
    await enviar('app-restablecer-clave form');
    expect(modal().querySelector('.alert.bad')?.textContent).toContain('8 a 72');
    escribir('#claveTemporal', 'Temporal2026');
    escribir('#claveTemporalRepetida', 'Temporal2027');
    await enviar('app-restablecer-clave form');
    expect(modal().querySelector('.alert.bad')?.textContent).toContain('no coinciden');
    http.expectNone('/api/v1/usuarios/5/clave');

    escribir('#claveTemporalRepetida', 'Temporal2026');
    await enviar('app-restablecer-clave form');
    const peticion = http.expectOne('/api/v1/usuarios/5/clave');
    expect(peticion.request.method).toBe('PATCH');
    expect(peticion.request.body).toEqual({ clave: 'Temporal2026' });
    peticion.flush({ ...USUARIOS[1], debeCambiarClave: true });
    await estable();
    expect(raiz.querySelector('app-restablecer-clave')).toBeNull();
    expect(raiz.querySelectorAll('tbody tr')[1].textContent).toContain('Debe cambiar su clave');
  });

  it('CUS54: sin SEGURIDAD:EDITAR no ofrece restablecer', async () => {
    await montar(['SEGURIDAD:VER']);
    expect(raiz.textContent).not.toContain('Restablecer contraseña');
  });

  it('CUS55: la pestaña «Auditoría» consulta con los usuarios de la página', async () => {
    await montar(['SEGURIDAD:VER']);
    await clic('Auditoría');
    const peticion = http.expectOne((req) => req.url === '/api/v1/auditoria');
    expect(peticion.request.params.get('fechaInicio')).toBeTruthy();
    peticion.flush([]);
    await estable();
    const usuarios = [...raiz.querySelectorAll('#auditoriaUsuario option')].map((o) =>
      o.textContent?.trim(),
    );
    expect(usuarios).toEqual(['Todos', 'admin', 'recepcion2']);
  });
});
