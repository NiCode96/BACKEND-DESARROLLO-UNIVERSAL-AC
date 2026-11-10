import DataBase from "../config/Database.js";
import { sqlIso, isoDesdeMysql } from "../services/firma/tiempo.js";

/* Documentos emitidos con firma electrónica (tabla documento_emitido).
 * Estados: pendiente_firma → firmado | anulado. Un documento firmado no cambia
 * (trigger trg_documento_firmado_inmutable): solo puede anularse. */

const SELECT_DOCUMENTO = `
    SELECT BIN_TO_UUID(d.id_documento) AS id_documento, d.codigo_verificacion, d.tipo_documento, d.titulo,
           d.estado, d.referencia_tabla, d.referencia_id, d.id_paciente, d.id_profesional_firmante,
           d.metadatos_json, d.zona_firma_json, d.zona_paciente_json,
           BIN_TO_UUID(d.paciente_otp_id) AS paciente_otp_id, ${sqlIso("d.paciente_acepto_at", "paciente_acepto_at")},
           d.paciente_canal, d.paciente_destino, d.paciente_firmante,
           d.borrador_key, d.borrador_sha256, d.borrador_bytes, d.paginas,
           BIN_TO_UUID(d.preparado_por_usuario) AS preparado_por_usuario, d.preparado_por_clerk_id, d.preparado_por_nombre,
           ${sqlIso("d.preparado_at", "preparado_at")},
           BIN_TO_UUID(d.id_firma) AS id_firma, ${sqlIso("d.firmado_at", "firmado_at")},
           d.pdf_key, d.pdf_sha256, d.pdf_bytes, ${sqlIso("d.anulado_at", "anulado_at")}, d.motivo_anulacion,
           TRIM(CONCAT(COALESCE(pa.nombre, ''), ' ', COALESCE(pa.apellido, ''))) AS paciente_nombre,
           pr.nombreProfesional AS firmante_nombre
    FROM documento_emitido d
    LEFT JOIN pacienteDatos pa ON pa.id_paciente = d.id_paciente
    LEFT JOIN profesionales pr ON pr.id_profesional = d.id_profesional_firmante`;

const json = (valor) => (valor == null ? null : typeof valor === "string" ? JSON.parse(valor) : valor);

/** Fila → objeto `documento` del contrato (sin claves R2 ni datos internos). */
export function aObjetoDocumento(fila) {
    if (!fila) return null;
    return {
        id_documento: fila.id_documento,
        codigo_verificacion: fila.codigo_verificacion,
        tipo_documento: fila.tipo_documento,
        titulo: fila.titulo,
        estado: fila.estado,
        id_paciente: fila.id_paciente,
        paciente_nombre: fila.paciente_nombre || null,
        id_profesional_firmante: fila.id_profesional_firmante,
        firmante_nombre: fila.firmante_nombre || null,
        preparado_por: fila.preparado_por_nombre || null,
        preparado_at: isoDesdeMysql(fila.preparado_at),
        firmado_at: isoDesdeMysql(fila.firmado_at),
        pdf_sha256: fila.pdf_sha256 || null,
        paginas: fila.paginas,
        anulado_at: isoDesdeMysql(fila.anulado_at),
        requiere_aceptacion_paciente: Boolean(fila.zona_paciente_json),
        paciente_acepto_at: isoDesdeMysql(fila.paciente_acepto_at),
    };
}

/** Fila con los JSON ya parseados (uso interno de los controladores). */
export function normalizarFila(fila) {
    if (!fila) return null;
    // Instantes ya en ISO UTC con milisegundos (DATE_FORMAT entrega microsegundos).
    const instantes = Object.fromEntries(Object.entries(fila).filter(([k]) => k.endsWith("_at")).map(([k, v]) => [k, isoDesdeMysql(v)]));
    return {
        ...fila,
        ...instantes,
        metadatos: json(fila.metadatos_json) || {},
        zona_firma: json(fila.zona_firma_json),
        zona_paciente: json(fila.zona_paciente_json),
    };
}

export default class DocumentoEmitido {

    async insertar(d) {
        return DataBase.getInstance().ejecutarQuery(
            `INSERT INTO documento_emitido (
                id_documento, codigo_verificacion, tipo_documento, titulo, estado, referencia_tabla, referencia_id,
                id_paciente, id_profesional_firmante, metadatos_json, zona_firma_json, zona_paciente_json,
                borrador_key, borrador_sha256, borrador_bytes, paginas,
                preparado_por_usuario, preparado_por_clerk_id, preparado_por_nombre, preparado_at, preparado_ip
            ) VALUES (UUID_TO_BIN(?), ?, ?, ?, 'pendiente_firma', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, UUID_TO_BIN(?), ?, ?, ?, ?)`,
            [
                d.id_documento, d.codigo_verificacion, d.tipo_documento, d.titulo, d.referencia_tabla, d.referencia_id,
                d.id_paciente, d.id_profesional_firmante, JSON.stringify(d.metadatos), JSON.stringify(d.zona_firma),
                d.zona_paciente ? JSON.stringify(d.zona_paciente) : null,
                d.borrador_key, d.borrador_sha256, d.borrador_bytes, d.paginas,
                d.preparado_por_usuario, d.preparado_por_clerk_id, d.preparado_por_nombre, d.preparado_at, d.preparado_ip,
            ]
        );
    }

    async seleccionarPorId(id_documento, conexion = null) {
        const query = `${SELECT_DOCUMENTO} WHERE d.id_documento = UUID_TO_BIN(?) ${conexion ? "FOR UPDATE OF d" : ""}`;
        if (conexion) {
            const [filas] = await conexion.query(query, [id_documento]);
            return normalizarFila(filas[0]);
        }
        const filas = await DataBase.getInstance().ejecutarQuery(query, [id_documento]);
        return normalizarFila(filas[0]);
    }

    async listarPorPaciente(id_paciente) {
        return DataBase.getInstance().ejecutarQuery(`${SELECT_DOCUMENTO} WHERE d.id_paciente = ? ORDER BY d.preparado_at DESC LIMIT 200`, [id_paciente]);
    }

    async listarPendientesPorFirmante(id_profesional) {
        return DataBase.getInstance().ejecutarQuery(
            `${SELECT_DOCUMENTO} WHERE d.id_profesional_firmante = ? AND d.estado = 'pendiente_firma' ORDER BY d.preparado_at ASC LIMIT 200`,
            [id_profesional]
        );
    }

    async marcarFirmado(conexion, id_documento, f) {
        return conexion.query(
            `UPDATE documento_emitido SET estado = 'firmado', id_firma = UUID_TO_BIN(?), firmado_por_usuario = UUID_TO_BIN(?),
                firmado_por_clerk_id = ?, firmado_at = ?, pdf_key = ?, pdf_sha256 = ?, pdf_bytes = ?
             WHERE id_documento = UUID_TO_BIN(?) AND estado = 'pendiente_firma'`,
            [f.id_firma, f.firmado_por_usuario, f.firmado_por_clerk_id, f.firmado_at, f.pdf_key, f.pdf_sha256, f.pdf_bytes, id_documento]
        );
    }

    async registrarAceptacionPaciente(conexion, id_documento, a) {
        return conexion.query(
            `UPDATE documento_emitido SET paciente_otp_id = UUID_TO_BIN(?), paciente_acepto_at = ?, paciente_canal = ?,
                paciente_destino = ?, paciente_firmante = ?
             WHERE id_documento = UUID_TO_BIN(?) AND estado = 'pendiente_firma'`,
            [a.id_otp, a.acepto_at, a.canal, a.destino, a.firmante, id_documento]
        );
    }

    async anular(conexion, id_documento, idUsuario, motivo, anuladoAt) {
        return conexion.query(
            `UPDATE documento_emitido SET estado = 'anulado', anulado_por_usuario = UUID_TO_BIN(?), anulado_at = ?, motivo_anulacion = ?
             WHERE id_documento = UUID_TO_BIN(?) AND estado IN ('pendiente_firma','firmado')`,
            [idUsuario, anuladoAt, motivo, id_documento]
        );
    }
}
