export const ROL_CREADOR = 'CREADOR';

export class ProyectoResumenDto {
  proyectoId: number;

  nombre: string;

  rol: string;

  constructor(proyectoId: number, nombre: string, rol: string) {
    this.proyectoId = proyectoId;
    this.nombre = nombre;
    this.rol = rol;
  }
}