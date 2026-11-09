import DataBase from "../config/Database.js";
import DocumentoPlantilla from "../model/DocumentoPlantilla.js";
import { nuevoId, esDuplicado } from "../services/firma/identificadores.js";
import { ahoraUtc, aMysqlUtc, isoDesdeMysql } from "../services/firma/tiempo.js";
import { sha256 } from "../services/firma/huellas.js";
import { esAdministrador, esRolClinico } from "../services/firma/roles.js";
import {
    construirCuerpoAnexo, validarProcedimiento, codigoDesdeNombre, tituloPlantilla, separarTitulo,
} from "../services/firma/anexos.js";

/* Procedimientos del consentimiento informado (anexos de la plantilla base).
 * Contrato: docs/firma/02 §7.8. Se guardan en documento_plantilla (categoría
 * "anexo_procedimiento"): no hay tabla nueva.
 *
 * El texto lo ARMA EL SERVIDOR a partir de los campos fijos (services/firma/
 * anexos.js, copia exacta del front): el cliente nunca manda texto libre.
 * Editar publica una versión nueva y retira la anterior en la misma transacción;
 * los consentimientos ya firmados guardan su propio snapshot del texto y no cambian. */

const normalizarNombre = (texto) => String(texto ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

function aObjeto(fila) {
    const { grupo, nombre } = separarTitulo(fila.titulo);
    return {
        id_plantilla: fila.id_plantilla,
        codigo: fila.codigo,
        grupo,
        nombre,
        version: fila.version,
        cuerpo: fila.cuerpo,
        sha256: fila.sha256,
        estado: fila.estado,
        vigente_desde: isoDesdeMysql(fila.vigente_desde),
        retirada_at: isoDesdeMysql(fila.retirada_at),
        creado_por: fila.creado_por || null,
        origen: fila.creado_por_clerk ? "clinica" : "ejemplo",
    };
}

function leerDatos(body) {
    const nombre = String(body?.nombre ?? "").trim();
    const grupo = String(body?.grupo ?? "").trim();
    const campos = body?.campos && typeof body.campos === "object" ? body.campos : {};
    return { nombre, grupo, campos };
}

/** Publica una versión (y retira la anterior si existe) en una transacción. */
async function publicarVersion({ codigo, datos, usuario }) {
    const modelo = new DocumentoPlantilla();
    const cuerpo = construirCuerpoAnexo(datos.campos);
    const titulo = tituloPlantilla(datos.grupo, datos.nombre);
    const conexion = await DataBase.getInstance().obtenerConexion();
    try {
        await conexion.beginTransaction();
        const actual = await modelo.vigenteParaActualizar(conexion, codigo);
        if (actual && actual.cuerpo === cuerpo && actual.titulo === titulo) {
            await conexion.rollback();
            return { sinCambios: true };
        }
        const ahora = aMysqlUtc(ahoraUtc());
        // Primero se retira la vigente: el índice único permite una sola vigente por código.
        if (actual) await modelo.retirar(conexion, actual.id_plantilla, ahora);
        const id_plantilla = nuevoId();
        await modelo.insertarVigente(conexion, {
            id_plantilla, codigo, version: (actual?.version || 0) + 1, titulo, cuerpo,
            sha256: sha256(cuerpo), ahora, creado_por_clerk: usuario.clerkId,
        });
        await conexion.commit();
        return { id_plantilla };
    } catch (error) {
        await conexion.rollback().catch(() => {});
        throw error;
    } finally {
        conexion.release();
    }
}

async function vigentePorCodigo(codigo) {
    return (await new DocumentoPlantilla().historial(codigo)).find((v) => v.estado === "vigente") || null;
}

export default class ProcedimientosController {

    // POST /procedimientos/listar → anexos vigentes
    static async listar(req, res) {
        try {
            if (!esRolClinico(req.usuario)) return res.status(403).json({ message: "sinPermiso" });
            const filas = await new DocumentoPlantilla().anexosVigentes();
            return res.status(200).json({ message: true, procedimientos: filas.map(aObjeto) });
        } catch (error) {
            console.error("[PROCEDIMIENTOS] listar:", error.message);
            return res.status(500).json({ message: "serverError" });
        }
    }

    // POST /procedimientos/historial { codigo }
    static async historial(req, res) {
        try {
            if (!esRolClinico(req.usuario)) return res.status(403).json({ message: "sinPermiso" });
            const codigo = String(req.body?.codigo ?? "");
            if (!codigo) return res.status(400).json({ message: "sindata" });
            const filas = await new DocumentoPlantilla().historial(codigo);
            return res.status(200).json({ message: true, versiones: filas.map(aObjeto) });
        } catch (error) {
            console.error("[PROCEDIMIENTOS] historial:", error.message);
            return res.status(500).json({ message: "serverError" });
        }
    }

    // POST /procedimientos/crear { nombre, grupo, campos } (administrador)
    static async crear(req, res) {
        try {
            if (!esAdministrador(req.usuario)) return res.status(403).json({ message: "sinPermiso" });
            const datos = leerDatos(req.body);
            if (Object.keys(validarProcedimiento(datos)).length) return res.status(422).json({ message: "datoinvalido" });

            // Dos procedimientos vigentes con el mismo nombre y especialidad confundirían al
            // elegir: se pide editar el existente (que publica una versión nueva).
            const modelo = new DocumentoPlantilla();
            const repetido = (await modelo.anexosVigentes()).map(aObjeto).find((p) =>
                normalizarNombre(p.nombre) === normalizarNombre(datos.nombre) && normalizarNombre(p.grupo) === normalizarNombre(datos.grupo));
            if (repetido) return res.status(409).json({ message: "procedimientoDuplicado", codigo: repetido.codigo });

            // Código único a partir del nombre: "anexo_relleno_de_labios", "…_2" si ya existió uno retirado.
            const base = codigoDesdeNombre(datos.nombre);
            let codigo = base;
            for (let n = 2; await modelo.existeCodigo(codigo); n++) codigo = `${base}_${n}`.slice(0, 80);

            await publicarVersion({ codigo, datos, usuario: req.usuario });
            return res.status(200).json({ message: true, procedimiento: aObjeto(await vigentePorCodigo(codigo)) });
        } catch (error) {
            if (esDuplicado(error)) return res.status(409).json({ message: "conflicto" });
            console.error("[PROCEDIMIENTOS] crear:", error.message);
            return res.status(500).json({ message: "serverError" });
        }
    }

    // POST /procedimientos/nuevaVersion { codigo, nombre, grupo, campos } (administrador)
    static async nuevaVersion(req, res) {
        try {
            if (!esAdministrador(req.usuario)) return res.status(403).json({ message: "sinPermiso" });
            const codigo = String(req.body?.codigo ?? "");
            const datos = leerDatos(req.body);
            if (!codigo) return res.status(400).json({ message: "sindata" });
            if (Object.keys(validarProcedimiento(datos)).length) return res.status(422).json({ message: "datoinvalido" });
            if (!(await vigentePorCodigo(codigo))) return res.status(404).json({ message: "noEncontrado" });

            const resultado = await publicarVersion({ codigo, datos, usuario: req.usuario });
            if (resultado.sinCambios) return res.status(409).json({ message: "sinCambios" });
            return res.status(200).json({ message: true, procedimiento: aObjeto(await vigentePorCodigo(codigo)) });
        } catch (error) {
            if (esDuplicado(error)) return res.status(409).json({ message: "conflicto" });
            console.error("[PROCEDIMIENTOS] nuevaVersion:", error.message);
            return res.status(500).json({ message: "serverError" });
        }
    }

    // POST /procedimientos/retirar { codigo } (administrador)
    // Deja de ofrecerse en consentimientos nuevos. No borra nada.
    static async retirar(req, res) {
        const conexion = await DataBase.getInstance().obtenerConexion();
        try {
            if (!esAdministrador(req.usuario)) return res.status(403).json({ message: "sinPermiso" });
            const codigo = String(req.body?.codigo ?? "");
            if (!codigo) return res.status(400).json({ message: "sindata" });
            await conexion.beginTransaction();
            const modelo = new DocumentoPlantilla();
            const actual = await modelo.vigenteParaActualizar(conexion, codigo);
            if (!actual) {
                await conexion.rollback();
                return res.status(404).json({ message: "noEncontrado" });
            }
            await modelo.retirar(conexion, actual.id_plantilla, aMysqlUtc(ahoraUtc()));
            await conexion.commit();
            return res.status(200).json({ message: true });
        } catch (error) {
            await conexion.rollback().catch(() => {});
            console.error("[PROCEDIMIENTOS] retirar:", error.message);
            return res.status(500).json({ message: "serverError" });
        } finally {
            conexion.release();
        }
    }
}
