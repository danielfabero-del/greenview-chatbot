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

    // 2️⃣ Descargar y procesar CSV
    const csvResponse = await fetch(SHEET_URL);
    const csvText = await csvResponse.text();
    
    console.log('📊 CSV descargado:', csvText.substring(0, 200));

    // Procesar CSV correctamente
    const rows = csvText
      .split('\n')
      .slice(1)
      .map(line => {
        const cleanLine = line.trim().replace(/"/g, '');
        const columns = cleanLine.split(',');
        
        if (columns.length >= 2) {
          return {
            categoria: columns[0]?.trim().toLowerCase(),
            link: columns[1]?.trim()
          };
        }
        return null;
      })
      .filter(row => row && row.categoria && row.link);

    console.log('📋 Categorías disponibles:', rows.map(r => r.categoria));

    // 3️⃣ Búsqueda MUCHO MÁS ESPECÍFICA
    const userMessage = message.toLowerCase().trim();
    console.log('🔍 Buscando:', userMessage);

    // Palabras clave PRINCIPALES para cada categoría
    const categoryKeywords = {
      'suelos laminados': ['laminado', 'laminados', 'laminada'],
      'suelos de madera': ['madera', 'maderas', 'parquet', 'wood'],
      'suelo vinílico en clic': ['vinílico clic', 'vinilico clic', 'clic', 'click'],
      'suelo vinílico autoportante': ['autoportante', 'autoportantes'],
      'suelo vinílico pegado': ['pegado', 'pegados', 'adherido'],
      'suelo vinílico en rollo': ['rollo', 'rollos', 'en rollo'],
      'revestimiento vinílico mural': ['mural', 'pared', 'revestimiento', 'wall'],
      'tarima exterior de bambú': ['tarima', 'bambú', 'bambu', 'exterior bambu'],
      'tarima exterior sintética': ['tarima sintética', 'sintetica', 'composite', 'exterior sintetico'],
      'fachada': ['fachada', 'facade', 'exterior fachada'],
      'moqueta': ['moqueta', 'moquetas', 'alfombra', 'carpet'],
      'césped artificial': ['cesped', 'césped', 'artificial', 'grass', 'jardin'],
      'accesorios': ['accesorio', 'accesorios', 'complemento'],
      'descatalogados': ['descatalogado', 'descatalogados', 'outlet']
    };

    // Función de búsqueda MEJORADA - mucho más estricta
    const findExactMatches = (query, categories) => {
      const matches = [];
      
      categories.forEach(item => {
        const category = item.categoria.toLowerCase();
        let score = 0;
        
        // 1. Coincidencia EXACTA de categoría
        if (query === category) {
          score = 1.0;
        }
        // 2. La categoría contiene la consulta completa
        else if (category.includes(query)) {
          score = 0.9;
        }
        // 3. La consulta contiene la categoría completa
        else if (query.includes(category)) {
          score = 0.8;
        }
        // 4. Búsqueda por palabras clave específicas
        else if (categoryKeywords[category]) {
          const keywords = categoryKeywords[category];
          const hasKeyword = keywords.some(keyword => query.includes(keyword));
          if (hasKeyword) {
            score = 0.7;
          }
        }
        // 5. Coincidencia de palabra principal (solo para palabras clave importantes)
        else {
          const mainWords = ['tarima', 'laminado', 'vinílico', 'madera', 'moqueta', 'cesped', 'fachada'];
          const hasMainWord = mainWords.some(word => 
            query.includes(word) && category.includes(word)
          );
          if (hasMainWord) {
            score = 0.6;
          }
        }
        
        if (score >= 0.6) { // Umbral más alto para menos falsos positivos
          matches.push({ ...item, score });
        }
      });
      
      return matches.sort((a, b) => b.score - a.score);
    };

    const matches = findExactMatches(userMessage, rows);
    console.log('🎯 Coincidencias exactas:', matches);

    let reply = "";

    if (matches.length > 0) {
      // Filtrar solo las mejores coincidencias
      const bestMatches = matches.filter(m => m.score >= 0.7);
      
      if (bestMatches.length === 0 && matches.length > 0) {
        // Si hay coincidencias pero no son muy buenas, mostrar la mejor
        const topMatch = matches[0];
        reply = `¿Te refieres a **${topMatch.categoria}**? Puedes ver nuestro catálogo aquí: ${topMatch.link}`;
      }
      else if (bestMatches.length === 1) {
        const match = bestMatches[0];
        reply = `Perfecto, te interesan los **${match.categoria}**. Puedes ver nuestro catálogo completo aquí: ${match.link}`;
      }
      else if (bestMatches.length > 1) {
        reply = `He encontrado estas opciones relacionadas con "${message}":\n\n` +
          bestMatches.map(match => 
            `• **${match.categoria}** - [Ver catálogo](${match.link})`
          ).join('\n') +
          `\n\n¿Te interesa alguna en particular?`;
      }
      else {
        // No hay buenas coincidencias
        reply = `Te recomiendo visitar nuestro catálogo completo: https://distiplas.ayudaweb.com.es/productos/`;
      }
    } else {
      // 4️⃣ Usar OpenAI para respuestas más naturales
      const availableCategories = rows.map(r => `- ${r.categoria}`).join('\n');
      
      const prompt = `Eres IAGreeView, asistente de Distiplas. Responde sobre SUELOS.

CATEGORÍAS: ${availableCategories}

Si el usuario pregunta por "tarima", recomienda SOLO tarimas.
Si pregunta por "vinílico", recomienda SOLO suelos vinílicos.
Si no está seguro, sugiere el catálogo general.

Usuario: "${message}"`;

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
          max_tokens: 300,
        }),
      });

      const data = await aiResponse.json();
      reply = data.choices?.[0]?.message?.content || 
        "Te recomiendo visitar: https://distiplas.ayudaweb.com.es/productos/";
    }

    console.log('💬 Respuesta final:', reply);
    res.status(200).json({ reply });

  } catch (error) {
    console.error("❌ Error:", error);
    res.status(500).json({ 
      error: "Error al procesar la solicitud.",
      details: error.message 
    });
  }
}
