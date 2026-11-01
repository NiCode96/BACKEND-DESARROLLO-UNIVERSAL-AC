import DatosEmpresa from '../model/DatosEmpresa.js';
import {
    CODIGO_EMPRESA_INVALIDA,
    CODIGO_LOGO_INVALIDO,
    normalizarIdEmpresa,
    normalizarLogoEmpresa,
} from '../services/logoEmpresa.js';


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



    //ACTUALIZAR SOLO EL LOGO
    // Endpoint propio para que el logo se guarde apenas se sube, sin depender de
    // "Guardar todos los datos" (que exige campos que no tienen que ver con el logo).
    // Body: { id_empresa, logoEmpresa }   logoEmpresa = id de Cloudflare, o "" para quitarlo.
    // Respuestas: 200 { message: true, logoEmpresa }   400 { message: "logo-invalido" | "empresa-invalida" }
    //             404 { message: "empresa-no-encontrada" }   500 { message: "serverError" }
    static async actualizarLogo(req, res) {
        let id_empresa;
        let logoEmpresa;
        try {
            id_empresa = normalizarIdEmpresa(req.body?.id_empresa);
            logoEmpresa = normalizarLogoEmpresa(req.body?.logoEmpresa);
        } catch (err) {
            if (err.code === CODIGO_LOGO_INVALIDO) return res.status(400).json({ message: "logo-invalido" });
            if (err.code === CODIGO_EMPRESA_INVALIDA) return res.status(400).json({ message: "empresa-invalida" });
            return res.status(400).json({ message: "sinDato" });
        }

        try {
            const datosEmpresaObjeto = new DatosEmpresa();
            const respuestaModel = await datosEmpresaObjeto.actualizarLogoEmpresa(logoEmpresa, id_empresa);

            if (!respuestaModel || respuestaModel.affectedRows === 0) {
                return res.status(404).json({ message: "empresa-no-encontrada" });
            }

            // Bitácora sin datos personales: quién, qué empresa y si puso o quitó el logo.
            console.log(
                `[AUDITORIA] logoEmpresa ${logoEmpresa ? "actualizado" : "quitado"} · id_empresa=${id_empresa} · usuario=${req.sesionClerk?.sub ?? "desconocido"}`
            );

            return res.status(200).json({ message: true, logoEmpresa });
        } catch (err) {
            console.error("[datosempresa/actualizarLogo]", err?.message ?? err);
            return res.status(500).json({ message: "serverError" });
        }
    }

}
