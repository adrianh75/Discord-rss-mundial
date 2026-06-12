const https = require('https');

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const FOOTBALL_API_URL = 'https://worldcupjson.net/matches/current';

// Convierte códigos ISO de 2 letras en emojis de banderas
function getFlagByCode(countryCode) {
  if (!countryCode || countryCode.length !== 2) return "⚽";
  const codePoints = countryCode.toUpperCase().split('').map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

// Función auxiliar para hacer peticiones GET asíncronas
function fetchLiveMatches() {
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
  console.log("📡 Consultando partidos en vivo en la API...");
  
  try {
    const matches = await fetchLiveMatches() || [];
    console.log(`Partidos en vivo detectados actualmente: ${matches.length}`);

    if (matches.length === 0) {
      console.log("📭 No hay partidos 'Live' en este momento. Terminando ejecución silenciosamente.");
      return;
    }

    // Procesar cada partido que la API reporte como activo
    for (const match of matches) {
      const homeTeam = match.home_team?.name || "Local";
      const awayTeam = match.away_team?.name || "Visitante";
      const currentScore = `${match.home_team?.goals || 0} - ${match.away_team?.goals || 0}`;
      const minute = match.time || "En juego";
      
      // Intentar extraer los códigos de país de la API (usa códigos de 2 letras como MX, ZA, CR)
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
          color: 15158332, // Rojo estético
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
      console.log(`✅ Tarjeta enviada para el encuentro: ${homeTeam} vs ${awayTeam}`);
    }

  } catch (err) {
    console.error("❌ Error crítico en el flujo de automatización:", err.message);
  }
}

main();
