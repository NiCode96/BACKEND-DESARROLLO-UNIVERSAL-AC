import { verifyToken, createClerkClient } from "@clerk/backend";

// Cliente de Clerk para consultar los datos del usuario. Se crea una sola vez
// (no por request) y solo si hay secret key configurada.
let clerk = null;
function obtenerClerk() {
    if (!clerk && process.env.CLERK_SECRET_KEY) {
        clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
    }
    return clerk;
}

/**
 * Valida el token de sesión de Clerk que manda el front y deja los datos del
 * usuario en req.usuario.
 *
 * Por qué se consulta a Clerk y no basta con el token: el token de sesión por
 * defecto de Clerk trae solo identificadores (sub, sid, iss, exp...). NO trae
 * correo, nombre ni publicMetadata. Se podría agregar con una plantilla de
 * sesión personalizada, pero eso obligaría a configurar a mano la instancia de
 * Clerk de cada uno de los ~50 clientes. Consultando el usuario por su id, el
 * mismo código funciona en todas las instancias sin configuración extra.
 *
 * El costo es una llamada a la API de Clerk por acceso registrado, y como el
 * controlador limita a un registro por usuario por hora, es despreciable.
 *
 * Si algo falla —token vencido, Clerk caído, sin secret key— req.usuario queda
 * con lo que se haya podido obtener (o null) y la petición sigue. Este
 * middleware cuida la CALIDAD del registro, no el acceso a la ruta: un acceso
 * sin identidad sigue sirviendo como señal de actividad.
 */
export const verificarUsuarioClerk = async (req, res, next) => {
    req.usuario = null;
    try {
        // req.headers (plural) es el objeto; req.header es una función de
        // Express. Con el singular esto sería siempre undefined y el token
        // nunca se leería, sin dar ningún error visible.
        const cabecera = req.headers.authorization || '';

        // El espacio en 'Bearer ' importa: sin él, una cabecera pegada como
        // "Bearerabc..." también entraría y el slice(7) cortaría mal.
        const token = cabecera.startsWith('Bearer ') ? cabecera.slice(7).trim() : null;

        if (!token || !process.env.CLERK_SECRET_KEY) return next();

        const datos = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY });

        // Con el id verificado ya se puede registrar el acceso, aunque la
        // consulta de abajo falle.
        req.usuario = { clerkId: datos.sub, email: null, nombre: null, rol: null, idProfesional: null };

        const cliente = obtenerClerk();
        if (!cliente) return next();

        const u = await cliente.users.getUser(datos.sub);
        const nombre = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();

        req.usuario = {
            clerkId: datos.sub,
            email: u.primaryEmailAddress?.emailAddress || u.emailAddresses?.[0]?.emailAddress || null,
            nombre: nombre || u.username || null,
            rol: u.publicMetadata?.role || null,
            idProfesional: u.publicMetadata?.idProfesionalAgenda || null,
        };
    } catch (error) {
        // Token vencido, inválido o Clerk no disponible: no es un error de la
        // app. Se registra y se sigue con lo que haya.
        console.error('[CLERK] no se pudo resolver el usuario:', error.message);
    }
    next();
};
