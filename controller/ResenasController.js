import Resenas from '../model/Resenas.js';

const COMENTARIO_MAX_LARGO = 1000;
const NOMBRE_MAX_LARGO = 100;

// Valida que un id opcional venga como entero positivo. Devuelve null si no vino,
// undefined si vino pero es inválido (para poder distinguir "sindata" de "no vino").
function normalizarIdOpcional(valor) {
    if (valor === undefined || valor === null || valor === '') return null;
    const numero = Number(valor);
    if (!Number.isInteger(numero) || numero <= 0) return undefined;
    return numero;
}

// Valida un texto opcional (nombre/apellido de invitado). Misma convención que normalizarIdOpcional.
function normalizarTextoOpcional(valor) {
    if (valor === undefined || valor === null || valor === '') return null;
    if (typeof valor !== 'string') return undefined;
    const limpio = valor.trim();
    if (!limpio || limpio.length > NOMBRE_MAX_LARGO) return undefined;
    return limpio;
}

export default class ResenasController {

    constructor() {}

    // FUNCION PARA INSERTAR UNA NUEVA RESEÑA
    static async insertarResenaController(req, res) {
        try {
            const { rating, comentario } = req.body;

            if (rating === undefined || rating === null || typeof comentario !== 'string') {
                return res.status(400).json({ message: "sindata" });
            }

            const ratingNumero = Number(rating);
            if (!Number.isInteger(ratingNumero) || ratingNumero < 1 || ratingNumero > 5) {
                return res.status(400).json({ message: "ratingInvalido" });
            }

            const comentarioLimpio = comentario.trim();
            if (!comentarioLimpio || comentarioLimpio.length > COMENTARIO_MAX_LARGO) {
                return res.status(400).json({ message: "sindata" });
            }

            const paciente_id = normalizarIdOpcional(req.body.paciente_id);
            const profesional_id = normalizarIdOpcional(req.body.profesional_id);
            const clinica_id = normalizarIdOpcional(req.body.clinica_id);

            if (paciente_id === undefined || profesional_id === undefined || clinica_id === undefined) {
                return res.status(400).json({ message: "sindata" });
            }

            if (!paciente_id && !profesional_id) {
                return res.status(400).json({ message: "sindata" });
            }

            const nombre_invitado = normalizarTextoOpcional(req.body.nombre_invitado);
            const apellido_invitado = normalizarTextoOpcional(req.body.apellido_invitado);

            if (nombre_invitado === undefined || apellido_invitado === undefined) {
                return res.status(400).json({ message: "sindata" });
            }

            // Sin paciente registrado, la reseña necesita al menos un nombre de invitado.
            if (!paciente_id && !nombre_invitado) {
                return res.status(400).json({ message: "sindata" });
            }

            const resenaClass = new Resenas();
            const resultado = await resenaClass.insertarResena(
                ratingNumero, comentarioLimpio, paciente_id, profesional_id, clinica_id, nombre_invitado, apellido_invitado
            );

            if (resultado.affectedRows > 0) {
                res.status(200).json({ message: true });
            } else {
                res.status(500).json({ message: false });
            }
        } catch (error) {
            res.status(500).json({ message: "serverError" });
        }
    }

    // FUNCION PARA LISTAR LAS RESEÑAS DE UN PROFESIONAL
    static async seleccionarPorProfesionalController(req, res) {
        try {
            const { profesional_id } = req.body;
            if (!profesional_id) {
                return res.status(400).json({ message: "sindata" });
            }

            const resenaClass = new Resenas();
            const resultado = await resenaClass.seleccionarPorProfesional(profesional_id);

            res.status(200).json(resultado);
        } catch (error) {
            res.status(500).json({ message: "serverError" });
        }
    }

    // FUNCION PARA OBTENER EL PROMEDIO Y TOTAL DE UN PROFESIONAL
    static async promedioPorProfesionalController(req, res) {
        try {
            const { profesional_id } = req.body;
            if (!profesional_id) {
                return res.status(400).json({ message: "sindata" });
            }

            const resenaClass = new Resenas();
            const resultado = await resenaClass.promedioPorProfesional(profesional_id);

            res.status(200).json(resultado);
        } catch (error) {
            res.status(500).json({ message: "serverError" });
        }
    }

    // FUNCION PARA ACTUALIZAR UNA RESEÑA EXISTENTE
    static async actualizarResenaController(req, res) {
        try {
            const { id_resena, rating, comentario } = req.body;

            if (!id_resena || rating === undefined || rating === null || !comentario) {
                return res.status(400).json({ message: "sindata" });
            }

            if (rating < 1 || rating > 5) {
                return res.status(400).json({ message: "ratingInvalido" });
            }

            const resenaClass = new Resenas();
            const resultado = await resenaClass.actualizarResena(rating, comentario, id_resena);

            if (resultado.affectedRows > 0) {
                res.status(200).json({ message: true });
            } else {
                res.status(404).json({ message: "noEncontrada" });
            }
        } catch (error) {
            res.status(500).json({ message: "serverError" });
        }
    }

    // FUNCION PARA ELIMINAR (DESACTIVAR) LOGICAMENTE UNA RESEÑA
    static async eliminarResenaController(req, res) {
        try {
            const { id_resena } = req.body;

            if (!id_resena) {
                return res.status(400).json({ message: "sindata" });
            }

            const resenaClass = new Resenas();
            const resultado = await resenaClass.eliminarResena(id_resena);

            if (resultado.affectedRows > 0) {
                res.status(200).json({ message: true });
            } else {
                res.status(404).json({ message: "noEncontrada" });
            }
        } catch (error) {
            res.status(500).json({ message: "serverError" });
        }
    }

    // FUNCION PARA LISTAR TODAS LAS RESEÑAS (uso interno / dashboard)
    static async seleccionarTodasLasResenas(req, res) {
        try {
            const resenaClass = new Resenas();
            const resultado = await resenaClass.seleccionarResenas();
            res.status(200).json(resultado);
        } catch (error) {
            res.status(500).json({ message: "serverError" });
        }
    }
}
