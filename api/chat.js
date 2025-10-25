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

    // 3️⃣ Búsqueda MEJORADA - MÁS PRECISA
    const userMessage = message.toLowerCase().trim();
    console.log('🔍 Buscando:', userMessage);

    // Función de búsqueda MUCHO MÁS PRECISA
    const findSmartMatches = (query, categories) => {
      const matches = [];
      
      // Normalizar la consulta
      const cleanQuery = query.replace(/[¿?]/g, '').trim();
      
      console.log('🔍 Búsqueda normalizada:', cleanQuery);
      
      // PALABRAS CLAVE PRINCIPALES para búsqueda inteligente
      const searchKeywords = {
        // LAMINADOS
        'laminado': 'suelos laminados',
        'laminados': 'suelos laminados',
        'suelos laminados': 'suelos laminados',
        
        // TARIMAS
        'tarima': ['tarima exterior de bambú', 'tarima exterior sintética'],
        'tarimas': ['tarima exterior de bambú', 'tarima exterior sintética'],
        'tarima exterior': ['tarima exterior de bambú', 'tarima exterior sintética'],
        'bambú': 'tarima exterior de bambú',
        'bambu': 'tarima exterior de bambú',
        'sintética': 'tarima exterior sintética',
        'sintetica': 'tarima exterior sintética',
        
        // VINÍLICOS
        'vinílico': ['suelo vinílico en clic', 'suelo vinílico autoportante', 'suelo vinílico pegado', 'suelo vinílico en rollo'],
        'vinilico': ['suelo vinílico en clic', 'suelo vinílico autoportante', 'suelo vinílico pegado', 'suelo vinílico en rollo'],
        'vinílicos': ['suelo vinílico en clic', 'suelo vinílico autoportante', 'suelo vinílico pegado', 'suelo vinílico en rollo'],
        'vinilicos': ['suelo vinílico en clic', 'suelo vinílico autoportante', 'suelo vinílico pegado', 'suelo vinílico en rollo'],
        'suelo vinílico': ['suelo vinílico en clic', 'suelo vinílico autoportante', 'suelo vinílico pegado', 'suelo vinílico en rollo'],
        
        // OTRAS CATEGORÍAS
        'madera': 'suelos de madera',
        'maderas': 'suelos de madera',
        'suelos de madera': 'suelos de madera',
        'moqueta': 'moqueta',
        'moquetas': 'moqueta',
        'cesped': 'césped artificial',
        'césped': 'césped artificial',
        'cesped artificial': 'césped artificial',
        'césped artificial': 'césped artificial',
        'fachada': 'fachada',
        'fachadas': 'fachada',
        'accesorios': 'accesorios',
        'revestimiento': 'revestimiento vinílico mural',
        'revestimientos': 'revestimiento vinílico mural',
        'mural': 'revestimiento vinílico mural'
      };
      
      categories.forEach(item => {
        const category = item.categoria.toLowerCase();
        let score = 0;
        
        // 1. COINCIDENCIA EXACTA (máxima prioridad)
        if (cleanQuery === category) {
          score = 1.0;
          console.log('🎯 Coincidencia EXACTA:', category);
        }
        // 2. BÚSQUEDA POR PALABRAS CLAVE
        else {
          for (const [keyword, targetCategories] of Object.entries(searchKeywords)) {
            if (cleanQuery.includes(keyword)) {
              const targetArray = Array.isArray(targetCategories) ? targetCategories : [targetCategories];
              
              if (targetArray.includes(category)) {
                score = 0.9;
                console.log(`✅ Palabra clave "${keyword}" → ${category}`);
                break;
              }
            }
          }
        }
        
        // 3. COINCIDENCIA PARCIAL (solo si no hay mejor opción)
        if (score === 0) {
          const queryWords = cleanQuery.split(/\s+/).filter(word => word.length > 3);
          const categoryWords = category.split(/\s+/);
          
          const matchingWords = queryWords.filter(qWord => 
            categoryWords.some(cWord => cWord.includes(qWord))
          );
          
          if (matchingWords.length > 0) {
            score = 0.5 + (matchingWords.length * 0.1);
            console.log(`🔄 Coincidencia parcial: ${matchingWords.join(', ')} → ${category}`);
          }
        }
        
        if (score >= 0.6) {
          matches.push({ ...item, score });
        }
      });
      
      console.log(`📊 Resultados para "${cleanQuery}":`, matches);
      return matches.sort((a, b) => b.score - a.score);
    };

    const matches = findSmartMatches(userMessage, rows);

    let reply = "";

    // SIEMPRE usar nuestro sistema de enlaces - NO OpenAI para categorías conocidas
    if (matches.length > 0) {
      const bestMatches = matches.filter(m => m.score >= 0.7);
      
      if (bestMatches.length === 1) {
        const match = bestMatches[0];
        reply = `Perfecto, te interesan los **${match.categoria}**. Puedes ver nuestro catálogo completo aquí: [Ver catálogo de ${match.categoria}](${match.link})`;
      }
      else if (bestMatches.length > 1) {
        // Agrupar por tipo de producto
        const hasTarimas = bestMatches.some(m => m.categoria.includes('tarima'));
        const hasVinilicos = bestMatches.some(m => m.categoria.includes('vinílico'));
        
        if (hasTarimas) {
          reply = `Tenemos **varias opciones de tarima exterior**:\n\n` +
            bestMatches.map(match => 
              `• **${match.categoria}** - [Ver catálogo](${match.link})`
            ).join('\n') +
            `\n\n¿Te interesa alguna en particular?`;
        }
        else if (hasVinilicos) {
          reply = `Tenemos **varias opciones de suelos vinílicos**:\n\n` +
            bestMatches.map(match => 
              `• **${match.categoria}** - [Ver catálogo](${match.link})`
            ).join('\n') +
            `\n\n¿Te interesa alguna en particular?`;
        }
        else {
          reply = `He encontrado estas opciones relacionadas con "${message}":\n\n` +
            bestMatches.map(match => 
              `• **${match.categoria}** - [Ver catálogo](${match.link})`
            ).join('\n') +
            `\n\n¿Te interesa alguna en particular?`;
        }
      }
      else {
        // Coincidencias débiles - usar la mejor
        const topMatch = matches[0];
        reply = `¿Te refieres a **${topMatch.categoria}**? Puedes ver nuestro catálogo aquí: [Ver catálogo](${topMatch.link})`;
      }
    } else {
      // SOLO usar OpenAI cuando realmente no hay coincidencias
      const availableCategories = rows.map(r => r.categoria).join(', ');
      
      const prompt = `Eres IAGreeView, asistente de Distiplas. 

CATEGORÍAS DISPONIBLES: ${availableCategories}

INSTRUCCIONES:
- Si el usuario pregunta por "suelos laminados", di que SÍ tenemos y ofrece el enlace
- Si pregunta por "tarima" o "bambú", ofrece las tarimas disponibles
- Si pregunta por algo que NO está en las categorías, sugiere el catálogo general
- NUNCA digas que no tenemos algo que sí está en las categorías listadas

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
          max_tokens: 200,
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
