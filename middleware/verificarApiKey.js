/**
 * Valida la API key de las llamadas máquina-a-máquina (NativeCode Finance).
 *
 * Acepta Authorization: Bearer <key>, que es lo que Finance ya envía y está
 * en producción. También acepta x-api-key, que es el formato que usan los dos
 * endpoints que ya existen en app.js.
 *
 * Falla cerrado: sin variable configurada no atiende a nadie. Es a propósito —
 * un backend sin la key puesta NO debe quedar abierto.
 */
export const verificarApiKey = (req, res, next) => {
    const claveEsperada = process.env.HEALTH_METRICS_API_KEY;
    if (!claveEsperada) {
        return res.status(503).json({ message: "apiKeyNoConfigurada" });
    }

    const cabecera = req.headers.authorization || '';
    const claveBearer = cabecera.startsWith('Bearer ') ? cabecera.slice(7).trim() : null;
    const claveRecibida = claveBearer || req.headers['x-api-key'];

    if (!claveRecibida || claveRecibida !== claveEsperada) {
        return res.status(401).json({ message: "noAutorizado" });
    }
    next();
};
