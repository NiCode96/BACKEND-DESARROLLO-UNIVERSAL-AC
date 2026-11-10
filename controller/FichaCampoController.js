import FichaCampo from '../model/FichaCampo.js';

export default class FichaCampoController{
    constructor(){
    }

    static async listarPorCategoria(req, res){
        try {
            const {id_categoria} = req.body;

            if(!id_categoria){
                res.status(400).send({
                    message: 'sindato',
                })
            }

            const FichaCampoClass = new FichaCampo();
            const respuestaModel = await FichaCampoClass.listarPorCategoria(id_categoria);

            if(Array.isArray(respuestaModel) && respuestaModel.length > 0){
                return res.status(200).send(respuestaModel);
            }else{
               return  res.status(400).send([])
            }
        }catch{
            return res.status(500).send({
                message: `serverError`
            })
        }
    }




    static async obtenerPorId(req, res){
        try {
            const {id_campo} = req.body;

            if(!id_campo){
                res.status(400).send({
                    message: 'sindato',
                })
            }

            const FichaCampoClass = new FichaCampo();
            const respuestaModel = await FichaCampoClass.obtenerPorId(id_campo);

            if(Array.isArray(respuestaModel) && respuestaModel.length > 0){
                return res.status(200).send(respuestaModel);
            }else{
                return  res.status(400).send([])
            }
        }catch{
            return res.status(500).send({
                message: `serverError`
            })
        }
    }


    static async insertarCampo(req, res){
        try {
            const {id_categoria, nombre, requerido, orden} = req.body;

            if(!id_categoria || !nombre || !requerido || !orden){
                res.status(400).send({
                    message: 'sindato',
                })
            }

            const FichaCampoClass = new FichaCampo();
            const respuestaModel = await FichaCampoClass.insertarCampo(
                id_categoria, nombre, requerido, orden
            );

            if(respuestaModel.affectedRows > 0){
                return res.status(200).send({
                    message: true,
                });
            }else{
                return  res.status(400).send({
                    message: false
                })
            }
        }catch{
            return res.status(500).send({
                message: `serverError`
            })
        }
    }



    static async actualizarCampo(req, res){
        try {
            const {nombre, requerido, orden, id_campo} = req.body;

            if(!nombre || !requerido || !orden || !id_campo){
              return  res.status(400).send({
                    message: 'sindato',
                })
            }

            const FichaCampoClass = new FichaCampo();
            const respuestaModel = await FichaCampoClass.actualizarCampo(
                nombre, requerido, orden, id_campo
            );

            if(respuestaModel.affectedRows > 0){
                return res.status(200).send({
                    message: true,
                });
            }else{
                return  res.status(400).send({
                    message: false
                })
            }
        }catch{
            return res.status(500).send({
                message: `serverError`
            })
        }
    }




    static async eliminarCampo(req, res){
        try {
            const {id_campo} = req.body;

            if(!id_campo){
                res.status(400).send({
                    message: 'sindato',
                })
            }

            const FichaCampoClass = new FichaCampo();
            const respuestaModel = await FichaCampoClass.eliminarCampo(
               id_campo
            );

            if(respuestaModel.affectedRows > 0){
                return res.status(200).send({
                    message: true,
                });
            }else{
                return  res.status(400).send({
                    message: false
                })
            }
        }catch{
            return res.status(500).send({
                message: `serverError`
            })
        }
    }



}