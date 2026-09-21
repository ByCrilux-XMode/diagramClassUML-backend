import { Exclude } from 'class-transformer';
import { Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn, RelationId } from 'typeorm';
import { Persona } from './persona.entity.js';

@Entity('usuario')
export class Usuario {
  @PrimaryGeneratedColumn({ name: 'usuario_id' })
  usuarioId: number;

  @Column({ name: 'username', length: 50, unique: true })
  username: string;

  @Exclude()
  @Column({ name: 'password' })
  contrasena: string;

  @OneToOne(() => Persona, { nullable: false })
  @JoinColumn({ name: 'persona_id' })
  persona: Persona;

  @RelationId((usuario: Usuario) => usuario.persona)
  personaId: number;
}