import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, RelationId } from 'typeorm';
import { Proyecto } from '../proyectos/proyecto.entity.js';
import { Usuario } from '../usuarios/usuario.entity.js';

@Entity('version_proyecto')
export class VersionProyecto {
  @PrimaryGeneratedColumn({ name: 'version_id' })
  versionId: number;

  @Column({ name: 'nombre', length: 150 })
  nombre: string;

  @Column({ name: 'descripcion', type: 'text', nullable: true })
  descripcion: string | null;

  @Column({ name: 'esquema_json', type: 'jsonb', nullable: true })
  esquemaJson: Record<string, unknown> | null;

  @Column({ name: 'creada_en', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  creadaEn: Date;

  @ManyToOne(() => Proyecto, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'proyecto_id' })
  proyecto: Proyecto;

  @RelationId((version: VersionProyecto) => version.proyecto)
  proyectoId: number;

  @ManyToOne(() => Usuario, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'creado_por_id' })
  creadoPor: Usuario | null;

  @RelationId((version: VersionProyecto) => version.creadoPor)
  creadoPorId: number | null;
}
