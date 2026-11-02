import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomBytes } from "node:crypto";
import "dotenv/config";

const r2 = new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY,
        secretAccessKey: process.env.R2_SECRET_KEY,
    },
});

const BUCKET = process.env.R2_BUCKET;

// Tiempo máximo de cada operación con R2. Si Cloudflare no responde, la petición
// falla con un error controlado en vez de dejar el proceso esperando.
const TIEMPO_LIMITE_R2_MS = Number(process.env.R2_TIEMPO_LIMITE_MS || 15000);
const conLimite = () => ({ abortSignal: AbortSignal.timeout(TIEMPO_LIMITE_R2_MS) });


// Genera un key unico para organizar archivos por paciente
// Ejemplo: pacientes/42/1749500000-radiografia.jpg
function construirKey(id_paciente, nombreOriginal) {
    const timestamp = Date.now();
    const nombreLimpio = nombreOriginal.replace(/[^a-zA-Z0-9._-]/g, "_");
    return `pacientes/${id_paciente}/${timestamp}-${nombreLimpio}`;
}


// Sube el buffer del archivo al bucket R2
async function subirArchivo(buffer, key, contentType) {
    const comando = new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: buffer,
        ContentType: contentType,
    });
    await r2.send(comando, conLimite());
}


// Elimina un archivo del bucket R2 usando su key
async function eliminarArchivoR2(key) {
    const comando = new DeleteObjectCommand({
        Bucket: BUCKET,
        Key: key,
    });
    await r2.send(comando, conLimite());
}


// Genera una URL temporal firmada para descargar/visualizar el archivo
// expiresIn en segundos (por defecto 1 hora)
// opciones (FIRMA): { nombre, tipo } → la descarga abre "inline" con ese nombre
// y sin caché. Las llamadas existentes con dos parámetros siguen igual.
async function generarUrlDescarga(key, expiresIn = 3600, opciones = {}) {
    const comando = new GetObjectCommand({
        Bucket: BUCKET,
        Key: key,
        ...(opciones.nombre ? { ResponseContentDisposition: `inline; filename="${opciones.nombre}"` } : {}),
        ...(opciones.tipo ? { ResponseContentType: opciones.tipo } : {}),
        ...(opciones.nombre || opciones.tipo ? { ResponseCacheControl: "no-store" } : {}),
    });
    return getSignedUrl(r2, comando, { expiresIn });
}


// ── FIRMA ELECTRÓNICA ──────────────────────────────────────────────────────

// Clave privada no adivinable: privado/<carpeta>/<año>/<32 hex>.<ext>
// Nunca lleva RUT, nombre ni id del paciente (si una clave se filtra, no revela nada).
function construirKeyPrivada(carpeta, extension) {
    const anio = new Date().getUTCFullYear();
    return `privado/${carpeta}/${anio}/${randomBytes(16).toString("hex")}.${extension}`;
}

// Lee un archivo de R2 completo como Buffer (para estampar, verificar huellas o adjuntar).
async function descargarArchivoComoBuffer(key) {
    const respuesta = await r2.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }), conLimite());
    return Buffer.from(await respuesta.Body.transformToByteArray());
}

// Lista claves bajo un prefijo (lo usa el script de limpieza de huérfanos).
async function listarClaves(prefijo, continuacion) {
    const respuesta = await r2.send(new ListObjectsV2Command({
        Bucket: BUCKET, Prefix: prefijo, ContinuationToken: continuacion,
    }), conLimite());
    return {
        claves: (respuesta.Contents || []).map((o) => ({ key: o.Key, modificado: o.LastModified })),
        siguiente: respuesta.IsTruncated ? respuesta.NextContinuationToken : null,
    };
}


export {
    construirKey, subirArchivo, eliminarArchivoR2, generarUrlDescarga,
    construirKeyPrivada, descargarArchivoComoBuffer, listarClaves,
};
