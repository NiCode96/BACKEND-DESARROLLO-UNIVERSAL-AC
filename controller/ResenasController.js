import Resenas from '../model/Resenas.js';

export default class ResenasController {

    constructor() {}

    // FUNCION PARA INSERTAR UNA NUEVA RESEÑA
    static async insertarResenaController(req, res) {
        try {
            const { rating, comentario, paciente_id, profesional_id, clinica_id } = req.body;

            if (rating === undefined || rating === null || !comentario || (!paciente_id && !profesional_id)) {
                return res.status(400).json({ message: "sindata" });
            }

            if (rating < 1 || rating > 5) {
                return res.status(400).json({ message: "ratingInvalido" });
            }

            const resenaClass = new Resenas();
            const resultado = await resenaClass.insertarResena(rating, comentario, paciente_id, profesional_id, clinica_id);

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
