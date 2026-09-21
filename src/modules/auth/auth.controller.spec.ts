import { Usuario } from '../usuarios/usuario.entity.js';
import { AuthController } from './auth.controller.js';
import { COOKIE_TOKEN } from './cookie.constantes.js';

describe('AuthController', () => {
  let controlador: AuthController;
  const authService = {
    registrarUsuario: vi.fn(),
    iniciarSesion: vi.fn(),
  };
  const configService = {
    get: vi.fn(),
    getOrThrow: vi.fn(),
  };

  const crearRespuestaMock = () => {
    const respuesta = { cookie: vi.fn(), clearCookie: vi.fn() };
    return respuesta as never;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    configService.get.mockImplementation((clave: string) => (clave === 'COOKIE_SECURE' ? false : undefined));
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
  });
});