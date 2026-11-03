import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NotificacionesService } from '../../../core/notificaciones/notificaciones.service';
import { PERMISOS } from '../../../core/sesion/permisos';
import { SesionService } from '../../../core/sesion/sesion.service';
import { BloqueAgendaDTO, CitaDTO, ListaEsperaDTO } from '../../modelos/agenda.modelos';
import {
  claseEstado,
  etiquetaEstado,
  horaDe,
  hoyIso,
  minutosDelDia,
  ordenarPorInicio,
  tituloBloque,
} from '../../modelos/agenda.vista';
import { CitasService } from '../../servicios/citas.service';
import { ListaEspera } from './lista-espera';
import { NuevaCita, PedidoEspera } from './nueva-cita';

type Vista = 'especialista' | 'recurso';

const HORA_APERTURA = 9;
const HORA_CIERRE = 20;
const PX_POR_MINUTO = 1;

/** IGU_Agenda: CUS05, CUS06 y CUS08. */
@Component({
  selector: 'app-agenda',
  imports: [ReactiveFormsModule, NuevaCita, ListaEspera],
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

  protected readonly vista = signal<Vista>('especialista');
  protected readonly bloques = signal<BloqueAgendaDTO[]>([]);
  protected readonly fechaVista = signal(hoyIso());
  /** Se acumulan para que filtrar por una especialista no vacíe los selectores. */
  protected readonly idsPersonal = signal<number[]>([]);
  protected readonly idsRecurso = signal<number[]>([]);
  protected readonly modalCita = signal(false);
  protected readonly pedidoEspera = signal<PedidoEspera | null>(null);
  /** El contrato no tiene lista de espera: solo se ven las anotadas en esta pantalla. */
  protected readonly esperas = signal<ListaEsperaDTO[]>([]);

  protected readonly puedeCrear = computed(() => this.sesion.tienePermiso(PERMISOS.agendaCrear));
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
        titulo: `${this.vista() === 'especialista' ? 'Especialista' : 'Recurso'} ${id}`,
        bloques: this.ocupados().filter((b) => b[clave] === id),
      }));
  });

  protected readonly filtros = inject(FormBuilder).nonNullable.group({
    fecha: [hoyIso(), Validators.required],
    idPersonal: [null as number | null],
    idRecurso: [null as number | null],
  });

  ngOnInit(): void {
    this.verAgenda();
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
        this.idsPersonal.update((ids) => unirIds(ids, bloques, 'idPersonal'));
        this.idsRecurso.update((ids) => unirIds(ids, bloques, 'idRecurso'));
      });
  }

  protected fechaLarga(): string {
    return new Intl.DateTimeFormat('es-PE', { dateStyle: 'full' }).format(
      new Date(`${this.fechaVista()}T12:00:00`),
    );
  }

  protected superior(bloque: BloqueAgendaDTO): number {
    return (minutosDelDia(bloque.inicio) - this.horas()[0] * 60) * PX_POR_MINUTO;
  }

  protected altura(bloque: BloqueAgendaDTO): number {
    return (minutosDelDia(bloque.fin) - minutosDelDia(bloque.inicio)) * PX_POR_MINUTO;
  }

  protected abrirEspera(pedido?: PedidoEspera): void {
    this.modalCita.set(false);
    this.pedidoEspera.set(
      pedido ?? { clienta: null, idVariante: null, fecha: this.filtros.controls.fecha.value },
    );
  }

  protected citaAgendada(cita: CitaDTO): void {
    this.modalCita.set(false);
    this.notificaciones.mostrar(`Cita ${cita.idCita} agendada.`);
    if (cita.fechaHoraInicio.startsWith(this.fechaVista())) {
      this.verAgenda();
    }
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

function unirIds(
  ids: number[],
  bloques: BloqueAgendaDTO[],
  clave: 'idPersonal' | 'idRecurso',
): number[] {
  const nuevos = bloques.map((b) => b[clave]).filter((id): id is number => id !== undefined);
  return [...new Set([...ids, ...nuevos])].sort((a, b) => a - b);
}
