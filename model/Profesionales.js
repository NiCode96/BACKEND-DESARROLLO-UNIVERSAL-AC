import DataBase from "../config/Database.js";

export default class Profesionales {

    constructor() {
    }

    async insertarProfesionalModel(
    nombreProfesional,
    descripcionProfesional,
    correoContacto,
    numeroTelefono,
    rutProfesional,
    ) {
        try {
            const conexion = DataBase.getInstance();
            const query = `
            INSERT INTO profesionales (        
            nombreProfesional,
            descripcionProfesional,
            correoContacto,
            numeroTelefono,
            rutProfesional) 
            VALUES (?,?,?,?,?)`;

            const params = [
                nombreProfesional,
                descripcionProfesional,
                correoContacto,
                numeroTelefono,
                rutProfesional
            ];

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





    async actualizarProfesionalModel(
        nombreProfesional,
        descripcionProfesional,
        correoContacto,
        numeroTelefono,
        rutProfesional,
        id_profesional
    ) {
        try {

            const conexion = DataBase.getInstance();

            const query = `
            UPDATE profesionales SET        
            nombreProfesional = ?,
            descripcionProfesional = ?,
            correoContacto = ?,
            numeroTelefono = ?,
            rutProfesional = ?
            WHERE id_profesional = ?`;

            const params = [
                nombreProfesional,
                descripcionProfesional,
                correoContacto,
                numeroTelefono,
                rutProfesional,
                id_profesional
            ];

            return await conexion.ejecutarQuery(query, params);

        }catch (error) {
            throw error;
        }

    }

    //FUNCION PARA SELECCIONAR POR ID UN NUEVO PROFESIONAL
    async seleccionarCorreoEspecificoPorProfesional(id_profesional) {
        try {
            const conexion = DataBase.getInstance();
            // Se incluye el nombre para que los correos al profesional no dependan de que
            // el front lo mande en el body (llegaba vacio y se imprimia "Hola, .").
            const query = "SELECT correoContacto, nombreProfesional FROM profesionales WHERE id_profesional = ? AND estado_Profesional <> 0";
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