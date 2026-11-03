import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CitasService } from './citas.service';

describe('CitasService', () => {
  it('consulta la agenda sin enviar los filtros opcionales vacíos', () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    TestBed.inject(CitasService).consultarAgenda({ fecha: '2026-11-09' }).subscribe();
    const peticion = TestBed.inject(HttpTestingController).expectOne(
      '/api/v1/citas/agenda?fecha=2026-11-09',
    );
    expect(peticion.request.method).toBe('GET');
  });
});
