import DataBase from "../config/Database.js";

export default class CotizacionesPacientes {
    constructor() {
    }



    //CREAR NUEVA COTIZACION
    async insertarCotizacion(
        nombre_cotizacion,
        profesional_solicitante_nombre,
        total_presupuesto_cotizado,
        id_paciente,
    ) {
        try {
            const conexion =  DataBase.getInstance();

            const query = `INSERT INTO cotizaciones_pacientes( nombre_cotizacion,profesional_solicitante_nombre,total_presupuesto_cotizado, id_paciente) VALUES (?,?,?,?)`;

            const params = [
                nombre_cotizacion,
                profesional_solicitante_nombre,
                total_presupuesto_cotizado,
                id_paciente
            ];

            return await conexion.ejecutarQuery(query, params);

        }catch (error) {
            throw error;
        }
    }



    //ACTUALIZAR COTIZACION ESPECIFICA POR ID
    async actualizarCotizacion(
        nombre_cotizacion,
        profesional_solicitante_nombre,
        total_presupuesto_cotizado,
        id_paciente,
        id_cotizacion_paciente

    ) {
        try {
            const conexion =  DataBase.getInstance();

            const query = `
            UPDATE cotizaciones_pacientes SET
            nombre_cotizacion = ?,
            profesional_solicitante_nombre = ?,
            total_presupuesto_cotizado = ?,
            id_paciente = ?,
            fecha_actualizacion = CURRENT_TIMESTAMP
            WHERE
            id_cotizacion_paciente = ?`;

            const params = [
                nombre_cotizacion,
                profesional_solicitante_nombre,
                total_presupuesto_cotizado,
                id_paciente,
                id_cotizacion_paciente
            ];

            return await conexion.ejecutarQuery(query, params);

        }catch (error) {
            throw error;
        }
    }



    //SELECCIOANR POR ID
    async seleccionarCotizacionEspecifica(
        id_cotizacion_paciente
    ) {
        try {
            const conexion =  DataBase.getInstance();
            const query = `
             SELECT 
             pacienteDatos.nombre, 
             pacienteDatos.apellido, 
             pacienteDatos.rut, 
             pacienteDatos.telefono, 
             pacienteDatos.correo, 
             pacienteDatos.id_paciente,
             
             cotizaciones_pacientes.id_cotizacion_paciente,
             cotizaciones_pacientes.nombre_cotizacion, 
             cotizaciones_pacientes.profesional_solicitante_nombre, 
             cotizaciones_pacientes.total_presupuesto_cotizado,
             cotizaciones_pacientes.observacionesDetalleCotizacion,
             cotizaciones_pacientes.abono_paciente,
             cotizaciones_pacientes.fecha_creacion,
             cotizaciones_pacientes.estado_cotizacion 
             
             FROM cotizaciones_pacientes 
             
             INNER JOIN pacienteDatos 
             ON pacienteDatos.id_paciente = cotizaciones_pacientes.id_paciente 
             
             WHERE id_cotizacion_paciente = ? AND
             cotizaciones_pacientes.estado_cotizacion  <> 0`;

            const params = [
                id_cotizacion_paciente
            ];
            return await conexion.ejecutarQuery(query, params);
        }catch (error) {
            throw error;
        }
    }



    //SELECCIONAR TODAS LAS COTIZACIONES DONDE EL ID DEL PACIENTE SEA X
    async seleccionar_cotizaciones_paciente_especifico_por_id(
        id_paciente
    ) {
        try {
            const conexion =  DataBase.getInstance();
            const query = `
    
    SELECT
    pacienteDatos.nombre,
    pacienteDatos.apellido,
    pacienteDatos.rut,
    pacienteDatos.telefono,
    pacienteDatos.correo,
    
    cotizaciones_pacientes.fecha_creacion,
    cotizaciones_pacientes.fecha_actualizacion,
    cotizaciones_pacientes.estado_cotizacion,
    
    cotizaciones_pacientes.id_cotizacion_paciente,
    cotizaciones_pacientes.nombre_cotizacion,
    cotizaciones_pacientes.profesional_solicitante_nombre,
    cotizaciones_pacientes.total_presupuesto_cotizado,
    cotizaciones_pacientes.estado_cotizacion
    
    FROM cotizaciones_pacientes
    
    INNER JOIN pacienteDatos
    ON pacienteDatos.id_paciente = cotizaciones_pacientes.id_paciente
  
    WHERE pacienteDatos.id_paciente = ?
    AND cotizaciones_pacientes.estado_cotizacion <> 0
    
    `;

            const params = [
                id_paciente
           ];

            return await conexion.ejecutarQuery(query, params);

        }catch (error) {
            throw error;
        }
    }





    //SELECCIONAR TODAS LAS COTIZACIONES DEL PACIENTE DONDE EL ESTADO SEA X
    async seleccionar_cotizaciones_paciente_porEstado(
        id_paciente,
        estado_cotizacion
    ) {
        try {
            const conexion =  DataBase.getInstance();
            const query = `
    
    SELECT
    pacienteDatos.nombre,
    pacienteDatos.apellido,
    pacienteDatos.rut,
    pacienteDatos.telefono,
    pacienteDatos.correo,
    cotizaciones_pacientes.nombre_cotizacion,
    cotizaciones_pacientes.profesional_solicitante_nombre,
    cotizaciones_pacientes.total_presupuesto_cotizado,
    cotizaciones_pacientes.estado_cotizacion
    
    FROM cotizaciones_pacientes
    
    INNER JOIN pacienteDatos
    ON pacienteDatos.id_paciente = cotizaciones_pacientes.id_paciente
  
    WHERE cotizaciones_pacientes.id_paciente = ?
    AND cotizaciones_pacientes.estado_cotizacion = ?
    
    `;

            const params = [
                id_paciente,
                estado_cotizacion
            ];

            return await conexion.ejecutarQuery(query, params);

        }catch (error) {
            throw error;
        }
    }





    //SELECCIONAR TODAS LAS COTIZACIONES DEL PACIENTE DONDE EL PROFESIONAL TENGA SIMILITUD CON EL NOMBRE /%%/
    async seleccionar_cotizaciones_paciente_profesional(
        id_paciente,
        profesional_solicitante_nombre,
    ) {
        try {
            const conexion = DataBase.getInstance();
            const query = `
    SELECT
    pacienteDatos.nombre,
    pacienteDatos.apellido,
    pacienteDatos.rut,
    pacienteDatos.telefono,
    pacienteDatos.correo,
    cotizaciones_pacientes.nombre_cotizacion,
    cotizaciones_pacientes.profesional_solicitante_nombre,
    cotizaciones_pacientes.total_presupuesto_cotizado,
    cotizaciones_pacientes.estado_cotizacion
    
    FROM cotizaciones_pacientes
    
    INNER JOIN pacienteDatos
    ON pacienteDatos.id_paciente = cotizaciones_pacientes.id_paciente
  
    WHERE cotizaciones_pacientes.id_paciente = ? 
    AND cotizaciones_pacientes.profesional_solicitante_nombre LIKE ?
    AND cotizaciones_pacientes.estado_cotizacion <> 0
   
    `;

            const params = [
                id_paciente,
                `%${profesional_solicitante_nombre}%`
            ];

            return await conexion.ejecutarQuery(query, params);

        }catch (error) {
            throw error;
        }
    }



    //ELIMINAR LÓGICAMENTE LA SOLICITUD
    async eliminarCotizacion(
        id_cotizacion_paciente
    ) {
        try {
            const conexion =  DataBase.getInstance();

            const query = `
            UPDATE cotizaciones_pacientes SET estado_cotizacion = 0 WHERE id_cotizacion_paciente = ?`;

            const params = [
                id_cotizacion_paciente
            ];

            return await conexion.ejecutarQuery(query, params);

        }catch (error) {
            throw error;
        }
    }






    //ACTUALIZAR TOTAL DE LA COTIZACION ESPECIFICA POR SU ID
    async actualizarTotal(
        total_presupuesto_cotizado,
        abono_paciente,
        id_cotizacion_paciente,
    ) {
        try {
            const conexion =  DataBase.getInstance();

            const query = `
            UPDATE cotizaciones_pacientes
            SET
                total_presupuesto_cotizado = ?,
                abono_paciente = ?,
                fecha_actualizacion = CURRENT_TIMESTAMP
            WHERE id_cotizacion_paciente = ?`;

            const params = [
                total_presupuesto_cotizado,
                abono_paciente,
                id_cotizacion_paciente,
            ];

            return await conexion.ejecutarQuery(query, params);

        }catch (error) {
            throw error;
        }
    }




    //ACTUALIZAR TOTAL DE LA COTIZACION ESPECIFICA POR SU ID
    async actualizarEstado(
        estado_cotizacion,
        id_cotizacion_paciente
    ) {
        try {
            const conexion =  DataBase.getInstance();

            const query = `
            UPDATE cotizaciones_pacientes
            SET estado_cotizacion = ?
            WHERE id_cotizacion_paciente = ?`;

            const params = [
                estado_cotizacion,
                id_cotizacion_paciente
            ];

            return await conexion.ejecutarQuery(query, params);

        }catch (error) {
            throw error;
        }
    }




    //ACTUALIZAR TOTAL DE LA observacionesDetalleCotizacion ESPECIFICA POR SU ID
    async actualizarObservacion(
        observacionesDetalleCotizacion,
        id_cotizacion_paciente
    ) {
        try {
            const conexion =  DataBase.getInstance();

            const query = `
            UPDATE cotizaciones_pacientes
            SET observacionesDetalleCotizacion = ?
            WHERE id_cotizacion_paciente = ?`;

            const params = [
                observacionesDetalleCotizacion,
                id_cotizacion_paciente
            ];

            return await conexion.ejecutarQuery(query, params);

        }catch (error) {
            throw error;
        }
    }


}
