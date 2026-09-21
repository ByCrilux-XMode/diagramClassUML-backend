import { Column, Entity, JoinColumn, OneToOne, PrimaryColumn } from 'typeorm';
import { Proyecto } from '../proyectos/proyecto.entity.js';

@Entity('documento_colaborativo')
export class DocumentoColaborativo {
  @PrimaryColumn({ name: 'proyecto_id', type: 'int' })
  proyectoId: number;

  @Column({ name: 'esquema_temporal', type: 'jsonb', nullable: true })
  esquemaTemporal: Record<string, unknown> | null;

  @Column({ name: 'actualizado_en', type: 'timestamptz' })
  actualizadoEn: Date;

  @OneToOne(() => Proyecto, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'proyecto_id' })
  proyecto: Proyecto;
}