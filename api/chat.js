export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const { message } = req.body || {};
  if (!message) return res.status(400).json({ error: 'Falta el campo message' });

  try {
    // 🔧 Usa tu ID real de Assistant
    const response = await fetch('https://api.openai.com/v1/threads/runs', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        assistant_id: 'asst_dHW5ZEgp59eKaKtjLPaUlvPv', // 👈 cambia solo esto
        thread: {
          messages: [{ role: 'user', content: message }],
        },
      }),
    });

    const data = await response.json();

    // Extrae el texto de la respuesta del assistant
    const reply =
      data.output?.[0]?.content?.[0]?.text?.value ||
      data.output?.[0]?.content?.[0]?.text ||
      'No encontré información.';

    res.status(200).json({ reply });
  } catch (error) {
    console.error('Error en el servidor:', error);
    res.status(500).json({ error: 'Error al conectar con el asistente de OpenAI' });
  }
}
