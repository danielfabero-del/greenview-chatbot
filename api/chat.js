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

    // 3️⃣ Búsqueda MEJORADA - SIEMPRE MOSTRAR GRUPOS COMPLETOS
    const userMessage = message.toLowerCase().trim();
    console.log('🔍 Buscando:', userMessage);

    // Función de búsqueda - MÁS INTELIGENTE CON GRUPOS
    const findSmartMatches = (query, categories) => {
      const matches = [];
      
      // Normalizar la consulta
      const cleanQuery = query.replace(/[¿?]/g, '').trim();
      
      console.log('🔍 Búsqueda normalizada:', cleanQuery);
      
      // GRUPOS DE PRODUCTOS - SIEMPRE MOSTRAR TODAS LAS OPCIONES DEL GRUPO
      const productGroups = {
        'tarima': ['tarima exterior de bambú', 'tarima exterior sintética'],
        'tarimas': ['tarima exterior de bambú', 'tarima exterior sintética'],
        'bambú': ['tarima exterior de bambú', 'tarima exterior sintética'], // ¡CAMBIADO! Bambú muestra AMBAS
        'bambu': ['tarima exterior de bambú', 'tarima exterior sintética'], // ¡CAMBIADO! Bambú muestra AMBAS
        'sintética': ['tarima exterior de bambú', 'tarima exterior sintética'],
        'sintetica': ['tarima exterior de bambú', 'tarima exterior sintética'],
        
        'vinílico': ['suelo vinílico en clic', 'suelo vinílico autoportante', 'suelo vinílico pegado', 'suelo vinílico en rollo'],
        'vinilico': ['suelo vinílico en clic', 'suelo vinílico autoportante', 'suelo vinílico pegado', 'suelo vinílico en rollo'],
        'vinílicos': ['suelo vinílico en clic', 'suelo vinílico autoportante', 'suelo vinílico pegado', 'suelo vinílico en rollo'],
        'vinilicos': ['suelo vinílico en clic', 'suelo vinílico autoportante', 'suelo vinílico pegado', 'suelo vinílico en rollo'],
        'vinilo': ['suelo vinílico en clic', 'suelo vinílico autoportante', 'suelo vinílico pegado', 'suelo vinílico en rollo'],
        
        'laminado': ['suelos laminados'],
        'laminados': ['suelos laminados'],
        
        'madera': ['suelos de madera'],
        'moqueta': ['moqueta'],
        'cesped': ['césped artificial'],
        'fachada': ['fachada'],
        'accesorios': ['accesorios'],
        'revestimiento': ['revestimiento vinílico mural']
      };
      
      // PRIMERO: Buscar por grupos (máxima prioridad)
      let groupMatches = [];
      for (const [keyword, groupCategories] of Object.entries(productGroups)) {
        if (cleanQuery.includes(keyword)) {
          console.log(`🎯 Encontrado grupo: ${keyword}`, groupCategories);
          
          groupCategories.forEach(groupCat => {
            const foundCategory = categories.find(cat => cat.categoria === groupCat);
            if (foundCategory && !groupMatches.some(m => m.categoria === groupCat)) {
              groupMatches.push({ ...foundCategory, score: 0.95, fromGroup: true });
            }
          });
        }
      }
      
      // Si encontramos grupos, usarlos y salir
      if (groupMatches.length > 0) {
        console.log('📦 Devolviendo grupo completo:', groupMatches.map(m => m.categoria));
        return groupMatches;
      }
      
      // SEGUNDO: Búsqueda individual (solo si no hay grupos)
      categories.forEach(item => {
        const category = item.categoria.toLowerCase();
        let score = 0;
        
        // 1. COINCIDENCIA EXACTA
        if (cleanQuery === category) {
          score = 1.0;
        }
        // 2. La categoría contiene la consulta
        else if (category.includes(cleanQuery)) {
          score = 0.9;
        }
        // 3. Coincidencia de palabras
        else {
          const queryWords = cleanQuery.split(/\s+/).filter(word => word.length > 2);
          const categoryWords = category.split(/\s+/);
          
          const matchingWords = queryWords.filter(qWord => 
            categoryWords.some(cWord => cWord.includes(qWord) || qWord.includes(cWord))
          );
          
          if (matchingWords.length > 0) {
            score = 0.5 + (matchingWords.length * 0.1);
          }
        }
        
        if (score >= 0.5) {
          matches.push({ ...item, score });
        }
      });
      
      console.log(`📊 Resultados individuales:`, matches);
      return matches.sort((a, b) => b.score - a.score);
    };

    const matches = findSmartMatches(userMessage, rows);

    let reply = "";

    // NUNCA usar OpenAI si tenemos coincidencias
    if (matches.length > 0) {
      const hasGroup = matches.some(m => m.fromGroup);
      
      if (matches.length === 1 && !hasGroup) {
        const match = matches[0];
        reply = `Perfecto, te interesan los **${match.categoria}**. Puedes ver nuestro catálogo completo aquí: [Ver catálogo de ${match.categoria}](${match.link})`;
      }
      else {
        // MOSTRAR SIEMPRE TODAS LAS OPCIONES DEL GRUPO
        const groupType = userMessage.includes('tarima') || userMessage.includes('bambu') ? 'tarima exterior' : 
                         userMessage.includes('vinil') ? 'suelos vinílicos' : 'opciones';
        
        reply = `Tenemos **varias opciones de ${groupType}**:\n\n` +
          matches.map(match => 
            `• **${match.categoria}** - [Ver catálogo](${match.link})`
          ).join('\n') +
          `\n\n¿Te interesa alguna en particular?`;
      }
    } else {
      // SOLO OpenAI cuando realmente no hay NADA
      reply = `Te recomiendo explorar nuestro [catálogo completo](https://distiplas.ayudaweb.com.es/productos/) donde encontrarás todas nuestras opciones de suelos y revestimientos.`;
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
