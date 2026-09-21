import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('permiso')
export class Permiso {
  @PrimaryGeneratedColumn({ name: 'permiso_id' })
  permisoId: number;

  @Column({ name: 'nombre', length: 50, unique: true })
  nombre: string;
}