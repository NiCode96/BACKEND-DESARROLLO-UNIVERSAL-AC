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
import contactoRouter from "./view/contactoRoutes.js";
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
import serviciosProfesionalesRoutes from "./view/serviciosProfesionalesRoutes.js";
import tarifasProfesionalRoutes from "./view/tarifasProfesionalRoutes.js";
import odontogramaRoutes from "./view/odontogramaRoutes.js";
import { ejecutarRecordatoriosAutomaticos } from "./services/notificacionPreviaDia.js";
import { notificacionAgendamiento } from "./services/notificacionWhatsApp.js";
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




const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));


const corsConfig = {
    origin: true,           // refleja el origin de la petición (permite cualquier origen)
    credentials: true,      // permite envío de cookies; poner false si no quieres cookies
    methods: ['GET','POST','PUT','DELETE','OPTIONS'],
    allowedHeaders: ['Content-Type','Authorization']
};

app.use(cors(corsConfig));

app.get("/", (req, res) => { res.send("Hola mundo"); });
app.use("/pedidos", pedidosRoutes);
app.use("/bloqueoAgenda", bloqueoAgendaRoutes);
app.use("/odontograma", odontogramaRoutes);
app.use("/profesionales", profesionalesRoutes);
app.use("/serviciosProfesionales", serviciosProfesionalesRoutes);
app.use("/tarifasProfesional", tarifasProfesionalRoutes);
app.use("/especificacionProducto", especificacionProductoRoutes);
app.use("/subsubcategorias", subSubCategoriaRoutes);
app.use("/carruselPortada", carruselPortadaRoutes);
app.use('/pacientes', pacienteRoutes);
app.use('/ficha', fichaRoutes);
app.use("/reservaPacientes", reservaPacienteRoutes);
app.use("/cloudflare", cloudflareRoutes);
app.use("/correo", correosRoutes);
app.use("/cupon", cuponesRoutes);
app.use("/pagosMercadoPago", mercadoPagoRouter);
app.use("/producto", productoRoute);
app.use("/titulo", tituloRoutes);
app.use("/textos", textosRoutes);
app.use("/categorias", categoriaRoutes);
app.use("/subcategorias", subCategoriasRoutes);
app.use("/publicaciones", publicacionesRoutes);
app.use('/contacto', contactoRouter );
app.use("/publicacionesTituloDetalle", publicacionesTituloDescripcionRoutes);
app.use('/notificacion', notificacionAgendamientoRoutes);
app.use('/fichaplantilla', fichaPlantillaRoutes);
app.use('/fichaCategoria', fichaCategoriaRoutes);
app.use('/fichaCampo', fichaCampoRoutes);
app.use("/examenes", examenesRoutes);
app.use("/recetas", recetasPacientesRoutes);
app.use("/datosempresa", datosEmpresaRoutes);
app.use("/archivoPaciente", archivoPacienteRoutes);
app.use("/persistence", persistence);
app.use("/cotizacionPaciente", cotizacionPacienteRoutes);
app.use("/detalleCotizacion", detalleCotizaciones);
app.use("/envioCotizacionCorreo", envioCotizacionRoutes);


// Ruta para ejecutar recordatorios manualmente (protegido con TEST_API_KEY)
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
})
