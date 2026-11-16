import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Modal } from '../../../layout/modal/modal';
import { soles } from '../../../core/api/moneda';
import { nombreO, numero } from '../../../core/api/nombres';
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
  fechaCorta,
  horaDe,
  hoyIso,
  minutosDelDia,
  nombreEspecialista,
  ordenarPorInicio,
  tituloBloque,
} from '../../modelos/agenda.vista';
import { CitasService } from '../../servicios/citas.service';
import { AdelantoCita } from './adelanto-cita';
import { CancelarCita } from './cancelar-cita';
import { ListaEspera } from './lista-espera';
import { NuevaCita, PedidoEspera } from './nueva-cita';
import { ReprogramarCita } from './reprogramar-cita';

type Vista = 'especialista' | 'recurso';
type Accion = 'detalle' | 'reprogramar' | 'cancelar';

const HORA_APERTURA = 9;
const HORA_CIERRE = 20;
const PX_POR_MINUTO = 1;

/**
 * IGU_Agenda: CUS05 a CUS10. El detalle de una cita ofrece «Reprogramar» (CUS09) y «Cancelar cita»
 * (CUS10); el panel «Lista de espera» lista las esperas del día (CUS06) para programarlas o
 * descartarlas.
 */
@Component({
  selector: 'app-agenda',
  imports: [
    ReactiveFormsModule,
    Modal,
    AdelantoCita,
    CancelarCita,
    NuevaCita,
    ListaEspera,
    ReprogramarCita,
  ],
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
  protected readonly fechaCorta = fechaCorta;
  protected readonly soles = soles;
  protected readonly nombreO = nombreO;
  protected readonly numero = numero;
  protected readonly nombreSede = computed(() => nombreO(this.sesion.sesion()?.nombreSede));

  protected readonly vista = signal<Vista>('especialista');
  protected readonly bloques = signal<FranjaAgendaDTO[]>([]);
  protected readonly fechaVista = signal(hoyIso());
  /** Especialistas y recursos de la sede, de GET /citas/filtros. */
  protected readonly opciones = signal<FiltrosAgendaDTO>({ especialistas: [], recursos: [] });
  protected readonly modalCita = signal(false);
  protected readonly pedidoEspera = signal<PedidoEspera | null>(null);
  /** Esperas PENDIENTES del día de la vista, de GET /citas/lista-espera. */
  protected readonly esperas = signal<ListaEsperaDTO[]>([]);
  /** Espera que «Programar» convierte en cita (CUS05 con idEspera). */
  protected readonly esperaAProgramar = signal<ListaEsperaDTO | null>(null);
  protected readonly esperaPorDescartar = signal<ListaEsperaDTO | null>(null);
  protected readonly descartando = signal(false);
  /** La recién anotada, con las otras horas libres que se le pueden ofrecer. */
  protected readonly ultimaAnotada = signal<ListaEsperaDTO | null>(null);
  /** Cita abierta desde la rejilla y lo que se hace con ella. */
  protected readonly citaElegida = signal<FranjaAgendaDTO | null>(null);
  protected readonly accion = signal<Accion>('detalle');

  protected readonly puedeCrear = computed(() => this.sesion.tienePermiso(PERMISOS.agendaCrear));
  /** AGENDA:EDITAR: adelanto, reprogramar, cancelar y descartar una espera. */
  protected readonly puedeEditar = computed(() => this.sesion.tienePermiso(PERMISOS.agendaEditar));
  protected readonly puedeCobrarAdelanto = this.puedeEditar;
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

  /** Nombre de la especialista: el de los filtros o el de la franja; si no llega, «—». */
  protected especialista(id?: number): string {
    const deFiltro = this.opciones().especialistas?.find((e) => e.idPersonal === id);
    const deFranja = this.bloques().find((b) => b.idPersonal === id && b.nombreEspecialista);
    return nombreO(deFiltro && nombreEspecialista(deFiltro), deFranja?.nombreEspecialista);
  }

  /** Servicio y, según la vista, el recurso o la especialista; en móvil, los dos. */
  protected detalle(bloque: FranjaAgendaDTO, completo = false): string {
    const servicio = nombreO(bloque.nombreServicio);
    const especialista = bloque.nombreEspecialista || this.especialista(bloque.idPersonal);
    const recurso = bloque.nombreRecurso || this.recurso(bloque.idRecurso);
    if (completo) {
      return [servicio, especialista, recurso].join(' · ');
    }
    return [servicio, this.vista() === 'especialista' ? recurso : especialista].join(' · ');
  }

  /** Nombre del recurso: el de los filtros o el de la franja; si no llega, «—». */
  protected recurso(id?: number): string {
    const deFiltro = this.opciones().recursos?.find((r) => r.idRecurso === id);
    const deFranja = this.bloques().find((b) => b.idRecurso === id && b.nombreRecurso);
    return nombreO(deFiltro?.nombre, deFranja?.nombreRecurso);
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
    this.cargarEsperas(fecha);
  }

  protected cargarEsperas(fecha = this.fechaVista()): void {
    this.servicio.listarEspera(fecha).subscribe((esperas) => this.esperas.set(esperas));
  }

  protected fechaLarga(): string {
    return new Intl.DateTimeFormat('es-PE', { dateStyle: 'full' }).format(
      new Date(`${this.fechaVista()}T12:00:00`),
    );
  }

  protected superior(bloque: FranjaAgendaDTO): number {
    return (minutosDelDia(bloque.inicio) - this.horas()[0] * 60) * PX_POR_MINUTO;
  }

  /** Un solo bloque hasta el fin del servicio: sin limpieza, libera a la especialista y al recurso (RN03). */
  protected altura(bloque: FranjaAgendaDTO): number {
    return (minutosDelDia(bloque.fin) - minutosDelDia(bloque.inicio)) * PX_POR_MINUTO;
  }

  protected esCita(bloque: FranjaAgendaDTO): boolean {
    return bloque.origen === 'CITA';
  }

  protected abrirCita(bloque: FranjaAgendaDTO): void {
    this.accion.set('detalle');
    this.citaElegida.set(bloque);
  }

  protected cerrarCita(): void {
    this.citaElegida.set(null);
    this.accion.set('detalle');
  }

  /** Solo se reprograman o cancelan las citas PENDIENTES. */
  protected sePuedeCambiar(bloque: FranjaAgendaDTO): boolean {
    return this.puedeEditar() && bloque.estado === 'PENDIENTE';
  }

  protected reprogramada(cita: CitaDTO): void {
    this.cerrarCita();
    this.notificaciones.mostrar(
      `Cita reprogramada para el ${fechaCorta(cita.fechaHoraInicio, true)}.`,
    );
    this.verAgenda();
  }

  /** El modal sigue abierto para mostrar el saldo a favor; la rejilla se actualiza. */
  protected cancelada(): void {
    this.verAgenda();
  }

  /** «Corte de Cabello Caballero · de 15:00 a 18:00». */
  protected detalleEspera(espera: ListaEsperaDTO): string {
    const servicio = nombreO(espera.nombreServicio);
    const rango = espera.horaDesde
      ? `de ${espera.horaDesde} a ${espera.horaHasta ?? ''}`
      : 'cualquier hora';
    return `${servicio} · ${rango}`;
  }

  protected programar(espera: ListaEsperaDTO): void {
    this.esperaAProgramar.set(espera);
    this.modalCita.set(true);
  }

  protected cerrarNuevaCita(): void {
    this.modalCita.set(false);
    this.esperaAProgramar.set(null);
  }

  protected descartar(): void {
    const idEspera = this.esperaPorDescartar()?.idEspera;
    if (idEspera === undefined) {
      return;
    }
    this.descartando.set(true);
    this.servicio.descartarEspera(idEspera).subscribe({
      next: () => {
        this.descartando.set(false);
        this.esperaPorDescartar.set(null);
        this.esperas.update((esperas) => esperas.filter((e) => e.idEspera !== idEspera));
        this.notificaciones.mostrar('Espera descartada.');
      },
      // El 409 (ya asignada o descartada) lo muestra el interceptor: se vuelve a leer la lista.
      error: () => {
        this.descartando.set(false);
        this.esperaPorDescartar.set(null);
        this.cargarEsperas();
      },
    });
  }

  protected abrirEspera(pedido?: PedidoEspera): void {
    this.cerrarNuevaCita();
    this.pedidoEspera.set(
      pedido ?? { clienta: null, idVariante: null, fecha: this.filtros.controls.fecha.value },
    );
  }

  protected citaAgendada(cita: CitaDTO): void {
    const deEspera = this.esperaAProgramar() !== null;
    this.cerrarNuevaCita();
    this.citaNueva.set(cita);
    this.notificaciones.mostrar(`Cita ${numero(cita.idCita)} agendada.`);
    if (cita.fechaHoraInicio.startsWith(this.fechaVista())) {
      this.verAgenda();
    } else if (deEspera) {
      this.cargarEsperas();
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
    this.notificaciones.mostrar(`Adelanto registrado en la cita ${numero(cita.idCita)}.`);
  }

  protected esperaAnotada(espera: ListaEsperaDTO): void {
    this.pedidoEspera.set(null);
    this.ultimaAnotada.set(espera);
    this.notificaciones.mostrar('Clienta anotada en la lista de espera.');
    if (espera.fechaDeseada === this.fechaVista()) {
      this.cargarEsperas();
    }
  }

  private clave(): 'idPersonal' | 'idRecurso' {
    return this.vista() === 'especialista' ? 'idPersonal' : 'idRecurso';
  }
}
