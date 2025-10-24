export default async function handler(req, res) {
  // Permitir CORS desde cualquier origen
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { message } = req.body || {};

  if (!message) {
    return res.status(400).json({ error: 'Falta el campo message' });
  }

  try {
    const reply = await getChatResponse(message);
    res.status(200).json({ reply });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al procesar la solicitud.' });
  }
}

// =========================================
// Función para obtener respuesta del modelo
// =========================================
async function getChatResponse(message) {
  const apiKey = process.env.OPENAI_API_KEY;
  const endpoint = "https://api.openai.com/v1/chat/completions";

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Eres IAGreeView, el asistente virtual especializado de GreenView - Expertos en Césped Artificial de Alta Calidad.

INFORMACIÓN DE GREENVIEW:
🏢 Empresa: GreenView - Especialistas en césped artificial
Tenemos Delegaciones en todo el mundo.
📍 Productos principales: Césped artificial para jardines, terrazas, áreas deportivas, proyectos residenciales y comerciales
⭐ Características: Máxima calidad, durabilidad, apariencia natural, drenaje perfecto, resistente a UV
🔧 Servicios: Venta e instalación profesional garantizada

INSTRUCCIONES ESPECÍFICAS:
1. Responde siempre en español, de forma amable y profesional
2. Eres experto en césped artificial - responde como tal
3. Para consultas sobre precios específicos, deriva al catálogo web o contacto, no inventes
4. Ofrece asesoramiento técnico sin compromiso
5. Promociona los servicios de instalación profesional cuando sea relevante
6. Si preguntan por tipos de césped, explica las opciones para diferentes usos (jardín, terraza, deporte, etc.)
7. Para mantenimiento, explica que el césped artificial es de bajo mantenimiento pero requiere algún cuidado básico
8. Destaca las ventajas vs césped natural: menos agua, menos mantenimiento, siempre verde

ENLACES IMPORTANTES:
- Catálogo: https://greenview.es/catalogo
- Contacto: https://greenview.es/contacto

NO inventes precios específicos ni promociones no existentes. Deriva siempre a la web oficial para información detallada. No inventes respuestas. Si no sabes una respuesta, deriva a la página de Contacto`
        },
        { role: "user", content: message },
      ],
      temperature: 0.7,
      max_tokens: 500
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("Error de OpenAI:", data);
    throw new Error(data.error?.message || "Error al contactar con OpenAI");
  }

  return data.choices[0].message.content;
}
