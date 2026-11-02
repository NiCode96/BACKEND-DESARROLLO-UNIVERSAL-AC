import DataBase from "../config/Database.js";
import { nuevoId } from "../services/firma/identificadores.js";
import { ahoraUtc, aMysqlUtc } from "../services/firma/tiempo.js";

/* Copia local de los usuarios de Clerk (tabla usuario_plataforma). La evidencia
 * guarda quién hizo cada cosa con un id propio y con el clerk_user_id: si el
 * usuario se borra en Clerk, la evidencia sigue identificándolo. */
export default class UsuarioPlataforma {

    //CREA O ACTUALIZA EL USUARIO Y DEVUELVE SU id_usuario (UUID TEXTO)
    async asegurar({ clerkId, idProfesional, nombre, email, rol }) {
        const db = DataBase.getInstance();
        const ahora = aMysqlUtc(ahoraUtc());
        await db.ejecutarQuery(
            `INSERT INTO usuario_plataforma (id_usuario, clerk_user_id, id_profesional, nombre, email, rol, creado_at, actualizado_at)
             VALUES (UUID_TO_BIN(?), ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE id_profesional = VALUES(id_profesional), nombre = VALUES(nombre),
                email = VALUES(email), rol = VALUES(rol), actualizado_at = VALUES(actualizado_at)`,
            [nuevoId(), clerkId, idProfesional, nombre, email, rol, ahora, ahora]
        );
        const filas = await db.ejecutarQuery(
            "SELECT BIN_TO_UUID(id_usuario) AS id_usuario FROM usuario_plataforma WHERE clerk_user_id = ?",
            [clerkId]
        );
        return filas[0]?.id_usuario || null;
    }
}
