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

    // 3️⃣ Búsqueda MÁS AGRESIVA - ENCONTRAR SIEMPRE QUE EXISTA
    const userMessage = message.toLowerCase().trim();

    const findMatches = (query, categories) => {
      const matches = [];
      
      const cleanQuery = query.replace(/[¿?]/g, '').trim();
      
      // PRIMERO: Búsqueda DIRECTA en todas las categorías
      categories.forEach(item => {
        const category = item.categoria.toLowerCase();
        
        // Coincidencia EXACTA
        if (cleanQuery === category) {
          matches.push({ ...item, score: 1.0 });
        }
        // Categoría CONTIENE consulta
        else if (category.includes(cleanQuery)) {
          matches.push({ ...item, score: 0.9 });
        }
        // Consulta CONTIENE categoría
        else if (cleanQuery.includes(category)) {
          matches.push({ ...item, score: 0.8 });
        }
      });

      // SEGUNDO: Si no hay coincidencias directas, buscar por palabras
      if (matches.length === 0) {
        const searchWords = cleanQuery.split(/\s+/).filter(word => word.length > 3);
        
        categories.forEach(item => {
          const category = item.categoria.toLowerCase();
          let score = 0;
          
          // Cada palabra de la consulta en la categoría
          searchWords.forEach(word => {
            if (category.includes(word)) {
              score += 0.3;
            }
          });
          
          if (score > 0) {
            matches.push({ ...item, score });
          }
        });
      }
      
      return matches.sort((a, b) => b.score - a.score);
    };

    const matches = findMatches(userMessage, rows);
    console.log('🔍 Búsqueda:', userMessage, 'Resultados:', matches.length);

    let reply = "";

    // REGLA PRINCIPAL: SI HAY COINCIDENCIA > 0.5, MOSTRAR ENLACE SIEMPRE
    const goodMatches = matches.filter(m => m.score >= 0.5);
    
    if (goodMatches.length > 0) {
      // SIEMPRE dar enlace directo cuando hay coincidencia buena
      if (goodMatches.length === 1) {
        const match = goodMatches[0];
        reply = `**${match.categoria}** - [Ver catálogo completo aquí](${match.link})`;
      } else {
        reply = `**Opciones encontradas:**\n\n` +
          goodMatches.map(match => 
            `• **${match.categoria}** - [Ver catálogo](${match.link})`
          ).join('\n') +
          `\n\n¿Te interesa alguna en particular?`;
      }
    } else {
      // SOLO OpenAI cuando NO HAY NINGUNA coincidencia
      const availableCategories = rows.map(r => r.categoria).join(', ');
      
      const prompt = `Eres IAGreeView, asistente de Distiplas. Especialista en suelos.

CATEGORÍAS DISPONIBLES: ${availableCategories}

INSTRUCCIONES CRÍTICAS:
- Si el usuario menciona CUALQUIER categoría de la lista, DEBES proporcionar el enlace correspondiente
- Si no es sobre suelos, responde brevemente y redirige al tema
- Para "suelos laminados", ofrecer el enlace directo
- Sé conciso y útil

Usuario: "${message}"`;

      try {
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
            max_tokens: 100,
          }),
        });

        const data = await aiResponse.json();
        reply = data.choices?.[0]?.message?.content || 
          "¿En qué puedo ayudarte con nuestros suelos y revestimientos?";
      } catch (aiError) {
        // Si OpenAI falla, respuesta de respaldo
        reply = "¿Te interesa algún tipo de suelo en particular? Tenemos opciones como suelos laminados, de madera, vinílicos, y más.";
      }
    }

    res.status(200).json({ reply });

  } catch (error) {
    console.error("❌ Error general:", error);
    res.status(500).json({ 
      error: "Error temporal. Por favor, intenta de nuevo."
    });
  }
}
