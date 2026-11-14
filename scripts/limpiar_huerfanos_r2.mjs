/* Borra de R2 los archivos de la firma que ninguna fila referencia (subidas que
 * quedaron a medias porque el proceso se cortó entre subir y guardar).
 *
 *   node scripts/limpiar_huerfanos_r2.mjs          → solo informa (no borra)
 *   node scripts/limpiar_huerfanos_r2.mjs --borrar → borra
 *
 * Reglas de seguridad: solo mira privado/documentos/, privado/firmas* y
 * privado/consentimientos/; solo archivos con más de 24 horas; NUNCA borra un
 * archivo referenciado por la BD.
 *
 * privado/registro-sis/ queda FUERA a propósito: al reemplazar el certificado,
 * la fila apunta al nuevo, pero la huella del anterior puede seguir en la cadena de
 * firma (evento registro_sis_declarado). Ese archivo es evidencia, no basura. */

import "dotenv/config";
import DataBase from "../config/Database.js";
import { listarClaves, eliminarArchivoR2 } from "../services/r2Storage.js";

const borrar = process.argv.includes("--borrar");
const PREFIJOS = ["privado/documentos/", "privado/firmas/", "privado/firmas-trazos/", "privado/consentimientos/"];
const db = DataBase.getInstance();

try {
    const referenciadas = new Set();
    const consultas = [
        "SELECT borrador_key AS k FROM documento_emitido UNION ALL SELECT pdf_key FROM documento_emitido WHERE pdf_key IS NOT NULL",
        "SELECT imagen_key AS k FROM profesional_firma UNION ALL SELECT trazos_key FROM profesional_firma",
        "SELECT pdf_key AS k FROM consentimiento_aceptacion",
    ];
    for (const sql of consultas) for (const fila of await db.ejecutarQuery(sql)) referenciadas.add(fila.k);

    const limite = Date.now() - 24 * 60 * 60 * 1000;
    let huerfanos = 0;
    for (const prefijo of PREFIJOS) {
        let continuacion;
        do {
            const { claves, siguiente } = await listarClaves(prefijo, continuacion);
            for (const { key, modificado } of claves) {
                if (referenciadas.has(key) || new Date(modificado).getTime() > limite) continue;
                huerfanos++;
                console.log(`${borrar ? "Borrando" : "Huérfano"}: ${key}`);
                if (borrar) await eliminarArchivoR2(key);
            }
            continuacion = siguiente;
        } while (continuacion);
    }
    console.log(`${huerfanos} archivo(s) huérfano(s)${borrar ? " borrados" : " (usar --borrar para eliminarlos)"}.`);
} catch (error) {
    console.error("No se pudo limpiar:", error.message);
    process.exitCode = 1;
} finally {
    await db.cerrarConexion();
    // Salida explícita: config/Database.js vuelve a cerrar el pool en "beforeExit".
    process.exit(process.exitCode ?? 0);
}
