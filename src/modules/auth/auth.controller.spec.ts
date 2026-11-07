import type { Response } from 'express';
import { Usuario } from '../usuarios/usuario.entity.js';
import { AuthController } from './auth.controller.js';
import { COOKIE_TOKEN } from './cookie.constantes.js';

type RespuestaMock = Response & {
  cookie: ReturnType<typeof vi.fn>;
  clearCookie: ReturnType<typeof vi.fn>;
};

describe('AuthController', () => {
  let controlador: AuthController;
  const authService = {
    registrarUsuario: vi.fn(),
    iniciarSesion: vi.fn(),
    ticketColaboracion: vi.fn(),
  };
  const configService = {
    get: vi.fn(),
    getOrThrow: vi.fn(),
  };

  const crearRespuestaMock = (): RespuestaMock => {
    const respuesta = { cookie: vi.fn(), clearCookie: vi.fn() };
    return respuesta as unknown as RespuestaMock;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    configService.get.mockImplementation((clave: string) =>
      clave === 'COOKIE_SECURE' ? false : undefined,
    );
    configService.getOrThrow.mockReturnValue('1d');
    controlador = new AuthController(authService as never, configService as never);
  });

  describe('iniciarSesion', () => {
    it('establece la cookie con el token y no lo expone en el body', async () => {
      const usuario = { usuarioId: 1, username: 'ana' } as Usuario;
      authService.iniciarSesion.mockResolvedValue({ tokenAcceso: 'token-secreto', usuario });
      const respuesta = crearRespuestaMock();

      const resultado = await controlador.iniciarSesion(
        { username: 'ana', password: 'clave1234' },
        respuesta,
      );

      expect(resultado).toEqual({ usuario });
      expect(respuesta.cookie).toHaveBeenCalledWith(
        COOKIE_TOKEN,
        'token-secreto',
        expect.objectContaining({ httpOnly: true, sameSite: 'lax', secure: false }),
      );
      expect(
        (respuesta.cookie as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[2],
      ).not.toHaveProperty('domain');
    });

    it('con COOKIE_DOMAIN la cookie se comparte entre subdominios', async () => {
      configService.get.mockImplementation((clave: string) => {
        if (clave === 'COOKIE_SECURE') return true;
        if (clave === 'COOKIE_DOMAIN') return '.midominio.com';
        return undefined;
      });
      const usuario = { usuarioId: 3, username: 'eva' } as Usuario;
      authService.iniciarSesion.mockResolvedValue({ tokenAcceso: 'token-compartido', usuario });
      const respuesta = crearRespuestaMock();

      await controlador.iniciarSesion({ username: 'eva', password: 'clave1234' }, respuesta);

      expect(respuesta.cookie).toHaveBeenCalledWith(
        COOKIE_TOKEN,
        'token-compartido',
        expect.objectContaining({
          domain: '.midominio.com',
          httpOnly: true,
          secure: true,
          sameSite: 'none',
          path: '/',
        }),
      );
    });
  });

  describe('registrarse', () => {
    it('establece la cookie con el token y devuelve solo el usuario', async () => {
      const usuario = { usuarioId: 2, username: 'luis' } as Usuario;
      authService.registrarUsuario.mockResolvedValue({ tokenAcceso: 'token-nuevo', usuario });
      const respuesta = crearRespuestaMock();

      const resultado = await controlador.registrarse(
        { username: 'luis', password: 'clave1234', nombre: 'Luis', apellido: 'García' },
        respuesta,
      );

      expect(resultado).toEqual({ usuario });
      expect(resultado).not.toHaveProperty('tokenAcceso');
      expect(respuesta.cookie).toHaveBeenCalledWith(COOKIE_TOKEN, 'token-nuevo', expect.any(Object));
    });
  });

  describe('cerrarSesion', () => {
    it('borra la cookie de sesión', async () => {
      const respuesta = crearRespuestaMock();

      controlador.cerrarSesion(respuesta);

      expect(respuesta.clearCookie).toHaveBeenCalledWith(COOKIE_TOKEN, expect.objectContaining({ path: '/' }));
    });

    it('borra también la cookie del dominio configurado', async () => {
      configService.get.mockImplementation((clave: string) =>
        clave === 'COOKIE_DOMAIN' ? '.midominio.com' : undefined,
      );
      const respuesta = crearRespuestaMock();

      controlador.cerrarSesion(respuesta);

      expect(respuesta.clearCookie).toHaveBeenCalledWith(COOKIE_TOKEN, {
        path: '/',
        domain: '.midominio.com',
      });
    });

    it('borra también la variante sin dominio', () => {
      configService.get.mockImplementation((clave: string) =>
        clave === 'COOKIE_DOMAIN' ? '.midominio.com' : undefined,
      );
      const respuesta = crearRespuestaMock();

      controlador.cerrarSesion(respuesta);

      expect(respuesta.clearCookie).toHaveBeenCalledWith(COOKIE_TOKEN, { path: '/' });
      expect(respuesta.clearCookie).toHaveBeenCalledTimes(2);
    });
  });

  describe('ticketColaboracion', () => {
    it('emite un ticket corto para el usuario autenticado', async () => {
      const usuario = { usuarioId: 5, username: 'sofia' } as Usuario;
      authService.ticketColaboracion.mockResolvedValue('ticket-corto');

      const resultado = await controlador.ticketColaboracion(usuario);

      expect(authService.ticketColaboracion).toHaveBeenCalledWith(usuario);
      expect(resultado).toEqual({ token: 'ticket-corto' });
    });
  });
});