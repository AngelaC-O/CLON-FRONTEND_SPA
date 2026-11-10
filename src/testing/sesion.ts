import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SesionDTO } from '../app/core/api/modelos.generados';
import { SesionService } from '../app/core/sesion/sesion.service';

/**
 * Solo para las pruebas: carga la sesión como lo hace la aplicación, respondiendo
 * GET /auth/sesion. Requiere provideHttpClientTesting.
 */
export function entrarComo(sesion: SesionDTO): SesionService {
  const servicio = TestBed.inject(SesionService);
  servicio.cargar().subscribe();
  TestBed.inject(HttpTestingController).expectOne('/api/v1/auth/sesion').flush(sesion);
  return servicio;
}
