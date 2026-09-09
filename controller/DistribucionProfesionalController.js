import DistribucionProfesional from '../model/DistribucionProfesional.js';

export default class DistribucionProfesionalController {
    constructor() {
}
    // GET - Trae el porcentaje vigente de todos los profesionales
    static async seleccionarVigentes(req, res) {
        try {
            const distribucionObjeto = new DistribucionProfesional();
            const respuestaModel = await distribucionObjeto.seleccionarVigentes();
            return res.status(200).json(respuestaModel);
        } catch (err) {
            return res.status(500).json({ message: `Error al traer los porcentajes vigentes de los profesionales: ${err}` });
        }
    }

    // post - guarda un neuvo % vigente por profesional
    static async actualizarDistribucion(req, res){
        try {
            const { id_profesional, porcentaje_profesional } = req.body;

            if (id_profesional === undefined || id_profesional === null || porcentaje_profesional === undefined || porcentaje_profesional === null){
                res.status(400).json({ message: 'Faltan datos para actualizar la distribucion profesional' });
                return;
            }
            const porcentajeNumero = Number(porcentaje_profesional);
            if (isNaN(porcentajeNumero) || porcentajeNumero < 0 || porcentajeNumero > 100) {
                res.status(400).json({ message: 'El porcentaje debe ser un número entre 0 y 100' });
                return;
            }

            const porcentajeClinica = 100 - porcentajeNumero;

            const distribucionObjeto = new DistribucionProfesional();
            const respuestaModel = await distribucionObjeto.actualizarDistribucion(id_profesional, 
                porcentajeNumero, 
                porcentajeClinica
            );

            if (respuestaModel.affectedRows > 0) {
                res.status(200).json({ message: true });
            } else {
                res.status(200).json({ message: false });
            }
        } catch (err) {
            return res.status(500).json({ message: `serverError: ${err}` });
        }
    }
}
