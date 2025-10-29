const { google } = require('googleapis');

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "Método no permitido" });

  const { action, fecha } = req.body;

  try {
    // 1. Configurar autenticación
    const serviceAccountKey = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    
    const auth = new google.auth.JWT(
      serviceAccountKey.client_email,
      null,
      serviceAccountKey.private_key,
      ['https://www.googleapis.com/auth/calendar.readonly'] // ← SOLO LECTURA
    );

    const calendar = google.calendar({ version: 'v3', auth });

    let result;

    // 2. Diferentes acciones de prueba
    switch (action) {
      case 'list_calendars':
        result = await listCalendars(calendar);
        break;
      
      case 'events_today':
        result = await getEventsToday(calendar);
        break;
      
      case 'events_week':
        result = await getEventsThisWeek(calendar);
        break;
      
      case 'check_date':
        result = await checkDateAvailability(calendar, fecha);
        break;
      
      default:
        result = { error: "Acción no válida" };
    }

    res.status(200).json(result);

  } catch (error) {
    console.error("❌ Error en calendar-test:", error);
    res.status(500).json({ 
      error: "Error consultando calendario",
      details: error.message 
    });
  }
}

// 🔍 FUNCIÓN: Listar calendarios disponibles
async function listCalendars(calendar) {
  const response = await calendar.calendarList.list();
  const calendars = response.data.items.map(cal => ({
    id: cal.id,
    name: cal.summary,
    description: cal.description || 'Sin descripción'
  }));
  
  return {
    action: 'list_calendars',
    calendars: calendars,
    total: calendars.length
  };
}

// 🔍 FUNCIÓN: Eventos de hoy
async function getEventsToday(calendar) {
  const now = new Date();
  const startOfDay = new Date(now.setHours(0, 0, 0, 0)).toISOString();
  const endOfDay = new Date(now.setHours(23, 59, 59, 999)).toISOString();

  const response = await calendar.events.list({
    calendarId: 'primary',
    timeMin: startOfDay,
    timeMax: endOfDay,
    singleEvents: true,
    orderBy: 'startTime'
  });

  const events = response.data.items.map(event => ({
    title: event.summary,
    start: event.start.dateTime || event.start.date,
    end: event.end.dateTime || event.end.date,
    status: event.status
  }));

  return {
    action: 'events_today',
    date: new Date().toLocaleDateString('es-ES'),
    events: events,
    total: events.length
  };
}

// 🔍 FUNCIÓN: Eventos de esta semana
async function getEventsThisWeek(calendar) {
  const now = new Date();
  const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
  startOfWeek.setHours(0, 0, 0, 0);
  
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);

  const response = await calendar.events.list({
    calendarId: 'primary',
    timeMin: startOfWeek.toISOString(),
    timeMax: endOfWeek.toISOString(),
    singleEvents: true,
    orderBy: 'startTime'
  });

  const events = response.data.items.map(event => ({
    title: event.summary,
    start: event.start.dateTime || event.start.date,
    end: event.end.dateTime || event.end.date
  }));

  return {
    action: 'events_week',
    week_start: startOfWeek.toLocaleDateString('es-ES'),
    week_end: endOfWeek.toLocaleDateString('es-ES'),
    events: events,
    total: events.length
  };
}

// 🔍 FUNCIÓN: Verificar disponibilidad en fecha específica
async function checkDateAvailability(calendar, fecha) {
  // fecha formato: "2024-11-25"
  const startOfDay = new Date(fecha + 'T00:00:00-06:00');
  const endOfDay = new Date(fecha + 'T23:59:59-06:00');

  const response = await calendar.events.list({
    calendarId: 'primary',
    timeMin: startOfDay.toISOString(),
    timeMax: endOfDay.toISOString(),
    singleEvents: true,
    orderBy: 'startTime'
  });

  const busySlots = response.data.items.map(event => ({
    title: event.summary,
    start: event.start.dateTime,
    end: event.end.dateTime
  }));

  return {
    action: 'check_date',
    date: fecha,
    busy_slots: busySlots,
    available: busySlots.length === 0
  };
}
