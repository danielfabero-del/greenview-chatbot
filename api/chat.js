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
    // 🔧 DETECCIÓN DE CITA (SOLO ESTA PARTE NUEVA)
    const detectarCita = (text) => {
      const palabrasCita = ['cita', 'agendar', 'reservar', 'disponibilidad', 'horario', 'reunión', 'consulta', 'visita', 'asesoría', 'agenda'];
      return palabrasCita.some(palabra => text.toLowerCase().includes(palabra));
    };

    if (detectarCita(message)) {
      return res.status(200).json({ 
        reply: `¡Perfecto! Veo que quieres agendar una cita. 

Para coordinar tu visita o asesoría, por favor proporciona:
📅 **Fecha** que te conviene  
⏰ **Horario** preferido  
📋 **Breve descripción** de lo que necesitas

Ejemplo: "Quiero cita para el 15 de diciembre a las 10:00 para ver suelos laminados"

¿Qué fecha y hora te viene bien?`
      });
    }

    // ✅ TU CÓDIGO ORIGINAL (TODO IGUAL)
    const SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQlxUuVr4XYbPHeIQwI1eQNDnDskBii1PoXwb2F3jry-q4bNcBI8niVnALh4epc5y_4zPEXVTAx0IO_/pub?output=csv";

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

    const userMessage = message.toLowerCase().trim();

    const findMatches = (query, categories) => {
      const matches = [];
      
      const cleanQuery = query.replace(/[¿?]/g, '').trim();
      
      categories.forEach(item => {
        const category = item.categoria.toLowerCase();
        
        if (cleanQuery === category) {
          matches.push({ ...item, score: 1.0 });
        }
        else if (category.includes(cleanQuery)) {
          matches.push({ ...item, score: 0.9 });
        }
        else if (cleanQuery.includes(category)) {
          matches.push({ ...item, score: 0.8 });
        }
      });

      if (matches.length === 0) {
        const searchWords = cleanQuery.split(/\s+/).filter(word => word.length > 3);
        
        categories.forEach(item => {
          const category = item.categoria.toLowerCase();
          let score = 0;
          
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

    const goodMatches = matches.filter(m => m.score >= 0.5);
    
    if (goodMatches.length > 0) {
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
