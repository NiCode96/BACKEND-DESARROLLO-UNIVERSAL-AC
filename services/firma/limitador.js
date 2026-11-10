/* Cuántas operaciones pesadas (estampar un PDF, normalizar una firma, adjuntar
 * un PDF a un correo) se ejecutan a la vez en este proceso (docs/firma/03 §9.2).
 *
 * Con 2 a la vez y hasta 10 en espera, una ráfaga de firmas se atiende en orden
 * y el resto de la aplicación (agenda, fichas) sigue respondiendo. La que llega
 * con la cola llena recibe 503 "servicioOcupado" y el front pide reintentar. */

const MAXIMO = Number(process.env.FIRMA_CONCURRENCIA || 2);
const COLA_MAXIMA = 10;
let activos = 0;
const cola = [];

export async function limitarEstampado(tarea) {
    if (activos >= MAXIMO) {
        if (cola.length >= COLA_MAXIMA) {
            const error = new Error("servicioOcupado");
            error.status = 503;
            error.codigo = "servicioOcupado";
            throw error;
        }
        await new Promise((resolver) => cola.push(resolver));
    }
    activos++;
    try {
        return await tarea();
    } finally {
        activos--;
        cola.shift()?.();
    }
}

/** Solo para pruebas. */
export const estadoLimitador = () => ({ activos, enCola: cola.length });
