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
    const SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQlxUuVr4XYbPHeIQwI1eQNDnDskBii1PoXwb2F3jry-q4bNcBI8niVnALh4epc5y_4zPEXVTAx0IO_/pub?output=csv";

    // 2️⃣ Descargar y procesar CSV CORRECTAMENTE
    const csvResponse = await fetch(SHEET_URL);
    const csvText = await csvResponse.text();
    
    console.log('📊 CSV descargado:', csvText.substring(0, 200)); // Debug

    // Procesar CSV correctamente
    const rows = csvText
      .split('\n')
      .slice(1) // Saltar header
      .map(line => {
        // Limpiar y dividir correctamente
        const cleanLine = line.trim().replace(/"/g, '');
        const columns = cleanLine.split(',');
        
        // Asumiendo: columna 0 = categoría, columna 1 = link
        if (columns.length >= 2) {
          return {
            categoria: columns[0]?.trim().toLowerCase(),
            link: columns[1]?.trim()
          };
        }
        return null;
      })
      .filter(row => row && row.categoria && row.link);

    console.log('📋 Filas procesadas:', rows.length); // Debug
    console.log('📝 Categorías disponibles:', rows.map(r => r.categoria)); // Debug

    // 3️⃣ Búsqueda MEJORADA en las categorías
    const userMessage = message.toLowerCase().trim();
    console.log('🔍 Buscando:', userMessage); // Debug

    // Función de búsqueda más inteligente
    const findMatches = (query, categories) => {
      const matches = [];
      
      categories.forEach(item => {
        const category = item.categoria.toLowerCase();
        let score = 0;
        
        // Coincidencia exacta
        if (query === category) {
          score = 1.0;
        }
        // Coincidencia de palabras clave
        else if (category.includes(query) || query.includes(category)) {
          score = 0.8;
        }
        // Coincidencia parcial
        else {
          const queryWords = query.split(/\s+/);
          const categoryWords = category.split(/\s+/);
          
          const matchingWords = queryWords.filter(qWord => 
            categoryWords.some(cWord => cWord.includes(qWord) || qWord.includes(cWord))
          );
          
          score = matchingWords.length / queryWords.length;
        }
        
        if (score > 0.3) { // Umbral más bajo para mejores resultados
          matches.push({ ...item, score });
        }
      });
      
      return matches.sort((a, b) => b.score - a.score);
    };

    const matches = findMatches(userMessage, rows);
    console.log('🎯 Coincidencias encontradas:', matches); // Debug

    let reply = "";

    if (matches.length > 0) {
      const topMatch = matches[0];
      
      if (matches.length === 1) {
        reply = `Perfecto, te interesan los **${topMatch.categoria}**. Puedes ver nuestro catálogo completo aquí: ${topMatch.link}`;
      } else {
        reply = `He encontrado varias opciones relacionadas con "${message}":\n\n` +
          matches.slice(0, 3).map(match => 
            `• **${match.categoria}** - [Ver catálogo](${match.link})`
          ).join('\n') +
          `\n\n¿Te interesa alguna en particular?`;
      }
    } else {
      // 4️⃣ Si no encuentra coincidencia, usar OpenAI con contexto MEJORADO
      const availableCategories = rows.map(r => `- ${r.categoria}`).join('\n');
      
      const prompt = `Eres IAGreeView, el asistente virtual de Distiplas - Expertos en Suelos de Calidad.

CATEGORÍAS DISPONIBLES EN NUESTRO CATÁLOGO:
${availableCategories}

INSTRUCCIONES:
1. Si el usuario pregunta por alguna de las categorías listadas, sugiere visitar el catálogo correspondiente
2. Para "suelos laminados" → https://distiplas.ayudaweb.com.es/tipoproducto/suelos-laminados/
3. Para "tarima exterior" → https://distiplas.ayudaweb.com.es/tipoproducto/tarima-exterior-de-bambu/
4. Si no está en la lista, sugiere visitar https://distiplas.ayudaweb.com.es/productos/
5. Sé amable, profesional y ofrece enlaces útiles
6. Usa formato Markdown para enlaces: [texto](URL)

Usuario pregunta: "${message}"`;

      const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
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
          max_tokens: 500,
        }),
      });

      const data = await aiResponse.json();
      
      if (!aiResponse.ok) {
        throw new Error(`OpenAI error: ${data.error?.message}`);
      }
      
      reply = data.choices?.[0]?.message?.content || 
        "Te recomiendo visitar nuestro catálogo completo: https://distiplas.ayudaweb.com.es/productos/";
    }

    console.log('💬 Respuesta final:', reply); // Debug
    res.status(200).json({ reply });

  } catch (error) {
    console.error("❌ Error en el servidor:", error);
    res.status(500).json({ 
      error: "Error al procesar la solicitud.",
      details: error.message 
    });
  }
}
