export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  const { message } = req.body || {};
  if (!message) return res.status(400).json({ error: "Falta el campo message" });

  const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN; // 👈 Añade esta variable en Vercel
  const BASE_ID = "appbX9MMdbKvfN78m";
  const TABLE_ID = "tblavPooCUFSzn9Dy";

  try {
    // 1️⃣ Buscar coincidencias en Airtable
    const query = encodeURIComponent(message);
    const airtableRes = await fetch(
      `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}?filterByFormula=FIND(LOWER("${query}"), LOWER({Categorias}))`,
      {
        headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` },
      }
    );

    const airtableData = await airtableRes.json();
    let reply = "";

    if (airtableData.records && airtableData.records.length > 0) {
      const cat = airtableData.records[0].fields;
      reply = `Puedes ver más sobre **${cat.Categorias}** en este enlace: ${cat.Link}`;
    } else {
      // 2️⃣ Si no hay coincidencia en Airtable, usar OpenAI
      const promptBase = `
Eres el asistente virtual de GreenView.
Responde de manera amable y clara sobre suelos y revestimientos.
Si no encuentras una categoría exacta en la base de datos, ofrece visitar la web general.
Sitio web: https://www.greenview.es
Horarios: Lunes a viernes, 9:00 a 18:00.
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
            { role: "system", content: promptBase },
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
