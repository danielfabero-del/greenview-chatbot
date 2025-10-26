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
    
    // Procesar CSV
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

    // 3️⃣ Búsqueda SIMPLE
    const userMessage = message.toLowerCase().trim();

    const findMatches = (query, categories) => {
      const matches = [];
      
      const cleanQuery = query.replace(/[¿?]/g, '').trim();
      
      // Búsqueda por palabras clave básicas
      const keywordMap = {
        'laminado': 'suelos laminados',
        'laminados': 'suelos laminados',
        'tarima': ['tarima exterior de bambú', 'tarima exterior sintética'],
        'tarimas': ['tarima exterior de bambú', 'tarima exterior sintética'],
        'bambú': ['tarima exterior de bambú', 'tarima exterior sintética'],
        'bambu': ['tarima exterior de bambú', 'tarima exterior sintética'],
        'vinílico': ['suelo vinílico en clic', 'suelo vinílico autoportante', 'suelo vinílico pegado', 'suelo vinílico en rollo'],
        'vinilico': ['suelo vinílico en clic', 'suelo vinílico autoportante', 'suelo vinílico pegado', 'suelo vinílico en rollo'],
        'vinilo': ['suelo vinílico en clic', 'suelo vinílico autoportante', 'suelo vinílico pegado', 'suelo vinílico en rollo'],
        'madera': 'suelos de madera',
        'moqueta': 'moqueta',
        'cesped': 'césped artificial',
        'fachada': 'fachada',
        'accesorios': 'accesorios',
        'revestimiento': 'revestimiento vinílico mural'
      };
      
      // Buscar por palabras clave
      let foundByKeyword = false;
      for (const [keyword, target] of Object.entries(keywordMap)) {
        if (cleanQuery.includes(keyword)) {
          const targets = Array.isArray(target) ? target : [target];
          targets.forEach(targetCat => {
            const match = categories.find(cat => cat.categoria === targetCat);
            if (match && !matches.some(m => m.categoria === targetCat)) {
              matches.push({ ...match, score: 0.9 });
              foundByKeyword = true;
            }
          });
        }
      }
      
      // Si no hay por palabra clave, buscar directo
      if (!foundByKeyword) {
        categories.forEach(item => {
          const category = item.categoria.toLowerCase();
          
          if (cleanQuery === category) {
            matches.push({ ...item, score: 1.0 });
          }
          else if (category.includes(cleanQuery) || cleanQuery.includes(category)) {
            matches.push({ ...item, score: 0.7 });
          }
        });
      }
      
      return matches.sort((a, b) => b.score - a.score);
    };

    const matches = findMatches(userMessage, rows);

    let reply = "";

    if (matches.length > 0) {
      // Mostrar resultados encontrados
      const showBothTarimas = userMessage.includes('bambu') || userMessage.includes('bambú') || userMessage.includes('tarima');
      
      if (matches.length === 1 && !showBothTarimas) {
        const match = matches[0];
        reply = `Perfecto, te interesan los **${match.categoria}**. Puedes ver nuestro catálogo completo aquí: [Ver catálogo de ${match.categoria}](${match.link})`;
      }
      else {
        const relevantMatches = showBothTarimas 
          ? matches.filter(m => m.categoria.includes('tarima'))
          : matches.slice(0, 5);
        
        if (relevantMatches.length === 1) {
          const match = relevantMatches[0];
          reply = `Perfecto, te interesan los **${match.categoria}**. Puedes ver nuestro catálogo completo aquí: [Ver catálogo de ${match.categoria}](${match.link})`;
        }
        else {
          const groupName = showBothTarimas ? 'tarima exterior' : 
                           userMessage.includes('vinil') ? 'suelos vinílicos' : 'opciones relacionadas';
          
          reply = `Tenemos **varias opciones de ${groupName}**:\n\n` +
            relevantMatches.map(match => 
              `• **${match.categoria}** - [Ver catálogo](${match.link})`
            ).join('\n') +
            `\n\n¿Te interesa alguna en particular?`;
        }
      }
    } else {
      // 4️⃣ Cuando NO encuentra coincidencias, usar OpenAI con prompt MEJORADO
      const availableCategories = rows.map(r => r.categoria).join(', ');
      
      const prompt = `Eres IAGreeView, el asistente virtual de Distiplas, especialistas en suelos y revestimientos.

CATEGORÍAS QUE SÍ TENEMOS: ${availableCategories}

INSTRUCCIONES CRÍTICAS:
1. Si el usuario pregunta por SUELOS, PISOS, REVESTIMIENTOS o cualquier cosa relacionada con construcción/reforma, recomienda nuestras categorías disponibles
2. Si pregunta por algo TOTALMENTE NO RELACIONADO (comida, animales, clima, etc.), responde como un asistente amable pero indica que solo puedes ayudar con suelos
3. Si pregunta sobre TI MISMO (nombre, quién eres), presenta tu función como asistente de Distiplas
4. Si no estás seguro, ofrece ayuda general sobre suelos
5. Sé natural, amable y útil

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
      reply = data.choices?.[0]?.message?.content || 
        "Soy IAGreeView, tu asistente virtual de Distiplas. ¿En qué puedo ayudarte con suelos y revestimientos?";
    }

    res.status(200).json({ reply });

  } catch (error) {
    console.error("❌ Error:", error);
    res.status(500).json({ 
      error: "Error al procesar la solicitud."
    });
  }
}
