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

    // 3️⃣ Búsqueda SIMPLE Y EFECTIVA
    const userMessage = message.toLowerCase().trim();
    console.log('🔍 Buscando:', userMessage);

    // Función de búsqueda SIMPLE - SIN COMPLICACIONES
    const findMatches = (query, categories) => {
      const matches = [];
      
      const cleanQuery = query.replace(/[¿?]/g, '').trim();
      
      // PALABRAS CLAVE BÁSICAS - SOLO LAS ESENCIALES
      const keywordMap = {
        // LAMINADOS
        'laminado': 'suelos laminados',
        'laminados': 'suelos laminados',
        
        // TARIMAS - BAMBÚ muestra AMBAS
        'tarima': ['tarima exterior de bambú', 'tarima exterior sintética'],
        'tarimas': ['tarima exterior de bambú', 'tarima exterior sintética'], 
        'bambú': ['tarima exterior de bambú', 'tarima exterior sintética'], // ✅ CAMBIO CLAVE
        'bambu': ['tarima exterior de bambú', 'tarima exterior sintética'], // ✅ CAMBIO CLAVE
        
        // VINÍLICOS
        'vinílico': ['suelo vinílico en clic', 'suelo vinílico autoportante', 'suelo vinílico pegado', 'suelo vinílico en rollo'],
        'vinilico': ['suelo vinílico en clic', 'suelo vinílico autoportante', 'suelo vinílico pegado', 'suelo vinílico en rollo'],
        'vinilo': ['suelo vinílico en clic', 'suelo vinílico autoportante', 'suelo vinílico pegado', 'suelo vinílico en rollo'],
        
        // OTRAS
        'madera': 'suelos de madera',
        'moqueta': 'moqueta',
        'cesped': 'césped artificial',
        'fachada': 'fachada',
        'accesorios': 'accesorios',
        'revestimiento': 'revestimiento vinílico mural'
      };
      
      // PRIMERO: Buscar por palabras clave específicas
      let foundByKeyword = false;
      for (const [keyword, target] of Object.entries(keywordMap)) {
        if (cleanQuery.includes(keyword)) {
          console.log(`🎯 Palabra clave encontrada: ${keyword}`);
          
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
      
      // SEGUNDO: Si no hay coincidencia por palabra clave, buscar directo
      if (!foundByKeyword) {
        categories.forEach(item => {
          const category = item.categoria.toLowerCase();
          
          // Coincidencia exacta
          if (cleanQuery === category) {
            matches.push({ ...item, score: 1.0 });
          }
          // Coincidencia parcial
          else if (category.includes(cleanQuery) || cleanQuery.includes(category)) {
            matches.push({ ...item, score: 0.7 });
          }
        });
      }
      
      return matches.sort((a, b) => b.score - a.score);
    };

    const matches = findMatches(userMessage, rows);
    console.log('🎯 Coincidencias:', matches);

    let reply = "";

    if (matches.length > 0) {
      // Para "bambú" y "tarima" mostrar SIEMPRE ambas
      const showBothTarimas = userMessage.includes('bambu') || userMessage.includes('bambú') || userMessage.includes('tarima');
      
      if (matches.length === 1 && !showBothTarimas) {
        const match = matches[0];
        reply = `Perfecto, te interesan los **${match.categoria}**. Puedes ver nuestro catálogo completo aquí: [Ver catálogo de ${match.categoria}](${match.link})`;
      }
      else {
        // Mostrar todas las opciones relevantes
        const relevantMatches = showBothTarimas 
          ? matches.filter(m => m.categoria.includes('tarima'))
          : matches.slice(0, 5); // Máximo 5 resultados
        
        if (relevantMatches.length === 0) {
          const match = matches[0];
          reply = `Perfecto, te interesan los **${match.categoria}**. Puedes ver nuestro catálogo completo aquí: [Ver catálogo de ${match.categoria}](${match.link})`;
        }
        else if (relevantMatches.length === 1) {
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
      // Respuesta simple cuando no encuentra nada
      reply = `Te recomiendo explorar nuestro [catálogo completo](https://distiplas.ayudaweb.com.es/productos/) para ver todas nuestras opciones disponibles.`;
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
