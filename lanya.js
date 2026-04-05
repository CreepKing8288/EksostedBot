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

const OWNER_ID = '1394914695600934932';

const requireOwner = (req, res, next) => {
  if (!req.session.user) return res.status(401).json({ error: 'Not authenticated' });
  if (req.session.user.id !== OWNER_ID) return res.status(403).json({ error: 'Owner only' });
  next();
};

app.get('/auth/login', (req, res) => {
  const returnUrl = req.query.return || '/dashboard';
  const state = Buffer.from(JSON.stringify({ return: returnUrl })).toString('base64');
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: DISCORD_REDIRECT_URI,
    response_type: 'code',
    scope: 'identify guilds',
    state,
  });
  res.redirect(`https://discord.com/api/oauth2/authorize?${params}`);
});

app.get('/auth/callback', async (req, res) => {
  const { code, state } = req.query;
  if (!code) return res.redirect('/');

  let returnUrl = '/dashboard';
  if (state) {
    try {
      const parsed = JSON.parse(Buffer.from(state, 'base64').toString());
      if (parsed.return) returnUrl = parsed.return;
    } catch {}
  }

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
        const isAdmin = g.owner || (BigInt(g.permissions) & 0x8n) === 0x8n;
        return isAdmin && botGuildIds.has(g.id);
      }),
    };

    res.redirect(returnUrl);
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

app.get('/api/user/guilds', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const botGuilds = client.guilds.cache.map(g => g.id);
    let userGuildIds = new Set();

    if (DISCORD_BOT_TOKEN) {
      try {
        let after = null;
        while (true) {
          const url = `https://discord.com/api/users/@me/guilds?limit=200${after ? `&after=${after}` : ''}`;
          const guildsRes = await fetch(url, {
            headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` }
          });
          if (!guildsRes.ok) break;
          const guilds = await guildsRes.json();
          if (guilds.length === 0) break;
          guilds.forEach(g => {
            if (botGuilds.includes(g.id)) {
              userGuildIds.add(g.id);
            }
          });
          if (guilds.length < 200) break;
          after = guilds[guilds.length - 1].id;
        }
      } catch (e) {
        console.error('Failed to fetch user guilds:', e);
      }
    }

    const guilds = client.guilds.cache
      .filter(g => userGuildIds.has(g.id))
      .map(g => ({
        id: g.id,
        name: g.name,
        icon: g.icon,
      }));

    res.json(guilds);
  } catch (err) {
    console.error('Error fetching user guilds:', err);
    res.status(500).json({ error: 'Failed to fetch guilds' });
  }
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
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;
    const sortField = type === 'vc' ? 'voiceSeconds' : 'totalXp';
    const guildId = req.params.guildId;

    let guildMemberIds = new Set();
    if (DISCORD_BOT_TOKEN) {
      try {
        let after = null;
        while (true) {
          const url = `https://discord.com/api/guilds/${guildId}/members?limit=1000${after ? `&after=${after}` : ''}`;
          const membersRes = await fetch(url, {
            headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` }
          });
          if (!membersRes.ok) break;
          const members = await membersRes.json();
          if (members.length === 0) break;
          members.forEach(m => guildMemberIds.add(m.user.id));
          if (members.length < 1000) break;
          after = members[members.length - 1].user.id;
        }
      } catch (e) {
        console.error('Failed to fetch guild members:', e);
      }
    }

    let allMembers = await MemberData.find({ guildId }).sort({ [sortField]: -1 });
    if (guildMemberIds.size > 0) {
      const leftUsers = allMembers.filter(m => !guildMemberIds.has(m.userId));
      if (leftUsers.length > 0) {
        await MemberData.deleteMany({ guildId, userId: { $in: leftUsers.map(m => m.userId) } });
        allMembers = allMembers.filter(m => guildMemberIds.has(m.userId));
      }
    }

    const total = allMembers.length;
    const paginated = allMembers.slice(skip, skip + limit);

    const userIds = paginated.map(m => m.userId);
    let userMap = {};
    if (userIds.length > 0 && DISCORD_BOT_TOKEN) {
      const userPromises = userIds.map(async (uid) => {
        try {
          const userRes = await fetch(`https://discord.com/api/users/${uid}`, {
            headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` }
          });
          if (userRes.ok) {
            const u = await userRes.json();
            return { id: uid, username: u.username, avatar: u.avatar, discriminator: u.discriminator };
          }
        } catch {}
        return { id: uid };
      });
      const users = await Promise.allSettled(userPromises);
      users.forEach(r => {
        if (r.status === 'fulfilled' && r.value && r.value.username) {
          userMap[r.value.id] = r.value;
        }
      });
    }

    const leaderboard = paginated.map((m, i) => {
      const u = userMap[m.userId] || {};
      return {
        rank: skip + i + 1,
        userId: m.userId,
        username: u.username || `User ${m.userId}`,
        avatar: u.avatar || null,
        discriminator: u.discriminator || '0',
        level: m.level,
        xp: m.xp,
        totalXp: m.totalXp,
        voiceXp: m.voiceXp,
        voiceSeconds: m.voiceSeconds,
      };
    });

    res.json({
      leaderboard,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error('Error fetching leaderboard:', err);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// Bot Status API - owner only
app.get('/api/status', requireOwner, async (req, res) => {
  try {
    const BotStatus = require('./models/BotStatus');
    let status = await BotStatus.findById('global');
    if (!status) {
      status = new BotStatus();
      await status.save();
    }
    res.json(status);
  } catch (err) {
    console.error('Error fetching status:', err);
    res.status(500).json({ error: 'Failed to fetch status' });
  }
});

app.post('/api/status', requireOwner, async (req, res) => {
  try {
    const BotStatus = require('./models/BotStatus');
    const { enabled, interval, entries } = req.body;
    let status = await BotStatus.findById('global');
    if (!status) {
      status = new BotStatus();
    }
    if (enabled !== undefined) status.enabled = enabled;
    if (interval) status.interval = interval;
    if (entries) status.entries = entries;
    status.updatedBy = req.session.user.id;
    await status.save();

    // Apply status immediately if client is available
    if (client && client.user) {
      try {
        const { updateBotStatus } = require('./functions/statusRotation');
        updateBotStatus(client);
      } catch {}
    }

    res.json(status);
  } catch (err) {
    console.error('Error saving status:', err);
    res.status(500).json({ error: 'Failed to save status' });
  }
});

app.get('/api/status/public', async (req, res) => {
  try {
    const BotStatus = require('./models/BotStatus');
    const status = await BotStatus.findById('global');
    if (!status || !status.entries || status.entries.length === 0) {
      return res.json({ enabled: true, current: '' });
    }
    const first = status.entries[0];
    res.json({
      enabled: status.enabled,
      type: first.type,
      state: first.state,
      updatedAt: status.updatedAt,
      updatedBy: status.updatedBy,
    });
  } catch (err) {
    console.error('Error fetching public status:', err);
    res.status(500).json({ error: 'Failed to fetch status' });
  }
});

// Global Announcement API - owner only
app.get('/api/announcement', requireOwner, async (req, res) => {
  try {
    const Announcement = require('./models/Announcement');
    let ann = await Announcement.findById('global');
    if (!ann) {
      ann = new Announcement();
      await ann.save();
    }
    res.json(ann);
  } catch (err) {
    console.error('Error fetching announcement:', err);
    res.status(500).json({ error: 'Failed to fetch announcement' });
  }
});

app.post('/api/announcement', requireOwner, async (req, res) => {
  try {
    const Announcement = require('./models/Announcement');
    let ann = await Announcement.findById('global');
    if (!ann) {
      ann = new Announcement();
    }
    const { content, embedTitle, embedDescription, embedColor, embedFooter, embedImage, embedThumbnail, channelId } = req.body;
    if (content !== undefined) ann.content = content;
    if (embedTitle !== undefined) ann.embedTitle = embedTitle;
    if (embedDescription !== undefined) ann.embedDescription = embedDescription;
    if (embedColor !== undefined) ann.embedColor = embedColor;
    if (embedFooter !== undefined) ann.embedFooter = embedFooter;
    if (embedImage !== undefined) ann.embedImage = embedImage;
    if (embedThumbnail !== undefined) ann.embedThumbnail = embedThumbnail;
    if (channelId !== undefined) ann.channelId = channelId;
    ann.updatedBy = req.session.user.id;
    await ann.save();
    res.json(ann);
  } catch (err) {
    console.error('Error saving announcement:', err);
    res.status(500).json({ error: 'Failed to save announcement' });
  }
});

app.post('/api/announcement/send', requireOwner, async (req, res) => {
  try {
    const Announcement = require('./models/Announcement');
    let ann = await Announcement.findById('global');
    if (!ann) {
      ann = new Announcement();
    }

    const { content, embedTitle, embedDescription, embedColor, embedFooter, embedImage, embedThumbnail, channelId } = req.body;
    if (content !== undefined) ann.content = content;
    if (embedTitle !== undefined) ann.embedTitle = embedTitle;
    if (embedDescription !== undefined) ann.embedDescription = embedDescription;
    if (embedColor !== undefined) ann.embedColor = embedColor;
    if (embedFooter !== undefined) ann.embedFooter = embedFooter;
    if (embedImage !== undefined) ann.embedImage = embedImage;
    if (embedThumbnail !== undefined) ann.embedThumbnail = embedThumbnail;
    if (channelId !== undefined) ann.channelId = channelId;
    ann.sentBy = req.session.user.id;
    ann.sentAt = new Date();

    const { EmbedBuilder } = require('discord.js');
    const embed = new EmbedBuilder();
    let hasEmbed = false;

    if (embedTitle) { embed.setTitle(embedTitle); hasEmbed = true; }
    if (embedDescription) { embed.setDescription(embedDescription); }
    if (embedColor) { embed.setColor(embedColor); }
    if (embedFooter) { embed.setFooter({ text: embedFooter }); }
    if (embedImage) { embed.setImage(embedImage); }
    if (embedThumbnail) { embed.setThumbnail(embedThumbnail); }

    let sent = 0;
    let failed = 0;
    const guilds = client.guilds.cache;

    for (const [, guild] of guilds) {
      try {
        let channel;
        if (channelId) {
          channel = guild.channels.cache.get(channelId);
        }
        if (!channel) {
          channel = guild.systemChannel || guild.channels.cache.find(c => c.type === 0 && c.permissionsFor(guild.members.me)?.has('SendMessages'));
        }
        if (!channel) {
          failed++;
          continue;
        }

        const sendOptions = {};
        if (content) sendOptions.content = content;
        if (hasEmbed) sendOptions.embeds = [embed];

        await channel.send(sendOptions);
        sent++;
      } catch {
        failed++;
      }
    }

    ann.totalSent = sent;
    ann.totalFailed = failed;
    await ann.save();

    res.json({ sent, failed, total: guilds.size });
  } catch (err) {
    console.error('Error sending announcement:', err);
    res.status(500).json({ error: `Failed to send announcement: ${err.message}` });
  }
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard', 'public', 'dashboard.html'));
});

app.get('/leaderboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard', 'public', 'leaderboard.html'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'website', 'index.html'));
});

// Public API - no auth required
app.get('/api/public/guilds', async (req, res) => {
  try {
    const guilds = client.guilds.cache.map(g => ({
      id: g.id,
      name: g.name,
      icon: g.icon,
      memberCount: g.memberCount,
    }));
    res.json(guilds);
  } catch (err) {
    console.error('Error fetching public guilds:', err);
    res.status(500).json({ error: 'Failed to fetch guilds' });
  }
});

app.get('/api/public/guild/:guildId/leaderboard', async (req, res) => {
  try {
    const { MemberData } = require('./models/Level');
    const type = req.query.type || 'level';
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;
    const sortField = type === 'vc' ? 'voiceSeconds' : 'totalXp';
    const guildId = req.params.guildId;

    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      return res.status(404).json({ error: 'Guild not found' });
    }

    let allMembers = await MemberData.find({ guildId }).sort({ [sortField]: -1 });
    const guildMemberIds = new Set(guild.members.cache.map(m => m.id));
    const leftUsers = allMembers.filter(m => !guildMemberIds.has(m.userId));
    if (leftUsers.length > 0) {
      await MemberData.deleteMany({ guildId, userId: { $in: leftUsers.map(m => m.userId) } });
      allMembers = allMembers.filter(m => guildMemberIds.has(m.userId));
    }

    const total = allMembers.length;
    const paginated = allMembers.slice(skip, skip + limit);

    const userIds = paginated.map(m => m.userId);
    let userMap = {};
    if (userIds.length > 0) {
      const userPromises = userIds.map(async (uid) => {
        try {
          const user = await client.users.fetch(uid, { force: false });
          if (user) {
            return { id: uid, username: user.username, avatar: user.avatar, discriminator: user.discriminator };
          }
        } catch {}
        return { id: uid };
      });
      const users = await Promise.allSettled(userPromises);
      users.forEach(r => {
        if (r.status === 'fulfilled' && r.value && r.value.username) {
          userMap[r.value.id] = r.value;
        }
      });
    }

    const leaderboard = paginated.map((m, i) => {
      const u = userMap[m.userId] || {};
      return {
        rank: skip + i + 1,
        userId: m.userId,
        username: u.username || `User ${m.userId}`,
        avatar: u.avatar || null,
        discriminator: u.discriminator || '0',
        level: m.level,
        xp: m.xp,
        totalXp: m.totalXp,
        voiceXp: m.voiceXp,
        voiceSeconds: m.voiceSeconds,
      };
    });

    res.json({
      leaderboard,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error('Error fetching public leaderboard:', err);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
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
