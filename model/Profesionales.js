import DataBase from "../config/Database.js";

export default class Profesionales {
    constructor(id_profesional, nombreProfesional, descripcionProfesional, correo_profesional, estado_Profesional) {
        this.id_profesional = id_profesional;
        this.nombreProfesional = nombreProfesional;
        this.descripcionProfesional = descripcionProfesional;
        this.correo_profesional = correo_profesional;
        this.estado_Profesional = estado_Profesional;
    }

    //FUNCION PARA INSERTAR UN NUEVO PROFESIONAL
    async insertarProfesionalModel(nombreProfesional, descripcionProfesional, correo_profesional = null) {
        try {
            const conexion = DataBase.getInstance();
            const query = "INSERT INTO profesionales (nombreProfesional, descripcionProfesional, correo_profesional) VALUES (?,?,?)";
            const params = [nombreProfesional, descripcionProfesional, correo_profesional];
            const resultado = await conexion.ejecutarQuery(query, params);
            if (resultado) {
                return resultado;
            }else {
                return resultado;
            }
        }catch (error) {
            throw error;
        }
    }

    //FUNCION PARA ACTUALIZAR UN PROFESIONAL
    // correo_profesional === undefined significa "no tocar esa columna" (el llamador no la envió).
    async actualizarProfesionalModel(nombreProfesional, descripcionProfesional, correo_profesional, id_profesional) {
        try {
            const conexion = DataBase.getInstance();
            const query = correo_profesional === undefined
                ? "UPDATE profesionales SET nombreProfesional = ?, descripcionProfesional = ? WHERE id_profesional = ?"
                : "UPDATE profesionales SET nombreProfesional = ?, descripcionProfesional = ?, correo_profesional = ? WHERE id_profesional = ?";
            const params = correo_profesional === undefined
                ? [nombreProfesional, descripcionProfesional, id_profesional]
                : [nombreProfesional, descripcionProfesional, correo_profesional, id_profesional];
            const resultado = await conexion.ejecutarQuery(query, params);
            if (resultado) {
                return resultado;
            }else {
                return resultado;
            }
        }catch (error) {
            throw  error;
        }
    }

    //FUNCION PARA SELECCIONAR POR ID UN NUEVO PROFESIONAL
    async seleccionarProfesionalPorID(id_profesional) {
        try {
            const conexion = DataBase.getInstance();
            const query = "SELECT * FROM profesionales WHERE id_profesional = ? AND estado_Profesional <> 0";
            const params = [id_profesional];
            const resultado = await conexion.ejecutarQuery(query, params);
            if (resultado) {
                return resultado;
            }else {
                return resultado;
            }
        }catch (error) {
            throw error;
        }
    }

    //FUNCION PARA ELIMINAR LOGICAMENTE CAMBIANDO ESTADO DE CERO A UNO UN PROFESIONAL
    async eliminarProfesionalPorId(id_profesional) {
        try {
            const conexion = DataBase.getInstance();
            const query = "UPDATE profesionales SET estado_Profesional = 0 WHERE id_profesional = ?";
            const params = [id_profesional];
            const resultado = await conexion.ejecutarQuery(query, params);
            if (resultado) {
                return resultado;
            }else {
                return resultado;
            }
        }catch (error) {
            throw  error;
        }
    }

    //FUNCION PARA SELECCIONAR UN NUEVO PROFESIONAL
    async seleccionarProfesionales() {
        try {
            const conexion = DataBase.getInstance();
            const query = "SELECT * FROM profesionales WHERE estado_Profesional <> 0";
            const resultado = await conexion.ejecutarQuery(query);
            if(resultado) {
                return resultado;
            }else {
                return resultado;
            }
        }catch (error) {
            throw  error;
        }
    }


}