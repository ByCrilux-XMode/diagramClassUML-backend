import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, RelationId } from 'typeorm';
import { Proyecto } from '../proyectos/proyecto.entity.js';
import { Usuario } from '../usuarios/usuario.entity.js';

@Entity('notificacion')
export class Notificacion {
  @PrimaryGeneratedColumn({ name: 'notificacion_id' })
  notificacionId: number;

  @Column({ name: 'tipo_accion', length: 50 })
  tipoAccion: string;

  @Column({ length: 200 })
  titulo: string;

  @Column({ type: 'text' })
  mensaje: string;

  @Column({ type: 'jsonb', nullable: true })
  datos: Record<string, string> | null;

  @Column({ default: false })
  leida: boolean;

  @Column({ default: false })
  enviada: boolean;

  @Column({ name: 'creada_en', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  creadaEn: Date;

  @ManyToOne(() => Usuario, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'destinatario_id' })
  destinatario: Usuario;

  @RelationId((notificacion: Notificacion) => notificacion.destinatario)
  destinatarioId: number;

  @ManyToOne(() => Usuario, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'actor_id' })
  actor: Usuario | null;

  @RelationId((notificacion: Notificacion) => notificacion.actor)
  actorId: number | null;

  @ManyToOne(() => Proyecto, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'proyecto_id' })
  proyecto: Proyecto;

  @RelationId((notificacion: Notificacion) => notificacion.proyecto)
  proyectoId: number;
}
