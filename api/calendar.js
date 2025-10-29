import { google } from 'googleapis';

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "Método no permitido" });

  const { action, fecha, hora, descripcion } = req.body;

  try {
    // Configurar autenticación
    const serviceAccountKey = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    
    const auth = new google.auth.JWT(
      serviceAccountKey.client_email,
      null,
      serviceAccountKey.private_key,
      ['https://www.googleapis.com/auth/calendar']
    );

    const calendar = google.calendar({ version: 'v3', auth });

    // Crear evento
    const event = {
      summary: 'Cita con cliente - DisTiplas',
      description: `Consulta: ${descripcion || 'Interesado en productos DisTiplas'}`,
      start: {
        dateTime: `${fecha}T${hora}:00`,
        timeZone: 'America/Mexico_City',
      },
      end: {
        dateTime: `${fecha}T${parseInt(hora.split(':')[0]) + 1}:${hora.split(':')[1]}:00`,
        timeZone: 'America/Mexico_City',
      },
    };

    const response = await calendar.events.insert({
      calendarId: 'primary',
      resource: event,
    });

    res.status(200).json({ 
      success: true, 
      message: '✅ Cita agendada correctamente',
      eventLink: response.data.htmlLink
    });

  } catch (error) {
    console.error("❌ Error agendando cita:", error);
    res.status(500).json({ 
      success: false,
      error: "Error agendando la cita. Por favor, intenta de nuevo."
    });
  }
}
