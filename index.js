require("dotenv").config();
const { Client, GatewayIntentBits } = require("discord.js");
const fs = require("fs");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

// ===== CONFIG =====
const RANKING_CHANNEL_ID = "1432538893688766524";
const LOG_CHANNEL_ID = "1375543232531791885";

const ROL_PERMITIDO = "1474278992914944114";
const ROL_BASE = "1378460820962414734";
const ROL_60 = "1398839663443050536";
const ROL_100 = "1371890352146878665";
// ===================

let puntos = {};
let rankingMessageID = null;
let bienvenidas = {};

if (fs.existsSync("./puntos.json")) {
  puntos = JSON.parse(fs.readFileSync("./puntos.json"));
}

function guardarPuntos() {
  fs.writeFileSync("./puntos.json", JSON.stringify(puntos, null, 2));
}

async function actualizarRoles(member) {
  const pts = puntos[member.id] || 0;

  if (pts >= 100) await member.roles.add(ROL_100).catch(() => {});
  if (pts >= 60) await member.roles.add(ROL_60).catch(() => {});
}

async function actualizarRanking(guild) {
  const canal = guild.channels.cache.get(RANKING_CHANNEL_ID);
  if (!canal) return;

  const ranking = Object.entries(puntos)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 100);

  let descripcion = "No hay puntos aún.";

  if (ranking.length > 0) {
    descripcion = ranking.map((u, i) => {
      let icono;

      if (i === 0) icono = "👑";
      else if (i === 1) icono = "🥈";
      else if (i === 2) icono = "🥉";
      else if (i <= 5) icono = "🏅";
      else icono = "🎖";

      return `${icono} **${i + 1}.** <@${u[0]}> — ${u[1]} pts`;
    }).join("\n");
  }

  const embed = {
    title: "🏆 Ranking Oficial",
    description: descripcion,
    color: 0xFFD700
  };

  try {
    if (rankingMessageID) {
      const msg = await canal.messages.fetch(rankingMessageID);
      await msg.edit({ embeds: [embed] });
    } else {
      const nuevo = await canal.send({ embeds: [embed] });
      rankingMessageID = nuevo.id;
    }
  } catch {
    const nuevo = await canal.send({ embeds: [embed] });
    rankingMessageID = nuevo.id;
  }
}

client.on("messageCreate", async message => {
  if (message.author.bot) return;
  if (!message.member) return;

  const member = message.member;
  const contenido = message.content.toLowerCase();

  // ===== BIENVENIDA AUTOMÁTICA =====
  if (
    (contenido.includes("bienvenida") ||
     contenido.includes("bienvenido") ||
     contenido.includes("welcome")) &&
    member.roles.cache.has(ROL_BASE)
  ) {
    const mencionado = message.mentions.users.first();
    if (!mencionado) return;

    if (!bienvenidas[mencionado.id]) {
      bienvenidas[mencionado.id] = message.author.id;

      puntos[message.author.id] = (puntos[message.author.id] || 0) + 2;
      guardarPuntos();

      await actualizarRoles(member);
      await actualizarRanking(message.guild);

      const log = message.guild.channels.cache.get(LOG_CHANNEL_ID);
      if (log) log.send(`🎉 ${message.author.tag} ganó 2 puntos por dar la bienvenida primero.`);

      message.reply("🎉 Ganaste 2 puntos por ser el primero en dar la bienvenida.");
    } else {
      const primero = bienvenidas[mencionado.id];
      message.reply(`⚠️ Ya le dieron la bienvenida. El punto fue para <@${primero}>.`);
    }
  }

  // ===== COMANDOS =====
  if (!message.content.startsWith("!")) return;

  const args = message.content.slice(1).split(" ");
  const comando = args.shift().toLowerCase();

  // ===== !puntos =====
  if (comando === "puntos") {
    const usuario = message.mentions.users.first() || message.author;
    const pts = puntos[usuario.id] || 0;
    return message.channel.send(`📊 ${usuario.username} tiene **${pts} puntos**.`);
  }

  // ===== !top =====
  if (comando === "top") {
    return actualizarRanking(message.guild);
  }

  // ===== SOLO ROL PERMITIDO =====
  if (!member.roles.cache.has(ROL_PERMITIDO)) {
    return message.reply("❌ No tienes permiso para usar comandos de puntos.");
  }

  // ===== !sumar =====
  if (comando === "sumar") {
    const usuario = message.mentions.users.first();
    const cantidad = parseInt(args[1]);
    if (!usuario || isNaN(cantidad)) return;

    puntos[usuario.id] = (puntos[usuario.id] || 0) + cantidad;
    guardarPuntos();

    const miembro = await message.guild.members.fetch(usuario.id);
    await actualizarRoles(miembro);
    await actualizarRanking(message.guild);

    const log = message.guild.channels.cache.get(LOG_CHANNEL_ID);
    if (log) log.send(`➕ ${member.user.tag} sumó ${cantidad} pts a ${usuario.tag}`);

    message.channel.send(`➕ ${cantidad} puntos agregados.`);
  }

  // ===== !restar =====
  if (comando === "restar") {
    const usuario = message.mentions.users.first();
    const cantidad = parseInt(args[1]);
    if (!usuario || isNaN(cantidad)) return;

    puntos[usuario.id] = (puntos[usuario.id] || 0) - cantidad;
    guardarPuntos();

    await actualizarRanking(message.guild);

    const log = message.guild.channels.cache.get(LOG_CHANNEL_ID);
    if (log) log.send(`➖ ${member.user.tag} restó ${cantidad} pts a ${usuario.tag}`);

    message.channel.send(`➖ ${cantidad} puntos restados.`);
  }
});

client.on("ready", () => {
  console.log(`Bot listo como ${client.user.tag}`);
});

client.login(process.env.TOKEN);