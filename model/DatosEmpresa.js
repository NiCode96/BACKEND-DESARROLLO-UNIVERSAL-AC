import DataBase from "../config/Database.js";



export default class DatosEmpresa {
    constructor() {
    }

    //SELECCIONAR TODOS LOS DATOS DE LA TABLA
    async seleccionarDatosEmpresa() {
        try {
            const conexion = DataBase.getInstance();
            const query = `SELECT * FROM datos_empresa where estadoActivo <> 0`;
            return await conexion.ejecutarQuery(query);
        }catch(err) {
            throw err;
        }
    }

    //SELECCIONAR DATOS ESPECIFICOS DE LA TABLA
    async seleccionarDatosEspecificos_porId(id_empresa) {
        try {
            const conexion = DataBase.getInstance();
            const query = `SELECT * FROM datos_empresa where estadoActivo <> 0 AND id_empresa = ?`;
            const params = [id_empresa];
            return await conexion.ejecutarQuery(query,params);
        }catch(err) {
            throw err;
        }
    }

    //ACTUALIZAR LOS DATOS DE LA TABLA
    async actualizarDatosEmpresa(
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

    ) {
        try {
            const conexion = DataBase.getInstance();
            const query = `
        UPDATE datos_empresa SET
        empresaNombre = ?,
        contactoTelefono = ?,
        contactoWhatsapp = ? ,
        contactoEmail = ?,
        contactoDireccion = ?,
        contactoUrlMapa = ?,
        sobreNosotrosTitulo = ?,
        sobreNosotrosParrafo1 = ?,
        sobreNosotrosParrafo2 = ?,
        socialInstagramUrl = ?,
        socialInstagramHandle = ?,
        socialFacebookUrl = ?,
        socialTwitterUrl = ?,
        socialLinkedinUrl = ?,
        socialTiktokUrl = ?,
        socialYoutubeUrl = ?,
        socialOtraUrl = ?,
        socialOtraEtiqueta = ?
        
        WHERE id_empresa = ?`;


            const params = [
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
            ];
            return await conexion.ejecutarQuery(query, params);
        }catch(err) {
            throw err;
        }
    }

    //ACTUALIZAR SOLO EL LOGO (id de Cloudflare Images, o NULL para quitarlo)
    async actualizarLogoEmpresa(logoEmpresa, id_empresa) {
        try {
            const conexion = DataBase.getInstance();
            const query = `UPDATE datos_empresa SET logoEmpresa = ? WHERE id_empresa = ? AND estadoActivo <> 0`;
            return await conexion.ejecutarQuery(query, [logoEmpresa, id_empresa]);
        }catch(err) {
            throw err;
        }
    }
}
