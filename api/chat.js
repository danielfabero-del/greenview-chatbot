// api/chat.js
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  try {
    const { message } = req.body || {};
    if (!message) {
      return res.status(400).json({ error: "Mensaje vacío" });
    }

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Eres un asistente especializado en suelos de madera, vinilo y laminados de GreenView. Responde de forma clara, profesional y empática."
        },
        { role: "user", content: message }
      ],
    });

    const reply = completion.choices?.[0]?.message?.content || "Lo siento, no pude generar respuesta.";
    return res.status(200).json({ reply });

  } catch (error) {
    console.error("Error en API:", error);
    return res.status(500).json({ error: "Error al procesar la solicitud." });
  }
}
