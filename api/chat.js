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
    // 1️⃣ URL pública de tu Google Sheet (CSV)
    const SHEET_URL =
      "https://docs.google.com/spreadsheets/d/e/2PACX-1vQlxUuVr4XYbPHeIQwI1eQNDnDskBii1PoXwb2F3jry-q4bNcBI8niVnALh4epc5y_4zPEXVTAx0IO_/pub?output=csv";

    // 2️⃣ Descargar y limpiar CSV
    const csvText = await fetch(SHEET_URL).then((r) => r.text());
    const clean = csvText.replace(/"/g, "").trim();

    const rows = clean
      .split("\n")
      .slice(1)
      .map((line) => {
        const parts = line.split(/,|;/);
        return {
          categoria: parts[0]?.trim().toLowerCase(),
          link: parts[1]?.trim(),
        };
      })
      .filter((r) => r.categoria && r.link);

    console.log("📊 Categorías leídas:", rows.map(r => r.categoria));

    // 3️⃣ Calcular similitud básica
    const msg = message.toLowerCase();
    const similarity = (a, b) => {
      const wordsA = a.split(" ");
      const wordsB = b.split(" ");
      const common = wordsA.filter((w) => wordsB.includes(w));
      return common.length / Math.max(wordsA.length, wordsB.length);
    };

    // 4️⃣ Buscar todas las coincidencias relevantes
    const matches = rows
      .map((r) => ({ ...r, score: similarity(msg, r.categoria) }))
      .filter((r) => r.score > 0.3) // relevancia mínima
      .sort((a, b) => b.score - a.score);

    let reply = "";

    if (matches.length > 0) {
      if (matches.length === 1) {
        const r = matches[0];
        reply = `Puedes ver más sobre **${r.categoria}** aquí: ${r.link}`;
      } else {
        // Varias coincidencias: devolver lista
        reply =
          "He encontrado varias opciones que pueden interesarte:\n\n" +
          matches
            .map(
              (r) =>
                `• **${r.categoria}** → [Ver más](${r.link})`
            )
            .join("\n");
      }
    } else {
      // 5️⃣ Si no hay coincidencias, usar OpenAI
      const prompt = `
Eres el asistente virtual de GreenView.
Responde de forma breve, profesional y cercana sobre suelos y revestimientos.
Si el usuario menciona algo fuera de las categorías listadas, sugiere visitar https://www.greenview.es.
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

    res.status(200).json({ reply });
  } catch (error) {
    console.error("❌ Error en el servidor:", error);
    res
      .status(500)
      .json({ error: "Error al procesar la solicitud o al conectar con el asistente." });
  }
}
