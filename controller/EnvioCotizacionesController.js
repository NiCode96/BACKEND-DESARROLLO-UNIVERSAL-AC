import CotizacionesPacientes from "../model/CotizacionesPacientes.js";
import DetalleCotizacion from "../model/DetalleCotizacion.js";
import DatosEmpresa from "../model/DatosEmpresa.js";
import EnviarPdfService from "../services/envioCotizacionCorreo.js";

export default class EnvioCotizacionesController {
    static async enviarCotizacionPorCorreo(req, res) {
        try {
            const { id_cotizacion_paciente, fecha_emision } = req.body;

            if (!id_cotizacion_paciente || !fecha_emision) {
                return res.status(400).send({ message: "sindata" });
            }

            const cotizacionModel = new CotizacionesPacientes();
            const detalleModel = new DetalleCotizacion();
            const datosEmpresaModel = new DatosEmpresa();

            const [
                resultadoBusquedaCotizacion,
                resultadoBusquedaDetalle,
                resultadoBusquedaDatosEmpresa
            ] = await Promise.all([
                cotizacionModel.seleccionarCotizacionEspecifica(id_cotizacion_paciente),
                detalleModel.seleccionarPor_id_cotizacion(id_cotizacion_paciente),
                datosEmpresaModel.seleccionarDatosEmpresa()
            ]);

            if (
                !Array.isArray(resultadoBusquedaCotizacion) ||
                resultadoBusquedaCotizacion.length === 0 ||
                !Array.isArray(resultadoBusquedaDetalle) ||
                resultadoBusquedaDetalle.length === 0 ||
                !Array.isArray(resultadoBusquedaDatosEmpresa) ||
                resultadoBusquedaDatosEmpresa.length === 0
            ) {
                return res.status(200).send({ message: false });
            }

            const enviado = await EnviarPdfService.enviarPdf(
                resultadoBusquedaCotizacion,
                resultadoBusquedaDetalle,
                resultadoBusquedaDatosEmpresa,
                fecha_emision
            );

            return res.status(200).send({ message: enviado === true });
        } catch (error) {
            return res.status(500).send({ error: error.message });
        }
    }
}
