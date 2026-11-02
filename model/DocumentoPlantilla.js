import DataBase from "../config/Database.js";
import { sqlIso } from "../services/firma/tiempo.js";

/* Textos legales versionados (tabla documento_plantilla): acta de adhesión FES,
 * política de privacidad, derechos y deberes del paciente, consentimiento base y anexos.
 * Un texto vigente nunca se edita: se publica una versión nueva y la anterior
 * queda "retirada" (lo ya aceptado conserva su versión y su huella). */
export default class DocumentoPlantilla {

    //SELECCIONAR LAS PLANTILLAS VIGENTES DE UNA CATEGORIA
    async seleccionarVigentesPorCategoria(categoria) {
        const query = `
            SELECT BIN_TO_UUID(id_plantilla) AS id_plantilla, codigo, categoria, version, titulo, cuerpo,
                   cuerpo_sha256 AS sha256, ${sqlIso("vigente_desde")}
            FROM documento_plantilla
            WHERE categoria = ? AND estado = 'vigente'
            ORDER BY codigo`;
        return DataBase.getInstance().ejecutarQuery(query, [categoria]);
    }

    //SELECCIONAR LA VERSION VIGENTE DE UN CODIGO (P. EJ. acta_adhesion_fes)
    async seleccionarVigentePorCodigo(codigo) {
        const query = `
            SELECT BIN_TO_UUID(id_plantilla) AS id_plantilla, codigo, categoria, version, titulo, cuerpo,
                   cuerpo_sha256 AS sha256
            FROM documento_plantilla
            WHERE codigo = ? AND estado = 'vigente'
            LIMIT 1`;
        const filas = await DataBase.getInstance().ejecutarQuery(query, [codigo]);
        return filas[0] || null;
    }

    // ── Procedimientos del consentimiento informado (anexos) ──────────────
    // creado_por: nombre de quien publicó la versión (NULL en los textos de ejemplo del seed).

    //TODAS LAS VERSIONES DE UN CODIGO (HISTORIAL), LA MAS RECIENTE PRIMERO
    async historial(codigo) {
        const query = `
            SELECT BIN_TO_UUID(p.id_plantilla) AS id_plantilla, p.codigo, p.version, p.titulo, p.cuerpo,
                   p.cuerpo_sha256 AS sha256, p.estado, ${sqlIso("p.vigente_desde", "vigente_desde")},
                   ${sqlIso("p.retirada_at", "retirada_at")}, p.creado_por_clerk, u.nombre AS creado_por
            FROM documento_plantilla p
            LEFT JOIN usuario_plataforma u ON u.clerk_user_id = p.creado_por_clerk
            WHERE p.codigo = ? AND p.categoria = 'anexo_procedimiento'
            ORDER BY p.version DESC`;
        return DataBase.getInstance().ejecutarQuery(query, [codigo]);
    }

    //ANEXOS VIGENTES CON EL NOMBRE DE QUIEN LOS PUBLICO
    async anexosVigentes() {
        const query = `
            SELECT BIN_TO_UUID(p.id_plantilla) AS id_plantilla, p.codigo, p.version, p.titulo, p.cuerpo,
                   p.cuerpo_sha256 AS sha256, p.estado, ${sqlIso("p.vigente_desde", "vigente_desde")},
                   p.creado_por_clerk, u.nombre AS creado_por
            FROM documento_plantilla p
            LEFT JOIN usuario_plataforma u ON u.clerk_user_id = p.creado_por_clerk
            WHERE p.categoria = 'anexo_procedimiento' AND p.estado = 'vigente'
            ORDER BY p.titulo`;
        return DataBase.getInstance().ejecutarQuery(query);
    }

    //¿EXISTE ALGUNA VERSION DE ESTE CODIGO? (PARA NO REPETIR CODIGOS AL CREAR)
    async existeCodigo(codigo) {
        const filas = await DataBase.getInstance().ejecutarQuery("SELECT 1 FROM documento_plantilla WHERE codigo = ? LIMIT 1", [codigo]);
        return filas.length > 0;
    }

    //VIGENTE DE UN CODIGO CON BLOQUEO (DENTRO DE UNA TRANSACCION)
    async vigenteParaActualizar(conexion, codigo) {
        const [filas] = await conexion.query(
            `SELECT BIN_TO_UUID(id_plantilla) AS id_plantilla, codigo, version, titulo, cuerpo
             FROM documento_plantilla WHERE codigo = ? AND categoria = 'anexo_procedimiento' AND estado = 'vigente'
             FOR UPDATE`,
            [codigo]
        );
        return filas[0] || null;
    }

    async retirar(conexion, id_plantilla, ahora) {
        return conexion.query(
            "UPDATE documento_plantilla SET estado = 'retirada', retirada_at = ? WHERE id_plantilla = UUID_TO_BIN(?) AND estado = 'vigente'",
            [ahora, id_plantilla]
        );
    }

    async insertarVigente(conexion, p) {
        return conexion.query(
            `INSERT INTO documento_plantilla (id_plantilla, codigo, categoria, version, titulo, cuerpo, cuerpo_sha256, estado, vigente_desde, creado_por_clerk, creado_at)
             VALUES (UUID_TO_BIN(?), ?, 'anexo_procedimiento', ?, ?, ?, ?, 'vigente', ?, ?, ?)`,
            [p.id_plantilla, p.codigo, p.version, p.titulo, p.cuerpo, p.sha256, p.ahora, p.creado_por_clerk, p.ahora]
        );
    }
}
