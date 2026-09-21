import { ConflictException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { DataSource, Repository } from 'typeorm';
import { PaginadoDto } from '../../common/dto/paginado.dto.js';
import { Persona } from './persona.entity.js';
import { Usuario } from './usuario.entity.js';

const COSTO_BCRYPT = 10;

interface SeedUsuario {
  username: string;
  contrasena: string;
  nombre: string;
  apellido: string;
}

const SEED_USUARIOS: readonly SeedUsuario[] = [
  { username: 'user1', contrasena: 'user123', nombre: 'Juan', apellido: 'Pérez' },
  { username: 'user2', contrasena: 'user123', nombre: 'María', apellido: 'García' },
  { username: 'user3', contrasena: 'user123', nombre: 'Carlos', apellido: 'López' },
] as const;

export interface NuevoUsuario {
  username: string;
  contrasena: string;
  nombre: string;
  apellido: string;
}

@Injectable()
export class UsuariosService implements OnModuleInit {
  private readonly logger = new Logger(UsuariosService.name);

  constructor(
    @InjectRepository(Usuario) private readonly repositorioUsuarios: Repository<Usuario>,
    @InjectRepository(Persona) private readonly repositorioPersonas: Repository<Persona>,
    private readonly dataSource: DataSource,
  ) {}

  async onModuleInit(): Promise<void> {
    const cantidad = await this.repositorioUsuarios.count();
    if (cantidad > 0) return;
    for (const seed of SEED_USUARIOS) {
      const contrasena = await bcrypt.hash(seed.contrasena, COSTO_BCRYPT);
      await this.crearUsuarioConPersona({
        username: seed.username,
        contrasena,
        nombre: seed.nombre,
        apellido: seed.apellido,
      });
    }
    this.logger.log(`Usuarios semilla creados: ${SEED_USUARIOS.map((u) => u.username).join(', ')}`);
  }

  async crearUsuarioConPersona(datos: NuevoUsuario): Promise<Usuario> {
    const existente = await this.repositorioUsuarios.findOneBy({ username: datos.username });
    if (existente) {
      throw new ConflictException(`El nombre de usuario '${datos.username}' ya está registrado`);
    }
    return this.dataSource.transaction(async (gestor) => {
      const persona = await gestor
        .getRepository(Persona)
        .save(gestor.getRepository(Persona).create({ nombre: datos.nombre, apellido: datos.apellido }));
      const usuario = await gestor.getRepository(Usuario).save(
        gestor.getRepository(Usuario).create({
          username: datos.username,
          contrasena: datos.contrasena,
          persona,
        }),
      );
      return usuario;
    });
  }

  async buscarPorId(usuarioId: number): Promise<Usuario> {
    const usuario = await this.repositorioUsuarios.findOne({
      where: { usuarioId },
      relations: { persona: true },
    });
    if (!usuario) throw new NotFoundException('Usuario no encontrado');
    return usuario;
  }

  async buscarPorUsername(username: string): Promise<Usuario | null> {
    return this.repositorioUsuarios.findOne({
      where: { username },
      relations: { persona: true },
    });
  }

  async listar(paginado: PaginadoDto): Promise<{ datos: Usuario[]; total: number }> {
    const [datos, total] = await this.repositorioUsuarios.findAndCount({
      relations: { persona: true },
      order: { usuarioId: 'ASC' },
      skip: (paginado.pagina - 1) * paginado.limite,
      take: paginado.limite,
    });
    return { datos, total };
  }
}