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
          content: "Eres el asistente de GreenView, una empresa que vende suelos de madera, laminados y vinílicos. Ofreces ayuda con catálogos y fichas técnicas.",
        },
        { role: "user", content: message },
      ],
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("Error de OpenAI:", data);
    throw new Error(data.error?.message || "Error al contactar con OpenAI");
  }

  return data.choices[0].message.content;
}
