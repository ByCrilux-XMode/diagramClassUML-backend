import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';

export interface EventoPropuestaCreada {
  tipo: 'propuesta.creada';
  turnoId: string;
  propuestas: unknown[];
}

export interface EventoPropuestaResuelta {
  tipo: 'propuesta.resuelta';
  turnoId: string;
  estado: string;
  aprobadoPor: unknown;
  resultado: unknown;
}

export type EventoStream =
  | { tipo: 'mensaje.creado'; mensaje: unknown }
  | EventoPropuestaCreada
  | EventoPropuestaResuelta;

/**
 * Un `Subject` por proyecto. Vive en memoria: con una sola instancia del
 * backend es suficiente; varias instancias necesitarían un bus externo.
 */
@Injectable()
export class ChatStreamService implements OnModuleDestroy {
  private readonly sujetos = new Map<number, Subject<EventoStream>>();
  private readonly suscriptores = new Map<number, number>();

  private obtener(proyectoId: number): Subject<EventoStream> {
    let sujeto = this.sujetos.get(proyectoId);
    if (!sujeto) {
      sujeto = new Subject<EventoStream>();
      this.sujetos.set(proyectoId, sujeto);
    }
    return sujeto;
  }

  suscribir(proyectoId: number): Observable<EventoStream> {
    return new Observable<EventoStream>((observador) => {
      const sujeto = this.obtener(proyectoId);
      const suscripcion = sujeto.subscribe(observador);
      this.suscriptores.set(proyectoId, (this.suscriptores.get(proyectoId) ?? 0) + 1);

      return () => {
        suscripcion.unsubscribe();
        const restantes = (this.suscriptores.get(proyectoId) ?? 1) - 1;
        if (restantes <= 0) {
          this.suscriptores.delete(proyectoId);
          this.sujetos.delete(proyectoId);
        } else {
          this.suscriptores.set(proyectoId, restantes);
        }
      };
    });
  }

  emitir(proyectoId: number, mensaje: unknown): void {
    this.sujetos.get(proyectoId)?.next({ tipo: 'mensaje.creado', mensaje });
  }

  /** El panel de propuestas reutiliza el stream del chat (D31). */
  emitirPropuestaCreada(
    proyectoId: number,
    evento: { turnoId: string; propuestas: unknown[] },
  ): void {
    this.sujetos.get(proyectoId)?.next({ tipo: 'propuesta.creada', ...evento });
  }

  emitirPropuestaResuelta(
    proyectoId: number,
    evento: {
      turnoId: string;
      estado: string;
      aprobadoPor: unknown;
      resultado: unknown;
    },
  ): void {
    this.sujetos.get(proyectoId)?.next({ tipo: 'propuesta.resuelta', ...evento });
  }

  onModuleDestroy(): void {
    for (const sujeto of this.sujetos.values()) sujeto.complete();
    this.sujetos.clear();
    this.suscriptores.clear();
  }
}
