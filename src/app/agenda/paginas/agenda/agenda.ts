import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NotificacionesService } from '../../../core/notificaciones/notificaciones.service';
import { PERMISOS } from '../../../core/sesion/permisos';
import { SesionService } from '../../../core/sesion/sesion.service';
import {
  CitaDTO,
  FiltrosAgendaDTO,
  FranjaAgendaDTO,
  ListaEsperaDTO,
} from '../../modelos/agenda.modelos';
import {
  claseEstado,
  etiquetaEstado,
  horaDe,
  hoyIso,
  minutosDelDia,
  nombreEspecialista,
  ordenarPorInicio,
  tituloBloque,
} from '../../modelos/agenda.vista';
import { CitasService } from '../../servicios/citas.service';
import { AdelantoCita } from './adelanto-cita';
import { ListaEspera } from './lista-espera';
import { NuevaCita, PedidoEspera } from './nueva-cita';

type Vista = 'especialista' | 'recurso';

const HORA_APERTURA = 9;
const HORA_CIERRE = 20;
const PX_POR_MINUTO = 1;

/** IGU_Agenda: CUS05, CUS06, CUS07 y CUS08. */
@Component({
  selector: 'app-agenda',
  imports: [ReactiveFormsModule, AdelantoCita, NuevaCita, ListaEspera],
  templateUrl: './agenda.html',
  styleUrl: './agenda.css',
})
export class Agenda implements OnInit {
  private readonly notificaciones = inject(NotificacionesService);
  private readonly servicio = inject(CitasService);
  protected readonly sesion = inject(SesionService);

  protected readonly horaDe = horaDe;
  protected readonly etiquetaEstado = etiquetaEstado;
  protected readonly claseEstado = claseEstado;
  protected readonly tituloBloque = tituloBloque;
  protected readonly nombreEspecialista = nombreEspecialista;

  protected readonly vista = signal<Vista>('especialista');
  protected readonly bloques = signal<FranjaAgendaDTO[]>([]);
  protected readonly fechaVista = signal(hoyIso());
  /** Especialistas y recursos de la sede, de GET /citas/filtros. */
  protected readonly opciones = signal<FiltrosAgendaDTO>({ especialistas: [], recursos: [] });
  protected readonly modalCita = signal(false);
  protected readonly pedidoEspera = signal<PedidoEspera | null>(null);
  /** El contrato no tiene lista de espera: solo se ven las anotadas en esta pantalla. */
  protected readonly esperas = signal<ListaEsperaDTO[]>([]);

  protected readonly puedeCrear = computed(() => this.sesion.tienePermiso(PERMISOS.agendaCrear));
  protected readonly puedeCobrarAdelanto = computed(() =>
    this.sesion.tienePermiso(PERMISOS.agendaEditar),
  );
  /** Cita recién agendada, para ofrecer su adelanto sin buscarla en la rejilla. */
  protected readonly citaNueva = signal<CitaDTO | null>(null);
  /** undefined: cerrado; null: abierto sin cita elegida, se escribe el código. */
  protected readonly citaAdelanto = signal<number | null | undefined>(undefined);
  protected readonly ocupados = computed(() =>
    ordenarPorInicio(this.bloques().filter((b) => b.franja === 'OCUPADA')),
  );
  protected readonly horas = computed(() => {
    const finales = this.ocupados().map((b) => Math.ceil(minutosDelDia(b.fin) / 60));
    const iniciales = this.ocupados().map((b) => Math.floor(minutosDelDia(b.inicio) / 60));
    const desde = Math.min(HORA_APERTURA, ...iniciales);
    const hasta = Math.max(HORA_CIERRE, ...finales);
    return Array.from({ length: hasta - desde }, (_, i) => desde + i);
  });
  protected readonly columnas = computed(() => {
    const clave = this.clave();
    const ids = new Set<number>();
    this.bloques().forEach((b) => {
      const id = b[clave];
      if (id !== undefined) {
        ids.add(id);
      }
    });
    return [...ids]
      .sort((a, b) => a - b)
      .map((id) => ({
        id,
        titulo: this.vista() === 'especialista' ? this.especialista(id) : this.recurso(id),
        bloques: this.ocupados().filter((b) => b[clave] === id),
      }));
  });

  protected readonly filtros = inject(FormBuilder).nonNullable.group({
    fecha: [hoyIso(), Validators.required],
    idPersonal: [null as number | null],
    idRecurso: [null as number | null],
  });

  ngOnInit(): void {
    this.servicio.listarFiltros().subscribe((opciones) =>
      this.opciones.set({
        especialistas: opciones.especialistas ?? [],
        recursos: opciones.recursos ?? [],
      }),
    );
    this.verAgenda();
  }

  /** Nombre de la especialista: el de la franja o el de los filtros. */
  protected especialista(id?: number): string {
    const deFiltro = this.opciones().especialistas?.find((e) => e.idPersonal === id);
    if (deFiltro) {
      return nombreEspecialista(deFiltro);
    }
    const deFranja = this.bloques().find((b) => b.idPersonal === id && b.nombreEspecialista);
    return deFranja?.nombreEspecialista ?? `Especialista ${id ?? ''}`;
  }

  /** Servicio y, según la vista, el recurso o la especialista; en móvil, los dos. */
  protected detalle(bloque: FranjaAgendaDTO, completo = false): string {
    const servicio = bloque.nombreServicio || `Variante ${bloque.idVariante}`;
    const especialista = bloque.nombreEspecialista || this.especialista(bloque.idPersonal);
    const recurso = this.recurso(bloque.idRecurso);
    if (completo) {
      return [servicio, especialista, recurso].join(' · ');
    }
    return [servicio, this.vista() === 'especialista' ? recurso : especialista].join(' · ');
  }

  protected recurso(id?: number): string {
    return (
      this.opciones().recursos?.find((r) => r.idRecurso === id)?.nombre ?? `Recurso ${id ?? ''}`
    );
  }

  protected verAgenda(): void {
    const { fecha, idPersonal, idRecurso } = this.filtros.getRawValue();
    if (!fecha) {
      return;
    }
    this.servicio
      .consultarAgenda({
        fecha,
        ...(idPersonal ? { idPersonal } : {}),
        ...(idRecurso ? { idRecurso } : {}),
      })
      .subscribe((bloques) => {
        this.bloques.set(bloques);
        this.fechaVista.set(fecha);
      });
  }

  protected fechaLarga(): string {
    return new Intl.DateTimeFormat('es-PE', { dateStyle: 'full' }).format(
      new Date(`${this.fechaVista()}T12:00:00`),
    );
  }

  protected superior(bloque: FranjaAgendaDTO): number {
    return (minutosDelDia(bloque.inicio) - this.horas()[0] * 60) * PX_POR_MINUTO;
  }

  /** Hasta finServicio: la limpieza no ocupa a la especialista (RN03). */
  protected altura(bloque: FranjaAgendaDTO): number {
    return (minutosDelDia(finServicio(bloque)) - minutosDelDia(bloque.inicio)) * PX_POR_MINUTO;
  }

  /** Minutos de limpieza: solo se pintan en la columna del recurso. */
  protected limpieza(bloque: FranjaAgendaDTO): number {
    if (this.vista() !== 'recurso') {
      return 0;
    }
    return Math.max(0, minutosDelDia(bloque.fin) - minutosDelDia(finServicio(bloque)));
  }

  protected superiorLimpieza(bloque: FranjaAgendaDTO): number {
    return this.superior(bloque) + this.altura(bloque);
  }

  protected abrirEspera(pedido?: PedidoEspera): void {
    this.modalCita.set(false);
    this.pedidoEspera.set(
      pedido ?? { clienta: null, idVariante: null, fecha: this.filtros.controls.fecha.value },
    );
  }

  protected citaAgendada(cita: CitaDTO): void {
    this.modalCita.set(false);
    this.citaNueva.set(cita);
    this.notificaciones.mostrar(`Cita ${cita.idCita} agendada.`);
    if (cita.fechaHoraInicio.startsWith(this.fechaVista())) {
      this.verAgenda();
    }
  }

  protected tieneAdelanto(bloque: FranjaAgendaDTO): boolean {
    return bloque.origen === 'CITA' && bloque.estado === 'PENDIENTE';
  }

  protected adelantoRegistrado(cita: CitaDTO): void {
    this.citaAdelanto.set(undefined);
    if (this.citaNueva()?.idCita === cita.idCita) {
      this.citaNueva.set(null);
    }
    this.notificaciones.mostrar(`Adelanto registrado en la cita ${cita.idCita}.`);
  }

  protected esperaAnotada(espera: ListaEsperaDTO): void {
    this.pedidoEspera.set(null);
    this.esperas.update((esperas) => [espera, ...esperas]);
    this.notificaciones.mostrar('Clienta anotada en la lista de espera.');
  }

  private clave(): 'idPersonal' | 'idRecurso' {
    return this.vista() === 'especialista' ? 'idPersonal' : 'idRecurso';
  }
}

function finServicio(bloque: FranjaAgendaDTO): string | undefined {
  return bloque.finServicio ?? bloque.fin;
}
