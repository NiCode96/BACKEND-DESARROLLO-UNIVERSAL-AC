import FichaClinica from "../model/FichaClinica.js";
import { esAdministrador, esProfesional } from "../services/firma/roles.js";
import { fichasVisibles, profesionalDeUsuario, etiquetaAutor } from "../services/autorFicha.js";

/* Reserva de la ficha clínica (Ley 20.584): un profesional ve solo las fichas que
 * escribió; la administración ve todas; el resto, ninguna (services/autorFicha.js).
 * La ficha no se modifica después de creada y solo la administración la da de baja. */

export default class FichaClinicaController {

    constructor() {
    }

    // 1. FUNCION CONTROLLER PARA SELECCIONAR TODAS LAS FICHAS CLINICAS
    static async seleccionarTodasFichas(req, res) {
        try {
            if (!esAdministrador(req.usuario)) return res.status(403).json({ message: "sinPermiso" });
            const fichaClinicaModel = new FichaClinica();
            const dataFichas = await fichaClinicaModel.selectFicha();
            if (dataFichas) {
                return res.status(200).json(dataFichas);
            }
        } catch (error) {
            return res.status(500).json({message: "sindato",});
        }
    }


    // 2. FUNCION CONTROLLER PARA SELECCIONAR LAS FICHAS CLINICAS ESPECIFICAS POR PACIENTE
    static async seleccionarFichasPaciente(req, res) {
        try {
            const {id_paciente} = req.body;


            if (!id_paciente) {
                return res.status(400).json({message: "sindato"});
            }

            const fichaclinicamodel = new FichaClinica();
            const dataFichaClinica = await fichaclinicamodel.selectFichasPaciente(id_paciente);
            if (dataFichaClinica) {
                return res.status(200).json(await fichasVisibles(req.usuario, dataFichaClinica));
            } else {
                return res.status(404).json({message: "sindato",});
            }
        } catch (error) {
            return res.status(500).json({message: "No se ha podido realizar la consulta desde FichaClinicaController / Contacte al equipo de soporte",});
        }
    }

    //3. FUNCION CONTROLLER PARA EDITAR LOS DATOS DE LOS PACIENTES
    static async editarFichaPaciente(req, res) {
        // La ficha clínica no se modifica después de creada (decisión del centro, Ley 20.584):
        // una corrección se registra como una ficha nueva. Lo que sigue queda sin uso.
        return res.status(409).json({ message: "fichaInmodificable" });
        // eslint-disable-next-line no-unreachable
        try {
            const {
                tipoAtencion,
                motivoConsulta,
                signosVitales,
                observaciones,
                anotacionConsulta,
                anamnesis,
                diagnostico,
                indicaciones,
                archivosAdjuntos,
                fechaConsulta,
                consentimientoFirmado,
                id_plantilla,
                datosDinamicos,
                id_ficha
            } = req.body;


            const datosdinamicos_json_stringfy = datosDinamicos ? JSON.stringify(datosDinamicos) : null;

            if (!id_ficha) {
                return res.status(400).json({message: "sindato"});
            }

            const fichaclinicamodel = new FichaClinica();
            const resultadoQuery = await fichaclinicamodel.updateFichaEspecifica(
                tipoAtencion,
                motivoConsulta,
                signosVitales,
                observaciones,
                anotacionConsulta,
                anamnesis,
                diagnostico,
                indicaciones,
                archivosAdjuntos,
                fechaConsulta,
                consentimientoFirmado,
                id_plantilla,
                datosdinamicos_json_stringfy,
                id_ficha);

            if (resultadoQuery.affectedRows > 0) {
                return res.status(200).json({message: true});
            } else {
                return res.status(404).json({message: false});
            }
        } catch (error) {
            return res.status(500).json({message: "No se ha podido realizar la consulta desde FichaClinicaController / Contacte al equipo de soporte",});
        }
    }


    //4. FUNCION PARA INSERTAR UNA NUEVA FICHA CLINICA EN UN PACIENTE ESPECIFICO (USANDO EL ID PACIENTE)
    static async insertarNuevaFichaPaciente(req, res) {
        try {

            const {
                id_paciente,
                tipoAtencion,
                motivoConsulta,
                signosVitales,
                observaciones,
                anotacionConsulta,
                anamnesis,
                diagnostico,
                indicaciones,
                archivosAdjuntos,
                fechaConsulta,
                consentimientoFirmado,
                id_plantilla,
                datosDinamicos
            } = req.body;

            const datosDinamicos_json_stringfy = datosDinamicos ? JSON.stringify(datosDinamicos) : null;

            if (!id_paciente) {
                return res.status(400).json({message: "sindato"});
            }

            // El autor lo fija el servidor: un profesional solo crea fichas a su nombre (con su
            // RUT); la administración puede registrar la de otro profesional.
            let autor = observaciones;
            if (!esAdministrador(req.usuario)) {
                if (!esProfesional(req.usuario)) return res.status(403).json({ message: "sinPermiso" });
                const propio = await profesionalDeUsuario(req.usuario);
                if (!propio) return res.status(403).json({ message: "sinAgenda" });
                autor = etiquetaAutor(propio);
            }
            if (!String(autor ?? "").trim()) return res.status(400).json({ message: "sindato" });

            const fichaclinicamodel = new FichaClinica();
            const resultadoQuery = await fichaclinicamodel.insertarFichaNueva(
                id_paciente,
                tipoAtencion,
                motivoConsulta,
                signosVitales,
                autor,
                anotacionConsulta,
                anamnesis,
                diagnostico,
                indicaciones,
                archivosAdjuntos,
                fechaConsulta,
                consentimientoFirmado,
                id_plantilla,
                datosDinamicos_json_stringfy

            );

            if (resultadoQuery.affectedRows > 0) {
                return res.status(200).json({message: true});
            } else {
                return res.status(404).json({message: false});
            }

        } catch (error) {
            return res.status(500).json({
                message:
                    "No se ha podido realizar la consulta desde FichaClinicaController / Contacte al equipo de soporte",
            });
        }
    }

    //5. FUNCION CONTROLLER PARA ELIMINAR FICHA CLINICA DE MANERA LOGICA DEJANDOLA EN ESTADO CERO USANDO ID DE PACIENTE E ID DE LA FICHA
    static async eliminarFicha(req, res) {
        try {
            const {id_ficha} = req.body;

            if (!id_ficha) {
                return res.status(400).json({message: "sindato"});
            }
            // La ficha se conserva (Ley 20.584): darla de baja es solo de la administración.
            if (!esAdministrador(req.usuario)) return res.status(403).json({ message: "sinPermiso" });

            const fichaClinicaModel = new FichaClinica();
            const resultadoQuery = await fichaClinicaModel.deleteFichaEspecifica(id_ficha);

            if (resultadoQuery.affectedRows > 0) {
                return res.status(200).json({message: true});
            } else {
                return res.status(404).json({message: false});
            }
        } catch (error) {
            return res.status(500).json({
                message:
                    "No se ha podido realizar la consulta desde FichaClinicaController / Contacte al equipo de soporte",
            });
        }
    }

    //6. SELECCIONAR LAS FICHAS CLINICAS POR ID DE LA FICHA Y POR EL ID DEL PACIENTE
    static async seleccionarFichaPacientePorIDdeFicha(req, res) {
        try {
            const {id_paciente, id_ficha} = req.body;
            if (!id_paciente || !id_ficha) {
                return res.status(400).json({message: "sindato"});
            }
            const fichaClinicaModel = new FichaClinica();
            const dataFichaClinca = await fichaClinicaModel.selectFichasPacientePorId(id_paciente, id_ficha);
            if (dataFichaClinca) {
                const visibles = await fichasVisibles(req.usuario, dataFichaClinca);
                if (dataFichaClinca.length && !visibles.length) return res.status(403).json({ message: "sinPermiso" });
                return res.status(200).json(visibles);
            } else {
                return res.status(404).json({message: "sindato"});
            }
        } catch (error) {
            return res.status(500).json({
                message: "no ha sido posible realizar la query desde FichaClinicaController"
            })
        }
    }

    //7. SELECCIONAR LAS FICHAS CLINICAS POR ID DE LA FICHA
    static async seleccionarFichaID(req, res) {
        try {

            const {id_ficha} = req.body;

            if (!id_ficha) {
                return res.status(400).json({message: "sindato"});
            }

            const fichaClinicaModel = new FichaClinica();
            const dataFichaClinca = await fichaClinicaModel.seleccionarPorIdFicha(id_ficha);
            if (dataFichaClinca) {
                const visibles = await fichasVisibles(req.usuario, dataFichaClinca);
                if (dataFichaClinca.length && !visibles.length) return res.status(403).json({ message: "sinPermiso" });
                return res.status(200).json(visibles);
            } else {
                return res.status(404).json({message: "sindato"});
            }
        } catch (error) {
            return res.status(500).json({
                message: "no ha sido posible realizar la query desde FichaClinicaController"
            })
        }
    }







    //8. SELECCIONAR LAS FICHAS CLINICAS POR similitud de nombre con profesional
    static async seleccionar_similitud_nombre_profesional(req, res) {
        try {

            const {observaciones} = req.body;

            if (!observaciones) {
                return res.status(400).json({message: "sindato"});
            }

            const fichaClinicaModel = new FichaClinica();
            const dataFichaClinca = await fichasVisibles(req.usuario,
                await fichaClinicaModel.seleccionar_similitud_nombre_profesional(observaciones));
            if (Array.isArray(dataFichaClinca)&&dataFichaClinca.length>0) {
                return res.status(200).json(dataFichaClinca);
            } else {
                return res.status(404).json([]);
            }
        } catch (error) {
            return res.status(500).json({
                message: "no ha sido posible realizar la query desde FichaClinicaController"
            })
        }
    }
}
