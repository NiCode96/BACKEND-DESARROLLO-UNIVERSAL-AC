import DataBase from "../config/Database.js";

// FIRMA: columnas que se pueden devolver al front. NUNCA "SELECT *": la tabla guarda
// la ubicación del certificado SIS en R2 (registro_sis_certificado_key) y quién lo
// verificó, que no deben salir en una respuesta (los listados son públicos).
// firma_estado: "activa" | "ninguna", calculado sin exponer datos de la firma.
const COLUMNAS_PUBLICAS = `
    p.id_profesional, p.nombreProfesional, p.descripcionProfesional, p.categoriaProfesional,
    p.imagenProfesional, p.estado_Profesional, p.correo_profesional, p.correoContacto,
    p.numeroTelefono, p.rutProfesional, p.usuarioAsignadoClerk,
    p.registro_sis_numero, p.registro_sis_estado,
    IF(EXISTS (SELECT 1 FROM profesional_firma f WHERE f.id_profesional = p.id_profesional AND f.estado = 'activa'),
       'activa', 'ninguna') AS firma_estado`;

export default class Profesionales {

    constructor() {
    }

    async insertarProfesionalModel(
    nombreProfesional,
    descripcionProfesional,
    correoContacto,
    numeroTelefono,
    rutProfesional,
    categoriaProfesional = null,
    imagenProfesional = null,
    ) {
        try {
            const conexion = DataBase.getInstance();
            const query = `
            INSERT INTO profesionales (        
            nombreProfesional,
            descripcionProfesional,
            categoriaProfesional,
            correoContacto,
            numeroTelefono,
            rutProfesional,
            imagenProfesional)
            VALUES (?,?,?,?,?,?,?)`;

            const params = [
                nombreProfesional,
                descripcionProfesional,
                categoriaProfesional,
                correoContacto,
                numeroTelefono,
                rutProfesional,
                imagenProfesional
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
        id_profesional,
        categoriaProfesional = undefined,
        imagenProfesional = undefined
    ) {
        try {

            const conexion = DataBase.getInstance();

            // categoriaProfesional === undefined → no vino en la petición: se conserva lo guardado
            const conCategoria = categoriaProfesional !== undefined;
            // FIRMA: imagenProfesional === undefined → no vino: se conserva la foto guardada
            const conImagen = imagenProfesional !== undefined;

            const query = `
            UPDATE profesionales SET        
            nombreProfesional = ?,
            descripcionProfesional = ?,
            ${conCategoria ? "categoriaProfesional = ?," : ""}
            correoContacto = ?,
            numeroTelefono = ?,
            rutProfesional = ?${conImagen ? ",\n            imagenProfesional = ?" : ""}
            WHERE id_profesional = ?`;

            const params = [
                nombreProfesional,
                descripcionProfesional,
                ...(conCategoria ? [categoriaProfesional] : []),
                correoContacto,
                numeroTelefono,
                rutProfesional,
                ...(conImagen ? [imagenProfesional] : []),
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
            const query = `SELECT ${COLUMNAS_PUBLICAS} FROM profesionales p WHERE p.id_profesional = ? AND p.estado_Profesional <> 0`;
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
            const query = `SELECT ${COLUMNAS_PUBLICAS} FROM profesionales p WHERE p.estado_Profesional <> 0`;
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