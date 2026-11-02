/* Instantes de la firma electrónica.
 *
 * Regla: la hora de una firma o una aceptación la fija SIEMPRE el reloj del
 * servidor (sincronizado por NTP), nunca la del navegador. En MySQL se guarda en
 * UTC como DATETIME(3); hacia el front se entrega como ISO 8601 UTC. */

export const ahoraUtc = () => new Date();

/** Date → '2026-10-23 01:25:57.123' (UTC) para columnas DATETIME(3). */
export const aMysqlUtc = (fecha) => fecha.toISOString().replace("T", " ").replace("Z", "");

/**
 * Columna DATETIME(3) leída por mysql2 → ISO UTC.
 * mysql2 devuelve DATETIME como Date interpretado en la zona del proceso; por eso
 * las consultas de este módulo leen con DATE_FORMAT(col, '%Y-%m-%dT%H:%i:%s.%fZ')
 * y aquí solo se recorta a milisegundos.
 */
export function isoDesdeMysql(valor) {
    if (!valor) return null;
    const texto = String(valor);
    // '2026-10-23T01:25:57.123000Z' → '2026-10-23T01:25:57.123Z'
    return texto.replace(/(\.\d{3})\d*Z$/, "$1Z");
}

/** Para SELECT: expresión SQL que devuelve la columna como ISO UTC. */
export const sqlIso = (columna, alias = columna) => `DATE_FORMAT(${columna}, '%Y-%m-%dT%H:%i:%s.%fZ') AS ${alias}`;

/**
 * Date → "22-10-2026 22:25:57 (UTC-03:00)" en America/Santiago. No depende de la
 * zona horaria del proceso (TZ): calcula el desfase real de esa fecha, así que
 * respeta el horario de verano (UTC−3) y de invierno (UTC−4).
 */
export function formatearSantiagoConOffset(fecha) {
    const zona = "America/Santiago";
    const partes = Object.fromEntries(
        new Intl.DateTimeFormat("es-CL", {
            timeZone: zona, day: "2-digit", month: "2-digit", year: "numeric",
            hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
        }).formatToParts(fecha).map((p) => [p.type, p.value])
    );
    const desfase = new Intl.DateTimeFormat("en-US", { timeZone: zona, timeZoneName: "longOffset" })
        .formatToParts(fecha).find((p) => p.type === "timeZoneName").value.replace("GMT", "UTC");
    return `${partes.day}-${partes.month}-${partes.year} ${partes.hour}:${partes.minute}:${partes.second} (${desfase === "UTC" ? "UTC+00:00" : desfase})`;
}
