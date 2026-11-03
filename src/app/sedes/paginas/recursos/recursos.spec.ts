import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Recursos } from './recursos';

describe('Recursos', () => {
  let fixture: ComponentFixture<Recursos>;
  let raiz: HTMLElement;
  let http: HttpTestingController;

  const estable = () => fixture.whenStable();
  const abrir = async () => {
    [...raiz.querySelectorAll('button')].find((b) => b.textContent?.includes('+ Recurso'))!.click();
    await estable();
  };
  const escribir = (id: string, valor: string) => {
    const entrada = raiz.querySelector<HTMLInputElement>(`#${id}`)!;
    entrada.value = valor;
    entrada.dispatchEvent(new Event('input'));
  };
  const enviar = async () => {
    raiz.querySelector('app-modal form')!.dispatchEvent(new Event('submit'));
    await estable();
  };

  beforeEach(async () => {
    sessionStorage.setItem(
      'cautiva.sesion',
      JSON.stringify({ idSede: 1, permisos: ['SEDES:CREAR'] }),
    );
    TestBed.configureTestingModule({
      imports: [Recursos],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Recursos);
    await estable();
    raiz = fixture.nativeElement;
  });

  afterEach(() => {
    http.verify();
    sessionStorage.clear();
  });

  it('no llama al back-end al abrir', () => {
    expect(raiz.querySelector('.vacio')).not.toBeNull();
    expect(raiz.querySelector('a[href="/catalogo"]')).toBeNull();
  });

  it('CUS61: registra el recurso con la sede de la sesión y lo lista', async () => {
    await abrir();
    expect(raiz.querySelector<HTMLInputElement>('#idSede')?.value).toBe('1');
    escribir('nombre', 'Sillón 11');
    escribir('minutosLimpieza', '15');
    await enviar();
    const peticion = http.expectOne('/api/v1/recursos');
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual({
      idSede: 1,
      nombre: 'Sillón 11',
      tipo: 'SILLON',
      minutosLimpieza: 15,
    });
    peticion.flush({ ...peticion.request.body, idRecurso: 21, estado: 'DISPONIBLE' });
    await estable();
    expect(raiz.querySelector('app-modal')).toBeNull();
    const fila = raiz.querySelector('tbody tr')!;
    expect(fila.textContent).toContain('Sillón 11');
    expect(fila.textContent).toContain('15');
    expect(fila.querySelector('.chip.ok')?.textContent).toContain('DISPONIBLE');
  });

  it.each(['31', '-1'])('rechaza %s minutos de limpieza (RN03)', async (minutos) => {
    await abrir();
    escribir('nombre', 'Camilla 1');
    escribir('minutosLimpieza', minutos);
    await enviar();
    http.expectNone('/api/v1/recursos');
    expect(raiz.querySelector('app-modal .alert.bad')?.textContent).toContain('0 a 30');
  });

  it('acepta 0 minutos de limpieza', async () => {
    await abrir();
    escribir('nombre', 'Camilla 1');
    escribir('minutosLimpieza', '0');
    await enviar();
    http.expectOne('/api/v1/recursos');
  });
});
