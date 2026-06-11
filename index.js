const axios = require('axios');

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
// Endpoint de la FIFA (Asegúrate de tener el ID correcto del torneo actual)
const FIFA_API_URL = 'https://givevoicetofootball.fifa.com/api/v1/live/football'; 

function getFlagByCode(countryCode) {
  if (!countryCode || countryCode.length !== 2) return "⚽";
  const codePoints = countryCode.toUpperCase().split('').map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

async function checkLiveScores() {
  try {
    const response = await axios.get(FIFA_API_URL);
    const matches = response.data.matches || [];

    for (const match of matches) {
      const homeTeam = match.homeTeam.name;
      const awayTeam = match.awayTeam.name;
      const currentScore = `${match.homeTeam.score}-${match.awayTeam.score}`;
      const status = match.status; 
      const minute = match.matchMinute || "0'";

      // Si hay un partido en vivo, enviamos el estado actual al canal
      if (status === "Live") {
        await sendDiscordEmbed({
          title: "⚽ ¡PARTIDO EN VIVO EN EL MUNDIAL!",
          color: 15158332, 
          homeTeam, awayTeam, score: currentScore, minute,
          homeCode: match.homeTeam.countryCode, awayCode: match.awayTeam.countryCode,
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
  // Monitorea ráfagas rápidas durante este minuto
  await checkLiveScores();
  await new Promise(resolve => setTimeout(resolve, 25000));
  await checkLiveScores();
}

main();
