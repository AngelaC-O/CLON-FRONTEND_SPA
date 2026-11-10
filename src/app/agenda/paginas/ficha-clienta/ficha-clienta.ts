import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { merge } from 'rxjs';
import { numeroDocumentoValido, tiposActivos } from '../../../core/api/documentos';
import { ListasService } from '../../../core/api/listas.service';
import { TipoDocumentoDTO } from '../../../core/api/modelos.generados';
import { soles } from '../../../core/api/moneda';
import { mensajeDelProblema } from '../../../core/api/problema';
import { NotificacionesService } from '../../../core/notificaciones/notificaciones.service';
import { PERMISOS } from '../../../core/sesion/permisos';
import { SesionService } from '../../../core/sesion/sesion.service';
import { ClienteDTO, FichaClienteDTO, PaqueteFicha } from '../../modelos/agenda.modelos';
import { claseEstado, etiquetaEstado, fechaCorta } from '../../modelos/agenda.vista';
import { ClientesService } from '../../servicios/clientes.service';

type Pestana = 'datos' | 'historial' | 'paquetes' | 'saldo';

const ESTADO_PAQUETE: Record<string, { texto: string; clase: string }> = {
  ACTIVO: { texto: 'Activo', clase: 'ok' },
  AGOTADO: { texto: 'Agotado', clase: '' },
  VENCIDO: { texto: 'Vencido', clase: 'warn' },
  ANULADO: { texto: 'Anulado', clase: 'bad' },
};

/**
 * IGU_Clientas, nodo 4:41: CUS03 Consultar Ficha de Clienta («Ver ficha») y CUS04 Actualizar
 * Clienta («Guardar cambios», con «Consultar documento» como en CUS02). Solo llama a
 * GET y PUT /clientes/{idCliente}, a la consulta del documento y a la lista de tipos de documento.
 */
@Component({
  selector: 'app-ficha-clienta',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './ficha-clienta.html',
})
export class FichaClienta implements OnInit {
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly destroyRef = inject(DestroyRef);
  private readonly notificaciones = inject(NotificacionesService);
  private readonly servicio = inject(ClientesService);
  private readonly sesion = inject(SesionService);
  private readonly listas = inject(ListasService);
  private readonly ruta = inject(ActivatedRoute);

  protected readonly soles = soles;
  protected readonly fechaCorta = fechaCorta;
  protected readonly etiquetaEstado = etiquetaEstado;
  protected readonly claseEstado = claseEstado;

  protected readonly ficha = signal<FichaClienteDTO | null>(null);
  protected readonly cargando = signal(true);
  protected readonly errorCarga = signal<string | null>(null);
  protected readonly pestana = signal<Pestana>('datos');
  protected readonly tipos = signal<TipoDocumentoDTO[]>([]);
  protected readonly enviando = signal(false);
  protected readonly consultando = signal(false);
  protected readonly errorEdicion = signal<string | null>(null);
  protected readonly avisoConsulta = signal<{ texto: string; ok: boolean } | null>(null);
  /** Solo la trae una consulta ENCONTRADO en esta edición: sin ella, un documento nuevo queda MANUAL. */
  protected readonly fechaVerificacion = signal<string | null>(null);

  protected readonly puedeEditar = computed(() =>
    this.sesion.tienePermiso(PERMISOS.clientasEditar),
  );
  protected readonly cliente = computed(() => this.ficha()?.cliente ?? null);
  protected readonly pestanas: { id: Pestana; texto: string }[] = [
    { id: 'datos', texto: 'Datos' },
    { id: 'historial', texto: 'Historial' },
    { id: 'paquetes', texto: 'Paquetes y membresías' },
    { id: 'saldo', texto: 'Saldo a favor' },
  ];

  protected readonly formulario = this.fb.group({
    idTipoDocumento: [null as number | null],
    numeroDocumento: ['', Validators.maxLength(15)],
    nombres: ['', [Validators.required, Validators.maxLength(80)]],
    apellidos: ['', Validators.maxLength(80)],
    telefono: ['', [Validators.required, Validators.maxLength(15)]],
    correo: ['', [Validators.email, Validators.maxLength(100)]],
    fechaCumpleanos: [''],
    observaciones: ['', Validators.maxLength(300)],
    aceptaComunicaciones: [false],
  });

  private idCliente = 0;

  ngOnInit(): void {
    this.idCliente = Number(this.ruta.snapshot.paramMap.get('idCliente'));
    const { idTipoDocumento, numeroDocumento } = this.formulario.controls;
    // Otro documento ya no es el que se verificó: hay que volver a consultarlo.
    merge(idTipoDocumento.valueChanges, numeroDocumento.valueChanges)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.fechaVerificacion.set(null);
        this.avisoConsulta.set(null);
      });
    this.listas.tiposDocumento().subscribe((tipos) => this.tipos.set(tipos));
    this.cargar();
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.errorCarga.set(null);
    this.servicio.obtenerFicha(this.idCliente).subscribe({
      next: (ficha) => {
        this.ficha.set(ficha);
        this.cargando.set(false);
        this.llenarFormulario(ficha.cliente);
      },
      error: (error: HttpErrorResponse) => {
        this.cargando.set(false);
        if (error.status === 404 || error.status === 400) {
          this.errorCarga.set(mensajeDelProblema(error, 'La clienta no existe.'));
        } else if (error.status !== 401 && error.status !== 403) {
          this.errorCarga.set('No se pudo cargar la ficha.');
        }
      },
    });
  }

  protected nombreCompleto(cliente: ClienteDTO): string {
    return [cliente.nombres, cliente.apellidos].filter(Boolean).join(' ');
  }

  protected iniciales(cliente: ClienteDTO): string {
    return [cliente.nombres, cliente.apellidos]
      .map((parte) => parte?.charAt(0).toUpperCase() ?? '')
      .join('');
  }

  protected abreviatura(idTipoDocumento?: number): string {
    return this.tipo(idTipoDocumento)?.abreviatura ?? 'Documento';
  }

  protected tipoElegido(): TipoDocumentoDTO | undefined {
    return this.tipo(this.formulario.controls.idTipoDocumento.value);
  }

  /** Los tipos activos y, si la ficha ya tiene uno inactivo, también ese. */
  protected tiposOfrecidos(): TipoDocumentoDTO[] {
    const activos = tiposActivos(this.tipos());
    const actual = this.tipo(this.cliente()?.idTipoDocumento);
    return actual && !activos.includes(actual) ? [...activos, actual] : activos;
  }

  /** La recomendación trae el id del producto; el nombre, si la clienta lo compró. */
  protected producto(idProducto: number): string {
    const comprado = this.ficha()?.productosComprados?.find((p) => p.idProducto === idProducto);
    return comprado?.producto ?? `Producto ${idProducto}`;
  }

  protected estadoPaquete(paquete: PaqueteFicha): { texto: string; clase: string } {
    return ESTADO_PAQUETE[paquete.estado ?? ''] ?? { texto: paquete.estado ?? '', clase: '' };
  }

  protected consultarDocumento(): void {
    const tipo = this.tipoElegido();
    const numero = this.formulario.controls.numeroDocumento.value.trim();
    if (
      !tipo?.consultaApi ||
      tipo.idTipoDocumento === undefined ||
      !numeroDocumentoValido(tipo, numero)
    ) {
      this.avisoConsulta.set({
        texto: `El ${tipo?.abreviatura ?? 'documento'} no tiene el formato correcto.`,
        ok: false,
      });
      return;
    }
    this.consultando.set(true);
    const abreviatura = tipo.abreviatura ?? 'documento';
    this.servicio.consultarDocumento(tipo.idTipoDocumento, numero).subscribe({
      next: (resultado) => {
        this.consultando.set(false);
        if (resultado.resultado === 'ENCONTRADO') {
          this.formulario.patchValue({
            nombres: resultado.nombres ?? resultado.razonSocial ?? '',
            apellidos: resultado.apellidos ?? '',
          });
          this.fechaVerificacion.set(resultado.fechaVerificacion ?? null);
          this.avisoConsulta.set({
            texto: `${abreviatura} verificado. Guarda los cambios.`,
            ok: true,
          });
        } else {
          this.avisarManual(abreviatura);
        }
      },
      error: (error: HttpErrorResponse) => {
        this.consultando.set(false);
        if (error.status !== 401 && error.status !== 403) {
          this.avisarManual(abreviatura);
        }
      },
    });
  }

  protected guardar(): void {
    const mensaje = this.validar();
    if (mensaje) {
      this.errorEdicion.set(mensaje);
      return;
    }
    this.errorEdicion.set(null);
    this.enviando.set(true);
    this.servicio.actualizar(this.idCliente, this.cuerpo()).subscribe({
      next: (cliente) => {
        this.enviando.set(false);
        this.ficha.update((ficha) => (ficha ? { ...ficha, cliente } : ficha));
        this.llenarFormulario(cliente);
        this.notificaciones.mostrar('Cambios guardados.');
      },
      error: (error: HttpErrorResponse) => {
        this.enviando.set(false);
        // El 409 y el 422 también los avisa el interceptor; aquí quedan junto al formulario.
        if ([400, 404, 409, 422].includes(error.status)) {
          this.errorEdicion.set(mensajeDelProblema(error, 'Revisa los datos de la clienta.'));
        }
      },
    });
  }

  private tipo(id: number | null | undefined): TipoDocumentoDTO | undefined {
    return this.tipos().find((tipo) => tipo.idTipoDocumento === id);
  }

  private llenarFormulario(cliente: ClienteDTO | undefined): void {
    if (!cliente) {
      return;
    }
    this.formulario.reset({
      idTipoDocumento: cliente.idTipoDocumento ?? null,
      numeroDocumento: cliente.numeroDocumento ?? '',
      nombres: cliente.nombres ?? '',
      apellidos: cliente.apellidos ?? '',
      telefono: cliente.telefono ?? '',
      correo: cliente.correo ?? '',
      fechaCumpleanos: cliente.fechaCumpleanos ?? '',
      observaciones: cliente.observaciones ?? '',
      aceptaComunicaciones: cliente.aceptaComunicaciones ?? false,
    });
    if (!this.puedeEditar()) {
      this.formulario.disable();
    }
    this.fechaVerificacion.set(null);
    this.avisoConsulta.set(null);
  }

  private avisarManual(abreviatura: string): void {
    this.avisoConsulta.set({
      texto: `No se pudo verificar el ${abreviatura}. Si guardas, la ficha quedará ingresada a mano.`,
      ok: false,
    });
  }

  private validar(): string | null {
    const { controls } = this.formulario;
    if (controls.nombres.invalid || controls.telefono.invalid) {
      return 'Nombre y teléfono son obligatorios.';
    }
    const tipo = this.tipoElegido();
    const numero = controls.numeroDocumento.value.trim();
    if (numero && !tipo) {
      return 'Elige el tipo de documento.';
    }
    if (tipo && !numeroDocumentoValido(tipo, numero)) {
      return `El ${tipo.abreviatura ?? 'documento'} no tiene el formato correcto.`;
    }
    return this.formulario.invalid ? 'Revisa el correo y las observaciones.' : null;
  }

  private cuerpo(): ClienteDTO {
    const valor = this.formulario.getRawValue();
    const documento = valor.idTipoDocumento
      ? { idTipoDocumento: valor.idTipoDocumento, numeroDocumento: valor.numeroDocumento.trim() }
      : {};
    return {
      ...documento,
      ...opcional('apellidos', valor.apellidos.trim()),
      ...opcional('correo', valor.correo.trim()),
      ...opcional('fechaCumpleanos', valor.fechaCumpleanos),
      ...opcional('observaciones', valor.observaciones.trim()),
      ...opcional('fechaVerificacion', this.fechaVerificacion()),
      nombres: valor.nombres.trim(),
      telefono: valor.telefono.trim(),
      aceptaComunicaciones: valor.aceptaComunicaciones,
    };
  }
}

function opcional<K extends keyof ClienteDTO>(campo: K, valor: string | null) {
  return valor ? { [campo]: valor } : {};
}
