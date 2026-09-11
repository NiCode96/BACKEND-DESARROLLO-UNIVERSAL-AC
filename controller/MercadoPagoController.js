import dotenv from 'dotenv';
import ReservaPacientes from "../model/ReservaPacientes.js";
import Pacientes from "../model/Pacientes.js";
import NotificacionAgendamiento from "../services/notificacionAgendamiento.js";
import * as mpNamed from "mercadopago";
import { notificacionAgendamiento, notificacionActualizacionAgendamiento } from "../services/notificacionWhatsApp.js";
import MercadoPersistence from "../model/MercadoPersisntence.js"
import Profesionales from "../model/Profesionales.js";

dotenv.config();

const BACKEND = process.env.BACKEND_URL;

function normalizarFechaISO(fecha) {
    if (!fecha) return null;

    const valor = String(fecha).trim();
    if (!valor) return null;

    // Caso común: "2026-08-13T04:00:00.000Z"
    const match = valor.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];

    // Fallback para otros formatos parseables
    const d = new Date(valor);
    if (Number.isNaN(d.getTime())) return null;

    return d.toISOString().slice(0, 10);
}


function normalizarHoraISO(hora) {
    if (!hora) return null;

    const valor = String(hora).trim();
    if (!valor) return null;

    // Caso común: "14:30:00"
    const match = valor.match(/^(\d{2}:\d{2})/);
    if (match) return match[1];

    // Fallback para otros formatos parseables
    const d = new Date(`1970-01-01T${valor}`);
    if (Number.isNaN(d.getTime())) return null;

    return d.toISOString().slice(11, 16);
}
//SE DEFINE LA FUNCION CREATE ORDER ESTA FUNCION PERMITE CREAR LA ORDEN DE PAGO
export const createOrder = async (req, res) => {
    try {

        const {
            tituloProducto,
            precio,
            cantidad,
            nombrePaciente,
            apellidoPaciente,
            rut,
            telefono,
            email,
            fechaInicio,
            horaInicio,
            fechaFinalizacion,
            horaFinalizacion,
            estadoReserva ,
            totalPago,
            id_profesional
        } = req.body;

        const mercadoPagoPersistence = new MercadoPersistence();
        const tokenData = await mercadoPagoPersistence.seleccionarTOKEN();
        const accessToken = tokenData?.[0]?.access_token;

        console.log("Iniciando Mercado pago: Body");
        console.log(req.body);

        if (!nombrePaciente || !apellidoPaciente || !rut || !telefono || !email || !fechaInicio || !horaInicio || !fechaFinalizacion || !horaFinalizacion || !id_profesional) {
            return res.status(400).json({ message: 'sindata' });
        }

        if (!totalPago || Number(totalPago) <= 0) {
            return res.status(400).json({ message: 'datoinvalido' });
        }

        const ACCESS_TOKEN = accessToken;

        if (!ACCESS_TOKEN) {
            return res.status(500).json({ error: 'No hay access token configurado en el servidor' });
        }

        const items = [{
            title: tituloProducto || 'Reserva consulta',
            quantity: 1,
            unit_price: Number(totalPago),
            currency_id: "CLP"
        }];


        const profesionales = new Profesionales();
        const profesionalesSeleccionId = await profesionales.seleccionarProfesionalPorID(id_profesional);
        const profesionalSeleccionado = profesionalesSeleccionId?.[0]?.nombreProfesional || `PROFESIONAL NO IDENTIFICADO`;



        const params = new URLSearchParams({
            fecha:      fechaInicio,
            hora:       horaInicio,
            horaFin:    horaFinalizacion,
            profesional: profesionalSeleccionado,
            servicio:   tituloProducto || "",
            duracion:   `${horaInicio} - ${horaFinalizacion}`,
            precio:     String(totalPago),
        });

        const FRONTEND = process.env.FRONT_URL;
        // Preparar el objeto 'preference' usando los items y metadata
        const preference = {
            items,
            back_urls: {
                success: `${FRONTEND}/reserva-hora?${params.toString()}`,
                failure: `${FRONTEND}/pagoRechazado`,
                pending: `${FRONTEND}/pagoEnProceso`,
            },
            metadata: {
                nombre_comprador: nombrePaciente,
                email: email,
                telefono: telefono
            },
            auto_return: "approved",
            notification_url: `${BACKEND}/pagosMercadoPago/notificacionPago`,
        };


        let resultBody;

        const client = new mpNamed.MercadoPagoConfig({ accessToken: ACCESS_TOKEN });
        const prefClient = new mpNamed.Preference(client);

        const resp = await prefClient.create({ body: preference });
        resultBody = resp;

        if (!resultBody) {
            console.error('No se pudo crear la preferencia.');
            return res.status(500).json({ error: 'Error al crear la orden de pago' });
        }

        const preference_id = resultBody.id;

        // --- INSERTAR RESERVA CON ESTADO "pendiente pago" ---
        try {
            const reservaPacienteClass = new ReservaPacientes();
            const estadoPeticion = 3;

            const correoNormalizado = email.trim();
            const numeroNormalizado = telefono.trim();

            const resultadoInsert = await reservaPacienteClass.insertarReservaPacienteBackend(
                nombrePaciente,
                apellidoPaciente,
                rut,
                numeroNormalizado,
                correoNormalizado,
                fechaInicio,
                horaInicio,
                fechaFinalizacion,
                horaFinalizacion,
                totalPago,
                tituloProducto,
                estadoReserva,
                preference_id,
                estadoPeticion,
                id_profesional
            );

            if (resultadoInsert && resultadoInsert.affectedRows > 0) {

               //PRIMERA ACCION ENVIAR AL CLIENTE EL ENLACE DE PAGO GENERADO DESDE MERCADO PAGO
                console.log('Reserva insertada con estado "reservado" con estado 3 (VISIBLE TEMPORALMENTE), preference_id:', preference_id);
                return res.status(200).json({
                    id: resultBody.id,
                    init_point: resultBody.init_point,
                    sandbox_init_point: resultBody.sandbox_init_point,
                });

            } else {
                return res.status(500).json({ error: 'No se pudo insertar la reserva' });
            }
        } catch (errReserva) {
            if (errReserva?.code === 'CONFLICTO_AGENDA') {
                return res.status(409).json({ error: 'Horario no disponible', message: 'conflicto' });
            }
            console.error('Error insertando reserva desde createOrder:', errReserva);
            return res.status(500).json({ error: 'Error al insertar la reserva', details: errReserva.message });
        }

    } catch (error) {
        console.error('Error creando preferencia:', error);
        const message = error?.response?.body || error.message || 'Error al crear la orden de pago';
        return res.status(500).json({ error: 'Error al crear la orden de pago', details: message });
    }
};


/*
INFORMACIÓN RECIBIDA DESDE EL WEEBHOOK

Webhook:
-> Es un "mensaje automático" que un servicio externo envía a tu servidor cuando ocurre un evento.
-> Es una notificación en tiempo real.
-> Cuando ocurre un evento, ese servicio (Mercado Pago, Stripe, Clerk, GitHub, etc.)
-> Te manda un POST a esa URL automáticamente.
-> Tú respondes 200 OK rápido para que no lo reenvíen.
-> Tu backend recibe un body con información en el caso de mercado pago:

{
  action: "payment.updated",
  api_version: "v1",
  data: {"id":"123456"},
  date_created: "2021-11-01T02:02:02Z",
  id: "123456",
  live_mode: false,
  type: "payment",
  user_id: 2964661140
                       }

IMPORTANTE
1. paymentId = body.data.id, que es el ID del pago en Mercado Pago.
2. Se devuelve un status 200 para que Mercado Pago no re-intente el webhook.
3. Se consulta a la API de mercado pago por la transacción realizada.

 * */


export const recibirPago = async (req, res) => {
    const mercadoPagoPersistence = new MercadoPersistence();
    const tokenData = await mercadoPagoPersistence.seleccionarTOKEN();
    const ACCESS_TOKEN = tokenData?.[0]?.access_token;

    if (!ACCESS_TOKEN) {
        return res.status(500).json({ error: 'No hay access token configurado en el servidor' });
    }

    const body = req.body;

    try {
        // 1) CASO PAYMENT
        if (body.type === 'payment' || body.topic === 'payment') {
            const paymentId = body.data && body.data.id;
            if (!paymentId) {
                console.error('No viene data.id en webhook de payment');
                return res.status(200).json({ received: true, lookup_error: true });
            }

            const url = `https://api.mercadopago.com/v1/payments/${paymentId}`;
            const resp = await fetch(url, {
                headers: {
                    Authorization: `Bearer ${ACCESS_TOKEN}`,
                    'Content-Type': 'application/json',
                },
            });

            const payment = await resp.json();
            return res.status(200).json({ received: true });
        }

        // 2) CASO MERCHANT_ORDER
        if (body.topic === 'merchant_order' && body.resource) {
            const merchantOrderUrl = body.resource;

            const resp = await fetch(merchantOrderUrl, {
                headers: {
                    Authorization: `Bearer ${ACCESS_TOKEN}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!resp.ok) {
                const txt = await resp.text();
                console.error('Error consultando merchant_order:', resp.status, txt);
                return res.status(200).json({ received: true, lookup_error: true });
            }

            const merchantOrder = await resp.json();
            console.log('MERCHANT ORDER DETAIL:', merchantOrder);

            const payments = merchantOrder.payments || [];
            const pagoAprobado = payments.some(p => p.status === 'approved');
            const preference_id = merchantOrder.preference_id;

            console.log("");
            console.log("-----------------------------------------");
            console.log('WEB HOOK ENVIA : preference_id:', preference_id);
            console.log('WEB HOOK ENVIA : pagoAprobado:', pagoAprobado);
            console.log("-----------------------------------------");
            console.log("");

            if (!pagoAprobado) {
                console.log("--------> PAGO NO APROBADO para preference_id:", preference_id);
                return res.status(200).json({ received: true, pago_aprobado: false });
            }

            try {
                // --- CAMBIAR ESTADO DE LA RESERVA A "reservada" ---
                const reservaPacientesClass = new ReservaPacientes();
                const resultadoQuery = await reservaPacientesClass.cambiarReservaPagadaVisible(preference_id);

                if (resultadoQuery && resultadoQuery.affectedRows > 0) {
                    console.log("--------> RESERVA ACTUALIZADA A 'reservada' para preference_id:", preference_id);

                    // Obtener datos de la reserva para enviar correos
                    const dataCliente = await reservaPacientesClass.seleccionarFichasReservadasPreference(preference_id);
                    const reserva = Array.isArray(dataCliente) && dataCliente.length > 0 ? dataCliente[0] : null;

                    if (reserva) {
                        //ENVIO DE CORREO AL EQUIPO DE LA CONSULTA
                        try {

                            console.log(`############################`);
                            console.log(`Enviando correo de confirmación para el email: ${reserva.email}`);
                            console.log(`############################`);

                            await NotificacionAgendamiento.enviarCorreoConfirmacionReserva({
                                to: reserva.email,
                                id_profesional: reserva.nombreProfesional,
                                nombrePaciente: reserva.nombrePaciente,
                                apellidoPaciente: reserva.apellidoPaciente,
                                rut: reserva.rut,
                                telefono: reserva.telefono,
                                fechaInicio: normalizarFechaISO(reserva.fechaInicio),
                                horaInicio: normalizarHoraISO(reserva.horaInicio),
                                fechaFinalizacion: normalizarFechaISO(reserva.fechaFinalizacion).toString(),
                                horaFinalizacion: normalizarHoraISO(reserva.horaFinalizacion).toString(),
                                monto_reserva: reserva.monto_reserva,
                                motivo_reserva: reserva.motivo_reserva,
                                estadoReserva: reserva.estadoReserva,
                                id_reserva: reserva.id_reserva
                            });
                        }catch {
                            console.log(`Error al procesar envio de correo para preference_id: ${preference_id}`);
                            return res.status(500).json({ received: false });
                        }




                        try {

                            console.log(`############################`);
                            console.log(`Enviando wsp de confirmación para el TELEFONO: ${reserva.telefono}`);
                            console.log(`############################`);

                            await notificacionAgendamiento({
                                telefono: reserva.telefono,
                                nombre: reserva.nombrePaciente,
                                apellido: reserva.apellidoPaciente,
                                nombreProfesional : reserva.nombreProfesional,
                                motivo_reserva : reserva.motivo_reserva,
                                fecha: normalizarFechaISO(reserva.fechaInicio).toString(),
                                hora: normalizarHoraISO(reserva.horaInicio).toString(),
                                id_reserva: reserva.id_reserva
                            })

                        }catch{
                            console.log(`Error al procesar envio de whatsapp para ${reserva.telefono}`);
                            return res.status(500).json({ received: false });
                        }


                        try {

                            console.log(`############################`);
                            console.log(`Enviando correo de notificacion al equipo clinico`);
                            console.log(`############################`);

                           await NotificacionAgendamiento.enviarCorreoConfirmacionEquipo({
                                nombreProfesional : reserva.nombreProfesional,
                                nombrePaciente: reserva.nombrePaciente,
                                apellidoPaciente: reserva.apellidoPaciente,
                                fechaInicio: normalizarFechaISO(reserva.fechaInicio).toString(),
                                horaInicio: normalizarHoraISO(reserva.horaInicio).toString(),
                                monto_reserva: reserva.monto_reserva,
                                motivo_reserva: reserva.motivo_reserva,
                                accion: "AGENDADA",
                                origen: "mercadopago",
                                id_reserva: reserva.id_reserva
                            })
                        }catch{
                            console.log(`Error al procesar envio de correo para el equipo clinico`);
                            return res.status(500).json({ received: false });
                        }


                    } else {

                        console.warn('No se encontro reserva para preference_id:', preference_id);
                    }

                    return res.status(200).json({ received: true });

                } else {
                    console.log("--------> NO HAY RESERVA ASOCIADA AL preference_id:", preference_id);
                    return res.status(200).json({ received: true });
                }

            } catch (error) {
                console.error('Error al validar preference_id:', error);
                return res.status(200).json({ received: true, error: true });
            }
        }

        // 3) CUALQUIER OTRO TIPO
        console.log('Webhook no manejado. topic/type:', body.topic, body.type);
        return res.status(200).json({ received: true, ignored: true });

    } catch (err) {
        console.error('Error en recibirPago:', err);
        return res.status(500).json({ error: 'Error interno al procesar webhook' });
    }
};
