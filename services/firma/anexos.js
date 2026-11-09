/* COPIA EXACTA de src/lib/consentimientos/procedimientos.js del front (no editar aquí sin cambiar allá).
 *
 * Procedimientos del consentimiento informado creados por la clínica.
 *
 * Cada procedimiento es un ANEXO de la plantilla base (plantillasProcedimiento.js)
 * y se guarda en la tabla documento_plantilla (categoría "anexo_procedimiento"),
 * la misma de los anexos de ejemplo: no hay tabla nueva.
 *
 * La clínica no escribe el texto libre: llena CAMPOS FIJOS y el sistema arma el
 * anexo con el formato de siempre ("## " subtítulo, "- " ítem). Así ningún
 * consentimiento queda sin lo que exige el art. 14 de la Ley 20.584: en qué
 * consiste, riesgos, alternativas y consecuencias de no realizarlo.
 *
 * El backend tiene una copia EXACTA de construirCuerpoAnexo (docs/firma/backend/
 * services/firma/anexos.js): el servidor arma el texto, no confía en el del cliente.
 * Si se cambia aquí, cambiar allá. */

export const CAMPOS_ANEXO = [
  {
    clave: "descripcion",
    titulo: "En qué consiste",
    tipo: "parrafo",
    obligatorio: true,
    ayuda: "Qué se hace, cómo, cuánto dura y qué resultado se puede esperar.",
    ejemplo: "Inyección de toxina botulínica tipo A en músculos específicos de la cara para suavizar las arrugas de expresión. El efecto aparece entre 3 y 14 días después y dura entre 3 y 6 meses.",
  },
  {
    clave: "riesgos_frecuentes",
    titulo: "Riesgos frecuentes",
    tipo: "lista",
    obligatorio: true,
    ayuda: "Uno por línea. Molestias o efectos que pueden ocurrir con cierta frecuencia.",
    ejemplo: "Dolor leve o hematoma en los puntos de inyección.\nDolor de cabeza transitorio.",
  },
  {
    clave: "riesgos_poco_frecuentes",
    titulo: "Riesgos poco frecuentes",
    tipo: "lista",
    obligatorio: true,
    ayuda: "Uno por línea. Complicaciones raras pero relevantes, incluidas las graves.",
    ejemplo: "Caída transitoria del párpado.\nReacción alérgica.",
  },
  {
    clave: "alternativas",
    titulo: "Alternativas",
    tipo: "parrafo",
    obligatorio: true,
    ayuda: "Otros tratamientos posibles, incluido no realizar el procedimiento.",
    ejemplo: "Rellenos con ácido hialurónico, tratamientos de superficie de la piel o no realizar el tratamiento.",
  },
  {
    clave: "contraindicaciones",
    titulo: "Contraindicaciones",
    tipo: "parrafo",
    obligatorio: false,
    ayuda: "Situaciones en que no se debe realizar.",
    ejemplo: "Embarazo y lactancia, enfermedades neuromusculares o infección activa en la zona.",
  },
  {
    clave: "si_no_se_realiza",
    titulo: "Si no se realiza",
    tipo: "parrafo",
    obligatorio: true,
    ayuda: "Qué puede pasar si el paciente decide no hacerlo.",
    ejemplo: "Las arrugas de expresión siguen su evolución natural. No hay consecuencias para la salud.",
  },
  {
    clave: "cuidados",
    titulo: "Cuidados posteriores",
    tipo: "parrafo",
    obligatorio: false,
    ayuda: "Indicaciones para después del procedimiento.",
    ejemplo: "No acostarse ni masajear la zona durante 4 horas y asistir al control indicado.",
  },
];

export const ESPECIALIDADES_SUGERIDAS = [
  "Armonización facial",
  "Odontología",
  "Medicina general",
  "Ginecología y obstetricia",
  "Dermatología",
  "Oftalmología",
  "Estética",
  "Kinesiología",
  "Psicología",
  "Terapia ocupacional",
  "Estética facial",
  "Depilación",
  "Nutrición",
];

export const LIMITES = { nombre: 120, grupo: 60, campo: 2000, item: 500, items: 15 };

const limpiar = (texto) => String(texto ?? "").replace(/\r/g, "").trim();

/** Ítems de una lista: uno por línea, sin viñetas escritas a mano ni líneas vacías. */
export function itemsDeLista(texto) {
  return limpiar(texto)
    .split("\n")
    .map((linea) => linea.replace(/^\s*[-•*·]\s*/, "").trim())
    .filter(Boolean);
}

/** Párrafo: los saltos de línea simples se respetan como párrafos separados. */
function parrafos(texto) {
  return limpiar(texto)
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n");
}

/** Campos → cuerpo del anexo (formato de plantillasProcedimiento.js). */
export function construirCuerpoAnexo(campos) {
  const secciones = [];
  for (const def of CAMPOS_ANEXO) {
    const valor = campos?.[def.clave];
    if (def.tipo === "lista") {
      const items = itemsDeLista(valor);
      if (items.length) secciones.push(`## ${def.titulo}\n${items.map((i) => `- ${i}`).join("\n")}`);
    } else {
      const texto = parrafos(valor);
      if (texto) secciones.push(`## ${def.titulo}\n${texto}`);
    }
  }
  return secciones.join("\n\n");
}

/** Cuerpo del anexo → campos (para editar una versión existente, incluidos los ejemplos). */
export function camposDesdeCuerpo(cuerpo) {
  const campos = Object.fromEntries(CAMPOS_ANEXO.map((d) => [d.clave, ""]));
  const porTitulo = new Map(CAMPOS_ANEXO.map((d) => [d.titulo.toLowerCase(), d]));
  for (const bloque of String(cuerpo ?? "").split(/\n(?=## )/)) {
    const [encabezado, ...resto] = bloque.trim().split("\n");
    const def = porTitulo.get(encabezado.replace(/^##\s*/, "").trim().toLowerCase());
    if (!def) continue;
    campos[def.clave] = resto.map((l) => (def.tipo === "lista" ? l.replace(/^-\s*/, "") : l)).join("\n").trim();
  }
  return campos;
}

/** Errores por campo (vacío = válido). Mismas reglas que el backend. */
export function validarProcedimiento({ nombre, grupo, campos }) {
  const errores = {};
  if (!limpiar(nombre)) errores.nombre = "Escribe el nombre del procedimiento.";
  else if (limpiar(nombre).length > LIMITES.nombre) errores.nombre = `Máximo ${LIMITES.nombre} caracteres.`;
  if (!limpiar(grupo)) errores.grupo = "Elige o escribe la especialidad.";
  else if (limpiar(grupo).length > LIMITES.grupo) errores.grupo = `Máximo ${LIMITES.grupo} caracteres.`;
  for (const def of CAMPOS_ANEXO) {
    const valor = limpiar(campos?.[def.clave]);
    if (def.obligatorio && !valor) {
      errores[def.clave] = def.tipo === "lista" ? "Agrega al menos uno." : "Este punto es obligatorio (Ley 20.584, art. 14).";
    } else if (valor.length > LIMITES.campo) {
      errores[def.clave] = `Máximo ${LIMITES.campo} caracteres.`;
    } else if (def.tipo === "lista") {
      const items = itemsDeLista(valor);
      if (items.length > LIMITES.items) errores[def.clave] = `Máximo ${LIMITES.items} ítems.`;
      else if (items.some((i) => i.length > LIMITES.item)) errores[def.clave] = `Cada ítem, máximo ${LIMITES.item} caracteres.`;
    }
  }
  return errores;
}

/** "Relleno con ácido hialurónico" → "anexo_relleno_con_acido_hialuronico". */
export function codigoDesdeNombre(nombre) {
  const slug = limpiar(nombre)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
  return `anexo_${slug || "procedimiento"}`;
}

/** Título guardado en documento_plantilla: "Grupo · Nombre". */
export const tituloPlantilla = (grupo, nombre) => `${limpiar(grupo)} · ${limpiar(nombre)}`;

export function separarTitulo(titulo) {
  const texto = String(titulo ?? "");
  const corte = texto.indexOf(" · ");
  return corte >= 0 ? { grupo: texto.slice(0, corte), nombre: texto.slice(corte + 3) } : { grupo: "Otros", nombre: texto };
}
