import DataBase from "../config/Database.js";

export default class DistribucionProfesional {
    constructor() {
    }

    // Selecciona el % vigente de cada profesional
    async seleccionarVigentes() {
        try {
            const conexion = DataBase.getInstance();
            const query = `
            SELECT
            dp.id_distribucion,
                dp.id_profesional,
                p.nombreProfesional,
                dp.porcentaje_profesional,
                dp.porcentaje_clinica,
                dp.vigente_desde
                FROM distribucion_profesional dp
                JOIN profesionales p ON p.id_profesional = dp.id_profesional
                WHERE dp.vigente_hasta IS NULL
                `;
            return await conexion.ejecutarQuery(query);
                } catch (err) {
            throw err;
        }
    }
    // Cierra la fila vigente actual e ese profesional (si existe)
        async cierraVigente(id_profesional) {
        try {
            const conexion = DataBase.getInstance();
            const query = `
                UPDATE distribucion_profesional
                SET vigente_hasta = CURDATE ()
                WHERE id_profesional = ? AND vigente_hasta IS NULL
                `;
                const params = [id_profesional];
                return await conexion.ejecutarQuery(query, params);
        } catch (err) {
            throw err;
        }           
    }

    // Inserta la nueva fila, ya como la vigente
    async insertarVigente(id_profesional, porcentaje_profesional, porcentaje_clinica) {
        try {
            const conexion = DataBase.getInstance();
            const query = `
                INSERT INTO distribucion_profesional
                        (id_profesional, porcentaje_profesional, porcentaje_clinica, vigente_desde, vigente_hasta)
                    VALUES (?, ?, ?, CURDATE(), NULL)
            `;
            const params = [id_profesional, porcentaje_profesional, porcentaje_clinica];
            return await conexion.ejecutarQuery(query, params);
        } catch (err) {
            throw err;
        }
    }

    // Orquesta las dos anteirores: Primero cierra, luego incerta.
    async actualizarDistribucion(id_profesional, porcentaje_profesional, porcentaje_clinica) {
        try {
            await this.cierraVigente(id_profesional);
            return await this.insertarVigente(id_profesional, porcentaje_profesional, porcentaje_clinica);
        } catch (err) {
            throw err;
        }
    }
}