import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('persona')
export class Persona {
  @PrimaryGeneratedColumn({ name: 'persona_id' })
  personaId: number;

  @Column({ name: 'nombre', length: 100 })
  nombre: string;

  @Column({ name: 'apellido', length: 100 })
  apellido: string;
}