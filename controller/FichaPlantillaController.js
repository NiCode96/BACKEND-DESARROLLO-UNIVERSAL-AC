import FichaPlantilla from "../model/FichaPlantilla.js";

export default class FichaPlantillaController{
    constructor(){
    }

static async listarPlantillas(req, res){
        try{
            const FichaPlantillaClass = new FichaPlantilla();
            const respuestaModel = await FichaPlantillaClass.listarPlantillas();

            if(Array.isArray(respuestaModel)&& respuestaModel.length > 0){
                return res.status(200).json(respuestaModel);
            }else{
                return res.status(200).json([]);
            }
        }catch(err){
            console.log(err);
            throw err;
        }
}


    static async obtenerPorId(req, res){
        try{
            const {id_plantilla} = req.body;

            if(!id_plantilla){
                return res.status(400).json({
                    message: "sindato"
                })
            }

            const FichaPlantillaClass = new FichaPlantilla();
            const respuestaModel = await FichaPlantillaClass.obtenerPorId(id_plantilla);

            if(Array.isArray(respuestaModel)&& respuestaModel.length > 0){
                return res.status(200).json(respuestaModel);
            }else{
                return res.status(200).json([]);
            }
        }catch(err){
            console.log(err);
            throw err;
        }
    }


    static async insertarPlantilla(req, res){
        try{
            const {nombre, descripcion} = req.body;

            if(!nombre || !descripcion){
                return res.status(400).json({
                    message: "sindato"
                })
            }

            const FichaPlantillaClass = new FichaPlantilla();
            const respuestaModel = await FichaPlantillaClass.insertarPlantilla(nombre, descripcion);

            if(respuestaModel.affectedRows > 0){
                return res.status(200).json({message : true});
            }else{
                return res.status(200).json({message : false});
            }
        }catch(err){
            console.log(err);
            throw err;
        }
    }


    static async actualizarPlantilla(req, res){
        try{
            const {nombre, descripcion, id_plantilla} = req.body;

            if(!nombre || !descripcion || !id_plantilla){
                return res.status(400).json({
                    message: "sindato"
                })
            }

            const FichaPlantillaClass = new FichaPlantilla();
            const respuestaModel = await FichaPlantillaClass.actualizarPlantilla(nombre, descripcion, id_plantilla);

            if(respuestaModel.affectedRows > 0){
                return res.status(200).json({message : true});
            }else{
                return res.status(200).json({message : false});
            }
        }catch(err){
            console.log(err);
            throw err;
        }
    }


    static async eliminarPlantilla(req, res){
        try{
            const {id_plantilla} = req.body;

            if(!id_plantilla){
                return res.status(400).json({
                    message: "sindato"
                })
            }

            const FichaPlantillaClass = new FichaPlantilla();
            const respuestaModel = await FichaPlantillaClass.eliminarPlantilla(id_plantilla);

            if(respuestaModel.affectedRows > 0){
                return res.status(200).json({message : true});
            }else{
                return res.status(200).json({message : false});
            }
        }catch(err){
            console.log(err);
        }
    }


    static async obtenerPlantillaCompleta(req, res){
        try{
            const {id_plantilla} = req.body;


            if(!id_plantilla){
                return res.status(400).json({
                    message: "sindato"
                })
            }

            const FichaPlantillaClass = new FichaPlantilla();
            const respuestaModel = await FichaPlantillaClass.obtenerPlantillaCompleta(id_plantilla);

                if(Array.isArray(respuestaModel)&&respuestaModel.length > 0){
                return res.status(200).json(respuestaModel);
            }else{
                return res.status(200).json([]);
            }
        }catch(err){
            console.log(err);
            throw err;
        }
    }


}