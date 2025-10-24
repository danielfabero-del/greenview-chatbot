import OpenAI from "openai";

export default async function handler(req, res) {
  try {
    const { message } = req.body;
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Eres un asistente de GreenView que ayuda a los clientes a encontrar productos y fichas técnicas." },
        { role: "user", content: message }
      ]
    });

    res.status(200).json({ reply: response.choices[0].message.content });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al procesar la solicitud." });
  }
}
