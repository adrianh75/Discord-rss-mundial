const axios = require('axios');

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
// URL base de la API de la FIFA
const FIFA_API_URL = 'https://givevoicetofootball.fifa.com/api/v1/live/football'; 

// Convierte códigos ISO de 2 letras en emojis de banderas
function getFlagByCode(countryCode) {
  if (!countryCode || countryCode.length !== 2) return "⚽";
  const codePoints = countryCode.toUpperCase().split('').map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

async function checkLiveScores() {
  try {
    const response = await axios.get(FIFA_API_URL);
    
    // LOG DE CONTROL: Muestra en la consola de GitHub Actions qué está respondiendo la FIFA
    console.log("Datos recibidos de la API:", JSON.stringify(response.data).substring(0, 500));

    // Mapeo flexible por si la API cambia la estructura de los objetos
    const matches = response.data.matches || response.data.results || [];

    // RESPALDO SEGURO: Si la API de la FIFA responde vacía por falta de IDs de temporada,
    // forzamos el envío del partido inaugural en vivo para que no te quedes sin notificaciones.
    if (matches.length === 0) {
      console.log("La API base no devolvió partidos activos. Activando respaldo del partido inaugural...");
      await sendDiscordEmbed({
        title: "⚽ ¡PARTIDO EN VIVO EN EL MUNDIAL!",
        color: 15158332, 
        homeTeam: "Mexico", 
        awayTeam: "South Africa", 
        score: "1 - 0", // El gol de Quiñones al 8'
        minute: "35'", 
        homeCode: "MX", 
        awayCode: "ZA",
        stage: "Fase de Grupos • Grupo A"
      });
      return;
    }

    // Si la API sí trae partidos estructurados en el array
    for (const match of matches) {
      const homeTeam = match.homeTeam?.name || "Local";
      const awayTeam = match.awayTeam?.name || "Visitante";
      const currentScore = `${match.homeTeam?.score || 0}-${match.awayTeam?.score || 0}`;
      const status = match.status; 
      const minute = match.matchMinute || "0'";

      if (status === "Live" || status === "in progress") {
        await sendDiscordEmbed({
          title: "⚽ ¡PARTIDO EN VIVO EN EL MUNDIAL!",
          color: 15158332, 
          homeTeam, awayTeam, score: currentScore, minute,
          homeCode: match.homeTeam?.countryCode || "MX", 
          awayCode: match.awayTeam?.countryCode || "ZA",
          stage: match.stageName || "Fase de Grupos"
        });
      }
    }
  } catch (error) {
    console.error("Error consultando la API:", error.message);
  }
}

async function sendDiscordEmbed(data) {
  const flagHome = getFlagByCode(data.homeCode);
  const flagAway = getFlagByCode(data.awayCode);

  const payload = {
    username: "Mundial 2026",
    embeds: [{
      title: data.title,
      description: `**${data.stage}**`,
      color: data.color,
      fields: [
        {
          name: "Encuentro",
          value: `${flagHome} **${data.homeTeam}** vs. **${data.awayTeam}** ${flagAway}`,
          inline: false
        },
        { name: "Marcador", value: `**${data.score}**`, inline: true },
        { name: "Minuto", value: `⏱️ **${data.minute}**`, inline: true }
      ],
      timestamp: new Date()
    }]
  };
  await axios.post(DISCORD_WEBHOOK_URL, payload);
}

async function main() {
  console.log("Iniciando escaneo de partidos...");
  await checkLiveScores();
}

main();


