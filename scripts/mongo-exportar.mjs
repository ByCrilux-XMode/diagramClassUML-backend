#!/usr/bin/env node
import "dotenv/config";
import mongoose from "mongoose";
import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { once } from "node:events";
import path from "node:path";
import { createGzip } from "node:zlib";
import { pathToFileURL } from "node:url";
import { COLECCIONES_IA } from "./mongo-estado.mjs";

/**
 * Exportación de la bitácora sin TTL (fase 9, D68).
 *
 * Recorre cada colección con cursor y escribe JSONL comprimido con gzip. No
 * carga la colección completa en memoria: respeta la contrapresión del stream.
 */

function fechaParaArchivo(fecha = new Date()) {
  return fecha.toISOString().replace(/[:.]/g, "-");
}

/**
 * Exporta una colección. `coleccion` es un `Collection` del driver; exportado
 * para probar el streaming con un cursor falso.
 */
export async function exportarColeccion(coleccion, destino, opciones = {}) {
  const batchSize = opciones.batchSize ?? 500;
  await mkdir(path.dirname(destino), { recursive: true });

  const archivo = createWriteStream(destino);
  const gzip = createGzip();
  gzip.pipe(archivo);

  const terminado = new Promise((resolver, rechazar) => {
    archivo.on("finish", resolver);
    archivo.on("error", rechazar);
    gzip.on("error", rechazar);
  });

  let documentos = 0;
  try {
    const cursor = coleccion.find({}).batchSize(batchSize);
    for await (const documento of cursor) {
      documentos += 1;
      if (!gzip.write(`${JSON.stringify(documento)}\n`)) {
        await once(gzip, "drain");
      }
    }
    gzip.end();
    await terminado;
  } catch (error) {
    gzip.destroy();
    archivo.destroy();
    throw error;
  }

  return { documentos, archivo: destino };
}

async function main() {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    console.error(JSON.stringify({ error: "Falta MONGODB_URI para exportar." }));
    process.exitCode = 2;
    return;
  }

  const directorio = process.env.MONGO_EXPORT_DIR?.trim() || "export";
  const fecha = fechaParaArchivo();

  await mongoose.connect(uri, {
    dbName: process.env.MONGODB_DB ?? "diagramador",
    serverSelectionTimeoutMS: 10_000,
  });

  try {
    const db = mongoose.connection.db;
    const resultados = [];
    for (const nombre of COLECCIONES_IA) {
      const destino = path.join(directorio, `${nombre}-${fecha}.jsonl.gz`);
      const resultado = await exportarColeccion(db.collection(nombre), destino);
      resultados.push({ coleccion: nombre, ...resultado });
    }
    process.stdout.write(`${JSON.stringify({ fecha, directorio, resultados }, null, 2)}\n`);
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
    process.exitCode = 1;
  });
}
