import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Permiso } from '../permisos/permiso.entity.js';
import { Proyecto } from '../proyectos/proyecto.entity.js';
import { Usuario } from '../usuarios/usuario.entity.js';

@Entity('colaborador')
export class Colaborador {
  @PrimaryColumn({ name: 'usuario_id', type: 'int' })
  usuarioId: number;

  @PrimaryColumn({ name: 'proyecto_id', type: 'int' })
  proyectoId: number;

  @Column({ name: 'permiso_id', type: 'int' })
  permisoId: number;

  @ManyToOne(() => Usuario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuario_id' })
  usuario: Usuario;

  @ManyToOne(() => Proyecto, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'proyecto_id' })
  proyecto: Proyecto;

  @ManyToOne(() => Permiso, { nullable: false })
  @JoinColumn({ name: 'permiso_id' })
  permiso: Permiso;
}