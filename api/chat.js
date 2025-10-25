export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const { message } = req.body || {};
  if (!message) return res.status(400).json({ error: 'Falta el campo message' });

  try {
    const assistantId = 'asst_dHW5ZEgp59eKaKtjLPaUlvPv'; // tu Assistant ID

    // 1️⃣ Crear un nuevo thread
    const threadRes = await fetch('https://api.openai.com/v1/threads', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: message }],
      }),
    });
    const threadData = await threadRes.json();
    const threadId = threadData.id;

    // 2️⃣ Ejecutar el assistant en ese thread
    const runRes = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ assistant_id: assistantId }),
    });
    const runData = await runRes.json();

    // 3️⃣ Esperar a que termine el run
    let runStatus = runData.status;
    let runId = runData.id;
    let outputData = null;

    while (runStatus !== 'completed' && runStatus !== 'failed' && runStatus !== 'cancelled') {
      await new Promise(r => setTimeout(r, 1000));
      const statusRes = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs/${runId}`, {
        headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
      });
      const statusData = await statusRes.json();
      runStatus = statusData.status;
    }

    // 4️⃣ Obtener mensajes del thread una vez completado
    const messagesRes = await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
      headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
    });
    const messagesData = await messagesRes.json();

    const lastMessage = messagesData.data
      ?.find(m => m.role === 'assistant')
      ?.content?.[0]?.text?.value || 'No encontré información.';

    res.status(200).json({ reply: lastMessage });
  } catch (error) {
    console.error('Error en el servidor:', error);
    res.status(500).json({ error: 'Error al conectar con el asistente de OpenAI' });
  }
}
