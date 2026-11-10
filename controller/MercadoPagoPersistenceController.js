import MercadoPersistence from "../model/MercadoPersisntence.js";

export default class MercadoPagoPersistenceController {
    constructor() {
    }

    static async insertarPersistencia(req,res){
        try {
            const {
                nombre_cliente,
                access_token,
            }=req.body;


            if(!nombre_cliente || !access_token){
                return res.status(400).send({
                    message: `sindata`
                });
            }

            const mercadoPagoPersistence = new MercadoPersistence();
            const respuestaModel = await mercadoPagoPersistence.crearPersistencia(nombre_cliente, access_token);

            if(respuestaModel.affectedRows > 0){
                return res.status(200).send({
                    message: true
                });
            }else {

                console.log(respuestaModel);
                return res.status(200).send({
                    message: false
                });
            }

        }catch (error) {
            return res.status(400).send({
                message: `serverError ${error}`
            })
        }
    }


    static async actualizarPersistencia(req,res){
        try {
            const {
                nombre_cliente,
                access_token,
                estado_pasarela,
                id_mercadoPago_persistence
            }=req.body;

            console.log(`Datos llegados para el cambio de datos para mercado pago:`);

            if(!nombre_cliente || !access_token || !id_mercadoPago_persistence){
                return res.status(400).send({
                    message: `sindata`
                });
            }

            const mercadoPagoPersistence = new MercadoPersistence();
            const respuestaModel = await mercadoPagoPersistence.actualizarPersistencia(nombre_cliente, access_token, estado_pasarela, id_mercadoPago_persistence);

            if(respuestaModel.affectedRows > 0){
                return res.status(200).send({
                    message: true
                });
            }else {
                return res.status(200).send({
                    message: false
                });
            }

        }catch (error) {
            return res.status(400).send({
                message: `serverError`
            })
        }
    }





    static async actualizarEstado(req,res){
        try {
            const {
                estado_pasarela,
                id_mercadoPago_persistence
            }=req.body;

            if(!estado_pasarela || !id_mercadoPago_persistence){
                return res.status(400).send({
                    message: `sindata`
                });
            }

            const mercadoPagoPersistence = new MercadoPersistence();
            const respuestaModel = await mercadoPagoPersistence.actualizarEstado(estado_pasarela, id_mercadoPago_persistence);

            if(respuestaModel.affectedRows > 0){
                return res.status(200).send({
                    message: true
                });
            }else {
                return res.status(200).send({
                    message: false
                });
            }

        }catch (error) {
            return res.status(400).send({
                message: `serverError`
            })
        }
    }


    static async seleccionarMercadoPagoPersistence(req,res){
        try {
            console.log(`Seleccionando MercadoPagoPersistence`);
            const mercadoPagoPersistence = new MercadoPersistence();
            const respuestaModel = await mercadoPagoPersistence.seleccionarMercadoPagoPersistence();

            if(Array.isArray(respuestaModel) && respuestaModel.length > 0){
                res.status(200).json(respuestaModel);

            }else {
                return res.status(200).send({
                    message: false
                });
            }

        }catch (e) {
            return res.status(500).send({
                message: `serverError : ${e}`
            })
        }
    }

    static async seleccionarTOKEN(req,res){
        try {
            const mercadoPagoPersistence = new MercadoPersistence();
            const respuestaModel = await mercadoPagoPersistence.seleccionarTOKEN();

            if(Array.isArray(respuestaModel) && respuestaModel.length > 0){
                return res.status(200).send({
                    respuestaModel
                });
            }else {
                return res.status(200).send({
                    message: false
                });
            }
        } catch (e) {
            return res.status(500).send({
                message: `serverError : ${e}`
            })
        }
    }

}