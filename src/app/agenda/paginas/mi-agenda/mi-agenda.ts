import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Modal } from '../../../layout/modal/modal';
import { BloqueAgendaDTO } from '../../modelos/agenda.modelos';
import {
  claseEstado,
  etiquetaEstado,
  horaDe,
  hoyIso,
  ordenarPorInicio,
  tituloBloque,
} from '../../modelos/agenda.vista';
import { AtencionEnCursoService } from '../../servicios/atencion-en-curso.service';
import { AtencionesService } from '../../servicios/atenciones.service';
import { CitasService } from '../../servicios/citas.service';

const CLAVE_ESPECIALISTA = 'cautiva.especialista';

/** IGU_Atencion, nodo 4:125: las citas del día y el inicio de CUS11. */
@Component({
  selector: 'app-mi-agenda',
  imports: [ReactiveFormsModule, Modal],
  templateUrl: './mi-agenda.html',
})
export class MiAgenda implements OnInit {
  private readonly atenciones = inject(AtencionesService);
  private readonly citas = inject(CitasService);
  private readonly enCurso = inject(AtencionEnCursoService);
  private readonly router = inject(Router);

  protected readonly horaDe = horaDe;
  protected readonly etiquetaEstado = etiquetaEstado;
  protected readonly claseEstado = claseEstado;
  protected readonly tituloBloque = tituloBloque;

  protected readonly bloques = signal<BloqueAgendaDTO[]>([]);
  protected readonly idPersonal = signal<number | null>(null);
  protected readonly citaPorIniciar = signal<BloqueAgendaDTO | null>(null);
  protected readonly enviando = signal(false);
  protected readonly errorInicio = signal<string | null>(null);

  protected readonly especialistas = computed(() => {
    const ids = this.bloques()
      .map((b) => b.idPersonal)
      .filter((id): id is number => id !== undefined);
    return [...new Set(ids)].sort((a, b) => a - b);
  });
  protected readonly misCitas = computed(() =>
    ordenarPorInicio(
      this.bloques().filter((b) => b.franja === 'OCUPADA' && b.idPersonal === this.idPersonal()),
    ),
  );

  protected readonly formInicio = inject(FormBuilder).nonNullable.group({
    tiempoDeclaradoMin: [null as number | null, [Validators.required, Validators.min(1)]],
  });

  ngOnInit(): void {
    this.citas.consultarAgenda({ fecha: hoyIso() }).subscribe((bloques) => {
      this.bloques.set(bloques);
      const guardada = leerEspecialista();
      const ids = this.especialistas();
      this.idPersonal.set(
        guardada !== null && ids.includes(guardada) ? guardada : (ids[0] ?? null),
      );
    });
  }

  protected elegirEspecialista(valor: string): void {
    const id = Number(valor);
    this.idPersonal.set(id);
    guardarEspecialista(id);
  }

  protected puedeContinuar(bloque: BloqueAgendaDTO): boolean {
    return this.enCurso.actual()?.idCita === bloque.idOrigen;
  }

  protected abrirInicio(bloque: BloqueAgendaDTO): void {
    this.formInicio.reset();
    this.errorInicio.set(null);
    this.citaPorIniciar.set(bloque);
  }

  protected iniciar(): void {
    const idCita = this.citaPorIniciar()?.idOrigen;
    const { tiempoDeclaradoMin } = this.formInicio.getRawValue();
    if (idCita === undefined || this.formInicio.invalid || tiempoDeclaradoMin === null) {
      this.errorInicio.set('Indica el tiempo exacto en minutos.');
      return;
    }
    this.enviando.set(true);
    this.atenciones.iniciar({ idCita, tiempoDeclaradoMin }).subscribe({
      next: (atencion) => {
        this.enviando.set(false);
        this.enCurso.establecer(atencion);
        void this.router.navigateByUrl('/agenda/atencion');
      },
      // Los 409 y 422 de la regla los muestra el interceptor; el modal queda abierto.
      error: () => this.enviando.set(false),
    });
  }

  protected continuar(): void {
    void this.router.navigateByUrl('/agenda/atencion');
  }
}

function leerEspecialista(): number | null {
  try {
    const guardada = Number(localStorage.getItem(CLAVE_ESPECIALISTA));
    return guardada > 0 ? guardada : null;
  } catch {
    return null;
  }
}

function guardarEspecialista(id: number): void {
  try {
    localStorage.setItem(CLAVE_ESPECIALISTA, String(id));
  } catch {
    // Solo es una comodidad: sin almacenamiento se vuelve a elegir.
  }
}
