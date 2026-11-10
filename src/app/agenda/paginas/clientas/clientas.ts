import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { merge } from 'rxjs';
import { ListasService } from '../../../core/api/listas.service';
import { TipoDocumentoDTO } from '../../../core/api/modelos.generados';
import { mensajeDelProblema } from '../../../core/api/problema';
import { numeroDocumentoValido, tiposActivos } from '../../../core/api/documentos';
import { NotificacionesService } from '../../../core/notificaciones/notificaciones.service';
import { PERMISOS } from '../../../core/sesion/permisos';
import { SesionService } from '../../../core/sesion/sesion.service';
import { Modal } from '../../../layout/modal/modal';
import { ClienteDTO } from '../../modelos/agenda.modelos';
import { ClientesService } from '../../servicios/clientes.service';

/** IGU_Clientas: CUS01 Buscar Clienta y CUS02 Registrar Clienta. */
@Component({
  selector: 'app-clientas',
  imports: [ReactiveFormsModule, Modal],
  templateUrl: './clientas.html',
})
export class Clientas implements OnInit {
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly destroyRef = inject(DestroyRef);
  private readonly notificaciones = inject(NotificacionesService);
  private readonly servicio = inject(ClientesService);
  private readonly sesion = inject(SesionService);
  private readonly listas = inject(ListasService);

  /** GET /tipos-documento (CUS65), en lugar de los id fijos (Duda 5 de NOTAS_IT1). */
  protected readonly tipos = signal<TipoDocumentoDTO[]>([]);
  protected readonly clientas = signal<ClienteDTO[]>([]);
  protected readonly modalAbierto = signal(false);
  protected readonly enviando = signal(false);
  protected readonly consultando = signal(false);
  protected readonly errorRegistro = signal<string | null>(null);
  protected readonly avisoConsulta = signal<{ texto: string; ok: boolean } | null>(null);
  /** Solo la trae una consulta con ENCONTRADO: es lo que deja la ficha como verificada. */
  protected readonly fechaVerificacion = signal<string | null>(null);

  protected readonly puedeRegistrar = computed(() =>
    this.sesion.tienePermiso(PERMISOS.clientasCrear),
  );

  protected readonly busqueda = this.fb.group({ texto: [''] });
  protected readonly formulario = this.fb.group({
    idTipoDocumento: [null as number | null],
    numeroDocumento: ['', Validators.maxLength(15)],
    nombres: ['', [Validators.required, Validators.maxLength(80)]],
    apellidos: ['', Validators.maxLength(80)],
    telefono: ['', [Validators.required, Validators.maxLength(15)]],
    correo: ['', [Validators.email, Validators.maxLength(100)]],
    fechaCumpleanos: [''],
    observaciones: ['', Validators.maxLength(300)],
    consentimiento: [false, Validators.requiredTrue],
    aceptaComunicaciones: [false],
  });

  ngOnInit(): void {
    const { idTipoDocumento, numeroDocumento } = this.formulario.controls;
    // Otro documento ya no es el que se verificó: hay que volver a consultarlo.
    merge(idTipoDocumento.valueChanges, numeroDocumento.valueChanges)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.fechaVerificacion.set(null);
        this.avisoConsulta.set(null);
      });
    this.listas.tiposDocumento().subscribe((tipos) => this.tipos.set(tipos));
    this.buscar();
  }

  protected tipoElegido(): TipoDocumentoDTO | undefined {
    return this.tipo(this.formulario.controls.idTipoDocumento.value);
  }

  protected tiposOfrecidos(): TipoDocumentoDTO[] {
    return tiposActivos(this.tipos());
  }

  protected abreviatura(idTipoDocumento?: number): string {
    return this.tipo(idTipoDocumento)?.abreviatura ?? 'Documento';
  }

  private tipo(id: number | null | undefined): TipoDocumentoDTO | undefined {
    return this.tipos().find((tipo) => tipo.idTipoDocumento === id);
  }

  protected iniciales(clienta: ClienteDTO): string {
    return [clienta.nombres, clienta.apellidos]
      .map((parte) => parte?.charAt(0).toUpperCase() ?? '')
      .join('');
  }

  protected buscar(): void {
    const texto = this.busqueda.getRawValue().texto.trim();
    const esTelefono = /^[\d\s+-]+$/.test(texto);
    this.servicio
      .buscar(esTelefono ? { telefono: texto.replace(/\s/g, '') } : { nombres: texto })
      .subscribe((clientas) => this.clientas.set(clientas));
  }

  protected abrirRegistro(): void {
    this.formulario.reset();
    this.errorRegistro.set(null);
    this.modalAbierto.set(true);
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
          // Un RUC trae razón social, y la ficha guarda ese nombre en nombres.
          this.formulario.patchValue({
            nombres: resultado.nombres ?? resultado.razonSocial ?? '',
            apellidos: resultado.apellidos ?? '',
          });
          this.fechaVerificacion.set(resultado.fechaVerificacion ?? null);
          this.avisoConsulta.set({ texto: `${abreviatura} verificado.`, ok: true });
        } else {
          this.avisarFicha(abreviatura);
        }
      },
      error: (error: HttpErrorResponse) => {
        this.consultando.set(false);
        if (error.status !== 401 && error.status !== 403) {
          this.avisarFicha(abreviatura);
        }
      },
    });
  }

  protected registrar(): void {
    const mensaje = this.validarRegistro();
    if (mensaje) {
      this.errorRegistro.set(mensaje);
      return;
    }
    this.errorRegistro.set(null);
    this.enviando.set(true);
    this.servicio.registrar(this.cuerpoRegistro()).subscribe({
      next: (clienta) => {
        this.enviando.set(false);
        this.clientas.update((clientas) => [clienta, ...clientas]);
        this.modalAbierto.set(false);
        this.notificaciones.mostrar('Clienta registrada.');
      },
      error: (error: HttpErrorResponse) => {
        this.enviando.set(false);
        // El 409 también lo avisa el interceptor; aquí queda a la vista mientras se corrige.
        if (error.status === 400 || error.status === 409) {
          this.errorRegistro.set(mensajeDelProblema(error, 'Revisa los datos de la clienta.'));
        }
      },
    });
  }

  private avisarFicha(abreviatura: string): void {
    this.avisoConsulta.set({
      texto: `No se pudo verificar el ${abreviatura}. Completa los datos a mano: la ficha quedará ingresada a mano.`,
      ok: false,
    });
  }

  private validarRegistro(): string | null {
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
    if (controls.consentimiento.invalid) {
      return 'Sin el consentimiento de la clienta no se puede guardar la ficha (RN27).';
    }
    return this.formulario.invalid ? 'Revisa el correo y las observaciones.' : null;
  }

  private cuerpoRegistro(): ClienteDTO {
    const valor = this.formulario.getRawValue();
    const documento = valor.idTipoDocumento
      ? { idTipoDocumento: valor.idTipoDocumento, numeroDocumento: valor.numeroDocumento.trim() }
      : {};
    return {
      ...documento,
      ...opcional('apellidos', valor.apellidos),
      ...opcional('correo', valor.correo),
      ...opcional('fechaCumpleanos', valor.fechaCumpleanos),
      ...opcional('observaciones', valor.observaciones),
      ...opcional('fechaVerificacion', this.fechaVerificacion()),
      nombres: valor.nombres,
      telefono: valor.telefono,
      aceptaComunicaciones: valor.aceptaComunicaciones,
    };
  }
}

function opcional<K extends keyof ClienteDTO>(campo: K, valor: string | null) {
  return valor ? { [campo]: valor } : {};
}
