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

    // 3️⃣ Búsqueda MEJORADA - MÁS FLEXIBLE
    const userMessage = message.toLowerCase().trim();
    console.log('🔍 Buscando:', userMessage);

    // Función de búsqueda OPTIMIZADA
    const findSmartMatches = (query, categories) => {
      const matches = [];
      
      // Palabras clave PRINCIPALES para agrupar búsquedas
      const searchGroups = {
        'tarima': ['tarima exterior de bambú', 'tarima exterior sintética'],
        'laminado': ['suelos laminados'],
        'laminados': ['suelos laminados'],
        'vinílico': ['suelo vinílico en clic', 'suelo vinílico autoportante', 'suelo vinílico pegado', 'suelo vinílico en rollo'],
        'vinilico': ['suelo vinílico en clic', 'suelo vinílico autoportante', 'suelo vinílico pegado', 'suelo vinílico en rollo'],
        'madera': ['suelos de madera'],
        'moqueta': ['moqueta'],
        'cesped': ['césped artificial'],
        'césped': ['césped artificial'],
        'fachada': ['fachada'],
        'accesorios': ['accesorios'],
        'revestimiento': ['revestimiento vinílico mural']
      };
      
      categories.forEach(item => {
        const category = item.categoria.toLowerCase();
        let score = 0;
        
        // 1. COINCIDENCIA EXACTA (máxima prioridad)
        if (query === category) {
          score = 1.0;
        }
        // 2. La categoría contiene TODA la consulta
        else if (category.includes(query)) {
          score = 0.95;
        }
        // 3. BÚSQUEDA POR GRUPOS - Si la consulta coincide con un grupo
        else {
          for (const [groupKey, groupCategories] of Object.entries(searchGroups)) {
            if (query.includes(groupKey) && groupCategories.includes(category)) {
              score = 0.85;
              break;
            }
          }
        }
        // 4. Coincidencia de palabra individual
        if (score === 0) {
          const specificWords = ['laminado', 'laminados', 'tarima', 'tarimas', 'vinílico', 'vinilico', 'madera', 'moqueta', 'cesped', 'césped', 'fachada'];
          const hasSpecificWord = specificWords.some(word => 
            query.includes(word) && category.includes(word)
          );
          if (hasSpecificWord) {
            score = 0.7;
          }
        }
        
        if (score >= 0.5) {
          matches.push({ ...item, score });
        }
      });
      
      return matches.sort((a, b) => b.score - a.score);
    };

    const matches = findSmartMatches(userMessage, rows);
    console.log('🎯 Coincidencias encontradas:', matches);

    let reply = "";

    // SIEMPRE usar nuestro sistema de enlaces - NO OpenAI para categorías conocidas
    if (matches.length > 0) {
      const showAllForGroups = ['tarima', 'vinílico', 'vinilico'].some(term => userMessage.includes(term));
      
      if (matches.length === 1) {
        const match = matches[0];
        reply = `Perfecto, te interesan los **${match.categoria}**. Puedes ver nuestro catálogo completo aquí: [Ver catálogo de ${match.categoria}](${match.link})`;
      }
      else if (matches.length > 1) {
        if (showAllForGroups) {
          const groupName = userMessage.includes('tarima') ? 'tarima exterior' : 'suelos vinílicos';
          reply = `Tenemos **varias opciones de ${groupName}**:\n\n` +
            matches.map(match => 
              `• **${match.categoria}** - [Ver catálogo](${match.link})`
            ).join('\n') +
            `\n\n¿Te interesa alguna en particular?`;
        } else {
          reply = `He encontrado estas opciones relacionadas con "${message}":\n\n` +
            matches.map(match => 
              `• **${match.categoria}** - [Ver catálogo](${match.link})`
            ).join('\n') +
            `\n\n¿Te interesa alguna en particular?`;
        }
      }
    } else {
      // Solo usar OpenAI para consultas completamente desconocidas
      const prompt = `Eres IAGreeView, asistente de Distiplas. Especialistas en suelos.

Si el usuario pregunta por algo que no está en nuestro catálogo, sugiere amablemente visitar nuestra web principal.

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
          max_tokens: 150,
        }),
      });

      const data = await aiResponse.json();
      const aiReply = data.choices?.[0]?.message?.content || "";
      
      // Combinar con enlace al catálogo general
      reply = `${aiReply}\n\nTambién puedes explorar nuestro [catálogo completo](https://distiplas.ayudaweb.com.es/productos/) para más opciones.`;
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
