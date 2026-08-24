import DataBase from "../config/Database.js";

export default class DetalleCotizacion {
    constructor() {
    }
/*
TABLA: detalleCotizacion
id_cotizacion
id_detalleCotizacion
producto_servicio_cotizado
valor_producto_cotizado
observacion_producto_cotizado
fecha_creacion
fecha_actualizacion
estado_detalle_producto_cotizacion
* */

    //INSERTAR NUEVO DETALLE
    async insertarNuevoDetalle(id_cotizacion, producto_servicio_cotizado, valor_producto_cotizado, observacion_producto_cotizado) {
        try {
            const conexion = await DataBase.getInstance();
            const query =`
            insert into detalleCotizacion (id_cotizacion, producto_servicio_cotizado, valor_producto_cotizado, observacion_producto_cotizado)
            values (?, ?, ?, ?)`;
            const params = [id_cotizacion, producto_servicio_cotizado, valor_producto_cotizado, observacion_producto_cotizado];
            return await conexion.ejecutarQuery(query, params);
        }catch (e) {
            throw e;
        }
    }


    //ELIMINAR NUEVO DETALLE
    async eliminarDetalleCotizacion(id_detalle){
        try {
            const conexion = await DataBase.getInstance();
            const query = `
            update detalleCotizacion
            set estado_detalle_producto_cotizacion = 0
            where id_detalle = ?`;
            const params = [id_detalle];
            return await conexion.ejecutarQuery(query, params);
        }catch (e) {
            throw e;
        }
    }

    //ACTUALIZAR NUEVO DETALLE
    async actualizarDetalleCotizacion(observacion_producto_cotizado, id_detalle){
        try {
            const conexion = await DataBase.getInstance();
            const query = `
            update detalleCotizacion
            set observacion_producto_cotizado = ?
            where id_detalle = ?`;

            const params = [observacion_producto_cotizado, id_detalle];
            return await conexion.ejecutarQuery(query, params);

        }catch (e) {
            throw e;
        }
    }

    async seleccionarPor_id_cotizacion(id_cotizacion){
        try {
            const conexion = await DataBase.getInstance();
            const query = `
                select * from detalleCotizacion
                where id_cotizacion = ? and estado_detalle_producto_cotizacion <> 0`;
            const params = [id_cotizacion];
            return await conexion.ejecutarQuery(query, params);
        }catch (e) {
            throw e;
        }
    }

}
