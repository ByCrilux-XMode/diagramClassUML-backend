import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PermisosService } from '../permisos/permisos.service.js';
import { Proyecto } from '../proyectos/proyecto.entity.js';
import { ProyectosService } from '../proyectos/proyectos.service.js';
import { UsuariosService } from '../usuarios/usuarios.service.js';
import { Colaborador } from './colaborador.entity.js';
import { AsignarColaboradorDto } from './dto/asignar-colaborador.dto.js';

@Injectable()
export class ColaboradoresService {
  constructor(
    @InjectRepository(Colaborador) private readonly repositorioColaboradores: Repository<Colaborador>,
    private readonly proyectosService: ProyectosService,
    private readonly usuariosService: UsuariosService,
    private readonly permisosService: PermisosService,
  ) {}

  async asignar(usuarioId: number, proyectoId: number, dto: AsignarColaboradorDto): Promise<Colaborador> {
    const proyecto = await this.obtenerProyectoVerificado(usuarioId, proyectoId);
    await this.usuariosService.buscarPorId(dto.usuarioId);
    const permiso = await this.permisosService.buscarPorId(dto.permisoId);

    const existente = await this.repositorioColaboradores.findOneBy({
      usuarioId: dto.usuarioId,
      proyectoId: proyecto.proyectoId,
    });
    if (existente) {
      existente.permiso = permiso;
      await this.repositorioColaboradores.save(existente);
    } else {
      await this.repositorioColaboradores.save(
        this.repositorioColaboradores.create({
          usuarioId: dto.usuarioId,
          proyectoId: proyecto.proyectoId,
          permiso,
        }),
      );
    }
    return this.obtenerColaborador(dto.usuarioId, proyecto.proyectoId);
  }

  async listarDelProyecto(usuarioId: number, proyectoId: number): Promise<Colaborador[]> {
    await this.obtenerProyectoVerificado(usuarioId, proyectoId);
    return this.repositorioColaboradores.find({
      where: { proyectoId },
      relations: { usuario: { persona: true }, permiso: true },
      order: { usuarioId: 'ASC' },
    });
  }

  async actualizarPermiso(
    usuarioId: number,
    proyectoId: number,
    colaboradorUsuarioId: number,
    permisoId: number,
  ): Promise<Colaborador> {
    await this.obtenerProyectoVerificado(usuarioId, proyectoId);
    const permiso = await this.permisosService.buscarPorId(permisoId);
    const colaborador = await this.obtenerColaborador(colaboradorUsuarioId, proyectoId);
    colaborador.permiso = permiso;
    await this.repositorioColaboradores.save(colaborador);
    return this.obtenerColaborador(colaboradorUsuarioId, proyectoId);
  }

  async remover(usuarioId: number, proyectoId: number, colaboradorUsuarioId: number): Promise<void> {
    await this.obtenerProyectoVerificado(usuarioId, proyectoId);
    const colaborador = await this.obtenerColaborador(colaboradorUsuarioId, proyectoId);
    await this.repositorioColaboradores.remove(colaborador);
  }

  private async obtenerColaborador(colaboradorUsuarioId: number, proyectoId: number): Promise<Colaborador> {
    const colaborador = await this.repositorioColaboradores.findOne({
      where: { usuarioId: colaboradorUsuarioId, proyectoId },
      relations: { usuario: { persona: true }, permiso: true },
    });
    if (!colaborador) throw new NotFoundException('Colaborador no encontrado');
    return colaborador;
  }

  private async obtenerProyectoVerificado(usuarioId: number, proyectoId: number): Promise<Proyecto> {
    const proyecto = await this.proyectosService.buscarPorId(proyectoId);
    if (proyecto.creador?.usuarioId !== usuarioId) {
      throw new ForbiddenException('Solo el creador del proyecto gestiona sus colaboradores');
    }
    return proyecto;
  }
}