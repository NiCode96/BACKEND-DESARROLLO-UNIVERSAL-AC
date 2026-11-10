/* Reverificación reciente de Clerk antes de una acción con valor legal (firmar,
 * registrar la firma, anular). Ley 19.799: hay que poder demostrar que quien
 * firmó era el titular de la cuenta EN ESE MOMENTO, no solo que había una sesión
 * abierta en el computador.
 *
 * Lee el claim `fva` del token de sesión de Clerk: [minutos desde el primer
 * factor, minutos desde el segundo factor] (-1 si nunca). Si ninguno está dentro
 * de la ventana, responde EXACTAMENTE la señal que reconoce useReverification de
 * @clerk/nextjs: el front muestra la ventana de contraseña/código y reintenta.
 *
 * Usar siempre DESPUÉS de exigirUsuarioClerk. */

export const exigirReverificacion = ({ minutos = Number(process.env.FIRMA_REVERIFICACION_MIN || 10) } = {}) =>
    (req, res, next) => {
        const [primer, segundo] = req.usuario?.fva || [-1, -1];
        const ok1 = primer >= 0 && primer <= minutos;
        const ok2 = segundo >= 0 && segundo <= minutos;
        if (!ok1 && !ok2) {
            return res.status(403).json({
                message: "reverificacionRequerida",
                clerk_error: {
                    type: "forbidden",
                    reason: "reverification-error",
                    metadata: { reverification: { level: "first_factor", afterMinutes: minutos } },
                },
            });
        }
        const edad = ok2 ? segundo : primer;
        req.reverificacion = {
            metodo: ok2 ? "clerk_reverificacion_segundo_factor" : "clerk_reverificacion_primer_factor",
            // Clerk informa la edad en minutos: el instante es aproximado al minuto.
            autenticadoAt: new Date(Date.now() - edad * 60_000),
            edadMinutos: edad,
        };
        return next();
    };
