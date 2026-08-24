import CotizacionPacientes from "../model/CotizacionesPacientes.js";

export default class CotizacionPacientesController {

    constructor() {
    }



    static async seleccionar_cotizaciones_paciente(req, res) {
        try {
            const {
                id_paciente
            } = req.body;

            console.log(`ID QUE LLEGA DESDE COTIZACIONES PACIENTE AL INGRESAR AL COMPONENTE FRONT:`);
            console.log(id_paciente);

            if(!id_paciente) {
                return res.status(400).send({
                    message: 'sindata'
                })
            }

            const CotizacionesModel = new CotizacionPacientes();
            const respuesta = await CotizacionesModel.seleccionar_cotizaciones_paciente_especifico_por_id(
                id_paciente
            );

            if (Array.isArray(respuesta) && respuesta.length > 0) {
                console.log(`RESPUESTA BACKEND `);
                console.log(respuesta);
                return res.status(200).send(respuesta)

            }else{
                return res.status(200).send([])
            }

        }catch (error) {
            return res.status(500).send({
                error: error.message
            })
        }
    }








    static async insertarCotizacion(req, res) {
        try {
            const {
                nombre_cotizacion,
                profesional_solicitante_nombre,
                total_presupuesto_cotizado,
                id_paciente,
            } = req.body;

            console.log(req.body);

            if (!nombre_cotizacion || !profesional_solicitante_nombre || !id_paciente) {
                return res.status(400).send({
                    message: 'sindata',
                })
            }

            const CotizacionesModel = new CotizacionPacientes();
            const respuesta = await CotizacionesModel.insertarCotizacion(
                nombre_cotizacion,
                profesional_solicitante_nombre,
                total_presupuesto_cotizado,
                id_paciente
            );

            if (respuesta.affectedRows > 0) {
                return res.status(200).send({
                    message: true
                })
            }else{
                return res.status(200).send({
                    message: false
                })
            }

        }catch (error) {
            return res.status(500).send({
                error: error.message
            })
        }
    }





    static async actualizarCotizacion(req, res) {
        try {
            const {
                nombre_cotizacion,
                profesional_solicitante_nombre,
                total_presupuesto_cotizado,
                id_paciente,
                id_cotizacion_paciente
            } = req.body;

            if (!nombre_cotizacion || !profesional_solicitante_nombre || !id_paciente || !id_cotizacion_paciente) {
                return res.status(400).send({
                    message: 'sindata',
                })
            }

            const CotizacionesModel = new CotizacionPacientes();
            const respuesta = await CotizacionesModel.actualizarCotizacion(
                nombre_cotizacion,
                profesional_solicitante_nombre,
                total_presupuesto_cotizado,
                id_paciente,
                id_cotizacion_paciente
            );

            if (respuesta.affectedRows > 0) {
                return res.status(200).send({
                    message: true
                })
            }else{
                return res.status(200).send({
                    message: false
                })
            }

        }catch (error) {
            return res.status(500).send({
                error: error.message
            })
        }
    }





    static async seleccionarCotizacionEspecifica(req, res) {
        try {
            const {
                id_cotizacion_paciente
            } = req.body;

            if(!id_cotizacion_paciente) {
                return res.status(400).send({
                    message: 'sindata'
                })
            }

            const CotizacionesModel = new CotizacionPacientes();
            const respuesta = await CotizacionesModel.seleccionarCotizacionEspecifica(
                id_cotizacion_paciente
            );

            if (Array.isArray(respuesta) && respuesta.length > 0) {
                return res.status(200).send(respuesta)
            }else{
                return res.status(200).send([])
            }

        }catch (error) {
            return res.status(500).send({
                error: error.message
            })
        }
    }





    static async seleccionar_cotizaciones_paciente_especifico_por_id(req, res) {
        try {
            const {
                id_paciente,
                estado_cotizacion
            } = req.body;

            if(!id_paciente || !estado_cotizacion) {
                return res.status(400).send({
                    message: 'sindata'
                })
            }

            const CotizacionesModel = new CotizacionPacientes();
            const respuesta = await CotizacionesModel.seleccionar_cotizaciones_paciente_especifico_por_id(
                id_paciente,
                estado_cotizacion
            );

            if (Array.isArray(respuesta) && respuesta.length > 0) {
                return res.status(200).send(respuesta)
            }else{
                return res.status(200).send([])
            }

        }catch (error) {
            return res.status(500).send({
                error: error.message
            })
        }
    }







    static async seleccionar_cotizaciones_paciente_porEstado(req, res) {
        try {
            const {
                id_paciente,
                estado_cotizacion
            } = req.body;

            if(!id_paciente || !estado_cotizacion) {
                return res.status(400).send({
                    message: 'sindata'
                })
            }

            const CotizacionesModel = new CotizacionPacientes();
            const respuesta = await CotizacionesModel.seleccionar_cotizaciones_paciente_porEstado(
                id_paciente,
                estado_cotizacion
            );

            if (Array.isArray(respuesta) && respuesta.length > 0) {
                return res.status(200).send(respuesta)
            }else{
                return res.status(200).send([])
            }

        }catch (error) {
            return res.status(500).send({
                error: error.message
            })
        }
    }




    static async seleccionar_cotizaciones_paciente_profesional(req, res) {
        try {
            const {
                id_paciente,
                profesional_solicitante_nombre,
            } = req.body;


            console.log(`SIMILITUD PROFESIONAL BUSCADO:`)
            console.log(req.body);

            if(!id_paciente || !profesional_solicitante_nombre) {
                return res.status(400).send({
                    message: 'sindata'
                })
            }

            const CotizacionesModel = new CotizacionPacientes();
            const respuesta = await CotizacionesModel.seleccionar_cotizaciones_paciente_profesional(
                id_paciente,
                profesional_solicitante_nombre
            );

            if (Array.isArray(respuesta) && respuesta.length > 0) {
                return res.status(200).send(respuesta)
            }else{
                return res.status(200).send([])
            }

        }catch (error) {
            return res.status(500).send({
                error: error.message
            })
        }
    }




    static async eliminarCotizacion(req, res) {
        try {
            const {
                id_cotizacion_paciente
            } = req.body;


            if(!id_cotizacion_paciente) {
                return res.status(400).send({
                    message: 'sindata'
                })
            }

            const CotizacionesModel = new CotizacionPacientes();
            const respuesta = await CotizacionesModel.eliminarCotizacion(
                id_cotizacion_paciente
            );


            if (respuesta.affectedRows > 0) {


                return res.status(200).send({
                    message: true,
                })

            }else{
                return res.status(200).send({
                    message: false
                })
            }


        }catch (error) {
            return res.status(500).send({
                error: error.message
            })
        }
    }






    static async actualizarTotal(req, res) {
        try {
            const {
                total_presupuesto_cotizado,
                abono_paciente,
                total_tratamiento,
                id_cotizacion_paciente
            } = req.body;

            const totalPresupuestoNormalizado = Number(total_presupuesto_cotizado);
            const abonoNormalizado = Number(abono_paciente);
            const totalTratamientoNormalizado = Number(total_tratamiento);

            if (
                !id_cotizacion_paciente
                || total_presupuesto_cotizado === null
                || total_presupuesto_cotizado === undefined
                || abono_paciente === null
                || abono_paciente === undefined
                || total_tratamiento === null
                || total_tratamiento === undefined
                || !Number.isFinite(totalPresupuestoNormalizado)
                || !Number.isFinite(abonoNormalizado)
                || !Number.isFinite(totalTratamientoNormalizado)
                || totalPresupuestoNormalizado < 0
                || abonoNormalizado < 0
                || totalTratamientoNormalizado < 0
            ) {
                return res.status(400).send({
                    message: 'sindata'
                })
            }

            if (abonoNormalizado > totalTratamientoNormalizado) {
                return res.status(400).send({
                    message: 'abono_mayor_total'
                })
            }

            const CotizacionesModel = new CotizacionPacientes();
            const respuesta = await CotizacionesModel.actualizarTotal(
                totalTratamientoNormalizado - abonoNormalizado,
                abonoNormalizado,
                id_cotizacion_paciente
            );


            if (respuesta.affectedRows > 0) {


                return res.status(200).send({
                    message: true,
                })

            }else{
                return res.status(200).send({
                    message: false
                })
            }


        }catch (error) {
            return res.status(500).send({
                error: error.message
            })
        }
    }


static async actualizarEstado(req, res) {
        try {
            const {
                estado_cotizacion,
                id_cotizacion_paciente
            } = req.body;


            if(!id_cotizacion_paciente || !estado_cotizacion) {
                return res.status(400).send({
                    message: 'sindata'
                })
            }

            const cotizacionPacienteModel = new CotizacionPacientes();
            const respuestaBackend = await cotizacionPacienteModel.actualizarEstado(
                estado_cotizacion,
                id_cotizacion_paciente
            );

            if (respuestaBackend.affectedRows > 0) {
                return res.status(200).send({
                    message: true
                });
            } else {
                return res.status(200).send({
                    message: false
                });
            }
        }catch (error) {
            return res.status(500).send({
                error: error.message
            })
        }
}





    static async actualizarObservacion(req, res) {
        try {
            const {
                observacionesDetalleCotizacion,
                id_cotizacion_paciente
            } = req.body;


            if(!id_cotizacion_paciente || !observacionesDetalleCotizacion) {
                return res.status(400).send({
                    message: 'sindata'
                })
            }

            const cotizacionPacienteModel = new CotizacionPacientes();
            const respuestaBackend = await cotizacionPacienteModel.actualizarObservacion(
                observacionesDetalleCotizacion,
                id_cotizacion_paciente
            );

            if (respuestaBackend.affectedRows > 0) {
                return res.status(200).send({
                    message: true
                });
            } else {
                return res.status(200).send({
                    message: false
                });
            }
        }catch (error) {
            return res.status(500).send({
                error: error.message
            })
        }
    }


}


