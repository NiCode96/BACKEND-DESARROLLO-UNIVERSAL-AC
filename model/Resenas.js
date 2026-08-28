import DataBase from "../config/Database.js";

export default class Resenas {
    constructor(
        id_resena,
        rating,
        comentario,
        paciente_id,
        profesional_id,
        clinica_id,
        estado,
        created_at
    ) {
        this.id_resena = id_resena;
        this.rating = rating;
        this.comentario = comentario;
        this.paciente_id = paciente_id;
        this.profesional_id = profesional_id;
        this.clinica_id = clinica_id;
        this.estado = estado;
        this.created_at = created_at;
    }

    async insertarResena(rating, comentario, paciente_id = null, profesional_id = null, clinica_id = null) {
        const conexion = DataBase.getInstance();
        const query = `INSERT INTO resenas (rating, comentario, paciente_id, profesional_id, clinica_id) VALUES (?,?,?,?,?)`;
        const params = [rating, comentario, paciente_id, profesional_id, clinica_id];
        try {
            const resultado = await conexion.ejecutarQuery(query, params);
            return resultado;
        } catch (error) {
            throw error;
        }
    }

    async actualizarResena(rating, comentario, id_resena) {
        const conexion = DataBase.getInstance();
        const query = `UPDATE resenas SET rating = ?, comentario = ? WHERE id_resena = ?`;
        const params = [rating, comentario, id_resena];
        try {
            const resultado = await conexion.ejecutarQuery(query, params);
            return resultado;
        } catch (error) {
            throw error;
        }
    }

    async seleccionarResenaPorID(id_resena) {
        const conexion = DataBase.getInstance();
        const query = `SELECT * FROM resenas WHERE id_resena = ? AND estado <> 0`;
        const params = [id_resena];
        try {
            const resultado = await conexion.ejecutarQuery(query, params);
            return resultado && resultado.length ? resultado[0] : null;
        } catch (error) {
            throw error;
        }
    }

    async eliminarResena(id_resena) {
        const conexion = DataBase.getInstance();
        const query = `UPDATE resenas SET estado = 0 WHERE id_resena = ?`;
        const params = [id_resena];
        try {
            const resultado = await conexion.ejecutarQuery(query, params);
            return resultado;
        } catch (error) {
            throw error;
        }
    }

    async seleccionarResenas() {
        const conexion = DataBase.getInstance();
        const query = `SELECT * FROM resenas WHERE estado <> 0 ORDER BY created_at DESC`;
        try {
            const resultado = await conexion.ejecutarQuery(query);
            return resultado;
        } catch (error) {
            throw error;
        }
    }

    async seleccionarPorProfesional(profesional_id) {
        const conexion = DataBase.getInstance();
        const query = `SELECT * FROM resenas WHERE profesional_id = ? AND estado <> 0 ORDER BY created_at DESC`;
        const params = [profesional_id];
        try {
            const resultado = await conexion.ejecutarQuery(query, params);
            return resultado;
        } catch (error) {
            throw error;
        }
    }

    async promedioPorProfesional(profesional_id) {
        const conexion = DataBase.getInstance();
        const query = `SELECT AVG(rating) AS promedio, COUNT(*) AS total FROM resenas WHERE profesional_id = ? AND estado <> 0`;
        const params = [profesional_id];
        try {
            const resultado = await conexion.ejecutarQuery(query, params);
            return resultado && resultado.length ? resultado[0] : { promedio: null, total: 0 };
        } catch (error) {
            throw error;
        }
    }
}
