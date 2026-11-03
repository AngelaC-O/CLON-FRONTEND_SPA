import { RecursoDTO } from './modelos.generados';

/** El enum tipo de RecursoDTO y tipoRecurso de ServicioDTO, con el texto del prototipo. */
export const TIPOS_RECURSO: { valor: RecursoDTO['tipo']; etiqueta: string }[] = [
  { valor: 'SILLON', etiqueta: 'Sillón' },
  { valor: 'ESTACION', etiqueta: 'Estación' },
  { valor: 'CAMILLA', etiqueta: 'Camilla' },
  { valor: 'CABINA', etiqueta: 'Cabina' },
  { valor: 'MESA_MANICURA', etiqueta: 'Mesa manicura' },
  { valor: 'LAVACABEZAS', etiqueta: 'Lavacabezas' },
  { valor: 'HIDROTERAPIA', etiqueta: 'Hidroterapia' },
];

export function etiquetaTipoRecurso(tipo: RecursoDTO['tipo']): string {
  return TIPOS_RECURSO.find((t) => t.valor === tipo)?.etiqueta ?? tipo;
}
