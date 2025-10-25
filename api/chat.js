export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  const { message } = req.body || {};
  if (!message) return res.status(400).json({ error: "Falta el campo message" });

  try {
    const AIRTABLE_URL =
      "https://airtable.com/appbX9MMdbKvfN78m/shrlpu3h99yjmYcEQ";

    // 1️⃣ Obtener HTML público de Airtable
    const response = await fetch(AIRTABLE_URL);
    const html = await response.text();

    // 2️⃣ Extraer las filas básicas del HTML (categorías y links)
    const regex = />\s*([^<]+)\s*<\/a>\s*<\/td><td[^>]*><a href="([^"]+)"/g;
    const matches = [...html.matchAll(regex)].map(m => ({
      categoria: m[1].trim(),
      link: m[2].trim()
    }));

    // 3️⃣ Buscar coincidencia con el mensaje del usuario
    const found = matches.find(obj =>
      message.toLowerCase().includes(obj.categoria.toLowerCase().split(" ")[1]) ||
      message.toLowerCase().includes(obj.categoria.toLowerCase())
    );

    let reply = "";

    if (found) {
      reply = `✅ (Airtable público) Encontrado: **${found.categoria}** → ${found.link}`;
    } else {
      // 4️⃣ Si no encuentra nada, responder con OpenAI
      const prompt = `
Eres el asistente de GreenView.
Responde de forma breve, amable y profesional sobre suelos y revestimientos.
Si no encuentras una categoría concreta, invita a visitar https://www.greenview.es
      `;

      const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: prompt },
            { role: "user", content: message },
          ],
          temperature: 0.7,
        }),
      });

      const data = await aiRes.json();
      reply = data.choices?.[0]?.message?.content || "No se pudo obtener respuesta.";
    }

    res.status(200).json({ reply });
  } catch (error) {
    console.error("Error en el servidor:", error);
    res.status(500).json({ error: "Error al procesar la solicitud." });
  }
}
