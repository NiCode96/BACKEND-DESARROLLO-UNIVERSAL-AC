import DataBase from "../config/Database.js";
import { VALOR_NO_INDICADO } from "../services/camposReserva.js";

const LOCK_TIMEOUT_SECONDS = 10;
const CODIGO_CONFLICTO_AGENDA = "CONFLICTO_AGENDA";
const CODIGO_BLOQUEO_TIMEOUT = "BLOQUEO_AGENDA_TIMEOUT";

export default class ReservaPacientes {

    constructor(
        id_reserva,
        nombrePaciente,
        apellidoPaciente,
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
        estadoPeticion,
        preference_id,
        id_profesional) {

        this.id_reserva = id_reserva;
        this.nombrePaciente = nombrePaciente;
        this.apellidoPaciente = apellidoPaciente;
        this.rut = rut;
        this.telefono = telefono;
        this.email = email;
        this.fechaInicio = fechaInicio;
        this.horaInicio = horaInicio;
        this.fechaFinalizacion = fechaFinalizacion;
        this.horaFinalizacion = horaFinalizacion;
        this.monto_reserva = monto_reserva;
        this.motivo_reserva = motivo_reserva;
        this.estadoReserva = estadoReserva;
        this.estadoPeticion = estadoPeticion;
        this.preference_id = preference_id;
        this.id_profesional = id_profesional;

    }

    crearErrorAgenda(codigo, mensaje) {
        const error = new Error(mensaje);
        error.code = codigo;
        return error;
    }

    construirClaveBloqueoAgenda(id_profesional) {
        return `agenda_profesional_${id_profesional}`;
    }

    async obtenerConexionConBloqueoAgenda(id_profesional) {
        const conexion = DataBase.getInstance();
        const connection = await conexion.obtenerConexion();
        const lockKey = this.construirClaveBloqueoAgenda(id_profesional);
        let lockTomado = false;

        try {
            const [rows] = await connection.query("SELECT GET_LOCK(?, ?) AS lockStatus", [lockKey, LOCK_TIMEOUT_SECONDS]);
            lockTomado = Number(rows?.[0]?.lockStatus) === 1;

            if (!lockTomado) {
                throw this.crearErrorAgenda(
                    CODIGO_BLOQUEO_TIMEOUT,
                    "No fue posible asegurar el horario en este momento. Intente nuevamente."
                );
            }

            return {connection, lockKey};
        } catch (error) {
            if (lockTomado) {
                try {
                    await connection.query("SELECT RELEASE_LOCK(?)", [lockKey]);
                } catch (_) {
                }
            }

            connection.release();
            throw error;
        }
    }

    async liberarConexionConBloqueoAgenda(connection, lockKey) {
        try {
            await connection.query("SELECT RELEASE_LOCK(?)", [lockKey]);
        } catch (_) {
        } finally {
            connection.release();
        }
    }

    async validarDisponibilidadEnConexion(connection, fechaInicio, horaInicio, fechaFinalizacion, horaFinalizacion, id_profesional, id_reservaExcluir = null) {
        const query = `
      SELECT COUNT(*) AS cnt FROM (
      SELECT id_reserva AS id
      FROM reservaPacientes
      WHERE id_profesional = ?
      AND estadoPeticion IN (1, 3)
      AND estadoReserva <> 'cancelada'
      AND (? IS NULL OR id_reserva <> ?)
      AND NOT (
        TIMESTAMP(fechaFinalizacion, horaFinalizacion) <= TIMESTAMP(?, ?)
        OR TIMESTAMP(fechaInicio, horaInicio) >= TIMESTAMP(?, ?)
      )
      UNION ALL
      SELECT id_bloqueo AS id
      FROM bloqueoAgenda
      WHERE id_profesional = ?
      AND estado_bloqueoAgenda <> 0
      AND ? >= fechaInicio
      AND ? <= fechaFinalizacion
      AND NOT (
        horaFinalizacion <= ?
        OR horaInicio >= ?
      )
    ) AS conflictos
    `;

        const params = [
            id_profesional,
            id_reservaExcluir, id_reservaExcluir,
            fechaInicio, horaInicio, fechaFinalizacion, horaFinalizacion,
            id_profesional, fechaInicio, fechaInicio, horaInicio, horaFinalizacion
        ];

        const [filas] = await connection.query(query, params);
        const cnt = Array.isArray(filas) ? filas[0]?.cnt : filas?.cnt;
        return Number(cnt) === 0;
    }


    async cambiarReservaPagada(preference_id) {
        try {
            const conexion = DataBase.getInstance();
            const query = "UPDATE reservaPacientes SET estadoReserva = 'reservada'  WHERE preference_id = ?";
            const params = [preference_id];
            const resultado = await conexion.ejecutarQuery(query, params);
            if (resultado) {
                return resultado;
            } else {
                return console.error('Ha habido un problema al ejecutar la consulta desde model en ReservaPacientes.js , NO se ha podido cambiar el estado correctamente a pagado ')
            }
        } catch (e) {
            console.log('Problema encontrado a nivel del model en ReservaPacientes.js :  ' + e);
            throw new Error('No se ha podido actualizar el pago desde la clase del modelo ReservaPacientes.js :  ' + e);
        }
    }


    //METODO PARA SELECCIONAR TODAS LAS CITAS MEDICAS SEGUN ESTADO DE RESERVA INGRESADO
    async seleccionarReservaEstado(estadoReserva) {
        try {
            const conexion = DataBase.getInstance();
            const query = "SELECT * FROM reservaPacientes WHERE estadoReserva = ? AND estadoPeticion <> 0"
            const param = [estadoReserva]
            const resultadoQuery = await conexion.ejecutarQuery(query, param);

            if (resultadoQuery) {
                return resultadoQuery;
            }
        } catch (error) {
            console.log(error);
            throw new Error(error);
        }
    }


    //METODO PARA ACTUALZIAR NUEVAS CITAS MEDICAS
    // Al actualizar se resetean los flags de recordatorio para que se reenvíen con la nueva fecha/hora
    async actualizarReserva(
        nombrePaciente,
        apellidoPaciente,
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
        id_reserva,
        prevision = null,
        comentario = null) {
        const {connection, lockKey} = await this.obtenerConexionConBloqueoAgenda(id_profesional);

        try {
            const disponible = await this.validarDisponibilidadEnConexion(
                connection,
                fechaInicio,
                horaInicio,
                fechaFinalizacion,
                horaFinalizacion,
                id_profesional,
                id_reserva
            );

            if (!disponible) {
                throw this.crearErrorAgenda(
                    CODIGO_CONFLICTO_AGENDA,
                    "El horario ya fue tomado por otra reserva o bloqueo."
                );
            }


            // prevision/comentario en null = el cliente no los envió: COALESCE conserva lo guardado.
            const query = "UPDATE reservaPacientes SET nombrePaciente = ? , apellidoPaciente = ?, rut = ? , telefono = ? , email = ? , fechaInicio = ?  , horaInicio = ? , fechaFinalizacion = ? , horaFinalizacion = ? ,monto_reserva = ? , motivo_reserva = ?, estadoReserva = ? , id_profesional = ? , prevision = COALESCE(?, prevision), comentario = COALESCE(?, comentario), recordatorio12h = 0, recordatorio6h = 0, wspRecordatorio12h = 0, wspRecordatorio6h = 0, wspRecordatorio1h = 0 WHERE id_reserva = ?";
            const params = [nombrePaciente, apellidoPaciente, rut, telefono, email, fechaInicio, horaInicio, fechaFinalizacion, horaFinalizacion, monto_reserva, motivo_reserva, estadoReserva, id_profesional, prevision, comentario, id_reserva];
            const [resultadoQuery] = await connection.query(query, params);
            return resultadoQuery;
        } finally {
            await this.liberarConexionConBloqueoAgenda(connection, lockKey);
        }
    }


    //METODO PARA ELIMINAR LOGICAMENTE EL AGENDAMIENTO
    async eliminarReservaPaciente(id_reserva) {
        try {
            const conexion = DataBase.getInstance();
            const query = "DELETE FROM reservaPacientes WHERE id_reserva = ?";
            const param = [id_reserva];

            const resultadoQuery = await conexion.ejecutarQuery(query, param);
            if (resultadoQuery) {
                return resultadoQuery;
            }

        } catch (error) {
            throw new Error(error);
        }
    }


    //METODO PARA SELECCIONAR TODAS LAS CITAS MEDICAS
    async seleccionarFichasReservadasEspecifica(id_reserva) {
        try {
            const conexion = DataBase.getInstance();
            const query = "SELECT reservaPacientes.*, profesionales.nombreProfesional FROM reservaPacientes INNER JOIN profesionales ON reservaPacientes.id_profesional = profesionales.id_profesional WHERE reservaPacientes.id_reserva = ? AND reservaPacientes.estadoPeticion <> 0"
            const param = [id_reserva];
            const resultadoQuery = await conexion.ejecutarQuery(query, param);

            if (resultadoQuery) {
                return resultadoQuery;
            }

        } catch (error) {
            console.log(error);
            throw new Error(error);
        }

    }


    //METODO PARA SELECCIONAR TODAS LAS CITAS MEDICAS
    async seleccionarFichasReservadas() {
        try {
            const conexion = DataBase.getInstance();
            const query = "SELECT reservaPacientes.*,profesionales.nombreProfesional FROM reservaPacientes INNER JOIN profesionales ON reservaPacientes.id_profesional = profesionales.id_profesional WHERE estadoPeticion <> 0"
            const resultadoQuery = await conexion.ejecutarQuery(query);
            if (resultadoQuery) {
                return resultadoQuery;
            }
        } catch (error) {
            console.log(error);
            throw new Error(error);
        }
    }


    //METODO PARA INSERTAR NUEVAS CITAS MEDICAS
    async insertarReservaPaciente(nombrePaciente, apellidoPaciente, rut, telefono, email, fechaInicio, horaInicio, fechaFinalizacion, horaFinalizacion, monto_reserva, motivo_reserva, estadoReserva, id_profesional, prevision = VALOR_NO_INDICADO, comentario = VALOR_NO_INDICADO) {
        const {connection, lockKey} = await this.obtenerConexionConBloqueoAgenda(id_profesional);

        try {
            const disponible = await this.validarDisponibilidadEnConexion(
                connection,
                fechaInicio,
                horaInicio,
                fechaFinalizacion,
                horaFinalizacion,
                id_profesional
            );

            if (!disponible) {
                throw this.crearErrorAgenda(
                    CODIGO_CONFLICTO_AGENDA,
                    "El horario ya fue tomado por otra reserva o bloqueo."
                );
            }

            const query = "INSERT INTO reservaPacientes(nombrePaciente, apellidoPaciente, rut, telefono, email, fechaInicio, horaInicio,fechaFinalizacion, horaFinalizacion,monto_reserva,motivo_reserva, estadoReserva, id_profesional, prevision, comentario) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)";
            const params = [nombrePaciente, apellidoPaciente, rut, telefono, email, fechaInicio, horaInicio, fechaFinalizacion, horaFinalizacion, monto_reserva, motivo_reserva, estadoReserva, id_profesional, prevision, comentario];
            const [resultadoQuery] = await connection.query(query, params);
            return resultadoQuery;
        } finally {
            await this.liberarConexionConBloqueoAgenda(connection, lockKey);
        }
    }

//DEVUELVE UN VALOR booleano PARA EVALUAR SI LAS HORAS MEDICAS SE SUPERPONEN CON RESERVAS O BLOQUEOS
    async validarDisponibilidadBoolean(fechaInicio, horaInicio, fechaFinalizacion, horaFinalizacion, id_profesional) {
        const conexion = DataBase.getInstance();
        const connection = await conexion.obtenerConexion();

        try {
            return await this.validarDisponibilidadEnConexion(
                connection,
                fechaInicio,
                horaInicio,
                fechaFinalizacion,
                horaFinalizacion,
                id_profesional
            );
        } finally {
            connection.release();
        }
    }


    async seleccionarSimilitudNombre(nombrePaciente) {
        try {
            const conexion = DataBase.getInstance();
            const query = 'SELECT * FROM reservaPacientes WHERE nombrePaciente LIKE ? AND estadoPeticion <> 0 ';
            const param = ['%' + nombrePaciente + '%'];

            const resultadoQuery = await conexion.ejecutarQuery(query, param);

            if (resultadoQuery) {
                return resultadoQuery;
            }

        } catch (error) {
            console.log(error);

        }
    }


    async seleccionarSimilitudRut(rut) {
        try {
            const conexion = DataBase.getInstance();
            const query = 'SELECT * FROM reservaPacientes WHERE rut LIKE ? AND estadoPeticion <> 0 ';
            const param = ['%' + rut + '%'];

            const resultadoQuery = await conexion.ejecutarQuery(query, param);

            if (resultadoQuery) {
                return resultadoQuery;
            }

        } catch (error) {
            console.log(error);

        }
    }


    async seleccionarPorId_profesional(id_profesional) {
        try {
            const conexion = DataBase.getInstance();
            const query = 'SELECT reservaPacientes.*, profesionales.nombreProfesional FROM reservaPacientes INNER JOIN profesionales ON reservaPacientes.id_profesional = profesionales.id_profesional WHERE reservaPacientes.id_profesional = ? AND reservaPacientes.estadoPeticion <> 0';
            const param = [id_profesional];

            const resultadoQuery = await conexion.ejecutarQuery(query, param);

            if (resultadoQuery) {
                return resultadoQuery;
            }
        } catch (error) {
            throw new Error(error);
        }
    }



    async seleccionarEntreFechas(fechaInicio, fechaFinalizacion) {
        try {
            const conexion = DataBase.getInstance();
            const query = 'SELECT reservaPacientes.*, profesionales.nombreProfesional FROM reservaPacientes INNER JOIN profesionales ON reservaPacientes.id_profesional = profesionales.id_profesional WHERE reservaPacientes.fechaInicio BETWEEN ? AND ? AND reservaPacientes.estadoPeticion <> 0';
            const param = [fechaInicio, fechaFinalizacion];

            const resultadoQuery = await conexion.ejecutarQuery(query, param);

            if (resultadoQuery) {
                return resultadoQuery;
            }

        } catch (error) {
            console.log(error);

        }
    }


    async actualizarEstado(estadoReserva, id_reserva) {
        try {
            const conexion = DataBase.getInstance();
            const query = "UPDATE reservaPacientes SET estadoReserva = ? WHERE id_reserva = ?"
            const params = [estadoReserva, id_reserva];

            const resultadoQuery = await conexion.ejecutarQuery(query, params);
            if (resultadoQuery) {

                return resultadoQuery;
            }
            return null;
        } catch (error) {
            throw error;
        }
    }


    async expirarReservasPendientes(){
        try {
            const conexion = DataBase.getInstance();

            const query = `
             update reservaPacientes SET estadoPeticion = 0 WHERE fechaExpiracionPago <= NOW() AND estadoPeticion = 3 
            `;

            return  await conexion.ejecutarQuery(query);


        }catch (e) {
            throw new Error(e);
        }

    }

    //METODO PARA INSERTAR NUEVAS CITAS MEDICAS DESDE METODOS INTERNOS DEL BACKEND COMO MERCADO PAGO
    async insertarReservaPacienteBackend(
        nombrePaciente,
        apellidoPaciente,
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
        preference_id,
        estadoPeticion,
        id_profesional,
        prevision = VALOR_NO_INDICADO,
        comentario = VALOR_NO_INDICADO) {
        const {connection, lockKey} = await this.obtenerConexionConBloqueoAgenda(id_profesional);
        try {
            const disponible = await this.validarDisponibilidadEnConexion(
                connection,
                fechaInicio,
                horaInicio,
                fechaFinalizacion,
                horaFinalizacion,
                id_profesional
            );

            if (!disponible) {
                throw this.crearErrorAgenda(
                    CODIGO_CONFLICTO_AGENDA,
                    "El horario ya fue tomado por otra reserva o bloqueo."
                );
            }

            const fechaActualMas10Minutos = new Date(Date.now() + 10 * 60 * 1000);

            const query = `INSERT INTO reservaPacientes(nombrePaciente, apellidoPaciente, rut, telefono, email, fechaInicio, horaInicio,fechaFinalizacion, horaFinalizacion, monto_reserva, motivo_reserva, estadoReserva, preference_id, estadoPeticion,id_profesional, fechaExpiracionPago, prevision, comentario) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
            const params = [nombrePaciente, apellidoPaciente, rut, telefono, email, fechaInicio, horaInicio, fechaFinalizacion, horaFinalizacion,monto_reserva, motivo_reserva, estadoReserva, preference_id, estadoPeticion, id_profesional, fechaActualMas10Minutos, prevision, comentario];
            const [resultadoQuery] = await connection.query(query, params);
            return resultadoQuery;
        } finally {
            await this.liberarConexionConBloqueoAgenda(connection, lockKey);
        }
    }



    //METODO PARA SELECCIONAR TODAS LAS CITAS MEDICAS por id_profesional
    async seleccionarFichasReservadasPreference(preference_id) {
        try {
            const conexion = DataBase.getInstance();
            const query = `
            SELECT 
reservaPacientes.nombrePaciente,
reservaPacientes.apellidoPaciente,
reservaPacientes.rut,
reservaPacientes.telefono,
reservaPacientes.email,
reservaPacientes.fechaInicio,
reservaPacientes.horaInicio,
reservaPacientes.fechaFinalizacion,
reservaPacientes.horaFinalizacion,
reservaPacientes.monto_reserva,
reservaPacientes.motivo_reserva,
reservaPacientes.estadoReserva,
reservaPacientes.estadoPeticion,
reservaPacientes.preference_id,
reservaPacientes.id_reserva,
reservaPacientes.prevision,
reservaPacientes.comentario,

profesionales.id_profesional,
profesionales.nombreProfesional

FROM reservaPacientes

INNER JOIN profesionales
ON profesionales.id_profesional = reservaPacientes.id_profesional

WHERE reservaPacientes.estadoPeticion <> 0 AND
reservaPacientes.preference_id = ?`;
            const param = [preference_id];
            const resultadoQuery = await conexion.ejecutarQuery(query, param);

            if (resultadoQuery) {
                return resultadoQuery;
            }

        } catch (error) {
            console.log(error);
            throw new Error(error);
        }
    }







    //METODO PARA SELECCIONAR TODAS LAS CITAS MEDICAS por preference_id
    async seleccionarReservasPorProfesional(id_pro) {
        try {
            const conexion = DataBase.getInstance();
            const query = "SELECT * FROM reservaPacientes WHERE preference_id = ? AND estadoPeticion <> 0"
            const param = [id_pro];
            const resultadoQuery = await conexion.ejecutarQuery(query, param);

            if (resultadoQuery) {
                return resultadoQuery;
            }

        } catch (error) {
            console.log(error);
            throw new Error(error);
        }
    }

    /*

    =====> cambiarReservaPagadaVisible(preference_id) <=======
    LO QUE SE HACE ACA ES CAMBIAR EL estadoPeticion EL CUAL POR DEFECTO ES 1, PERO SI NO HA PAGADO SE INGRESA COMO 0 SOLO SI PAGA SE DEJA VISIBLE Y OPERATIVA
    -->SOLO SE USA EN EN CONTROLLER DE MERCADO PAGO.

    * */
    async cambiarReservaPagadaVisible(preference_id) {
        try {
            const conexion = DataBase.getInstance();
            const query = `  UPDATE reservaPacientes
  SET estadoPeticion = 1
  WHERE preference_id = ?
    AND estadoPeticion = 3`;
            const params = [preference_id];
            const resultado = await conexion.ejecutarQuery(query, params);
            if (resultado) {
                return resultado;
            } else {
                return console.error('Ha habido un problema al ejecutar la consulta desde model en ReservaPacientes.js , NO se ha podido cambiar el estado correctamente a pagado ')
            }
        } catch (e) {
            console.log('Problema encontrado a nivel del model en ReservaPacientes.js :  ' + e);
            throw new Error('No se ha podido actualizar el pago desde la clase del modelo ReservaPacientes.js :  ' + e);
        }
    }



    async seleccionarFichasReservadas_id_profesional(id_profesional) {
        try {
            const conexion = DataBase.getInstance();
            const query = "SELECT * FROM reservaPacientes WHERE id_profesional = ? AND estadoPeticion <> 0"
            const param = [id_profesional];
            const resultadoQuery = await conexion.ejecutarQuery(query, param);

            if (resultadoQuery) {
                return resultadoQuery;
            }

        } catch (error) {
            console.log(error);
            throw new Error(error);
        }
    }


    //METODO PARA ACTUALIZAR SOLO EL COMENTARIO DE UNA CITA (lápiz del Panel de Reservaciones)
    async actualizarComentario(comentario, id_reserva) {
        const conexion = DataBase.getInstance();
        const query = "UPDATE reservaPacientes SET comentario = ? WHERE id_reserva = ? AND estadoPeticion <> 0";
        const params = [comentario, id_reserva];
        return await conexion.ejecutarQuery(query, params);
    }


    /*
    =====> contarReservasPorPrevision(fechaInicio, fechaFinalizacion) <=======
    ESTADISTICA DEL PANEL FINANCIERO: CANTIDAD DE RESERVAS POR PREVISION EN EL PERIODO.
    Usa el MISMO universo que el KPI "reservas del período" del panel:
    estadoPeticion = 1 (excluye slots libres y pagos en curso) y fechaInicio dentro
    del rango, sin filtrar por estadoReserva. Así los porcentajes calzan con ese total.
    */
    async contarReservasPorPrevision(fechaInicio, fechaFinalizacion) {
        const conexion = DataBase.getInstance();
        const query = `
            SELECT COALESCE(NULLIF(prevision, ''), ?) AS prevision, COUNT(*) AS cantidad
            FROM reservaPacientes
            WHERE estadoPeticion = 1
              AND fechaInicio BETWEEN ? AND ?
            GROUP BY COALESCE(NULLIF(prevision, ''), ?)`;
        const params = [VALOR_NO_INDICADO, fechaInicio, fechaFinalizacion, VALOR_NO_INDICADO];
        return await conexion.ejecutarQuery(query, params);
    }

}
