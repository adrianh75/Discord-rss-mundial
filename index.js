const axios = require('axios');
const fs = require('fs');
const path = require('path');

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const FIFA_API_URL = 'https://givevoicetofootball.fifa.com/api/v1/live/football'; 
const STATE_FILE = path.join(__dirname, 'match_state.json');

// Convierte códigos ISO de 2 letras (ej: "CR", "MX") en emojis de banderas
function getFlagByCode(countryCode) {
  if (!countryCode || countryCode.length !== 2) return "⚽";
  const codePoints = countryCode.toUpperCase().split('').map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

async function runSnapshot() {
  let lastState = {};
  if (fs.existsSync(STATE_FILE)) {
    lastState = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  }

  try {
    const response = await axios.get(FIFA_API_URL);
    const matches = response.data.matches || [];
    let stateChanged = false;

    for (const match of matches) {
      const matchId = match.idMatch;
      const homeTeam = match.homeTeam.name;
      const awayTeam = match.awayTeam.name;
      const currentScore = `${match.homeTeam.score}-${match.awayTeam.score}`;
      const status = match.status; 
      const minute = match.matchMinute || "0'";

      const stateKey = `${matchId}_score`;
      const statusKey = `${matchId}_status`;

      // 1. Alerta de GOAL
      if (lastState[stateKey] && lastState[stateKey] !== currentScore && status === "Live") {
        await sendDiscordEmbed({
          title: "⚽ ¡GOOOOL EN EL MUNDIAL!",
          color: 15158332, // Rojo
          homeTeam, awayTeam, score: currentScore, minute,
          homeCode: match.homeTeam.countryCode, awayCode: match.awayTeam.countryCode,
          stage: match.stageName || "Fase de Grupos"
        });
        lastState[stateKey] = currentScore;
        stateChanged = true;
      } 
      else if (!lastState[stateKey]) {
        lastState[stateKey] = currentScore;
        lastState[statusKey] = status;
        stateChanged = true;
      }

      // 2. Alerta de Fin del Partido
      if (lastState[statusKey] && lastState[statusKey] !== "Finished" && status === "Finished") {
        await sendDiscordEmbed({
          title: "🏁 PARTIDO FINALIZADO",
          color: 3066993, // Verde
          homeTeam, awayTeam, score: currentScore, minute: "90'",
          homeCode: match.homeTeam.countryCode, awayCode: match.awayTeam.countryCode,
          stage: match.stageName || "Fase de Grupos"
        });
        lastState[statusKey] = "Finished";
        stateChanged = true;
      }
    }

    if (stateChanged) {
      fs.writeFileSync(STATE_FILE, JSON.stringify(lastState, null, 2));
    }
  } catch (error) {
    console.error("Error procesando los partidos:", error.message);
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
  // Ejecuta 3 ráfagas internas espaciadas por 20 segundos para simular tiempo real continuo
  await runSnapshot();
  await new Promise(resolve => setTimeout(resolve, 20000));
  await runSnapshot();
  await new Promise(resolve => setTimeout(resolve, 20000));
  await runSnapshot();
}

main();
