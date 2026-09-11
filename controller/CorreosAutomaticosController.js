import "dotenv/config";
import { obtenerDatosEmpresaConfig } from "../services/datosEmpresaConfig.js";
import { construirCorreoBase, construirTablaDetalle, TEXTO_PRINCIPAL, TEXTO_SECUNDARIO, BORDE } from "../services/emailTemplateBase.js";

export default class CorreosAutomaticosController {

    constructor() {

    }


    static async enviarSeguimiento(req, res) {
        try {
            const { asunto, email, mensaje } = req.body;
            console.log(req.body);

            // Validación básica
            if (!asunto || !email || !mensaje) {
                return res.status(400).json({ message: 'sindato' });
            }

            const apiKey = process.env.BREVO_API_KEY;
            const correoRemitente = process.env.CORREO_REMITENTE;
            const { nombreEmpresa, correoEmpresa } = await obtenerDatosEmpresaConfig();

            if (!apiKey) {
                console.error("Falta BREVO_API_KEY en .env");
                return res.status(500).json({ mensaje: 'sindato' });
            }
            if (!correoEmpresa) {
                console.error("Falta contactoEmail en datos_empresa");
                return res.status(500).json({ mensaje: 'sindato' });
            }
            if (!correoRemitente) {
                console.error("Falta CORREO_REMITENTE en .env");
                return res.status(500).json({ mensaje: 'sindato' });
            }

            const response = await fetch("https://api.brevo.com/v3/smtp/email", {
                method: "POST",
                headers: {
                    "api-key": apiKey,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    sender: {
                        name: nombreEmpresa,
                        email: correoRemitente,
                    },
                    to: [
                        {
                            email: email, // email del cliente
                            name: "Cliente",
                        },
                    ],
                    replyTo: {
                        email: correoEmpresa,
                        name: nombreEmpresa,
                    },
                    subject: asunto,
                    htmlContent: construirCorreoBase({
                        eyebrow: nombreEmpresa,
                        titulo: asunto,
                        contenidoHtml: `<div style="font-size:14px; line-height:1.7; color:${TEXTO_PRINCIPAL};">${mensaje.replace(/\n/g, '<br/>')}</div>`,
                        footerNota: "Si tienes alguna consulta adicional, no dudes en contactarnos en nuestros canales regulares.",
                        nombreEmpresa,
                    }),
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                console.error("Error Brevo:", data);
                return res.status(500).json({ mensaje: false });
            }

            return res.json({
                message: true,
            });

        } catch (error) {
            console.error("Error servidor:", error);
            return res.status(500).json({ ok: false, error: "Error del servidor al enviar correo" });
        }
    }







    static async enviarFormularioContacto(req, res) {
        try {
            const { nombre, email, mensaje } = req.body;
            const { nombreEmpresa, correoEmpresa } = await obtenerDatosEmpresaConfig();
            console.log(req.body);

            // Validación básica
            if (!nombre || !email || !mensaje) {
                return res.status(400).json({ message: 'sindato' });
            }

            const apiKey = process.env.BREVO_API_KEY;
            const correoRemitente = process.env.CORREO_REMITENTE;
            if (!apiKey) {
                console.error("Falta BREVO_API_KEY en .env");
                return res.status(500).json({ mensaje: 'sindato' });}
            if (!correoEmpresa) {
                console.error("Falta contactoEmail en datos_empresa");
                return res.status(500).json({ mensaje: 'sindato' });
            }
            if (!correoRemitente) {
                console.error("Falta CORREO_REMITENTE en .env");
                return res.status(500).json({ mensaje: 'sindato' });
            }

            const response = await fetch("https://api.brevo.com/v3/smtp/email", {
                method: "POST",
                headers: {
                    "api-key": apiKey,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    sender: {
                        name: nombreEmpresa,
                        email: correoRemitente,
                    },
                    to: [
                        {
                            email: correoEmpresa,
                            name: nombreEmpresa,
                        },
                    ],
                    replyTo: {
                        email,
                        name: nombre,
                    },
                    subject: `Nuevo mensaje de ${nombre}`,
                    htmlContent: construirCorreoBase({
                        eyebrow: "Formulario de Contacto",
                        titulo: `Nueva consulta de ${nombre}`,
                        contenidoHtml: `
                            ${construirTablaDetalle([
                                { label: "Nombre", value: nombre },
                                { label: "Email", value: email },
                            ])}
                            <p style="margin: 20px 0 0 0; font-size: 14px; line-height: 1.7; color: ${TEXTO_PRINCIPAL};">${String(mensaje).replace(/\n/g, '<br/>')}</p>
                        `,
                        nombreEmpresa,
                    }),
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                console.error("Error Brevo:", data);
                return res.status(500).json({ mensaje:false });
            }

            return res.json({
                message: true,});

        } catch (error) {
            console.error("Error servidor:", error);
            return res.status(500).json({ ok: false, error: "Error del servidor al enviar correo" });
        }
    }






    static async enviarComprobanteCompra(req, res) {
        try {
            const { cliente, venta, productos } = req.body;
            console.log("BODY COMPROBANTE:", req.body);
            const { nombreEmpresa, correoEmpresa } = await obtenerDatosEmpresaConfig();

            // Validación básica
            if (!cliente || !venta || !Array.isArray(productos) || productos.length === 0) {
                return res.status(400).json({ message: 'sindato' });
            }

            const apiKey = process.env.BREVO_API_KEY;
            const correoRemitente = process.env.CORREO_REMITENTE;
            if (!apiKey) {
                console.error("Falta BREVO_API_KEY en .env");
                return res.status(500).json({ message: 'sindato' });
            }
            if (!correoEmpresa) {
                console.error("Falta contactoEmail en datos_empresa");
                return res.status(500).json({ message: 'sindato' });
            }
            if (!correoRemitente) {
                console.error("Falta CORREO_REMITENTE en .env");
                return res.status(500).json({ message: 'sindato' });
            }

            // Armamos tabla HTML con el detalle de la compra
            const filasProductos = productos.map((producto) => {
                const subtotal = Number(producto.cantidad) * Number(producto.precioUnitario || producto.precio);
                return `
                <tr>
                    <td style="padding: 10px 0; border-bottom: 1px solid ${BORDE}; font-size: 14px; color: ${TEXTO_PRINCIPAL};">${producto.nombre}</td>
                    <td style="padding: 10px 0; border-bottom: 1px solid ${BORDE}; font-size: 14px; color: ${TEXTO_PRINCIPAL}; text-align:center;">${producto.cantidad}</td>
                    <td style="padding: 10px 0; border-bottom: 1px solid ${BORDE}; font-size: 14px; color: ${TEXTO_PRINCIPAL}; text-align:right;">$${Number(producto.precioUnitario || producto.precio).toLocaleString('es-CL')}</td>
                    <td style="padding: 10px 0; border-bottom: 1px solid ${BORDE}; font-size: 14px; font-weight:600; color: ${TEXTO_PRINCIPAL}; text-align:right;">$${subtotal.toLocaleString('es-CL')}</td>
                </tr>
            `;
            }).join("");

            const totalTexto = Number(venta.total).toLocaleString('es-CL');

            const response = await fetch("https://api.brevo.com/v3/smtp/email", {
                method: "POST",
                headers: {
                    "api-key": apiKey,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    sender: {
                        name: nombreEmpresa,
                        email: correoRemitente,
                    },
                    to: [
                        {
                            email: cliente.email,         // cliente que compró
                            name: cliente.nombre,
                        },
                        {
                            email: correoEmpresa,
                            name: nombreEmpresa,
                        },
                    ],
                    replyTo: {
                        email: correoEmpresa,
                        name: nombreEmpresa,
                    },
                    subject: `Comprobante de compra #${venta.codigo || venta.id || ""}`,
                    htmlContent: construirCorreoBase({
                        eyebrow: "Comprobante de Compra",
                        titulo: `Gracias por tu compra, ${cliente.nombre}`,
                        introHtml: `<p style="margin:0;">Este es el comprobante de tu compra realizada en <strong>${nombreEmpresa}</strong>.</p>`,
                        contenidoHtml: `
                            ${construirTablaDetalle([
                                { label: "Código de pedido", value: venta.codigo || "-" },
                                { label: "Método de pago", value: venta.medioPago || "-" },
                                { label: "Fecha", value: venta.fecha || new Date().toLocaleString('es-CL') },
                            ])}
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%; border-collapse:collapse; margin-top:20px;">
                                <thead>
                                    <tr>
                                        <th align="left" style="padding:8px 0; border-bottom:2px solid ${BORDE}; font-size:11px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:${TEXTO_SECUNDARIO};">Producto</th>
                                        <th style="padding:8px 0; border-bottom:2px solid ${BORDE}; font-size:11px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:${TEXTO_SECUNDARIO};">Cant.</th>
                                        <th align="right" style="padding:8px 0; border-bottom:2px solid ${BORDE}; font-size:11px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:${TEXTO_SECUNDARIO};">Precio</th>
                                        <th align="right" style="padding:8px 0; border-bottom:2px solid ${BORDE}; font-size:11px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:${TEXTO_SECUNDARIO};">Subtotal</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${filasProductos}
                                </tbody>
                            </table>
                            <p style="margin: 16px 0 0 0; text-align:right; font-size:16px; font-weight:700; color:${TEXTO_PRINCIPAL};">Total pagado: $${totalTexto} CLP</p>
                        `,
                        footerNota: "Ante cualquier duda sobre tu compra, contáctanos a través de nuestros canales de venta oficiales.",
                        nombreEmpresa,
                    }),
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                console.error("Error Brevo comprobante:", data);
                return res.status(500).json({ message: false });
            }

            return res.json({ message: true });

        } catch (error) {
            console.error("Error servidor (comprobante):", error);
            return res.status(500).json({ message: false, error: "Error del servidor al enviar comprobante" });
        }
    }
}
