import OpenAI from "openai";

export default async function handler(req, res) {
  // Configuración CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Responder preflight
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  try {
    // Leer body manualmente
    let body = "";
    for await (const chunk of req) {
      body += chunk;
    }
    const data = JSON.parse(body);
    const message = data.message || "";

    // Verificar mensaje
    if (!message) {
      res.status(400).json({ error: "No se recibió ningún mensaje." });
      return;
    }

    // Cliente de OpenAI
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Llamada a OpenAI
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Eres el asistente de GreenView. Ayudas a los clientes a encontrar suelos y fichas técnicas." },
        { role: "user", content: message }
      ]
    });

    const reply = completion.choices[0].message.content;
    res.status(200).json({ reply });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Error al procesar la solicitud." });
  }
}
