import { parametros } from './parametros';

describe('parametros', () => {
  it('no envía los opcionales vacíos', () => {
    const params = parametros({ fecha: '2026-11-09', idPersonal: 0, idRecurso: undefined, q: '' });
    expect(params.toString()).toBe('fecha=2026-11-09&idPersonal=0');
  });
});
