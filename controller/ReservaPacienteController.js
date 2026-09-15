import ReservaPacientes from "../model/ReservaPacientes.js";
import Pacientes from "../model/Pacientes.js";
import NotificacionAgendamiento from "../services/notificacionAgendamiento.js";
import { notificacionAgendamiento, notificacionActualizacionAgendamiento } from "../services/notificacionWhatsApp.js";
import enviarCorreoProfesionales from "../services/correoNotificacionProfesionales.js";
import Profesionales from "../model/Profesionales.js";
import enviarCorreoProfesionalesActualizacion from "../services/correoActualizacionProfesional.js";

function responderErrorReserva(res, error) {
    if (error?.code === "CONFLICTO_AGENDA") {
        return res.status(409).send({message: "conflicto"});
    }

    if (error?.code === "BLOQUEO_AGENDA_TIMEOUT") {
        return res.status(503).send({message: "reintentar"});
    }

    console.error(error);
    return res.status(500).send({message: error.message});
}

export default class ReservaPacienteController {
    constructor() {
    }


    static async validacionDisponibilidad(req, res) {
        try {
            const {fechaInicio, horaInicio, fechaFinalizacion, horaFinalizacion, id_profesional} = req.body;
            console.log(fechaInicio, horaInicio, fechaFinalizacion, horaFinalizacion, id_profesional);

            if (!fechaInicio || !horaInicio || !fechaFinalizacion || !horaFinalizacion || !id_profesional) {
                return res.status(400).send({message: 'sindata'});
            }

            const claseReservaPaciente = new ReservaPacientes();
            const respuestaBackend = await claseReservaPaciente.validarDisponibilidadBoolean(fechaInicio, horaInicio, fechaFinalizacion, horaFinalizacion, id_profesional);

            if (respuestaBackend) {
                return res.status(200).send({message: true});
            } else {
                return res.status(404).send({message: false});
            }

        } catch (e) {
            throw e;
        }
    }


    static async seleccionarSegunEstado(req, res) {
        try {
            const {estadoReserva} = req.body;
            console.log(estadoReserva);

            if (!estadoReserva) {
                return res.status(400).send({message: 'sindata'});
            }

            const claseReservaPaciente = new ReservaPacientes();
            const resultadoQuery = await claseReservaPaciente.seleccionarReservaEstado(estadoReserva)

            if (resultadoQuery) {
                return res.status(200).json(resultadoQuery);
            } else {
                return res.status(400).send({message: 'sindata'});
            }
        } catch (error) {
            console.log(error);
            return res.status(400).send({message: error.message});
        }
    }


    static async actualizarEstado(req, res) {
        try {
            const {estadoReserva, id_reserva} = req.body;
            console.log(estadoReserva, id_reserva);

            if (!estadoReserva || !id_reserva) {
                return res.status(400).send({message: 'sindata'});
            }

            const claseReservaPaciente = new ReservaPacientes();
            const resultadoQuery = await claseReservaPaciente.actualizarEstado(estadoReserva, id_reserva);

            if (resultadoQuery.affectedRows > 0) {
                return res.status(200).send({message: true})
            } else {
                return res.status(400).send({message: 'sindata'});
            }
        } catch (error) {
            console.log(error);
            return res.status(400).send({message: error.message});
        }
    }


    static async buscarEntreFechas(req, res) {
        try {
            const {fechaInicio, fechaFinalizacion} = req.body;
            console.log(fechaInicio, fechaFinalizacion);

            if (!fechaInicio || !fechaFinalizacion) {
                return res.status(400).send({message: 'sindata'});
            }

            const claseReservaPaciente = new ReservaPacientes();
            const resultadoQuery = await claseReservaPaciente.seleccionarEntreFechas(fechaInicio, fechaFinalizacion);

            if (Array.isArray(resultadoQuery)) {

                return res.status(200).json(resultadoQuery);

            } else {

                return res.status(400).send({message: 'sindata'});
            }
        } catch (error) {
            console.log(error);
            return res.status(400).send({message: error.message});

        }
    }


    static async buscarSimilitudRut(req, res) {
        try {
            const {rut} = req.body;
            console.log(rut);

            if (!rut) {
                return res.status(400).send({message: 'sindata'});
            }

            const claseReservaPaciente = new ReservaPacientes();
            const resultadoQuery = await claseReservaPaciente.seleccionarSimilitudRut(rut);

            if (Array.isArray(resultadoQuery)) {

                return res.status(200).json(resultadoQuery);

            } else {

                return res.status(400).send({message: 'sindata'});
            }

        } catch (error) {
            console.log(error);
            return res.status(400).send({message: error.message});

        }
    }


    static async buscarSimilitudNombre(req, res) {
        try {
            const {nombrePaciente} = req.body;
            console.log(nombrePaciente);

            if (!nombrePaciente) {
                return res.status(400).send({message: 'sindata'});
            }

            const claseReservaPaciente = new ReservaPacientes();
            const resultadoQuery = await claseReservaPaciente.seleccionarSimilitudNombre(nombrePaciente);

            if (Array.isArray(resultadoQuery)) {

                return res.status(200).json(resultadoQuery);

            } else {

                return res.status(400).send({message: 'sindata'});
            }

        } catch (error) {
            console.log(error);
            return res.status(400).send({message: error.message});

        }
    }


    static async actualizarInformacionReserva(req, res) {
        try {
            const {
                nombrePaciente,
                apellidoPaciente,
                nombreProfesional,
                rut,
                telefono,
                email,
                fechaInicio,
                horaInicio,
                fechaFinalizacion,
                horaFinalizacion,
                monto_reserva,
                motivo_reserva,
                estadoReserva,
                id_profesional,
                id_reserva
            } = req.body;

            console.log(req.body);

            if (!id_reserva || !id_profesional) {
                return res.status(404).send({message: 'sindata'})
            }

            const claseReservaPaciente = new ReservaPacientes();
            const resultadoQuery = await claseReservaPaciente.actualizarReserva(nombrePaciente, apellidoPaciente, rut, telefono, email, fechaInicio, horaInicio, fechaFinalizacion, horaFinalizacion,monto_reserva, motivo_reserva, estadoReserva, id_profesional, id_reserva);

            if (resultadoQuery.affectedRows > 0) {
                const correoNormalizado = email && String(email).trim() ? String(email).trim() : null;

                if (correoNormalizado) {
                    try {
                        await NotificacionAgendamiento.enviarCorreoActualizacionReserva({
                            to: correoNormalizado,
                            nombreProfesional,
                            nombrePaciente,
                            apellidoPaciente,
                            rut,
                            telefono,
                            fechaInicio,
                            horaInicio,
                            fechaFinalizacion,
                            horaFinalizacion,
                            monto_reserva,
                            motivo_reserva,
                            estadoReserva,
                            id_reserva
                        });
                    } catch (err) {
                        console.error("[MAIL] Error actualización:", err.message);
                    }
                }

                NotificacionAgendamiento.enviarCorreoConfirmacionEquipo({
                    nombreProfesional,
                    nombrePaciente,
                    apellidoPaciente,
                    fechaInicio,
                    horaInicio,
                    monto_reserva,
                    motivo_reserva,
                    accion: "ACTUALIZADA",
                    id_reserva
                }).catch(err => {
                    console.error("[MAIL EQUIPO] Error actualización:", err.message);
                });

                notificacionActualizacionAgendamiento({
                    telefono,
                    nombre: nombrePaciente,
                    nombreProfesional : nombreProfesional,
                    motivo_reserva : motivo_reserva,
                    apellido: apellidoPaciente,
                    fecha: fechaInicio,
                    hora: horaInicio,
                    id_reserva
                }).catch(err => {
                    console.error("[WSP] Error actualización:", err.message);
                });


                const claseProfesionales = new Profesionales();
                const correoEnArray = await claseProfesionales.seleccionarCorreoEspecificoPorProfesional(id_profesional);
                const correoDelProfesional = correoEnArray[0].correoContacto;
                let nombreDelPaciente = nombrePaciente + " " + apellidoPaciente;

                enviarCorreoProfesionalesActualizacion(
                    correoDelProfesional,
                    nombreProfesional,
                    nombreDelPaciente,
                    fechaInicio,
                    horaInicio
                ).catch(err => {
                    console.error("[MAIL] Error:", err.message);
                });

                return res.status(200).json({message: true});
            } else {
                return res.status(200).json({message: false});
            }

        } catch (err) {
            return responderErrorReserva(res, err);
        }
    }


    static async seleccionarReservaEspecifica(req, res) {
        try {

            const {id_reserva} = req.body;
            console.log(id_reserva);

            if (!id_reserva) {
                return res.status(404).send({message: 'sindata'})
            }

            const claseReservaPaciente = new ReservaPacientes();
            const resultadoQuery = await claseReservaPaciente.seleccionarFichasReservadasEspecifica(id_reserva);

            if (resultadoQuery) {
                return res.status(200).json(resultadoQuery);
            } else {
                return res.status(200).json({message: "sindata"});
            }

        } catch (err) {
            res.status(400).send({
                message: err.message
            })
        }
    }


    static async eliminarReserva(req, res) {
        try {
            const {id_reserva} = req.body;
            console.log(id_reserva);

            if (!id_reserva) {
                return res.status(404).send({message: 'sindata'})
            }

            const claseReservaPaciente = new ReservaPacientes();
            const resultadoQuery = await claseReservaPaciente.eliminarReservaPaciente(id_reserva);

            if (resultadoQuery.affectedRows > 0) {
                return res.status(200).json({message: true});
            } else {
                return res.status(200).json({message: false});
            }

        } catch (err) {
            res.status(400).send({
                message: err.message
            })
        }
    }


    static async seleccionarReservados(req, res) {
        try {
            const claseReservaPaciente = new ReservaPacientes();
            const resultadoQuery = await claseReservaPaciente.seleccionarFichasReservadas();

            if (Array.isArray(resultadoQuery)) {
                return res.status(200).json(resultadoQuery);
            } else {
                return res.status(400).json({message: "sindata"});
            }
        } catch (err) {
            res.status(400).send({
                message: err.message
            })
        }
    }


    static async insertarReservaPaciente(req, res) {
        try {
            const{
                nombrePaciente,
                apellidoPaciente,
                nombreProfesional,
                rut,
                telefono,
                email,
                fechaInicio,
                horaInicio,
                fechaFinalizacion,
                horaFinalizacion,
                monto_reserva,
                motivo_reserva,
                estadoReserva,
                id_profesional,
                origen

            } = req.body;

            console.log(req.body);
            const correoNormalizado = email && String(email).trim() ? String(email).trim() : null;

            if (!nombrePaciente || !apellidoPaciente || !rut || !telefono || !fechaInicio || !horaInicio || !fechaFinalizacion || !horaFinalizacion || !monto_reserva || !motivo_reserva || !estadoReserva || !id_profesional) {
                return res.status(400).send({message: "sindata"})
            }

            const claseReservaPaciente = new ReservaPacientes();
            const resultadoQuery = await claseReservaPaciente.insertarReservaPaciente(
                nombrePaciente,
                apellidoPaciente,
                rut,
                telefono,
                correoNormalizado,
                fechaInicio,
                horaInicio,
                fechaFinalizacion,
                horaFinalizacion,
                monto_reserva,
                motivo_reserva,
                estadoReserva,
                id_profesional)

            if (resultadoQuery.affectedRows > 0) {
                if (correoNormalizado) {
                    try {
                        // Se reenvian monto y motivo al servicio de correo
                        // para que puedan mostrarse en la notificacion al paciente.
                        await NotificacionAgendamiento.enviarCorreoConfirmacionReserva({
                            to: correoNormalizado,
                            nombreProfesional,
                            nombrePaciente,
                            apellidoPaciente,
                            rut,
                            telefono,
                            fechaInicio,
                            horaInicio,
                            fechaFinalizacion,
                            horaFinalizacion,
                            monto_reserva,
                            motivo_reserva,
                            estadoReserva,
                            id_reserva: resultadoQuery.insertId
                        });
                    } catch (err) {
                        console.error("[MAIL] Error:", err.message);
                    }
                }


                NotificacionAgendamiento.enviarCorreoConfirmacionEquipo({
                    nombreProfesional,
                    nombrePaciente,
                    apellidoPaciente,
                    fechaInicio,
                    horaInicio,
                    monto_reserva,
                    motivo_reserva,
                    accion: "AGENDADA",
                    origen: origen === "web" || origen === "mercadopago" ? origen : "dashboard",
                    id_reserva: resultadoQuery.insertId
                }).catch(err => {
                    console.error("[MAIL EQUIPO] Error:", err.message);
                });

                notificacionAgendamiento({
                    telefono,
                    nombre: nombrePaciente,
                    apellido: apellidoPaciente,
                    nombreProfesional : nombreProfesional,
                    motivo_reserva : motivo_reserva,
                    fecha: fechaInicio,
                    hora: horaInicio,
                    id_reserva: resultadoQuery.insertId
                }).catch(err => {
                    console.error("[WSP] Error:", err.message);
                });

                const claseProfesionales = new Profesionales();
                const correoEnArray = await claseProfesionales.seleccionarCorreoEspecificoPorProfesional(id_profesional);
                const correoDelProfesional = correoEnArray[0].correoContacto;
                let nombreDelPaciente = nombrePaciente + " " + apellidoPaciente;

                enviarCorreoProfesionales(
                    correoDelProfesional,
                    nombreProfesional,
                    nombreDelPaciente,
                    fechaInicio,
                    horaInicio
                    ).catch(err => {
                    console.error("[MAIL] Error:", err.message);
                });
                return res.status(200).send({message: true})
            } else {
                return res.status(200).send({message: false})
            }

        } catch (error) {
            return responderErrorReserva(res, error);
        }
    }



    //FUNCION PARA INSERTAR PACIENTE Y FICHAS SEGUN SI EXITES O NO PREVIAMENTE INGRESADOS, RUT MANDA.
    // ===========> ESTA FUNCION ESTA RESERVADA PARA CUANDO LOS CLIENTES QUIEREN EL INGRESO AUTOMATICO DESDE LA RESERVA , ES DECIR QUE LOS PACIENTES SE AUTOINGRESEN SOLOS DESDE LA PAGINA
    static async insertarReservaPacienteFicha(req, res) {
        try {
            const {
                nombrePaciente,
                apellidoPaciente,
                rut,
                telefono,
                email,
                fechaInicio,
                horaInicio,
                fechaFinalizacion,
                horaFinalizacion,
                estadoReserva,
                id_profesional
            } = req.body;

            console.log(req.body);
            const correoNormalizado = email && String(email).trim() ? String(email).trim() : null;

            if (!nombrePaciente || !apellidoPaciente || !rut || !telefono || !fechaInicio || !horaInicio || !fechaFinalizacion || !horaFinalizacion || !estadoReserva || !id_profesional) {
                return res.status(400).send({message: "sindata"})
            }


            let nombre = nombrePaciente;
            let apellido = apellidoPaciente;
            let nacimiento = null;
            let sexo = null;
            let prevision_id = 0;
            let correo = null;
            let direccion = null;
            let pais = 'chile';



            const clasePacientes = new Pacientes();
            const respuestaBackendPaciente = await clasePacientes.insertPacientemp(nombre,apellido,rut,nacimiento,sexo,prevision_id,telefono,correo,direccion,pais,null,null,null,null,null,null,null,null);

            if (respuestaBackendPaciente.affectedRows > 0) {
                console.log("Paciente ingresado correctamente desde reserva");

            }else if (respuestaBackendPaciente.duplicado === true) {
                console.log("Error al ingresar paciente desde reserva : Paciente ya existe");

            }




            const claseReservaPaciente = new ReservaPacientes();
            const resultadoQuery = await claseReservaPaciente.insertarReservaPaciente(nombrePaciente, apellidoPaciente, rut, telefono, correoNormalizado, fechaInicio, horaInicio, fechaFinalizacion, horaFinalizacion, estadoReserva, id_profesional)

            if (resultadoQuery.affectedRows > 0) {
                if (correoNormalizado) {
                    try {
                        await NotificacionAgendamiento.enviarCorreoConfirmacionReserva({
                            to: correoNormalizado,
                            nombrePaciente,
                            apellidoPaciente,
                            rut,
                            telefono,
                            fechaInicio,
                            horaInicio,
                            fechaFinalizacion,
                            horaFinalizacion,
                            estadoReserva,
                            id_reserva: resultadoQuery.insertId
                        });
                    } catch (err) {
                        console.error("[MAIL] Error:", err.message);
                    }
                }

                NotificacionAgendamiento.enviarCorreoConfirmacionEquipo({
                    nombrePaciente,
                    apellidoPaciente,
                    fechaInicio,
                    horaInicio,
                    accion: "AGENDADA",
                    origen: "web",
                    id_reserva: resultadoQuery.insertId
                }).catch(err => {
                    console.error("[MAIL EQUIPO] Error:", err.message);
                });

                notificacionAgendamiento({
                    telefono,
                    nombre: nombrePaciente,
                    apellido: apellidoPaciente,
                    fecha: fechaInicio,
                    hora: horaInicio,
                    id_reserva: resultadoQuery.insertId
                }).catch(err => {
                    console.error("[WSP] Error:", err.message);
                });


                const correoPruebas = `desarrollo.native.code@gmail.com`;
                const nombreProfesional = `dr pruebitas`;

                enviarCorreoProfesionales(correoPruebas, nombreProfesional).catch(err => {
                    console.error("[MAIL PROFESIONAL] Error:", err.message);
                });

                return res.status(200).send({message: true})
            } else {
                return res.status(200).send({message: false})
            }

        } catch (error) {
            return responderErrorReserva(res, error);
        }
    }






    static async seleccionarReservaSegunId_Profesional(req, res) {
        try {
            const {id_profesional} = req.body;
            console.log(id_profesional);

            if (!id_profesional) {
                return res.status(400).send({message: 'sindata'});
            }

            const claseReservaPaciente = new ReservaPacientes();
            const resultadoQuery = await claseReservaPaciente.seleccionarFichasReservadas_id_profesional(id_profesional)

            if (resultadoQuery) {
                return res.status(200).json(resultadoQuery);
            } else {
                return res.status(400).send({message: 'sindata'});
            }
        } catch (error) {
            console.log(error);
            return res.status(400).send({message: error.message});
        }
    }
}
