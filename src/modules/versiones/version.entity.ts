import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, RelationId } from 'typeorm';
import { Proyecto } from '../proyectos/proyecto.entity.js';

@Entity('version')
export class Version {
  @PrimaryGeneratedColumn({ name: 'version_id' })
  versionId: number;

  @Column({ name: 'nombre', length: 100 })
  nombre: string;

  @Column({ name: 'fecha', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  fecha: Date;

  @Column({ name: 'json', type: 'jsonb' })
  json: Record<string, unknown>;

  @ManyToOne(() => Proyecto, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'proyecto_id' })
  proyecto: Proyecto;

  @RelationId((version: Version) => version.proyecto)
  proyectoId: number;
}
