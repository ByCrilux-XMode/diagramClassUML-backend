import type { Usuario } from '../modules/usuarios/usuario.entity.js';

/** Nombre visible y desnormalizado que se guarda en eventos y mensajes. */
export function nombreCompleto(usuario: Usuario): string {
  const persona = usuario.persona;
  const nombre = [persona?.nombre, persona?.apellido].filter(Boolean).join(' ').trim();
  return nombre || usuario.username;
}
