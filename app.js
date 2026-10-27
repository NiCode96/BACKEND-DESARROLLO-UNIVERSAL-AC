// Carga del .env en la primera línea del primer módulo: varios archivos leen
// process.env al evaluarse (ej. el cliente de Twilio en services/telemedicina.js)
// y no debe depender del orden de imports que Database.js se cargue antes.
import 'dotenv/config';
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
import productoRoute from "./view/productoRoutes.js";
import tituloRoutes from "./view/tituloRoutes.js";
import textosRoutes from "./view/textosRoutes.js";
import categoriaRoutes from "./view/categoriaRoutes.js";
import publicacionesRoutes from "./view/publicacionesRoutes.js";
// Grupo sin uso (2026-10-23): el formulario publico de contacto envia por
// /correo/contacto. Nadie consume /contacto; se deja de montar. El controller
// queda en el repo por si se necesita reactivar.
// import contactoRouter from "./view/contactoRoutes.js";
import mercadoPagoRouter from "./view/mercadoPagoRoutes.js";
import pedidosRoutes from "./view/pedidosRoutes.js";
import cuponesRoutes from "./view/cuponesRoutes.js";
import correosRoutes from "./view/correosRoutes.js";
import cloudflareRoutes from "./view/CloudflareRoutes.js";
import subCategoriasRoutes from "./view/subCategoriaRoutes.js";
import reservaPacienteRoutes from "./view/reservaPacienteRoutes.js";
import pacienteRoutes from "./view/pacientesRoutes.js";
import fichaRoutes from "./view/fichaRoutes.js";
import carruselPortadaRoutes from "./view/carruselPortadaRoutes.js";
import subSubCategoriaRoutes from "./view/subSubCategoriaRoutes.js";
import especificacionProductoRoutes from "./view/especificacionProductoRoutes.js";
import notificacionAgendamientoRoutes from "./view/notificacionAgendamientoRoutes.js";
import profesionalesRoutes from "./view/profesionalesRoutes.js";
import DistribucionProfesionalRoutes from "./view/distribucionProfesionalRoutes.js";
import serviciosProfesionalesRoutes from "./view/serviciosProfesionalesRoutes.js";
import tarifasProfesionalRoutes from "./view/tarifasProfesionalRoutes.js";
import odontogramaRoutes from "./view/odontogramaRoutes.js";
import { ejecutarRecordatoriosAutomaticos, limpiarNotificacionesInappAntiguas } from "./services/notificacionPreviaDia.js";
import { notificacionAgendamiento } from "./services/notificacionWhatsApp.js";
import notificacionesPushRoutes from "./view/notificacionesPushRoutes.js";
import bloqueoAgendaRoutes from "./view/bloqueoAgendaRoutes.js";
import publicacionesTituloDescripcionRoutes from "./view/publicacionesTtiloDescripcionRoutes.js";
import fichaPlantillaRoutes from "./view/fichaPlantillaRoutes.js";
import fichaCategoriaRoutes from "./view/fichaCategoriaRoutes.js";
import fichaCampoRoutes from "./view/fichaCampoRoutes.js";
import examenesRoutes from "./view/examenesClinicosRoutes.js";
import recetasPacientesRoutes from "./view/recetasPacientesRoutes.js";
import datosEmpresaRoutes from "./view/datosEmpresaRoutes.js";
import archivoPacienteRoutes from "./view/archivoPacienteRoutes.js";
import persistence from "./view/mercadoPagoPersistenceRoutes.js";
import ReservaPacientes from "./model/ReservaPacientes.js";
import cotizacionPacienteRoutes from "./view/cotizacionPacienteRoutes.js";
import envioCotizacionRoutes from "./view/envioCotizacionRoutes.js";
import detalleCotizaciones from "./view/detalleCotizacionRoutes.js"
import resenasRoutes from "./view/resenasRoutes.js";
import healthMetricsRoutes from "./view/healthMetricsRoutes.js";
import telemedicinaRoutes from "./view/telemedicinaRoutes.js";
import { exigirSesionClerk } from "./middleware/exigirSesionClerk.js";




const app = express();


app.set('trust proxy', 1);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));


const corsConfig = {
    origin: true,
    credentials: true,
    methods: ['GET','POST','PUT','DELETE','OPTIONS'],
    allowedHeaders: ['Content-Type','Authorization']
};

app.use(cors(corsConfig));
app.get("/", (req, res) => { res.send("Hola mundo"); });
app.use("/pedidos", pedidosRoutes);
app.use("/bloqueoAgenda", bloqueoAgendaRoutes);
app.use("/odontograma", exigirSesionClerk, odontogramaRoutes);
app.use("/profesionales", profesionalesRoutes);
app.use("/distribucionProfesional", exigirSesionClerk, DistribucionProfesionalRoutes);
app.use("/resenas", resenasRoutes);
app.use("/serviciosProfesionales", exigirSesionClerk, serviciosProfesionalesRoutes);
app.use("/tarifasProfesional", tarifasProfesionalRoutes);
app.use("/especificacionProducto", exigirSesionClerk, especificacionProductoRoutes);
app.use("/subsubcategorias", exigirSesionClerk, subSubCategoriaRoutes);
app.use("/carruselPortada", carruselPortadaRoutes);
app.use("/pacientes", exigirSesionClerk, pacienteRoutes);
app.use('/ficha', exigirSesionClerk, fichaRoutes);
app.use("/reservaPacientes", reservaPacienteRoutes);
app.use("/cloudflare", exigirSesionClerk, cloudflareRoutes);
app.use("/correo", correosRoutes);
app.use("/cupon", exigirSesionClerk, cuponesRoutes);
app.use("/pagosMercadoPago", mercadoPagoRouter);
app.use("/producto", productoRoute);
app.use("/titulo", tituloRoutes);
app.use("/textos", exigirSesionClerk, textosRoutes);
app.use("/categorias", exigirSesionClerk, categoriaRoutes);
app.use("/subcategorias", exigirSesionClerk, subCategoriasRoutes);
app.use("/publicaciones", publicacionesRoutes);
app.use("/publicacionesTituloDetalle", publicacionesTituloDescripcionRoutes);
app.use('/notificacion', notificacionAgendamientoRoutes);
app.use('/fichaplantilla', exigirSesionClerk, fichaPlantillaRoutes);
app.use('/fichaCategoria', exigirSesionClerk, fichaCategoriaRoutes);
app.use('/fichaCampo', exigirSesionClerk, fichaCampoRoutes);
app.use("/examenes", exigirSesionClerk, examenesRoutes);
app.use("/recetas", exigirSesionClerk, recetasPacientesRoutes);

app.use("/datosempresa", datosEmpresaRoutes);
app.use("/archivoPaciente", exigirSesionClerk, archivoPacienteRoutes);

app.use("/persistence", persistence);
app.use("/cotizacionPaciente", exigirSesionClerk, cotizacionPacienteRoutes);
app.use("/detalleCotizacion", exigirSesionClerk, detalleCotizaciones);
app.use("/envioCotizacionCorreo", exigirSesionClerk, envioCotizacionRoutes);
app.use("/notificaciones", exigirSesionClerk, notificacionesPushRoutes);
app.use("/telemedicina", telemedicinaRoutes);


app.use("/health-metrics", healthMetricsRoutes);


app.get('/recordatorios/ejecutar', async (req, res) => {
    try {
        const apiKey = req.headers['x-api-key'];
        if (!process.env.TEST_API_KEY || apiKey !== process.env.TEST_API_KEY) {
            return res.status(401).json({ ok: false, error: "No autorizado" });
        }

        const resultado = await ejecutarRecordatoriosAutomaticos();
        res.json({ ok: true, ...resultado });
    } catch (error) {
        res.status(500).json({ ok: false, error: error.message });
    }
});

// Endpoint de prueba para WhatsApp (protegido con TEST_API_KEY)
app.post('/test-whatsapp', async (req, res) => {
    try {
        const apiKey = req.headers['x-api-key'];
        if (!process.env.TEST_API_KEY || apiKey !== process.env.TEST_API_KEY) {
            return res.status(401).json({ ok: false, error: "No autorizado" });
        }

        const { telefono, nombre, apellido, clinica, fecha, hora, id_reserva } = req.body;

        if (!telefono || !nombre || !fecha || !hora) {
            return res.status(400).json({
                ok: false,
                error: "Faltan campos: telefono, nombre, fecha, hora"
            });
        }

        const enviado = await notificacionAgendamiento({ telefono, nombre, apellido, clinica, fecha, hora, id_reserva });

        if (enviado) {
            res.json({ ok: true, message: "Mensaje WhatsApp enviado correctamente" });
        } else {
            res.status(500).json({ ok: false, error: "No se pudo enviar el mensaje. Revisa los logs." });
        }
    } catch (error) {
        res.status(500).json({ ok: false, error: error.message });
    }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`BACKEND CORRIENDO SIN PROBLEMAS EN --->  http://localhost:${PORT}`);

    // CRON JOB: Ejecutar recordatorios automáticos cada 5 minutos
    console.log("[CRON] Iniciando cron job de recordatorios (cada 5 minutos)...");
    setInterval(async () => {
        await ejecutarRecordatoriosAutomaticos();
    }, 5 * 60 * 1000); // 5 minutos en milisegundos

    const reservaPacientesClass = new ReservaPacientes();



    console.log("[CRON] Iniciando cron job de expiración de reservas pendientes (cada 2 minutos)...");
    setInterval(async () => {
        try {
            await reservaPacientesClass.expirarReservasPendientes();
        } catch (e) {
            console.error("[CRON] Error en cron job de expiración de reservas pendientes:", e);
        }
    }, 60000);

    // Ejecutar una vez al iniciar el servidor
    setTimeout(async () => {
        console.log("[CRON] Ejecutando primera revisión de recordatorios...");
        await ejecutarRecordatoriosAutomaticos();
    }, 10000); // Esperar 10 segundos después de iniciar

    // CRON NOTIFICACIONES: limpiar notificaciones in-app leídas/antiguas — cada 30 min.
    console.log("[CRON] Iniciando cron job de limpieza de notificaciones in-app (cada 30 minutos)...");
    setInterval(() => {
        limpiarNotificacionesInappAntiguas();
    }, 30 * 60 * 1000);
})
