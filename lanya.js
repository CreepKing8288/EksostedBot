const express = require('express');
const session = require('express-session');
const path = require('path');
const crypto = require('crypto');
const app = express();
app.set('trust proxy', 1);

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const DISCORD_BOT_TOKEN = process.env.DISCORD_TOKEN;
const DASHBOARD_PORT = process.env.DASHBOARD_PORT || process.env.PORT || 3000;
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || `http://localhost:${DASHBOARD_PORT}/auth/callback`;
const sessionSecret = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'dashboard', 'public')));
app.use(session({
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 7 * 24 * 60 * 60 * 1000 },
}));

const requireAuth = (req, res, next) => {
  if (!req.session.user) return res.status(401).json({ error: 'Not authenticated' });
  next();
};

app.get('/auth/login', (req, res) => {
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: DISCORD_REDIRECT_URI,
    response_type: 'code',
    scope: 'identify guilds',
  });
  res.redirect(`https://discord.com/api/oauth2/authorize?${params}`);
});

app.get('/auth/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.redirect('/');

  try {
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: DISCORD_REDIRECT_URI,
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error('Token exchange failed:', tokenRes.status, errText);
      return res.status(500).send(`Token exchange failed: ${errText}`);
    }
    const tokens = await tokenRes.json();

    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!userRes.ok) {
      console.error('Failed to fetch user:', userRes.status);
      return res.status(500).send('Failed to fetch user');
    }
    const user = await userRes.json();

    const guildsRes = await fetch('https://discord.com/api/users/@me/guilds', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!guildsRes.ok) {
      console.error('Failed to fetch guilds:', guildsRes.status);
      return res.status(500).send('Failed to fetch guilds');
    }
    const guilds = await guildsRes.json();

    if (!Array.isArray(guilds)) {
      console.error('Guilds is not an array:', guilds);
      return res.status(500).send('Invalid guilds response');
    }

    const botGuildsRes = await fetch('https://discord.com/api/users/@me/guilds', {
      headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` },
    });
    const botGuilds = botGuildsRes.ok ? await botGuildsRes.json() : [];
    const botGuildIds = new Set(botGuilds.map(bg => bg.id));

    req.session.user = {
      id: user.id,
      username: user.username,
      discriminator: user.discriminator,
      avatar: user.avatar,
      guilds: guilds.filter(g => {
        const hasManageGuild = (BigInt(g.permissions) & 0x8n) === 0x8n;
        return hasManageGuild && botGuildIds.has(g.id);
      }),
    };

    res.redirect('/dashboard');
  } catch (err) {
    console.error('OAuth error:', err.message, err.stack);
    res.status(500).send(`OAuth error: ${err.message}`);
  }
});

app.get('/auth/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

app.get('/api/user', requireAuth, (req, res) => {
  res.json(req.session.user);
});

app.get('/api/guilds', requireAuth, (req, res) => {
  res.json(req.session.user.guilds);
});

app.get('/api/guild/:guildId/configs', requireAuth, async (req, res) => {
  try {
    const configs = {};
    const guildId = req.params.guildId;

    const modelsWithGuildId = [
      'SwearFilter', 'AntiSpam', 'LinkFilter', 'Starboard',
      'CrateConfig', 'TicketSettings', 'AFK',
      'AIChatConfig', 'ProtectionSettings', 'serverlogs',
      'ButtonRole', 'ServerStatus',
    ];

    for (const modelName of modelsWithGuildId) {
      try {
        const Model = require(`./models/${modelName}`);
        const data = await Model.findOne({ guildId });
        configs[modelName] = data;
      } catch {
        configs[modelName] = null;
      }
    }

    try {
      const AutoRole = require('./models/AutoRoles');
      configs.AutoRole = await AutoRole.findOne({ $or: [{ guildId }, { serverId: guildId }] });
    } catch {
      configs.AutoRole = null;
    }

    try {
      const Welcome = require('./models/welcome');
      configs.welcome = await Welcome.findOne({ $or: [{ guildId }, { serverId: guildId }] });
    } catch {
      configs.welcome = null;
    }

    try {
      const { GuildSettings } = require('./models/Level');
      configs.Level = await GuildSettings.findOne({ guildId });
    } catch {
      configs.Level = null;
    }

    res.json(configs);
  } catch (err) {
    console.error('Error fetching configs:', err);
    res.status(500).json({ error: 'Failed to fetch configs' });
  }
});

app.post('/api/guild/:guildId/config/:model', requireAuth, async (req, res) => {
  try {
    let Model;
    let query;

    if (req.params.model === 'Level') {
      Model = require('./models/Level').GuildSettings;
      query = { guildId: req.params.guildId };
    } else if (req.params.model === 'ServerLog') {
      Model = require('./models/serverlogs');
      query = { guildId: req.params.guildId };
    } else if (req.params.model === 'AutoRole') {
      Model = require('./models/AutoRoles');
      query = { $or: [{ guildId: req.params.guildId }, { serverId: req.params.guildId }] };
    } else if (req.params.model === 'Welcome') {
      Model = require('./models/welcome');
      query = { $or: [{ guildId: req.params.guildId }, { serverId: req.params.guildId }] };
    } else if (req.params.model === 'ButtonRole') {
      Model = require('./models/ButtonRole');
      query = { guildId: req.params.guildId };
    } else if (req.params.model === 'ServerStatus') {
      Model = require('./models/ServerStatus');
      query = { guildId: req.params.guildId };
    } else {
      Model = require(`./models/${req.params.model}`);
      query = { guildId: req.params.guildId };
    }

    const data = await Model.findOneAndUpdate(
      query,
      { $set: req.body },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json(data);
  } catch (err) {
    console.error('Error saving config:', err);
    res.status(500).json({ error: 'Failed to save config' });
  }
});

app.get('/api/guild/:guildId/leaderboard', requireAuth, async (req, res) => {
  try {
    const { MemberData } = require('./models/Level');
    const type = req.query.type || 'level';
    const sortField = type === 'vc' ? 'voiceSeconds' : 'totalXp';

    const top = await MemberData.find({ guildId: req.params.guildId })
      .sort({ [sortField]: -1 })
      .limit(25);

    const leaderboard = top.map((m, i) => ({
      rank: i + 1,
      userId: m.userId,
      username: `User ${m.userId}`,
      avatar: null,
      level: m.level,
      xp: m.xp,
      totalXp: m.totalXp,
      voiceXp: m.voiceXp,
      voiceSeconds: m.voiceSeconds,
    }));

    res.json(leaderboard);
  } catch (err) {
    console.error('Error fetching leaderboard:', err);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard', 'public', 'dashboard.html'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard', 'public', 'dashboard.html'));
});

app.listen(DASHBOARD_PORT, () => {
  console.log(`✅ Dashboard running on http://localhost:${DASHBOARD_PORT}`);
});
const dotenv = require('dotenv');
const { Client, GatewayIntentBits } = require('discord.js');
const { LavalinkManager } = require('lavalink-client');
const fs = require('fs');
const chalk = require('chalk');
const { autoPlayFunction } = require('./functions/autoPlay');

const defaultEnvPath = path.join(__dirname, '.env');
const explicitEnvFile = process.env.ENV_FILE ? path.join(__dirname, process.env.ENV_FILE) : null;
const requiredEnvVars = ['DISCORD_TOKEN', 'MONGODB_URI'];
const missingRequiredEnv = requiredEnvVars.some((key) => !process.env[key]);
let envPath = null;

if (!missingRequiredEnv) {
  console.log('✅ Environment variables already provided; skipping local env file load.');
} else {
  if (explicitEnvFile && fs.existsSync(explicitEnvFile)) {
    envPath = explicitEnvFile;
  } else if (fs.existsSync(defaultEnvPath)) {
    envPath = defaultEnvPath;
  }

  if (envPath) {
    dotenv.config({ path: envPath });
    console.log(`✅ Loaded environment from ${path.basename(envPath)}`);
  } else {
    console.log('⚠️ No local env file found. Using system environment only. Set ENV_FILE to choose a specific file if needed.');
  }
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
  ],
});
client.activeCrateMessages = new Map();

client.lavalink = new LavalinkManager({
  nodes: [
    {
      authorization: process.env.LL_PASSWORD,
      host: process.env.LL_HOST,
      port: parseInt(process.env.LL_PORT, 10),
      id: process.env.LL_NAME,
    },
  ],
  sendToShard: (guildId, payload) =>
    client.guilds.cache.get(guildId)?.shard?.send(payload),
  autoSkip: true,
  client: {
    id: process.env.DISCORD_CLIENT_ID,
    username: 'Lanya',
  },
  playerOptions: {
    onEmptyQueue: {
      destroyAfterMs: 30_000,
      autoPlayFunction: autoPlayFunction,
    },
  },
});

const styles = {
  successColor: chalk.bold.green,
  warningColor: chalk.bold.yellow,
  infoColor: chalk.bold.blue,
  commandColor: chalk.bold.cyan,
  userColor: chalk.bold.magenta,
  errorColor: chalk.red,
  highlightColor: chalk.bold.hex('#FFA500'),
  accentColor: chalk.bold.hex('#00FF7F'),
  secondaryColor: chalk.hex('#ADD8E6'),
  primaryColor: chalk.bold.hex('#FF1493'),
  dividerColor: chalk.hex('#FFD700'),
};

global.styles = styles;

const handlerFiles = fs
  .readdirSync(path.join(__dirname, 'handlers'))
  .filter((file) => file.endsWith('.js'));

(async () => {
  let counter = 0;
  for (const file of handlerFiles) {
    counter += 1;
    const handler = require(`./handlers/${file}`);
    if (typeof handler === 'function') {
      await handler(client);
    }
  }

  console.log(
    global.styles.successColor(`✅ Successfully loaded ${counter} handlers`)
  );

  await client.login(process.env.DISCORD_TOKEN);
})();
