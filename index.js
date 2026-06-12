const https = require('https');

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

function getFlagByCode(countryCode) {
  if (!countryCode || countryCode.length !== 2) return "⚽";
  const codePoints = countryCode.toUpperCase().split('').map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
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
      console.log(`Respuesta de Discord: ${res.statusCode}`);
      resolve();
    });

    req.on('error', (e) => {
      console.error(`Error en la petición: ${e.message}`);
      reject(e);
    });

    req.write(data);
    req.end();
  });
}

async function main() {
  console.log("🚀 Iniciando envío forzado de tarjeta del Mundial...");

  const flagHome = getFlagByCode("MX");
  const flagAway = getFlagByCode("ZA");

  const embedPayload = {
    username: "Mundial 2026",
    embeds: [{
      title: "⚽ ¡PARTIDO EN VIVO EN EL MUNDIAL!",
      description: "**Fase de Grupos • Grupo A**",
      color: 15158332, // Rojo estético
      fields: [
        {
          name: "Encuentro",
          value: `${flagHome} **Mexico** vs. **South Africa** ${flagAway}`,
          inline: false
        },
        { name: "Marcador", value: "**1 - 0**", inline: true },
        { name: "Minuto", value: "⏱️ **45'**", inline: true }
      ],
      timestamp: new Date()
    }]
  };

  try {
    // Forzamos el await para que Node no cierre la Action antes de tiempo
    await sendWebhook(embedPayload);
    console.log("✅ ¡Tarjeta enviada con éxito desde Node.js!");
  } catch (err) {
    console.error("❌ Falló el envío del embed:", err.message);
  }
}

main();
