#!/usr/bin/env node
import "dotenv/config";
import mongoose from "mongoose";
import { pathToFileURL } from "node:url";

/**
 * Estado de almacenamiento de MongoDB (fase 9, D68).
 *
 * No hay endpoint HTTP de administración: la medición es un script con salida
 * JSON y código de salida 1 cuando se alcanza el umbral. Así un cron o un
 * pipeline puede alertar sin exponer métricas a los colaboradores.
 */

export const COLECCIONES_IA = [
  "eventos",
  "salas",
  "mensajes",
  "propuestas",
  "planes",
  "turnos_ia",
  "config_ia",
];

const BYTES_POR_MB = 1024 * 1024;

function numeroPositivo(valor, defecto) {
  const numero = Number(valor);
  return Number.isFinite(numero) && numero > 0 ? numero : defecto;
}

function redondear(valor, decimales = 2) {
  return Math.round(valor * 10 ** decimales) / 10 ** decimales;
}

function esColeccionInexistente(error) {
  const mensaje = error instanceof Error ? error.message : String(error);
  return /ns not found|NamespaceNotFound|not found/i.test(mensaje);
}

async function statsDeColeccion(db, nombre) {
  try {
    const stats = await db.command({ collStats: nombre });
    return {
      documentos: Number(stats.count ?? 0),
      tamanoBytes: Number(stats.size ?? 0),
      almacenamientoBytes: Number(stats.storageSize ?? 0),
      indicesBytes: Number(stats.totalIndexSize ?? 0),
    };
  } catch (error) {
    if (!esColeccionInexistente(error)) throw error;
    return { documentos: 0, tamanoBytes: 0, almacenamientoBytes: 0, indicesBytes: 0 };
  }
}

/**
 * Construye el reporte a partir de un objeto `db` compatible con el driver de
 * MongoDB. Exportado para poder probarlo sin conectarse a Atlas.
 */
export async function construirReporte(db, opciones = {}) {
  const capacidadMb = numeroPositivo(opciones.capacidadMb, 512);
  const umbral = numeroPositivo(opciones.umbral, 70);
  const stats = await db.stats();

  const porColeccion = [];
  for (const coleccion of COLECCIONES_IA) {
    const medidas = await statsDeColeccion(db, coleccion);
    porColeccion.push({
      coleccion,
      documentos: medidas.documentos,
      tamanoBytes: medidas.tamanoBytes,
      almacenamientoBytes: medidas.almacenamientoBytes,
      indicesBytes: medidas.indicesBytes,
      tamanoMb: redondear(medidas.almacenamientoBytes / BYTES_POR_MB),
    });
  }

  const usadoMb = redondear(Number(stats.storageSize ?? 0) / BYTES_POR_MB);
  const dataMb = redondear(Number(stats.dataSize ?? 0) / BYTES_POR_MB);
  const porcentaje = redondear((usadoMb / capacidadMb) * 100);
  const mayor = porColeccion.reduce(
    (maximo, actual) =>
      actual.almacenamientoBytes > (maximo?.almacenamientoBytes ?? -1) ? actual : maximo,
    null,
  );

  return {
    capacidadMb,
    usadoMb,
    dataMb,
    objetos: Number(stats.objects ?? 0),
    porcentaje,
    umbral,
    superaUmbral: porcentaje >= umbral,
    mayorColeccion: mayor?.coleccion ?? null,
    porColeccion,
  };
}

async function main() {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    console.error(
      JSON.stringify({ error: "Falta MONGODB_URI para medir el almacenamiento." }),
    );
    process.exitCode = 2;
    return;
  }

  await mongoose.connect(uri, {
    dbName: process.env.MONGODB_DB ?? "diagramador",
    serverSelectionTimeoutMS: 10_000,
  });

  try {
    const reporte = await construirReporte(mongoose.connection.db, {
      capacidadMb: process.env.MONGO_CAPACIDAD_MB,
      umbral: process.env.MONGO_UMBRAL_MB,
    });
    process.stdout.write(`${JSON.stringify(reporte, null, 2)}\n`);
    process.exitCode = reporte.superaUmbral ? 1 : 0;
  } finally {
    await mongoose.disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    process.exitCode = 2;
  });
}
