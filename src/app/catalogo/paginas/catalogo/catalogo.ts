import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TIPOS_RECURSO } from '../../../core/api/tipos-recurso';
import { NotificacionesService } from '../../../core/notificaciones/notificaciones.service';
import { PERMISOS } from '../../../core/sesion/permisos';
import { SesionService } from '../../../core/sesion/sesion.service';
import { Modal } from '../../../layout/modal/modal';
import { AreaDTO, ServicioDTO } from '../../modelos/catalogo.modelos';
import { CatalogoService } from '../../servicios/catalogo.service';

/** IGU_Catalogo: CUS57 Registrar Servicio. */
@Component({
  selector: 'app-catalogo',
  imports: [ReactiveFormsModule, RouterLink, RouterLinkActive, Modal],
  templateUrl: './catalogo.html',
})
export class Catalogo implements OnInit {
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly notificaciones = inject(NotificacionesService);
  private readonly servicio = inject(CatalogoService);
  private readonly sesion = inject(SesionService);

  protected readonly tipos = TIPOS_RECURSO;
  protected readonly lineas: { valor: AreaDTO['linea']; etiqueta: string }[] = [
    { valor: 'SALON', etiqueta: 'Salón' },
    { valor: 'SPA', etiqueta: 'Spa' },
  ];

  protected readonly areas = signal<AreaDTO[]>([]);
  /** El contrato no tiene lista de servicios: solo se ven los registrados en esta pantalla. */
  protected readonly servicios = signal<ServicioDTO[]>([]);
  protected readonly filtroArea = signal<number | null>(null);
  protected readonly modal = signal<'area' | 'servicio' | null>(null);
  protected readonly errorFormulario = signal<string | null>(null);
  protected readonly enviando = signal(false);

  protected readonly puedeCrear = computed(() => this.sesion.tienePermiso(PERMISOS.catalogoCrear));
  protected readonly verRecursos = computed(() => this.sesion.tienePermiso(PERMISOS.sedesCrear));
  protected readonly serviciosVisibles = computed(() => {
    const filtro = this.filtroArea();
    return this.servicios().filter((s) => filtro === null || s.idArea === filtro);
  });

  protected readonly formArea = this.fb.group({
    linea: ['SALON' as AreaDTO['linea'], Validators.required],
    nombreArea: ['', [Validators.required, Validators.maxLength(60)]],
  });
  protected readonly formServicio = this.fb.group({
    nombre: ['', [Validators.required, Validators.maxLength(80)]],
    idArea: [null as number | null, Validators.required],
    duracionRefMin: [null as number | null, [Validators.required, Validators.min(1)]],
    tipoRecurso: ['SILLON' as ServicioDTO['tipoRecurso'], Validators.required],
    variantes: this.fb.array<ReturnType<Catalogo['nuevaVariante']>>([]),
  });

  ngOnInit(): void {
    this.servicio.listarAreas().subscribe((areas) => this.areas.set(areas));
  }

  protected areaDe(idArea: number): AreaDTO | undefined {
    return this.areas().find((a) => a.idArea === idArea);
  }

  protected abrirArea(): void {
    this.formArea.reset();
    this.errorFormulario.set(null);
    this.modal.set('area');
  }

  protected registrarArea(): void {
    if (this.formArea.invalid) {
      this.errorFormulario.set('Indica la línea y el nombre del área.');
      return;
    }
    this.errorFormulario.set(null);
    this.enviando.set(true);
    // Los 409 y 422 de la regla los muestra el interceptor; el modal queda abierto para corregir.
    this.servicio.registrarArea(this.formArea.getRawValue()).subscribe({
      next: (area) => {
        this.enviando.set(false);
        this.areas.update((areas) => [...areas, area]);
        this.modal.set(null);
        this.notificaciones.mostrar('Área registrada.');
      },
      error: () => this.enviando.set(false),
    });
  }

  protected abrirServicio(): void {
    this.formServicio.reset();
    this.formServicio.controls.variantes.clear();
    this.agregarVariante();
    this.errorFormulario.set(null);
    this.modal.set('servicio');
  }

  protected agregarVariante(): void {
    this.formServicio.controls.variantes.push(this.nuevaVariante());
  }

  protected quitarVariante(indice: number): void {
    this.formServicio.controls.variantes.removeAt(indice);
  }

  protected agregarInsumo(variante: ReturnType<Catalogo['nuevaVariante']>): void {
    variante.controls.insumos.push(this.nuevoInsumo());
  }

  protected registrarServicio(): void {
    const variantes = this.formServicio.controls.variantes;
    if (this.formServicio.invalid || variantes.length === 0) {
      this.errorFormulario.set(
        'Completa nombre, área, duración y tipo de recurso. Necesitas al menos una variante con precio, y cada insumo necesita producto y cantidad.',
      );
      return;
    }
    this.errorFormulario.set(null);
    this.enviando.set(true);
    this.servicio.registrarServicio(this.formServicio.getRawValue() as ServicioDTO).subscribe({
      next: (servicio) => {
        this.enviando.set(false);
        this.servicios.update((servicios) => [servicio, ...servicios]);
        this.modal.set(null);
        this.notificaciones.mostrar('Servicio registrado.');
      },
      error: () => this.enviando.set(false),
    });
  }

  private nuevaVariante() {
    return this.fb.group({
      nombreVariante: ['', [Validators.required, Validators.maxLength(60)]],
      precio: [null as number | null, [Validators.required, Validators.min(0)]],
      insumos: this.fb.array<ReturnType<Catalogo['nuevoInsumo']>>([]),
    });
  }

  private nuevoInsumo() {
    return this.fb.group({
      idProducto: [null as number | null, [Validators.required, Validators.min(1)]],
      cantidadEstimada: [null as number | null, [Validators.required, Validators.min(0)]],
    });
  }
}
