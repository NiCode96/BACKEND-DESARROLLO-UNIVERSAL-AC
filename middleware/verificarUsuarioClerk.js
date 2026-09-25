import { verifyToken } from "@clerk/backend";

/**
 * Valida el token de sesión de Clerk que manda el front.
 *
 * No monta sesiones ni middleware global: solo verifica la firma del token
 * contra la instancia de Clerk de ESTE cliente y deja los datos del usuario
 * en req.usuario. Si el token no sirve, deja req.usuario en null y deja pasar
 * igual — este middleware protege la CALIDAD del registro de accesos, no el
 * acceso a la ruta. Un latido sin identidad sigue sirviendo como señal de
 * actividad; simplemente no se puede atribuir a nadie.
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

        req.usuario = {
            clerkId: datos.sub,
            email: datos.email || null,
            nombre: datos.name || null,
            rol: datos.metadata?.role || datos.publicMetadata?.role || null,
            idProfesional: datos.publicMetadata?.idProfesionalAgenda || null,
        };
    } catch (error) {
        // Token vencido o inválido: no es un error de la app, se ignora.
        console.error('[CLERK] token no verificado:', error.message);
    }
    next();
};
