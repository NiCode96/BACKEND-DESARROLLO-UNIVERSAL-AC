/* Respaldo diario de la base de ESTA instancia (la de DB_DATABASE en el .env).
 *
 *   node scripts/respaldo_bd.mjs           → local + copia en R2
 *   node scripts/respaldo_bd.mjs --sin-r2  → solo local (pruebas)
 *
 * 1. mysqldump --single-transaction: copia consistente sin bloquear la agenda.
 *    Incluye los triggers que hacen inmutable la evidencia de la firma.
 * 2. Lo deja comprimido en RESPALDO_DIR (por omisión ~/respaldos/diario) con
 *    permisos 600: lleva datos de pacientes.
 * 3. Sube el mismo archivo a R2 en privado/respaldos-bd/<base>/ (clave con sufijo
 *    aleatorio, como el resto de lo privado). Si el disco del servidor se pierde,
 *    queda esta copia.
 * 4. Solo si todo lo anterior salió bien, borra los respaldos (locales y de R2)
 *    con más de RESPALDO_DIAS días (30 por omisión). Si el respaldo falla, no se
 *    borra ninguno viejo.
 *
 * La contraseña va en un archivo temporal 600 (--defaults-extra-file), nunca en la
 * línea de comandos: `ps` la mostraría a cualquier usuario del servidor.
 * Sale con código 1 ante cualquier falla (el cron avisa con avisar_falla.mjs).
 *
 * Restaurar:  gunzip -c <archivo>.sql.gz | mysql -u <usuario> -p <base> */

import "dotenv/config";
import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { chmod, mkdir, mkdtemp, readdir, readFile, rename, rm, stat, unlink, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";
import { randomBytes } from "node:crypto";

const sinR2 = process.argv.includes("--sin-r2");
const DIAS = Number(process.env.RESPALDO_DIAS || 30);
const DIRECTORIO = process.env.RESPALDO_DIR || path.join(homedir(), "respaldos", "diario");
const BASE = process.env.DB_DATABASE;
const PREFIJO_R2 = `privado/respaldos-bd/${String(BASE).replace(/[^a-zA-Z0-9_-]/g, "_")}/`;
const UN_DIA_MS = 24 * 60 * 60 * 1000;

// Valor de un archivo de opciones de MySQL entre comillas (escapa \ y ").
const comillas = (valor) => `"${String(valor ?? "").replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

// "20261114-0400" en hora de Chile: el nombre se lee igual que la hora del reloj.
function marcaDeTiempo() {
    const texto = new Intl.DateTimeFormat("sv-SE", {
        timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).format(new Date()); // "2026-11-14 04:00"
    return texto.replace(/-/g, "").replace(" ", "-").replace(":", "");
}

async function volcar(destino) {
    const carpetaTemporal = await mkdtemp(path.join(tmpdir(), "respaldo-"));
    const opciones = path.join(carpetaTemporal, "my.cnf");
    try {
        await writeFile(opciones, [
            "[client]",
            `host=${comillas(process.env.DB_HOST || "localhost")}`,
            `port=${Number(process.env.DB_PORT || 3306)}`,
            `user=${comillas(process.env.DB_USER)}`,
            `password=${comillas(process.env.DB_PASS)}`,
            "",
        ].join("\n"), { mode: 0o600 });

        const mysqldump = spawn("mysqldump", [
            `--defaults-extra-file=${opciones}`,
            "--single-transaction", "--quick", "--triggers", "--no-tablespaces", "--set-gtid-purged=OFF",
            "--default-character-set=utf8mb4",
            BASE,
        ], { stdio: ["ignore", "pipe", "pipe"] });

        let errores = "";
        mysqldump.stderr.on("data", (d) => { errores += d; });
        const termino = new Promise((resolve, reject) => {
            mysqldump.on("error", reject); // p. ej. mysqldump no instalado
            mysqldump.on("close", resolve);
        });

        // mysqldump escribe "-- Dump completed" al final solo si terminó entero.
        let cola = "";
        const vigilarCola = new Transform({
            transform(trozo, _codificacion, listo) {
                cola = (cola + trozo.toString("utf8")).slice(-200);
                listo(null, trozo);
            },
        });

        await pipeline(mysqldump.stdout, vigilarCola, createGzip({ level: 9 }), createWriteStream(destino, { mode: 0o600 }));
        const codigo = await termino;
        if (errores.trim()) console.error(errores.trim());
        if (codigo !== 0) throw new Error(`mysqldump terminó con código ${codigo}`);
        if (!cola.includes("-- Dump completed")) throw new Error("el volcado quedó incompleto");
    } finally {
        await rm(carpetaTemporal, { recursive: true, force: true });
    }
}

async function borrarLocalesViejos(limite) {
    let borrados = 0;
    for (const nombre of await readdir(DIRECTORIO)) {
        if (!nombre.startsWith(`${BASE}-`) || !nombre.endsWith(".sql.gz")) continue;
        const ruta = path.join(DIRECTORIO, nombre);
        if ((await stat(ruta)).mtimeMs < limite) {
            await unlink(ruta);
            borrados++;
        }
    }
    return borrados;
}

async function borrarR2Viejos(limite, { listarClaves, eliminarArchivoR2 }) {
    let borrados = 0;
    let continuacion;
    do {
        const { claves, siguiente } = await listarClaves(PREFIJO_R2, continuacion);
        for (const { key, modificado } of claves) {
            if (new Date(modificado).getTime() < limite) {
                await eliminarArchivoR2(key);
                borrados++;
            }
        }
        continuacion = siguiente;
    } while (continuacion);
    return borrados;
}

try {
    if (!BASE || !process.env.DB_USER) throw new Error("faltan DB_DATABASE o DB_USER en el .env");
    if (!(DIAS >= 1)) throw new Error("RESPALDO_DIAS debe ser un número mayor o igual a 1");

    await mkdir(DIRECTORIO, { recursive: true, mode: 0o700 });
    await chmod(DIRECTORIO, 0o700);

    const nombre = `${BASE}-${marcaDeTiempo()}.sql.gz`;
    const final = path.join(DIRECTORIO, nombre);
    const parcial = `${final}.parcial`;
    try {
        await volcar(parcial);
        await rename(parcial, final); // un .sql.gz siempre es un respaldo completo
    } catch (error) {
        await rm(parcial, { force: true });
        throw error;
    }
    const bytes = (await stat(final)).size;
    console.log(`${new Date().toISOString()} respaldo local: ${final} (${Math.round(bytes / 1024)} KB)`);

    const limite = Date.now() - DIAS * UN_DIA_MS;
    if (!sinR2) {
        // Import diferido: con --sin-r2 el script no necesita las credenciales de R2.
        const r2 = await import("../services/r2Storage.js");
        const clave = `${PREFIJO_R2}${nombre.replace(/\.sql\.gz$/, "")}-${randomBytes(8).toString("hex")}.sql.gz`;
        await r2.subirArchivo(await readFile(final), clave, "application/gzip");
        console.log(`${new Date().toISOString()} copia en R2: ${clave}`);
        const viejosR2 = await borrarR2Viejos(limite, r2);
        if (viejosR2) console.log(`R2: ${viejosR2} respaldo(s) de más de ${DIAS} días borrados.`);
    }
    const viejos = await borrarLocalesViejos(limite);
    if (viejos) console.log(`Local: ${viejos} respaldo(s) de más de ${DIAS} días borrados.`);
} catch (error) {
    console.error(`${new Date().toISOString()} respaldo falló:`, error.message);
    process.exitCode = 1;
}
process.exit(process.exitCode ?? 0);
