import { verifyToken } from "@clerk/backend";

export const exigirSesionClerk = async (req, res, next) => {
    try {
        const cabecera = req.headers.authorization || '';
        const token = cabecera.startsWith('Bearer ') ? cabecera.slice(7).trim() : null;

        if (!token) {
            return res.status(401).json({ message: "USUARIO-SIN-AUTENTICACION" });
        }

        // Se conserva la sesión verificada para que los controladores puedan
        // registrar en la bitácora quién hizo cada cambio (req.sesionClerk.sub).
        req.sesionClerk = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY });

        return next();
    } catch (error) {
        return res.status(401).json({ message: "USUARIO-SIN-AUTENTICACION" });
    }
};