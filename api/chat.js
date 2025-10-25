export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "Método no permitido" });

  const { message } = req.body || {};
  if (!message)
    return res.status(400).json({ error: "Falta el campo message" });

  try {
    // 1️⃣ URL pública de tu Google Sheet (ya en formato CSV)
    const SHEET_URL =
      "https://docs.google.com/spreadsheets/d/e/2PACX-1vQlxUuVr4XYbPHeIQwI1eQNDnDskBii1PoXwb2F3jry-q4bNcBI8niVnALh4epc5y_4zPEXVTAx0IO_/pub?output=csv";

    // 2️⃣ Descargar el CSV y parsearlo
    const csvText = await fetch(SHEET_URL).then((r) => r.text());
    const rows = csvText
      .split("\n")
      .slice(1)
      .map((line) => {
        const parts = line.split(",");
        return {
          categoria: parts[0]?.trim().toLowerCase(),
          link: parts[1]?.trim(),
        };
      });

    // 3️⃣ Buscar coincidencia con el mensaje del usuario
    const found = rows.find((obj) =>
      message.toLowerCase().includes(obj.categoria)
    );

    let reply = "";

    if (found) {
      reply = `Puedes ver más sobre **${found.categoria}** aquí: ${found.link}`;
    } else {
      // 4️⃣ Si no encuentra nada, usar OpenAI
      const prompt = `
Eres el asistente virtual de GreenView.
Responde de forma profesional, cercana y breve sobre suelos y revestimientos.
Si el usuario menciona una categoría o marca no listada, sugiere visitar https://www.greenview.es.
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
      reply =
        data.choices?.[0]?.message?.content ||
        "No se pudo obtener respuesta del asistente.";
    }

    // 5️⃣ Devolver respuesta
    res.status(200).json({ reply });
  } catch (error) {
    console.error("Error en el servidor:", error);
    res
      .status(500)
      .json({ error: "Error al procesar la solicitud o al conectar con el asistente." });
  }
}
