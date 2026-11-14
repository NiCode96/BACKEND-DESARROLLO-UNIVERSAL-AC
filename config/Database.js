import 'dotenv/config';
import mysql from 'mysql2/promise';

class DataBase {
    constructor() {
        // Configuración de la conexión a la base de datos
        // Pool de conexiones para soportar concurrencia
        this.pool = mysql.createPool({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASS,
            database: process.env.DB_DATABASE,
            port: Number(process.env.DB_PORT || 3306), // ahora se incluye el puerto
            waitForConnections: true,
            connectionLimit: Number(process.env.DB_POOL_LIMIT || 5),
            queueLimit: 0
        });
    }

    async cerrarConexion() {
        try {
            await this.pool.end();
            console.log('Pool de conexiones MySQL cerrado correctamente.\n');
        } catch (error) {
            console.error('Error al cerrar el pool de conexiones MySQL:', error);
        }
    }

    // Método para ejecutar consultas SQL
    async ejecutarQuery(query, params) {
        const [rows] = await this.pool.query(query, params);
        return rows;
    }

    async obtenerConexion() {
        return this.pool.getConnection();
    }

    static getInstance() {
        if (!this.instance) {
            this.instance = new DataBase();
        }
        return this.instance;
    }
}

export default DataBase;

// Cierre ordenado del pool cuando el proceso termina
if (!global.__db_shutdown_hook) {
    global.__db_shutdown_hook = true;
    const closePool = () => {
        try {
            const db = DataBase.instance;
            if (db && db.pool) {
                db.cerrarConexion();
            }
        } catch (_) { /* noop */ }
    };
    // SIGINT/SIGTERM no se atienden aquí: app.js espera a que terminen las peticiones
    // en curso antes de cerrar el pool. Un process.exit inmediato en este punto cortaría
    // a la mitad una firma durante un reinicio de pm2.
    process.on('beforeExit', () => { closePool(); });
}
