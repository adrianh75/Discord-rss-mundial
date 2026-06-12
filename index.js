const https = require('https');

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
// Endpoint dinámico que incluye el desglose de eventos en tiempo real
const LIVE_API_URL = 'https://worldcup-json-2026.vercel.app/api/current';

function getFlagByCode(countryCode) {
  if (!countryCode || countryCode.length !== 2) return "⚽";
  const codePoints = countryCode.toUpperCase().split('').map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

function fetchScores() {
  return new Promise((resolve) => {
    https.get(LIVE_API_URL, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { resolve(null); }
      });
    }).on('error', () => { resolve(null); });
  });
}

function sendWebhook(payload) {
  return new Promise((resolve) => {
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
    const req = https.request(options, () => { resolve(); });
    req.on('error', () => { resolve(); });
    req.write(data);
    req.end();
  });
}

async function main() {
  console.log("📡 Escaneando eventos del Mundial en tiempo real...");
  const apiData = await fetchScores();

  if (!apiData || !apiData.matches || apiData.matches.length === 0) {
    console.log("📭 No hay partidos reportados por la API en este instante.");
    return;
  }

  // Buscamos cualquier partido activo en la jornada
  for (const match of apiData.matches) {
    const status = match.status?.toLowerCase() || '';
    const homeTeam = match.home_team?.name || "Local";
    const awayTeam = match.away_team?.name || "Visitante";
    const score = `${match.home_team?.goals || 0} - ${match.away_team?.goals || 0}`;
    const minute = match.time || "En Juego";
    
    const homeCode = match.home_team?.country || "⚽";
    const awayCode = match.away_team?.country || "⚽";
    const stage = match.stage_name || "Fase de Grupos";

    // Detectar si hubo un gol en la última ventana de 5 minutos
    // La API mapea los eventos recientes en un array; verificamos el último minuto de gol registrado
    const lastEventMinute = match.last_goal_minute || 0;
    const currentMatchMinute = parseInt(minute.replace(/[^0-9]/g, '')) || 0;
    
    // Margen de tiempo para saber si el gol acaba de pasar dentro del ciclo del cron (5 min)
    const isNewGoal = currentMatchMinute > 0 && lastEventMinute > 0 && (currentMatchMinute - lastEventMinute <= 5);
    const isFullTime = status === 'completed' || status === 'full_time' || status === 'finalizado';

    // CONDICIÓN CRÍTICA: Solo notificamos si acaba de caer un gol o si el partido terminó
    if (isNewGoal || isFullTime) {
      let title = "⚽ ¡GOOOOOL EN EL MUNDIAL!";
      let color = 3066993; // Verde para goles

      if (isFullTime) {
        title = "🏁 ¡RESULTADO FINAL DEL PARTIDO!";
        color = 15158332; // Rojo/Gris oscuro para el cierre del encuentro
      }

      const embedPayload = {
        username: "Mundial 2026",
        embeds: [{
          title: title,
          description: `**${stage}**`,
          color: color,
          fields: [
            {
              name: "Encuentro",
              value: `${getFlagByCode(homeCode)} **${homeTeam}** vs. **${awayTeam}** ${getFlagByCode(awayCode)}`,
              inline: false
            },
            { name: "Marcador Actual", value: `**${score}**`, inline: true },
            { name: "Minuto", value: isFullTime ? "⏱️ **Fin del Partido**" : `⏱️ **${minute}**`, inline: true }
          ],
          timestamp: new Date()
        }]
      };

      await sendWebhook(embedPayload);
      console.log(`✅ Notificación enviada con éxito para ${homeTeam} vs ${awayTeam}`);
    } else {
      console.log(`🤫 El partido ${homeTeam} vs ${awayTeam} sigue en curso (${score}), pero no se registran goles nuevos en este ciclo.`);
    }
  }
}

main();
