import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { TipoDocumentoDTO } from '../../../core/api/modelos.generados';
import { entrarComo } from '../../../../testing/sesion';
import { FichaClienteDTO } from '../../modelos/agenda.modelos';
import { FichaClienta } from './ficha-clienta';

const TIPOS: TipoDocumentoDTO[] = [
  {
    idTipoDocumento: 1,
    abreviatura: 'DNI',
    longitudMin: 8,
    longitudMax: 8,
    soloNumeros: true,
    consultaApi: true,
    estado: 'ACTIVO',
  },
  {
    idTipoDocumento: 4,
    abreviatura: 'PASAPORTE',
    longitudMin: 6,
    longitudMax: 12,
    soloNumeros: false,
    consultaApi: false,
    estado: 'ACTIVO',
  },
];
const FICHA: FichaClienteDTO = {
  cliente: {
    idCliente: 407,
    nombres: 'Rosaura',
    apellidos: 'Quispe',
    telefono: '987610001',
    correo: 'rosaura@correo.pe',
    idTipoDocumento: 1,
    numeroDocumento: '71234567',
    aceptaComunicaciones: true,
    origenDatos: 'VERIFICADO',
    estado: 'ACTIVO',
    fechaConsentimiento: '2026-11-09T10:00:00',
  },
  saldoFavor: 20,
  atenciones: [
    {
      idAtencion: 1532,
      estado: 'COBRADA',
      horaInicio: '2026-11-02T10:00:00',
      idPersonal: 4,
      idVariante: 2,
      nombreServicio: 'Tinte · Raíz',
      nombreEspecialista: 'Lucía Ramos',
      nombreRecurso: 'Sillón 1',
      recomendaciones: [
        {
          idRecomendacion: 8,
          idProducto: 41,
          nombreProducto: 'Mascarilla de color',
          observacion: 'Para mantener el color',
        },
      ],
    },
  ],
  citasPendientes: [
    {
      idCita: 951,
      idCliente: 407,
      idPersonal: 4,
      idRecurso: 1,
      idVariante: 2,
      nombreServicio: 'Corte de Cabello Caballero · Estándar',
      nombreEspecialista: 'Ana Torres',
      duracionMin: 30,
      estado: 'PENDIENTE',
      fechaHoraInicio: '2026-11-16T10:00:00',
    },
  ],
  paquetes: [
    {
      idClientePaquete: 5,
      idPaquete: 3,
      nombrePaquete: 'Tres cortes',
      estado: 'ACTIVO',
      sesionesTotales: 3,
      sesionesUsadas: 1,
      sesionesRestantes: 2,
      fechaVencimiento: '2027-01-31',
    },
  ],
  productosComprados: [
    {
      idProducto: 40,
      producto: 'Shampoo reparador',
      cantidad: 1,
      fecha: '2026-11-02',
      subtotal: 45,
      idVenta: 610,
    },
  ],
};

describe('FichaClienta (CUS03 y CUS04)', () => {
  let fixture: ComponentFixture<FichaClienta>;
  let raiz: HTMLElement;
  let http: HttpTestingController;

  const estable = () => fixture.whenStable();
  const boton = (texto: string) =>
    [...raiz.querySelectorAll('button')].find((b) => b.textContent?.includes(texto));
  const clic = async (texto: string) => {
    boton(texto)!.click();
    await estable();
  };
  const escribir = async (id: string, valor: string) => {
    const entrada = raiz.querySelector<HTMLInputElement>(`#${id}`)!;
    entrada.value = valor;
    entrada.dispatchEvent(new Event('input'));
    await estable();
  };
  const guardar = async () => {
    raiz.querySelector('form')!.dispatchEvent(new Event('submit'));
    await estable();
  };

  const montar = async (permisos: string[], ficha: FichaClienteDTO | null = FICHA) => {
    TestBed.configureTestingModule({
      imports: [FichaClienta],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ idCliente: '407' }) } },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    entrarComo({ idSede: 1, permisos });
    fixture = TestBed.createComponent(FichaClienta);
    await estable();
    raiz = fixture.nativeElement;
    http.expectOne('/api/v1/tipos-documento').flush(TIPOS);
    const peticion = http.expectOne('/api/v1/clientes/407');
    if (ficha) {
      peticion.flush(ficha);
    } else {
      peticion.flush(
        { detail: 'La clienta no existe', regla: 'RF02' },
        { status: 404, statusText: 'Not Found' },
      );
    }
    await estable();
  };

  afterEach(() => http.verify());

  const editar = ['CLIENTAS:VER', 'CLIENTAS:EDITAR'];

  it('CUS03: cabecera con nombre, documento verificado y saldo a favor', async () => {
    await montar(editar);
    expect(raiz.querySelector('h1')?.textContent).toBe('Rosaura Quispe');
    expect(raiz.textContent).toContain('DNI verificado');
    expect(raiz.querySelector('#saldoFavor')?.textContent).toBe('S/ 20.00');
    expect(raiz.querySelector<HTMLInputElement>('#fichaTelefono')?.value).toBe('987610001');
  });

  it('CUS03: historial con citas pendientes, servicios, recomendaciones y compras', async () => {
    await montar(editar);
    await clic('Historial');
    const texto = raiz.textContent ?? '';
    expect(texto).toContain('16/11/2026 10:00');
    expect(texto).toContain('Pendiente');
    expect(texto).toContain('02/11/2026 10:00');
    expect(texto).toContain('Cobrada');
    // La recomendación trae el nombre del producto (It. 2.1), aunque no lo haya comprado.
    expect(texto).toContain('Mascarilla de color');
    expect(texto).toContain('Para mantener el color');
    expect(texto).toContain('Shampoo reparador');
    expect(raiz.querySelector('tbody tr')?.textContent).toContain('S/ 45.00');
  });

  it('It. 2.1: el historial nombra servicio y especialista; nunca sus ids', async () => {
    await montar(editar);
    await clic('Historial');
    const texto = raiz.textContent ?? '';
    expect(texto).toContain('Tinte · Raíz');
    expect(texto).toContain('Lucía Ramos');
    expect(texto).toContain('Corte de Cabello Caballero · Estándar');
    expect(texto).toContain('Ana Torres');
    expect(texto).not.toMatch(/Variante 2|Especialista 4|Producto 41/);
  });

  it('CUS03: paquetes con sesiones (RN36) y saldo a favor', async () => {
    await montar(editar);
    await clic('Paquetes y membresías');
    expect(raiz.textContent).toContain('Tres cortes');
    expect(raiz.textContent).not.toContain('Paquete 3');
    expect(raiz.textContent).toContain('2 disponibles');
    expect(raiz.textContent).toContain('1 de 3 sesiones usadas');
    expect(raiz.textContent).toContain('31/01/2027');
    await clic('Saldo a favor');
    expect(raiz.textContent).toContain('RN05');
  });

  it('CUS04: «Guardar cambios» envía la ficha editada con PUT', async () => {
    await montar(editar);
    await escribir('fichaTelefono', '987610002');
    await escribir('fichaObservaciones', 'Alérgica al tinte');
    await guardar();
    const peticion = http.expectOne('/api/v1/clientes/407');
    expect(peticion.request.method).toBe('PUT');
    expect(peticion.request.body).toEqual({
      idTipoDocumento: 1,
      numeroDocumento: '71234567',
      nombres: 'Rosaura',
      apellidos: 'Quispe',
      telefono: '987610002',
      correo: 'rosaura@correo.pe',
      observaciones: 'Alérgica al tinte',
      aceptaComunicaciones: true,
    });
    peticion.flush({ ...FICHA.cliente, telefono: '987610002' });
    await estable();
    expect(raiz.querySelector('.alert.bad')).toBeNull();
    expect(raiz.querySelector('h1')?.textContent).toBe('Rosaura Quispe');
  });

  it('CUS04: un documento nuevo consultado se envía con su fecha de verificación', async () => {
    await montar(editar);
    await escribir('fichaNumeroDocumento', '71234568');
    await clic('Consultar documento');
    http
      .expectOne('/api/v1/clientes/consulta-documento?idTipoDocumento=1&numeroDocumento=71234568')
      .flush({
        resultado: 'ENCONTRADO',
        nombres: 'Rosaura Inés',
        apellidos: 'Quispe Rojas',
        fechaVerificacion: '2026-11-10T10:15:00',
      });
    await estable();
    expect(raiz.querySelector('.alert.ok')?.textContent).toContain('DNI verificado');
    await guardar();
    const peticion = http.expectOne('/api/v1/clientes/407');
    expect(peticion.request.body).toMatchObject({
      numeroDocumento: '71234568',
      nombres: 'Rosaura Inés',
      apellidos: 'Quispe Rojas',
      fechaVerificacion: '2026-11-10T10:15:00',
    });
    peticion.flush({ ...FICHA.cliente });
    await estable();
  });

  it('CUS04: un documento con formato incorrecto no se envía', async () => {
    await montar(editar);
    await escribir('fichaNumeroDocumento', '123');
    await guardar();
    http.expectNone((req) => req.method === 'PUT');
    expect(raiz.querySelector('.alert.bad')?.textContent).toContain('formato correcto');
  });

  it('CUS04: el 409 queda junto al formulario', async () => {
    await montar(editar);
    await guardar();
    http
      .expectOne('/api/v1/clientes/407')
      .flush(
        { detail: 'El teléfono o el documento ya pertenecen a otra ficha', regla: 'RF05' },
        { status: 409, statusText: 'Conflict' },
      );
    await estable();
    expect(raiz.querySelector('.alert.bad')?.textContent).toContain('ya pertenecen a otra ficha');
  });

  it('sin CLIENTAS:EDITAR la ficha se ve sin editar', async () => {
    await montar(['CLIENTAS:VER']);
    expect(boton('Guardar cambios')).toBeUndefined();
    expect(boton('Consultar documento')).toBeUndefined();
    expect(raiz.querySelector<HTMLInputElement>('#fichaNombres')?.disabled).toBe(true);
  });

  it('muestra el 404 de una clienta que no existe', async () => {
    await montar(['CLIENTAS:VER'], null);
    expect(raiz.querySelector('.alert.bad')?.textContent).toContain('La clienta no existe');
    await clic('Reintentar');
    http.expectOne('/api/v1/clientes/407').flush(FICHA);
    await estable();
    expect(raiz.querySelector('h1')?.textContent).toBe('Rosaura Quispe');
  });
});
