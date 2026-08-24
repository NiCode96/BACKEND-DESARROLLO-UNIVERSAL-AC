import "dotenv/config";
import { Buffer } from "node:buffer";
import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";


function generarCotizacionPdf(fecha,cotizacion,detalle,empresa) {
    const documento = new jsPDF("p", "mm", "letter");
    const anchoPagina = documento.internal.pageSize.getWidth();
    const altoPagina = documento.internal.pageSize.getHeight();
    const margen = 16;
    const azulClinico = [24, 54, 78];
    const turquesaClinico = [20, 132, 136];
    const textoPrincipal = [31, 49, 64];
    const textoSecundario = [91, 112, 126];
    const fondoSuave = [244, 248, 249];
    const borde = [205, 219, 224];
    const nombreEmpresa = String(empresa.empresaNombre ?? "").trim();
    const contactoPie = [
        empresa.contactoTelefono ? `Tel. ${empresa.contactoTelefono}` : "",
        empresa.contactoWhatsapp ? `WhatsApp ${empresa.contactoWhatsapp}` : "",
        empresa.contactoEmail || ""
    ].filter(Boolean).join("  ·  ");
    const direccionPie = String(empresa.contactoDireccion ?? "").trim();

    function dibujarPiePagina() {
        const paginaActual = documento.internal.getCurrentPageInfo().pageNumber;
        const posicionPie = altoPagina - 17;

        documento.setDrawColor(...borde);
        documento.setLineWidth(0.25);
        documento.line(margen, posicionPie - 3, anchoPagina - margen, posicionPie - 3);

        documento.setFont("helvetica", "bold");
        documento.setFontSize(7);
        documento.setTextColor(...azulClinico);
        documento.text(nombreEmpresa || "-", margen, posicionPie);
        documento.text(`Página ${paginaActual}`, anchoPagina - margen, posicionPie, {align: "right"});

        documento.setFont("helvetica", "normal");
        documento.setFontSize(6.5);
        documento.setTextColor(...textoSecundario);
        documento.text(contactoPie || "-", margen, posicionPie + 4);
        documento.text(direccionPie ? `Dirección: ${direccionPie}` : "-", margen, posicionPie + 8);
    }

    documento.setFillColor(...azulClinico);
    documento.rect(0, 0, anchoPagina, 9, "F");

    const lineasNombreEmpresa = documento.splitTextToSize(nombreEmpresa || "-", anchoPagina - 110);
    documento.setFont("helvetica", "bold");
    documento.setFontSize(16);
    documento.setTextColor(...azulClinico);
    documento.text(lineasNombreEmpresa, margen + 6, 21);

    const posicionSubtitulo = 21 + (lineasNombreEmpresa.length * 5.5);
    documento.setFillColor(...turquesaClinico);
    documento.roundedRect(margen, 16, 2.5, posicionSubtitulo - 13, 1, 1, "F");
    documento.setFontSize(7.5);
    documento.setTextColor(...turquesaClinico);
    documento.text("COTIZACIÓN CLÍNICA", margen + 6, posicionSubtitulo);

    documento.setFont("helvetica", "bold");
    documento.setFontSize(10);
    documento.setTextColor(...azulClinico);
    documento.text(`#${cotizacion.id_cotizacion_paciente}`, anchoPagina - margen, 20, {align: "right"});

    documento.setFont("helvetica", "normal");
    documento.setFontSize(7);
    documento.setTextColor(...textoSecundario);
    documento.text(
        `Emisión: ${formatearFechaDocumento(fecha)}`,
        anchoPagina - margen,
        27,
        {align: "right"}
    );

    const finEncabezado = Math.max(posicionSubtitulo + 4, 31);
    documento.setDrawColor(...borde);
    documento.setLineWidth(0.3);
    documento.line(margen, finEncabezado, anchoPagina - margen, finEncabezado);

    const inicioPaciente = finEncabezado + 8;
    documento.setFillColor(...fondoSuave);
    documento.setDrawColor(...borde);
    documento.roundedRect(margen, inicioPaciente, anchoPagina - (margen * 2), 40, 2, 2, "FD");

    documento.setFont("helvetica", "bold");
    documento.setFontSize(7);
    documento.setTextColor(...turquesaClinico);
    documento.text("INFORMACIÓN DEL PACIENTE", margen + 5, inicioPaciente + 7);

    documento.setFont("helvetica", "normal");
    documento.setFontSize(6.5);
    documento.setTextColor(...textoSecundario);
    documento.text("PACIENTE", margen + 5, inicioPaciente + 14);
    documento.text("RUT", margen + 83, inicioPaciente + 14);
    documento.text("TELÉFONO", margen + 130, inicioPaciente + 14);
    documento.text("CORREO", margen + 5, inicioPaciente + 28);
    documento.text("PROFESIONAL", margen + 83, inicioPaciente + 28);
    documento.text("FECHA DE EMISIÓN", margen + 145, inicioPaciente + 28);

    documento.setFont("helvetica", "bold");
    documento.setFontSize(8.5);
    documento.setTextColor(...textoPrincipal);
    documento.text(`${cotizacion.nombre ?? ""} ${cotizacion.apellido ?? ""}`.trim() || "-", margen + 5, inicioPaciente + 20);
    documento.text(String(cotizacion.rut ?? "-"), margen + 83, inicioPaciente + 20);
    documento.text(String(cotizacion.telefono ?? "-"), margen + 130, inicioPaciente + 20);
    documento.text(String(cotizacion.correo ?? "-"), margen + 5, inicioPaciente + 34);
    documento.text(
        documento.splitTextToSize(String(cotizacion.profesional_solicitante_nombre ?? "-"), 55)[0],
        margen + 83,
        inicioPaciente + 34
    );
    documento.text(
        formatearFechaDocumento(fecha),
        margen + 145,
        inicioPaciente + 34
    );

    const inicioDetalle = inicioPaciente + 51;
    documento.setFont("helvetica", "bold");
    documento.setFontSize(7.5);
    documento.setTextColor(...azulClinico);
    documento.text("DETALLE DE PRESTACIONES", margen, inicioDetalle - 4);

    autoTable(documento, {
        startY: inicioDetalle,
        margin: {left: margen, right: margen, bottom: 27},
        head: [["Prestación o procedimiento", "Valor", "Observaciones"]],
        body: detalle.map((elemento) => [
            elemento.producto_servicio_cotizado,
            formatearMonto(elemento.valor_producto_cotizado),
            elemento.observacion_producto_cotizado || "-"
        ]),
        theme: "grid",
        styles: {
            font: "helvetica",
            fontSize: 8,
            cellPadding: 3.4,
            lineColor: borde,
            lineWidth: 0.18,
            textColor: textoPrincipal,
            valign: "middle"
        },
        headStyles: {
            fillColor: azulClinico,
            textColor: [255, 255, 255],
            fontStyle: "bold",
            fontSize: 7.5
        },
        bodyStyles: {
            fillColor: [255, 255, 255]
        },
        alternateRowStyles: {fillColor: fondoSuave},
        columnStyles: {
            0: {cellWidth: 76},
            1: {cellWidth: 30, halign: "right", fontStyle: "bold"},
            2: {cellWidth: "auto"}
        },
        didDrawPage: dibujarPiePagina
    });

    let posicionTotales = (documento.lastAutoTable?.finalY || 95) + 9;
    if (posicionTotales > altoPagina - 45) {
        documento.addPage();
        documento.setFillColor(...azulClinico);
        documento.rect(0, 0, anchoPagina, 6, "F");
        dibujarPiePagina();
        posicionTotales = 24;
    }

    const anchoTotal = 76;
    const inicioTotales = anchoPagina - margen - anchoTotal;
    documento.setFillColor(...fondoSuave);
    documento.setDrawColor(...borde);
    documento.roundedRect(inicioTotales, posicionTotales, anchoTotal, 20, 2, 2, "FD");

    documento.setFont("helvetica", "bold");
    documento.setFontSize(7);
    documento.setTextColor(...turquesaClinico);
    documento.text("TOTAL COTIZACIÓN (PENDIENTE PAGO)", inicioTotales + 5, posicionTotales + 7);

    documento.setFontSize(14);
    documento.setTextColor(...azulClinico);
    documento.text(
        formatearMonto(cotizacion.total_presupuesto_cotizado),
        anchoPagina - margen - 5,
        posicionTotales + 15,
        {align: "right"}
    );

    documento.setFont("helvetica", "normal");
    documento.setFontSize(6.5);
    documento.setTextColor(...textoSecundario);
    documento.text(
        "Valores sujetos a confirmación clínica y disponibilidad.",
        margen,
        posicionTotales + 13
    );

    const nombrePacienteArchivo = `${cotizacion.nombre ?? ""}-${cotizacion.apellido ?? ""}`
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

const nombreArchivo = `presupuesto-${cotizacion.id_cotizacion_paciente}-${nombrePacienteArchivo || "paciente"}.pdf`;
const pdfArrayBuffer = documento.output("arraybuffer");
const pdf_buffer = Buffer.from(pdfArrayBuffer);

if( !pdf_buffer || pdf_buffer.byteLength === 0) {
    throw new Error("Error al generar el PDF.");
}

return {
    pdf_buffer,
    nombreArchivo
}

}


function formatearMonto(valor) {
    return new Intl.NumberFormat("es-CL", {
        style: "currency",
        currency: "CLP",
        maximumFractionDigits: 0
    }).format(Number(valor) || 0);
}


function formatearFechaDocumento(fecha) {
    const [anio, mes, dia] = String(
        fecha ?? ""
    ).split("-");

    if (!anio || !mes || !dia) {
        throw new Error(
            "La fecha de emisión no es válida."
        );
    }

    return `${dia}/${mes}/${anio}`;
}

function debug(resultadoBusquedaCotizacion, resultadoBusquedaDetalle, resultadoBusquedaDatosEmpresa, fecha_emision,pdf_cotizacion_realizado){
    console.log(" ");
    console.log("*********** INICIO DEL ENVIO DEL PDF ************");
    console.log("--------------------------------------------------");
    console.log(`DATOS ENCONTRADOS DE LA COTIZACION:`);
    console.log("--------------------------------------------------");
    console.log(resultadoBusquedaCotizacion);
    console.log(" ");
    console.log("--------------------------------------------------");
    console.log(`DETALLES ENCONTRADOS DE LA COTIZACION:`);
    console.log("--------------------------------------------------");
    console.log(resultadoBusquedaDetalle);
    console.log(" ");
    console.log("--------------------------------------------------");
    console.log(`DATOS DE LA EMPRESA:`);
    console.log("--------------------------------------------------");
    console.log(resultadoBusquedaDatosEmpresa);
    console.log(" ");
    console.log("--------------------------------------------------");
    console.log(`FECHA DE EMISION: ${fecha_emision}`);
    console.log(" ");
    console.log(" ");
    console.log(" ");
    console.log("PDF CREADO (INCLUYE NOMBRE Y DATOS BUFFER EN BINARIO):");
    console.log("--------------------------------------------------");
    console.log(pdf_cotizacion_realizado);
    console.log("--------------------------------------------------");
    console.log(" ");
    console.log(" ");
}


export default class EnviarPdfService {

    constructor() {
    }

   static async enviarPdf(resultadoBusquedaCotizacion, resultadoBusquedaDetalle, resultadoBusquedaDatosEmpresa, fecha_emision){
        try {
            if(Array.isArray(resultadoBusquedaCotizacion) && resultadoBusquedaCotizacion.length > 0 && Array.isArray(resultadoBusquedaDetalle) && resultadoBusquedaDetalle.length > 0 && fecha_emision){

                const cotizacion = resultadoBusquedaCotizacion[0];
                const empresa = resultadoBusquedaDatosEmpresa[0];
                const detalle = resultadoBusquedaDetalle;
                const fecha = fecha_emision;

                const pdf_cotizacion_realizado = generarCotizacionPdf(fecha,cotizacion,detalle,empresa);
                debug(resultadoBusquedaCotizacion, resultadoBusquedaDetalle, resultadoBusquedaDatosEmpresa, fecha_emision,pdf_cotizacion_realizado);


                const pdf_base64 = pdf_cotizacion_realizado
                    .pdf_buffer
                    .toString("base64");

                const api_key = process.env.BREVO_API_KEY;

                const correo_remitente =
                    process.env.CORREO_REMITENTE;

                const nombre_paciente =
                    `${cotizacion.nombre ?? ""} ${cotizacion.apellido ?? ""}`
                        .trim();


                const respuesta_brevo = await fetch(
                    "https://api.brevo.com/v3/smtp/email",
                    {
                        method: "POST",
                        headers: {"api-key": api_key,
                            "Content-Type": "application/json",
                            "Accept":"application/json"
                        },
                        body: JSON.stringify({
                            sender: {
                                name: empresa.empresaNombre,
                                email:correo_remitente
                            },
                            to: [
                                {
                                    email: cotizacion.correo,
                                    name: nombre_paciente
                                }
                            ],
                            replyTo: {
                                email: empresa.contactoEmail,
                                name: empresa.empresaNombre
                            },

                            subject:
                                `Cotización - ${empresa.empresaNombre ?? ""} / ${cotizacion.nombre ?? ""} ${cotizacion.apellido ?? ""}`,

          
                            htmlContent: `
                  <div style="font-family: Arial, sans-serif; max-width:
                  600px; margin: 0 auto;">
                      <h2 style="color: #18364e;">
                          ${empresa.empresaNombre}
                      </h2>

                      <p>
                          Estimado/a
                          <strong>
                              ${nombre_paciente}
                          </strong>:
                      </p>

                      <p>
                          Adjuntamos su cotización de tratamiento
                          en formato PDF.
                      </p>

                      <p>
                          ID de cotización:
                          <strong>
                              #${cotizacion.id_cotizacion_paciente}
                          </strong>
                      </p>

                      <p>
                          Fecha de emisión:
                          <strong>
                              ${formatearFechaDocumento(fecha)}
                          </strong>
                      </p>

                      <p>
                      Si tiene alguna consulta, puede contactarnos a través de nuestros canales regulares.
                      </p> 
                      
                      </br>
                          
                          Correo Contacto:
                          <strong>
                              ${empresa.contactoEmail}
                          </strong>
                                   </br>
                          
                          Contacto Telefono::
                          <strong>
                              ${empresa.contactoTelefono}
                          </strong>
                      
                  </div>
              `,
                            attachment: [
                                {
                                    content: pdf_base64,
                                    name: pdf_cotizacion_realizado.nombreArchivo
                                }
                            ]
                        })
                    }
                );

                const resultado_brevo = await respuesta_brevo.json();

                console.log(``);
                console.log("RESPUESTA DE BREVO:");
                console.log(resultado_brevo);



                return true;
            }else{
                console.log(`#################################################`);
                console.log(`NO FUE POSIBLE ENVIAR LA COTIZACION AL CLIENTE`);
                console.log(`#################################################`);
                return false;
            }

        }catch (e) {
            throw e;
        }
    }


}

