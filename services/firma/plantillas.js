/* Interpolación de los textos legales. MISMA lógica que interpolarPlantilla()
 * de src/lib/consentimientos/textosLegales.js del front: el paciente lee en
 * pantalla exactamente el texto que aquí se guarda como snapshot y se imprime
 * en la constancia.
 *
 * Variables: {{empresa.nombre}}, {{empresa.direccion}}, {{empresa.correo}},
 * {{empresa.telefono}}, {{profesional.nombre}}. Una variable sin valor se
 * reemplaza por un texto neutro; nunca queda la marca visible. */

export function interpolarPlantilla(cuerpo, { empresa = {}, profesional = {} } = {}) {
    const valores = {
        "empresa.nombre": empresa.empresaNombre || empresa.nombre || "el centro de salud",
        "empresa.direccion": empresa.contactoDireccion || empresa.direccion || "la dirección informada en este sitio",
        "empresa.correo": empresa.contactoEmail || empresa.correo || "el correo de contacto del centro",
        "empresa.telefono": empresa.contactoTelefono || empresa.telefono || "el teléfono de contacto del centro",
        "profesional.nombre": profesional.nombreProfesional || profesional.nombre || "el profesional seleccionado",
    };
    return String(cuerpo ?? "").replace(/\{\{\s*([a-z]+\.[a-z]+)\s*\}\}/g, (_, clave) => valores[clave] ?? "");
}

/** Divide el cuerpo en bloques: {tipo:"titulo"|"subtitulo"|"parrafo"|"lista", texto|items}. */
export function bloquesDeTexto(cuerpo) {
    const bloques = [];
    for (const fragmento of String(cuerpo ?? "").split(/\n{2,}/)) {
        const lineas = fragmento.split("\n").map((l) => l.trim()).filter(Boolean);
        let lista = null;
        for (const linea of lineas) {
            if (linea.startsWith("### ")) { lista = null; bloques.push({ tipo: "subtitulo", texto: linea.slice(4) }); }
            else if (linea.startsWith("## ")) { lista = null; bloques.push({ tipo: "titulo", texto: linea.slice(3) }); }
            else if (linea.startsWith("- ")) {
                if (!lista) { lista = { tipo: "lista", items: [] }; bloques.push(lista); }
                lista.items.push(linea.slice(2));
            } else { lista = null; bloques.push({ tipo: "parrafo", texto: linea }); }
        }
    }
    return bloques;
}

/** "a•••e@correo.cl": el correo nunca se devuelve completo en una respuesta. */
export function enmascararCorreo(correo) {
    const [usuario, dominio] = String(correo || "").split("@");
    if (!usuario || !dominio) return "";
    return `${usuario[0]}${"•".repeat(Math.max(usuario.length - 2, 1))}${usuario.slice(-1)}@${dominio}`;
}

export function enmascararTelefono(telefono) {
    const digitos = String(telefono || "").replace(/\D/g, "");
    return digitos.length >= 4 ? `+56 9 •••• ${digitos.slice(-4)}` : "";
}

export const CORREO_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
