import { ConflictException, NotFoundException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Usuario } from './usuario.entity.js';
import { Persona } from './persona.entity.js';
import { UsuariosService } from './usuarios.service.js';

describe('UsuariosService', () => {
  let servicio: UsuariosService;
  const repositorioUsuarios = {
    findOne: vi.fn(),
    findOneBy: vi.fn(),
    findAndCount: vi.fn(),
  };
  const repositorioPersonas = {
    findOne: vi.fn(),
    save: vi.fn(),
  };
  const dataSource = {
    transaction: vi.fn(),
    getRepository: vi.fn(),
  };

  const crearUsuario = (usuarioId: number, username: string): Usuario =>
    ({ usuarioId, username, contrasena: 'hashed', persona: { personaId: 1, nombre: 'Juan', apellido: 'Pérez' } } as Usuario);

  const crearPersona = (personaId: number): Persona =>
    ({ personaId, nombre: 'Juan', apellido: 'Pérez' } as Persona);

  beforeEach(() => {
    vi.clearAllMocks();
    const gestor = {
      getRepository: vi.fn((entity) => ({
        create: vi.fn((data) => ({ ...data, personaId: 1 })),
        save: vi.fn((entity) => Promise.resolve(entity)),
      })),
    };
    (dataSource.transaction as ReturnType<typeof vi.fn>).mockImplementation(async (fn: any) => fn(gestor));
    servicio = new UsuariosService(
      repositorioUsuarios as never,
      repositorioPersonas as never,
      dataSource as never,
    );
  });

  describe('buscarPorId', () => {
    it('devuelve el usuario cuando existe', async () => {
      repositorioUsuarios.findOne.mockResolvedValue(crearUsuario(1, 'user1'));
      const resultado = await servicio.buscarPorId(1);
      expect(resultado.username).toBe('user1');
    });

    it('lanza NotFoundException cuando el usuario no existe', async () => {
      repositorioUsuarios.findOne.mockResolvedValue(null);
      await expect(servicio.buscarPorId(99)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('buscarPorUsername', () => {
    it('devuelve el usuario cuando existe', async () => {
      repositorioUsuarios.findOne.mockResolvedValue(crearUsuario(1, 'user1'));
      const resultado = await servicio.buscarPorUsername('user1');
      expect(resultado).toBeDefined();
    });

    it('devuelve null cuando el usuario no existe', async () => {
      repositorioUsuarios.findOne.mockResolvedValue(null);
      const resultado = await servicio.buscarPorUsername('inexistente');
      expect(resultado).toBeNull();
    });
  });

  describe('listar', () => {
    it('devuelve paginación con datos y total', async () => {
      repositorioUsuarios.findAndCount.mockResolvedValue([[crearUsuario(1, 'user1')], 1]);
      const resultado = await servicio.listar({ pagina: 1, limite: 10 });
      expect(resultado.datos).toHaveLength(1);
      expect(resultado.total).toBe(1);
    });
  });

  describe('crearUsuarioConPersona', () => {
    it('crea usuario con persona cuando no existe', async () => {
      repositorioUsuarios.findOneBy.mockResolvedValue(null);
      const resultado = await servicio.crearUsuarioConPersona({
        username: 'nuevo',
        contrasena: 'hashed',
        nombre: 'Nuevo',
        apellido: 'User',
      });
      expect(resultado.username).toBe('nuevo');
      expect(repositorioUsuarios.findOneBy).toHaveBeenCalledWith({ username: 'nuevo' });
    });

    it('lanza ConflictException cuando el username ya está registrado', async () => {
      repositorioUsuarios.findOneBy.mockResolvedValue(crearUsuario(1, 'user1'));
      await expect(
        servicio.crearUsuarioConPersona({ username: 'user1', contrasena: 'h', nombre: 'X', apellido: 'Y' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });
});
