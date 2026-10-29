/*
    camposReserva.js
    Reglas de los campos opcionales de la reserva: previsión y comentario.

    Todos los endpoints que crean o editan una reserva pasan por aquí, para que
    el valor que llega a la base sea siempre uno de dos:
      - un valor válido (previsión del catálogo, comentario limpio de ≤100), o
      - 'No indicado', cuando el usuario no ingresó nada.
    Un valor que no cumple se RECHAZA (no se corrige en silencio), así lo que
    queda guardado es exactamente lo que el usuario vio y confirmó.

    Son funciones puras, sin base de datos: se prueban en pruebas/reservas/.
*/

export const VALOR_NO_INDICADO = "No indicado";

// Mismo catálogo que el front (src/lib/previsiones.js). Si se agrega una
// previsión allá, hay que agregarla aquí o el backend la rechazará.
export const PREVISIONES_PERMITIDAS = Object.freeze([
    "FONASA",
    "ISAPRE",
    "CONVENIO",
    "SIN PREVISION",
    "CAPREDENA",
    "DIPRECA",
    "PARTICULAR",
]);

export const MAX_CARACTERES_COMENTARIO = 100;

export const CODIGO_PREVISION_INVALIDA = "PREVISION_INVALIDA";
export const CODIGO_COMENTARIO_INVALIDO = "COMENTARIO_INVALIDO";

function crearErrorCampo(codigo, mensaje) {
    const error = new Error(mensaje);
    error.code = codigo;
    return error;
}

// Mayúsculas y sin tildes: "Isapre", "ISAPRE" e "Isápre" son la misma previsión.
function textoComparable(valor) {
    return String(valor)
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .trim()
        .toUpperCase();
}

const NO_INDICADO_COMPARABLE = new Set(["", "NO INDICADO", "NO INDICADA"]);

/**
 * Previsión a guardar. Vacía o ausente → 'No indicado'.
 * Lanza PREVISION_INVALIDA si no pertenece al catálogo.
 */
export function normalizarPrevisionReserva(valor) {
    if (valor === undefined || valor === null) return VALOR_NO_INDICADO;
    if (typeof valor !== "string") {
        throw crearErrorCampo(CODIGO_PREVISION_INVALIDA, "La previsión debe ser texto.");
    }

    const comparable = textoComparable(valor);
    if (NO_INDICADO_COMPARABLE.has(comparable)) return VALOR_NO_INDICADO;

    const previsionValida = PREVISIONES_PERMITIDAS.find((nombre) => nombre === comparable);
    if (!previsionValida) {
        throw crearErrorCampo(CODIGO_PREVISION_INVALIDA, "La previsión no pertenece al catálogo.");
    }
    return previsionValida;
}

/**
 * Comentario a guardar. Vacío o ausente → 'No indicado'.
 * Los caracteres de control (saltos de línea incluidos) se vuelven espacio: el
 * comentario es una nota de una línea y así no puede inyectar líneas en
 * correos, PDF ni registros. Lanza COMENTARIO_INVALIDO si supera el límite.
 */
export function normalizarComentarioReserva(valor) {
    if (valor === undefined || valor === null) return VALOR_NO_INDICADO;
    if (typeof valor !== "string") {
        throw crearErrorCampo(CODIGO_COMENTARIO_INVALIDO, "El comentario debe ser texto.");
    }

    const limpio = valor
        .replace(/[\p{Cc}\p{Cf}\u2028\u2029]/gu, " ")
        .replace(/\s+/g, " ")
        .trim();

    if (NO_INDICADO_COMPARABLE.has(textoComparable(limpio))) return VALOR_NO_INDICADO;

    // Se cuentan caracteres reales (no unidades UTF-16), igual que VARCHAR(100).
    if ([...limpio].length > MAX_CARACTERES_COMENTARIO) {
        throw crearErrorCampo(
            CODIGO_COMENTARIO_INVALIDO,
            `El comentario supera los ${MAX_CARACTERES_COMENTARIO} caracteres.`
        );
    }
    return limpio;
}

/**
 * Lee previsión y comentario del body.
 *
 * Al CREAR, un campo ausente vale 'No indicado'.
 * Al ACTUALIZAR, un campo ausente vale null = "no tocar lo guardado": así un
 * cliente que no conoce estos campos (calendario general, versiones antiguas)
 * no borra lo que otro usuario ya registró. Enviarlo vacío sí lo limpia.
 */
export function leerCamposOpcionalesReserva(body = {}, { esActualizacion = false } = {}) {
    const tiene = (campo) => Object.prototype.hasOwnProperty.call(body ?? {}, campo);

    const prevision = esActualizacion && !tiene("prevision")
        ? null
        : normalizarPrevisionReserva(body?.prevision);

    const comentario = esActualizacion && !tiene("comentario")
        ? null
        : normalizarComentarioReserva(body?.comentario);

    return { prevision, comentario };
}

/**
 * true si el texto es una fecha civil "AAAA-MM-DD" que existe en el calendario
 * (rechaza "2026-02-30"). Date.UTC solo se usa para validar el día, no para
 * convertir zonas: entrada y salida son la misma fecha civil.
 */
export function esFechaCivilValida(texto) {
    if (typeof texto !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false;
    const [anio, mes, dia] = texto.split("-").map(Number);
    const fecha = new Date(Date.UTC(anio, mes - 1, dia));
    return fecha.getUTCFullYear() === anio && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia;
}

/**
 * Convierte las filas { prevision, cantidad } del GROUP BY en la distribución
 * que consume el panel. Los porcentajes van con un decimal y SIEMPRE suman
 * exactamente 100 (método del mayor resto): redondear cada uno por separado
 * puede dar 99,9 o 100,1 y el panel no cuadraría con el total.
 */
export function calcularDistribucionPrevision(filas = []) {
    const grupos = new Map();
    for (const fila of filas) {
        const cantidad = Number(fila?.cantidad) || 0;
        if (cantidad <= 0) continue;
        const nombre = fila?.prevision ? String(fila.prevision) : VALOR_NO_INDICADO;
        grupos.set(nombre, (grupos.get(nombre) ?? 0) + cantidad);
    }

    const total = [...grupos.values()].reduce((acc, n) => acc + n, 0);
    if (total === 0) return { total: 0, distribucion: [] };

    const DECIMAS_TOTALES = 1000; // 100,0 % expresado en décimas
    const partes = [...grupos.entries()].map(([prevision, cantidad]) => {
        const exacto = (cantidad * DECIMAS_TOTALES) / total;
        const decimas = Math.floor(exacto);
        return { prevision, cantidad, decimas, resto: exacto - decimas };
    });

    let faltantes = DECIMAS_TOTALES - partes.reduce((acc, p) => acc + p.decimas, 0);
    const porResto = [...partes].sort(
        (a, b) => b.resto - a.resto || b.cantidad - a.cantidad || a.prevision.localeCompare(b.prevision)
    );
    for (const parte of porResto) {
        if (faltantes <= 0) break;
        parte.decimas += 1;
        faltantes -= 1;
    }

    const distribucion = partes
        .map(({ prevision, cantidad, decimas }) => ({ prevision, cantidad, porcentaje: decimas / 10 }))
        .sort((a, b) => b.cantidad - a.cantidad || a.prevision.localeCompare(b.prevision));

    return { total, distribucion };
}
