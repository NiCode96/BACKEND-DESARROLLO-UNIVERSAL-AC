import DatosEmpresa from '../model/DatosEmpresa.js';


export default class DatosEmpresaController {
    constructor() {
    }

    //SELECCIONAR TODOS LOS DATOS DE LA TABLA
    static async seleccionarDatosEmpresa(req, res) {
        try {
            const datosEmpresaObjeto = new DatosEmpresa();
            const respuestaModel = await datosEmpresaObjeto.seleccionarDatosEmpresa();
            return res.status(200).json(respuestaModel);

        }catch(err) {
            return res.status(500).json({
                message: `serverError: ${err}`,
            })
        }
    }




    //SELECCIONAR TODOS LOS DATOS DE LA TABLA
    static async seleccionarDatosEspecificos_porId(req, res) {
        try {
            const { id_empresa } = req.body;

            const datosEmpresaObjeto = new DatosEmpresa();
            const respuestaModel = await datosEmpresaObjeto.seleccionarDatosEspecificos_porId(id_empresa);

            if (respuestaModel.length > 0) {
                res.status(200).send(respuestaModel);
            }else{
                res.status(200).send([]);
            }

        }catch(err) {
            return res.status(500).json({
                message: `serverError: ${err}`,
            })
        }
    }



    //ACTUALIZAR LOS DATOS DE LA TABLA
    static async actualizarDatos(req, res) {
        try {
            const {
                empresaNombre,
                contactoTelefono,
                contactoWhatsapp,
                contactoEmail,
                contactoDireccion,
                contactoUrlMapa,
                sobreNosotrosTitulo,
                sobreNosotrosParrafo1,
                sobreNosotrosParrafo2,
                socialInstagramUrl,
                socialInstagramHandle,
                socialFacebookUrl,
                socialTwitterUrl,
                socialLinkedinUrl,
                socialTiktokUrl,
                socialYoutubeUrl,
                socialOtraUrl,
                socialOtraEtiqueta,
                id_empresa
            }= req.body;


            if (
                    !empresaNombre ||
                    !contactoTelefono ||
                    !contactoWhatsapp ||
                    !contactoEmail ||
                    !contactoDireccion ||
                    !sobreNosotrosTitulo ||
                    !sobreNosotrosParrafo1 ||
                    !sobreNosotrosParrafo2 ||
                    !id_empresa
            ) {
                res.status(400).send({
                    message: `sinDato`,
                });

                return;
            }

            const datosEmpresaObjeto = new DatosEmpresa();
            const respuestaModel = await datosEmpresaObjeto.actualizarDatosEmpresa(
                empresaNombre,
                contactoTelefono,
                contactoWhatsapp,
                contactoEmail,
                contactoDireccion,
                contactoUrlMapa,
                sobreNosotrosTitulo,
                sobreNosotrosParrafo1,
                sobreNosotrosParrafo2,
                socialInstagramUrl,
                socialInstagramHandle,
                socialFacebookUrl,
                socialTwitterUrl,
                socialLinkedinUrl,
                socialTiktokUrl,
                socialYoutubeUrl,
                socialOtraUrl,
                socialOtraEtiqueta,
                id_empresa
            );

            if (respuestaModel.affectedRows > 0) {
                res.status(200).json({
                    message: true,
                });
            }else{
                res.status(200).json({
                    message: false,
                });
            }

        }catch(err) {
            return res.status(500).json({
                message: `serverError: ${err}`,
            })
        }
    }

}