export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const { message } = req.body || {};
  if (!message) return res.status(400).json({ error: 'Falta el campo message' });

  try {
    const assistantId = 'asst_dHW5ZEgp59eKaKtjLPaUlvPv';

    // Crear un thread con el mensaje del usuario
    const threadRes = await fetch('https://api.openai.com/v1/threads', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: message }],
      }),
    });

    const threadData = await threadRes.json();
    const threadId = threadData.id;

    // Iniciar el assistant
    const runRes = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ assistant_id: assistantId }),
    });

    const runData = await runRes.json();
    const runId = runData.id;

    // Esperar hasta que el assistant termine (máx. 20s)
    let runStatus = runData.status;
    let attempts = 0;

    while (runStatus !== 'completed' && runStatus !== 'failed' && runStatus !== 'cancelled' && attempts < 20) {
      await new Promise((r) => setTimeout(r, 1000));
      const checkRes = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs/${runId}`, {
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      });
      const checkData = await checkRes.json();
      runStatus = checkData.status;
      attempts++;
    }

    // Obtener los mensajes del assistant
    const messagesRes = await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    });

    const messagesData = await messagesRes.json();

    // Buscar el mensaje más reciente del assistant
    const assistantMessage = messagesData.data
      ?.filter((m) => m.role === 'assistant' && m.content?.length)
      ?.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];

    const reply =
      assistantMessage?.content?.[0]?.text?.value ||
      'No encontré información o la respuesta no llegó a tiempo.';

    res.status(200).json({ reply });
  } catch (error) {
    console.error('Error en el servidor:', error);
    res.status(500).json({ error: 'Error al conectar con el asistente de OpenAI' });
  }
}
