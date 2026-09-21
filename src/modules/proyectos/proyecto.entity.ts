import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, RelationId } from 'typeorm';
import { Usuario } from '../usuarios/usuario.entity.js';

@Entity('proyecto')
export class Proyecto {
  @PrimaryGeneratedColumn({ name: 'proyecto_id' })
  proyectoId: number;

  @Column({ name: 'nombre', length: 100 })
  nombre: string;

  @Column({ name: 'esquema_json', type: 'jsonb', nullable: true })
  esquemaJson: Record<string, unknown> | null;

  @ManyToOne(() => Usuario, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'creador_id' })
  creador: Usuario;

  @RelationId((proyecto: Proyecto) => proyecto.creador)
  creadorId: number;
}