/*
    Carga la plantilla base del consentimiento informado y los procedimientos de ejemplo
    (migraciones/plantillas_ejemplo_consentimiento.json, exportado del front) en documento_plantilla.

    Se puede correr las veces que haga falta y en cada instancia:
      - Código que no existe            → se agrega como vigente.
      - Ejemplo de fábrica más antiguo  → se publica la versión nueva y se retira la anterior.
      - Editado por la clínica          → no se toca (su versión manda).
      - Retirado por la clínica         → no se toca (lo eliminó a propósito).
      - Misma versión o más nueva       → no se toca.
    Lo ya firmado no cambia: cada consentimiento guarda su propio texto.

    Uso (desde la raíz del backend, con el .env de la instancia):
      node scripts/cargar_plantillas_consentimiento.mjs            # solo muestra lo que haría
      node scripts/cargar_plantillas_consentimiento.mjs --aplicar  # escribe en una transacción
*/
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import DataBase from "../config/Database.js";
import { nuevoId } from "../services/firma/identificadores.js";
import { ahoraUtc, aMysqlUtc } from "../services/firma/tiempo.js";

const aplicar = process.argv.includes("--aplicar");
const { plantillas } = JSON.parse(readFileSync(new URL("../migraciones/plantillas_ejemplo_consentimiento.json", import.meta.url), "utf8"));

for (const p of plantillas) {
    if (createHash("sha256").update(p.cuerpo, "utf8").digest("hex") !== p.sha256) {
        throw new Error(`Huella inválida en ${p.codigo}: el JSON fue modificado a mano.`);
    }
}

const db = DataBase.getInstance();
const conexion = await db.obtenerConexion();
const resumen = { agregadas: [], actualizadas: [], editadasPorLaClinica: [], retiradasPorLaClinica: [], alDia: [] };

try {
    await conexion.beginTransaction();
    const ahora = aMysqlUtc(ahoraUtc());

    for (const p of plantillas) {
        const [filas] = await conexion.query(
            `SELECT BIN_TO_UUID(id_plantilla) AS id_plantilla, version, estado, creado_por_clerk
             FROM documento_plantilla WHERE codigo = ? AND categoria = ? ORDER BY version DESC FOR UPDATE`,
            [p.codigo, p.categoria]
        );
        const vigente = filas.find((f) => f.estado === "vigente");
        const etiqueta = `${p.codigo} v${p.version}`;

        if (!filas.length) resumen.agregadas.push(etiqueta);
        else if (!vigente) { resumen.retiradasPorLaClinica.push(p.codigo); continue; }
        else if (vigente.creado_por_clerk) { resumen.editadasPorLaClinica.push(`${p.codigo} (v${vigente.version})`); continue; }
        else if (vigente.version >= p.version) { resumen.alDia.push(etiqueta); continue; }
        else resumen.actualizadas.push(`${p.codigo} v${vigente.version} → v${p.version}`);

        if (!aplicar) continue;
        // Primero se retira la vigente: el índice único permite una sola vigente por código.
        if (vigente) {
            await conexion.query(
                "UPDATE documento_plantilla SET estado = 'retirada', retirada_at = ? WHERE id_plantilla = UUID_TO_BIN(?)",
                [ahora, vigente.id_plantilla]
            );
        }
        await conexion.query(
            `INSERT INTO documento_plantilla (id_plantilla, codigo, categoria, version, titulo, cuerpo, cuerpo_sha256, estado, vigente_desde, creado_at)
             VALUES (UUID_TO_BIN(?), ?, ?, ?, ?, ?, ?, 'vigente', ?, ?)`,
            [nuevoId(), p.codigo, p.categoria, p.version, p.titulo, p.cuerpo, p.sha256, ahora, ahora]
        );
    }

    if (aplicar) await conexion.commit();
    else await conexion.rollback();
} catch (error) {
    await conexion.rollback().catch(() => {});
    console.error("No se cargó nada:", error.message);
    process.exitCode = 1;
} finally {
    conexion.release();
}

const titulos = {
    agregadas: "Se agregan", actualizadas: "Se actualizan",
    editadasPorLaClinica: "No se tocan (editadas por la clínica)",
    retiradasPorLaClinica: "No se tocan (retiradas por la clínica)", alDia: "Ya al día",
};
console.log(aplicar ? "\nCARGA APLICADA" : "\nSIMULACIÓN (nada se escribió; usa --aplicar)");
for (const [clave, lista] of Object.entries(resumen)) {
    if (lista.length) console.log(`\n${titulos[clave]} (${lista.length}):\n  ${lista.join("\n  ")}`);
}
// La transacción ya terminó; Database.js cierra el pool en beforeExit, que no llega
// mientras haya conexiones abiertas: se sale explícitamente.
process.exit(process.exitCode ?? 0);
