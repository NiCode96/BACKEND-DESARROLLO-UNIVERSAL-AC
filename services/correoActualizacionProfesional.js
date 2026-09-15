export default async function enviarCorreoProfesionalesActualizacion(
    correoProfesional,
    nombreProfesional,
    nombreDelPaciente,
    fechaAtencion,
    horaAtencion

) {

    const message = `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#F3F7FC" style="width:100%; background-color:#F3F7FC; font-family:Arial,
  Helvetica, sans-serif;">
      <tr>
          <td align="center" style="padding:24px 12px;">

              <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:560px; max-width:100%; background-color:#FFFFFF; border:1px
              solid #D9E4F2; border-radius:12px;">

                  <tr>
                      <td style="padding:22px 26px; background-color:#123F88; border-radius:12px 12px 0 0;">
                          <p style="margin:0 0 6px; color:#BFDBFE; font-size:11px; font-weight:bold; line-height:16px; letter-spacing:1px; text-transform:uppercase;">
                              Agenda Clínica
                          </p>

                          <p style="margin:0; color:#FFFFFF; font-size:21px; font-weight:bold; line-height:27px;">
                              Reserva actualizada
                          </p>
                      </td>
                  </tr>

                  <tr>
                      <td style="padding:24px 26px 22px;">
                          <p style="margin:0 0 10px; color:#0F172A; font-size:15px; line-height:22px;">
                              Hola, <strong>${nombreProfesional}</strong>.
                          </p>

                          <p style="margin:0 0 18px; color:#475569; font-size:14px; line-height:21px;">
                              Se actualizó una reserva asociada a tu agenda profesional. Revisa la información vigente de la atención.
                          </p>

                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; border:1px solid #D7E6FA; border-
                          collapse:separate; border-spacing:0; border-radius:10px; overflow:hidden; background-color:#FFFFFF;">

                              <tr>
                                  <td colspan="2" style="padding:13px 16px; background-color:#EFF6FF; border-bottom:1px solid #D7E6FA;">
                                      <p style="margin:0; color:#1D4ED8; font-size:11px; font-weight:bold; line-height:16px; letter-spacing:.8px; text-
                                      transform:uppercase;">
                                          Información actualizada
                                      </p>
                                  </td>
                              </tr>

                              <tr>
                                  <td width="118" valign="middle" style="width:118px; padding:11px 14px; background-color:#F8FBFF; border-bottom:1px solid #E2E8F0; border-
                                  right:1px solid #E2E8F0; color:#64748B; font-size:12px; font-weight:bold; line-height:18px;">
                                      Paciente
                                  </td>
                                  <td valign="middle" style="padding:11px 14px; border-bottom:1px solid #E2E8F0; color:#0F172A; font-size:13px; font-weight:bold; line-
                                  height:18px;">
                                      ${nombreDelPaciente}
                                  </td>
                              </tr>

                              <tr>
                                  <td width="118" valign="middle" style="width:118px; padding:11px 14px; background-color:#F8FBFF; border-bottom:1px solid #E2E8F0; border-
                                  right:1px solid #E2E8F0; color:#64748B; font-size:12px; font-weight:bold; line-height:18px;">
                                      Fecha
                                  </td>
                                  <td valign="middle" style="padding:11px 14px; border-bottom:1px solid #E2E8F0; color:#0F172A; font-size:13px; font-weight:bold; line-
                                  height:18px;">
                                      ${fechaAtencion}
                                  </td>
                              </tr>

                              <tr>
                                  <td width="118" valign="middle" style="width:118px; padding:11px 14px; background-color:#F8FBFF; border-right:1px solid #E2E8F0;
                                  color:#64748B; font-size:12px; font-weight:bold; line-height:18px;">
                                      Hora
                                  </td>
                                  <td valign="middle" style="padding:11px 14px; color:#0F172A; font-size:13px; font-weight:bold; line-height:18px;">
                                      ${horaAtencion}
                                  </td>
                              </tr>

                          </table>

                          <p style="margin:18px 0 0; color:#475569; font-size:13px; line-height:20px;">
                              Ingresa a Agenda Clínica para revisar los cambios y gestionar esta atención.
                          </p>
                      </td>
                  </tr>

                  <tr>
                      <td style="padding:14px 26px; border-top:1px solid #E2E8F0; background-color:#F8FAFC; border-radius:0 0 12px 12px;">
                          <p style="margin:0; color:#94A3B8; font-size:11px; line-height:17px;">
                              Correo automático de Agenda Clínica. No respondas directamente a este mensaje.
                          </p>
                      </td>
                  </tr>

              </table>
          </td>
      </tr>
  </table>
  `;

    const { BREVO_API_KEY, CORREO_REMITENTE } = process.env;

    if (!BREVO_API_KEY) {
        console.error("BREVO_API_KEY no configurada");
        return;
    }

    if (!CORREO_REMITENTE) {
        console.error("CORREO_REMITENTE no configurado");
        return;
    }

    const payload = {
        sender: {
            name: "Agenda Clínica",
            email: CORREO_REMITENTE
        },
        to: [
            {
                email: correoProfesional
            }
        ],

        subject: "NOTIFICACION",
        htmlContent: message,

        textContent: "NUEVA NOTIFICACION DE AGENDAMIENTO REALIZADO"
    };

    const respuesta = await fetch(
        "https://api.brevo.com/v3/smtp/email",
        {
            method: "POST",
            headers: {
                accept: "application/json",
                "content-type": "application/json",
                "api-key": BREVO_API_KEY
            },

            body: JSON.stringify(payload)
        }
    );

    if (!respuesta.ok) {
        const error = await respuesta.text();
        console.error("Error enviando correo:", error);
        return;
    }

    console.log("########################### CORREO DE PRUEBAS ENVIADO A ======= ", correoProfesional);
}
