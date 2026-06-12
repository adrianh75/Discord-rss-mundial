const https = require('https');

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const FOOTBALL_API_URL = 'https://worldcupjson.net/matches/today';

function getFlagByCode(countryCode) {
  if (!countryCode || countryCode.length !== 2) return "⚽";
  const codePoints = countryCode.toUpperCase().split('').map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

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
      resolve();
    });

    req.on('error', (e) => { reject(e); });
    req.write(data);
    req.end();
  });
}

async function main() {
  console.log("📡 Consultando agenda de hoy para auditoría...");
  
  try {
    const matches = await fetchTodayMatches() || [];
    
    console.log(`--- LISTA DE PARTIDOS REGISTRADOS HOY (${matches.length}) ---`);
    matches.forEach(m => {
      console.log(`⚽ Encuentro: ${m.home_team?.name} vs ${m.away_team?.name} | Estado API: "${m.status}" | Time: "${m.time}"`);
    });
    console.log("-----------------------------------------------------");

    // Filtro ultra flexible: buscamos cualquier estado que no sea 'future' o 'completed'
    const liveMatches = matches.filter(match => {
      const status = String(match.status).toLowerCase().trim();
      return status !== 'future' && status !== 'completed' && status !== 'null';
    });

    console.log(`Partidos que pasaron el filtro en vivo: ${liveMatches.length}`);

    if (liveMatches.length === 0) {
      console.log("📭 Ningún partido coincide con un estado activo en este minuto.");
      return;
    }

    for (const match of liveMatches) {
      const homeTeam = match.home_team?.name || "Local";
      const awayTeam = match.away_team?.name || "Visitante";
      const currentScore = `${match.home_team?.goals || 0} - ${match.away_team?.goals || 0}`;
      const minute = match.time || "En juego";
      
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
      console.log(`✅ Tarjeta enviada con éxito para: ${homeTeam} vs ${awayTeam}`);
    }

  } catch (err) {
    console.error("❌ Error crítico en el script:", err.message);
  }
}

main();
