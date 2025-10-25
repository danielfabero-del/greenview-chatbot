export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const { message } = req.body || {};
  if (!message) return res.status(400).json({ error: 'Falta el campo message' });

  const apiKey = process.env.OPENAI_API_KEY;
  const assistantId = "asst_dHW5ZEgp59eKaKtjLPaUlvPv"; // ✅ Tu Assistant ID

  try {
    // 1️⃣ Crear un thread
    const threadRes = await fetch("https://api.openai.com/v1/threads", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: message }],
      }),
    });
    const thread = await threadRes.json();

    // 2️⃣ Crear un run con el assistant
    const runRes = await fetch(`https://api.openai.com/v1/threads/${thread.id}/runs`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        assistant_id: assistantId,
      }),
    });
    const run = await runRes.json();

    // 3️⃣ Esperar a que el run termine (polling cada segundo)
    let runStatus = run.status;
    while (runStatus === "queued" || runStatus === "in_progress") {
      await new Promise((r) => setTimeout(r, 1000));
      const statusRes = await fetch(`https://api.openai.com/v1/threads/${thread.id}/runs/${run.id}`, {
        headers: { "Authorization": `Bearer ${apiKey}` },
      });
      const statusData = await statusRes.json();
      runStatus = statusData.status;
    }

    // 4️⃣ Obtener los mensajes del thread (la respuesta final)
    const messagesRes = await fetch(`https://api.openai.com/v1/threads/${thread.id}/messages`, {
      headers: { "Authorization": `Bearer ${apiKey}` },
    });
    const messagesData = await messagesRes.json();

    // 5️⃣ Buscar el último mensaje del assistant
    const last = messagesData.data.find(m => m.role === "assistant");
    const reply = last?.content?.[0]?.text?.value || "No encontré información.";

    res.status(200).json({ reply });
  } catch (error) {
    console.error("Error en el servidor:", error);
    res.status(500).json({ error: "Error al conectar con el asistente de OpenAI" });
  }
}
