const https = require('https');

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

// Convierte códigos ISO de 2 letras en emojis de banderas
function getFlagByCode(countryCode) {
  if (!countryCode || countryCode.length !== 2) return "⚽";
  const codePoints = countryCode.toUpperCase().split('').map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

// Función para enviar datos a Discord de manera síncrona/promesa
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
      console.error(`Error de red en el webhook: ${e.message}`);
      reject(e);
    });

    req.write(data);
    req.end();
  });
}

async function main() {
  console.log("🚀 Lanzando pasarela directa en vivo para Corea vs Chequia...");

  const flagHome = getFlagByCode("KR");
  const flagAway = getFlagByCode("CZ");

  const embedPayload = {
    username: "Mundial 2026",
    embeds: [{
      title: "⚽ ¡PARTIDO EN VIVO EN EL MUNDIAL!",
      description: "**Fase de Grupos • Grupo B**",
      color: 15158332, // Rojo estético
      fields: [
        {
          name: "Encuentro",
          value: `${flagHome} **Republic of Korea** vs. **Czech Republic** ${flagAway}`,
          inline: false
        },
        { name: "Marcador", value: "**0 - 0**", inline: true }, 
        { name: "Minuto", value: "⏱️ **En Juego**", inline: true }
      ],
      timestamp: new Date()
    }]
  };

  try {
    // Aseguramos que el hilo espere la confirmación de Discord
    await sendWebhook(embedPayload);
    console.log("✅ ¡Tarjeta enviada con éxito desde Node.js!");
  } catch (err) {
    console.error("❌ Falló el envío del embed:", err.message);
  }
}

main();
