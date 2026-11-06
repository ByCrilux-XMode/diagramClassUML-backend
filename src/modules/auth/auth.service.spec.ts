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
    actualizarTokenFirebase: vi.fn(),
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
      expect(usuariosService.actualizarTokenFirebase).not.toHaveBeenCalled();
    });

    it('guarda el token FCM si se envía al registrarse', async () => {
      const usuario = { usuarioId: 3, username: 'luis', contrasena: 'hash' } as Usuario;
      usuariosService.crearUsuarioConPersona.mockResolvedValue(usuario);
      usuariosService.buscarPorId.mockResolvedValue(usuario);

      await servicio.registrarUsuario({
        username: 'luis',
        password: 'clave1234',
        nombre: 'Luis',
        apellido: 'García',
        tokenFirebase: 'token-fcm-nuevo',
      });

      expect(usuariosService.actualizarTokenFirebase).toHaveBeenCalledWith(3, 'token-fcm-nuevo');
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
      expect(usuariosService.actualizarTokenFirebase).not.toHaveBeenCalled();
    });

    it('guarda el token FCM cuando Flutter lo envía en el inicio de sesión', async () => {
      const contrasena = await bcrypt.hash('clave1234', 10);
      const usuario = { usuarioId: 7, username: 'ana', contrasena } as Usuario;
      usuariosService.buscarPorUsername.mockResolvedValue(usuario);
      usuariosService.buscarPorId.mockResolvedValue(usuario);

      await servicio.iniciarSesion({
        username: 'ana',
        password: 'clave1234',
        tokenFirebase: 'token-fcm-del-celular',
      });

      expect(usuariosService.actualizarTokenFirebase).toHaveBeenCalledWith(7, 'token-fcm-del-celular');
    });

    it('lanza UnauthorizedException con credenciales inválidas', async () => {
      usuariosService.buscarPorUsername.mockResolvedValue(null);

      await expect(
        servicio.iniciarSesion({ username: 'ana', password: 'incorrecta' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});