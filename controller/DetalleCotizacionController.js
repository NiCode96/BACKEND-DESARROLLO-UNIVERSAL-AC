import DetalleCotizacion from "../model/DetalleCotizacion.js";

export default class DetalleCotizacionController{

    constructor() {
    }

    static async insertarNuevoDetalle(req, res){
        try {
            const {
                id_cotizacion,
                producto_servicio_cotizado,
                valor_producto_cotizado,
                observacion_producto_cotizado
            }= req.body;

            if(!id_cotizacion || !producto_servicio_cotizado || !valor_producto_cotizado){
                return res.status(400).send({error: "Faltan datos requeridos"});
            }

            const DetalleCotizacionModel = new DetalleCotizacion();
            const resultado = await DetalleCotizacionModel.insertarNuevoDetalle(
                id_cotizacion,
                producto_servicio_cotizado,
                valor_producto_cotizado,
                observacion_producto_cotizado
            );

            if(resultado.affectedRows > 0){
                return res.status(200).send({
                    message: true
                })
            }else{
                return res.status(200).send({
                    message: false
                })
            }
        }catch (e) {
            return res.status(500).send({error: e});
        }
    }




    static async eliminarDetalleCotizacion(req, res){
        try {
            const {id_detalle} = req.body;
            if(!id_detalle){
                return res.status(400).send({message: "sindata"});
            }
            const DetalleCotizacionModel = new DetalleCotizacion();
            const resultado = await DetalleCotizacionModel.eliminarDetalleCotizacion(id_detalle);

            if(resultado.affectedRows > 0){
                return res.status(200).send({
                    message: true
                })
            }else{
                return res.status(200).send({
                    message: false
                })
            }
        }catch (e) {
            return res.status(500).send({error: e});
        }
    }



    static async actualizarDetalleCotizacion(req, res){
        try {
            const {observacion_producto_cotizado, id_detalle} = req.body;
            if(!observacion_producto_cotizado || !id_detalle){
                return res.status(400).send({message: "sindata"});
            }
            const DetalleCotizacionModel = new DetalleCotizacion();
            const resultado = await DetalleCotizacionModel.actualizarDetalleCotizacion(observacion_producto_cotizado, id_detalle);

            if(resultado.affectedRows > 0){
                return res.status(200).send({
                    message: true
                })
            }else{
                return res.status(200).send({
                    message: false
                })
            }
        }catch (e) {
            return res.status(500).send({error: e});
        }
    }


    static async seleccionarPorIdCotizacion(req, res){
        try {
            const {id_cotizacion} = req.body;
            if(!id_cotizacion){
                return res.status(400).send({message: "sindata"});
            }
            const DetalleCotizacionModel = new DetalleCotizacion();
            const respuestaData = await DetalleCotizacionModel.seleccionarPor_id_cotizacion(id_cotizacion);

            if(Array.isArray(respuestaData) && respuestaData.length > 0){
                return res.status(200).send(respuestaData);
            }else{
                return res.status(200).send([]);
            }
        }catch (e) {
            return res.status(500).send({error: e});
        }
    }
}
