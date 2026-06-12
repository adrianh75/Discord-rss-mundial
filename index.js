const https = require('https');

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
// Cambiamos al endpoint de todo el día para evitar desfases de caché
const FOOTBALL_API_URL = 'https://worldcupjson.net/matches/today';

// Convierte códigos ISO de 2 letras en emojis de banderas
function getFlagByCode(countryCode) {
  if (!countryCode || countryCode.length !== 2) return "⚽";
  const codePoints = countryCode.toUpperCase().split('').map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

// Función auxiliar para hacer peticiones GET asíncronas
function fetchTodayMatches() {
  return new Promise((resolve, reject) => {
    https.get(FOOTBALL_API_URL, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error("Error parseando el JSON de la API"));
        }
      });
    }).on('error', (err) => { reject(err); });
  });
}

// Función auxiliar para enviar datos a Discord
function sendWebhook(payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const url = new URL(DISCORD_WEBHOOK_URL);

    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = https.request(options, (res) => {
      console.log(`Respuesta de Discord: ${res.statusCode}`);
      resolve();
    });

    req.on('error', (e) => { reject(e); });
    req.write(data);
    req.end();
  });
}

async function main() {
  console.log("📡 Consultando la agenda de partidos de hoy...");
  
  try {
    const matches = await fetchTodayMatches() || [];
    
    // Filtramos ÚNICAMENTE los partidos que estén activamente en juego (en vivo o entretiempo)
    const liveMatches = matches.filter(match => 
      match.status === 'in_progress' || 
      match.status === 'live'
    );

    console.log(`Partidos en vivo detectados hoy: ${liveMatches.length}`);

    if (liveMatches.length === 0) {
      console.log("📭 No hay partidos en juego en este momento. Terminando ejecución.");
      return;
    }

    // Procesar cada partido que esté corriendo en vivo
    for (const match of liveMatches) {
      const homeTeam = match.home_team?.name || "Local";
      const awayTeam = match.away_team?.name || "Visitante";
      const currentScore = `${match.home_team?.goals || 0} - ${match.away_team?.goals || 0}`;
      
      // Si la API no tiene el minuto exacto, ponemos un texto amigable
      const minute = match.time ? `${match.time}` : "En juego";
      
      // Extraemos códigos de país (ej: KR, CZ)
      const homeCode = match.home_team?.country || "⚽";
      const awayCode = match.away_team?.country || "⚽";
      const stage = match.stage_name || "Fase de Grupos";

      const flagHome = getFlagByCode(homeCode);
      const flagAway = getFlagByCode(awayCode);

      const embedPayload = {
        username: "Mundial 2026",
        embeds: [{
          title: "⚽ ¡PARTIDO EN VIVO EN EL MUNDIAL!",
          description: `**${stage}**`,
          color: 15158332,
          fields: [
            {
              name: "Encuentro",
              value: `${flagHome} **${homeTeam}** vs. **${awayTeam}** ${flagAway}`,
              inline: false
            },
            { name: "Marcador", value: `**${currentScore}**`, inline: true },
            { name: "Minuto", value: `⏱️ **${minute}**`, inline: true }
          ],
          timestamp: new Date()
        }]
      };

      await sendWebhook(embedPayload);
      console.log(`✅ Tarjeta enviada: ${homeTeam} vs ${awayTeam}`);
    }

  } catch (err) {
    console.error("❌ Error crítico en el flujo de automatización:", err.message);
  }
}

main();
