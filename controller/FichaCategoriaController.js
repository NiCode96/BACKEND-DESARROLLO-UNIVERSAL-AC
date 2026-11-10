import FichaCategoria from "../model/FichaCategoria.js";

export default class FichaCategoriaController{
    constructor(){
    }

    static async listarPorPlantilla(req, res) {
        try{
            const {id_plantilla} = req.body;

            if(!id_plantilla){
                return res.status(400).send({
                    message: `sindato`
                });
            }

            const FichaCategoriaClass = new FichaCategoria();
            const resultadoModel = await FichaCategoriaClass.listarPorPlantilla(id_plantilla);

            if(Array.isArray(resultadoModel)&&resultadoModel.length > 0){
                return res.status(200).send(resultadoModel);
            }else{
                return res.status(404).send([])
            }
        }catch(err){
            return res.status(500).send({
                message: `Ha ocurrido un error: ${err}`,
            })
        }
    }








    static async obtenerPorId(req, res) {
        try{
            const {id_categoria} = req.body;

            if(!id_categoria){
                return res.status(400).send({
                    message: `sindato`
                });
            }

            const FichaCategoriaClass = new FichaCategoria();
            const resultadoModel = await FichaCategoriaClass.obtenerPorId(id_categoria);

            if(Array.isArray(resultadoModel)&&resultadoModel.length > 0){
                return res.status(200).send(resultadoModel);
            }else{
                return res.status(404).send([])
            }
        }catch(err){
            return res.status(500).send({
                message: `Ha ocurrido un error: ${err}`,
            })
        }
    }





    static async insertarCategoria(req, res) {
        try{
            const {id_plantilla, nombre, orden} = req.body;

            if(!id_plantilla || !nombre || !orden){
                return res.status(400).send({
                    message: `sindato`
                });
            }

            const FichaCategoriaClass = new FichaCategoria();
            const resultadoModel = await FichaCategoriaClass.insertarCategoria(id_plantilla, nombre, orden);

            if(resultadoModel.affectedRows > 0){
                return res.status(200).send({message: true});
            }else{
                return res.status(404).send({message: false})
            }
        }catch(err){
            return res.status(500).send({
                message: `Ha ocurrido un error: ${err}`,
            })
        }
    }






    static async actualizarCategoria(req, res) {
        try{
            const {nombre, orden, id_categoria} = req.body;

            if(!id_categoria || !nombre || !orden){
                return res.status(400).send({
                    message: `sindato`
                });
            }

            const FichaCategoriaClass = new FichaCategoria();
            const resultadoModel = await FichaCategoriaClass.actualizarCategoria(nombre, orden, id_categoria);

            if(resultadoModel.affectedRows > 0){
                return res.status(200).send({message: true});
            }else{
                return res.status(404).send({message: false})
            }
        }catch(err){
            return res.status(500).send({
                message: `Ha ocurrido un error: ${err}`,
            })
        }
    }






    static async eliminarCategoria(req, res) {
        try{
            const {id_categoria} = req.body;

            if(!id_categoria){
                return res.status(400).send({
                    message: `sindato`
                });
            }

            const FichaCategoriaClass = new FichaCategoria();
            const resultadoModel = await FichaCategoriaClass.eliminarCategoria(id_categoria);

            if(resultadoModel.affectedRows > 0){
                return res.status(200).send({message: true});
            }else{
                return res.status(404).send({message: false})
            }
        }catch(err){
            return res.status(500).send({
                message: `Ha ocurrido un error: ${err}`,
            })
        }
    }
}