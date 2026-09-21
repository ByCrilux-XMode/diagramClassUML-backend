import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Usuario } from '../usuarios/usuario.entity.js';
import { AuthService } from './auth.service.js';

describe('AuthService', () => {
  let servicio: AuthService;
  const usuariosService = {
    crearUsuarioConPersona: vi.fn(),
    buscarPorUsername: vi.fn(),
    buscarPorId: vi.fn(),
  };
  const jwtService = { signAsync: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    jwtService.signAsync.mockResolvedValue('token-de-prueba');
    servicio = new AuthService(usuariosService as never, jwtService as never);
  });

  describe('registrarUsuario', () => {
    it('crea el usuario con la contraseña hasheada y devuelve token y perfil', async () => {
      const usuario = { usuarioId: 1, username: 'ana', contrasena: 'hash' } as Usuario;
      usuariosService.crearUsuarioConPersona.mockResolvedValue(usuario);
      usuariosService.buscarPorId.mockResolvedValue(usuario);

      const resultado = await servicio.registrarUsuario({
        username: 'ana',
        password: 'clave1234',
        nombre: 'Ana',
        apellido: 'Pérez',
      });

      expect(usuariosService.crearUsuarioConPersona).toHaveBeenCalledWith({
        username: 'ana',
        contrasena: expect.stringMatching(/^\$2[aby]\$/),
        nombre: 'Ana',
        apellido: 'Pérez',
      });
      expect(resultado.tokenAcceso).toBe('token-de-prueba');
      expect(resultado.usuario.usuarioId).toBe(1);
    });
  });

  describe('iniciarSesion', () => {
    it('devuelve token con credenciales válidas', async () => {
      const contrasena = await bcrypt.hash('clave1234', 10);
      const usuario = { usuarioId: 1, username: 'ana', contrasena } as Usuario;
      usuariosService.buscarPorUsername.mockResolvedValue(usuario);
      usuariosService.buscarPorId.mockResolvedValue(usuario);

      const resultado = await servicio.iniciarSesion({ username: 'ana', password: 'clave1234' });

      expect(resultado.tokenAcceso).toBe('token-de-prueba');
      expect(usuariosService.buscarPorUsername).toHaveBeenCalledWith('ana');
    });

    it('lanza UnauthorizedException con credenciales inválidas', async () => {
      usuariosService.buscarPorUsername.mockResolvedValue(null);

      await expect(
        servicio.iniciarSesion({ username: 'ana', password: 'incorrecta' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});