const express = require('express');
const session = require('express-session');
const path = require('path');
const crypto = require('crypto');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.DASHBOARD_PORT || 3000;

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || `http://localhost:${PORT}/auth/callback`;
const DISCORD_BOT_TOKEN = process.env.DISCORD_TOKEN;

const sessionSecret = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
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

const requireAdmin = (req, res, next) => {
  if (!req.session.user) return res.status(401).json({ error: 'Not authenticated' });
  next();
};

// OAuth2 Login
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

// OAuth2 Callback
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

    const tokens = await tokenRes.json();
    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const user = await userRes.json();

    const guildsRes = await fetch('https://discord.com/api/users/@me/guilds', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const guilds = await guildsRes.json();

    req.session.user = {
      id: user.id,
      username: user.username,
      discriminator: user.discriminator,
      avatar: user.avatar,
      guilds: guilds.filter(g => (g.permissions & 0x8) === 0x8),
    };

    res.redirect(returnUrl);
  } catch (err) {
    console.error('OAuth error:', err);
    res.redirect('/');
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

// Dashboard API - read/write configs
app.get('/api/guild/:guildId/configs', requireAdmin, async (req, res) => {
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
        const Model = require(path.join(__dirname, '..', 'models', modelName));
        const data = await Model.findOne({ guildId });
        configs[modelName] = data;
      } catch {
        configs[modelName] = null;
      }
    }

    try {
      const AutoRole = require(path.join(__dirname, '..', 'models', 'AutoRoles'));
      configs.AutoRole = await AutoRole.findOne({ $or: [{ guildId }, { serverId: guildId }] });
    } catch {
      configs.AutoRole = null;
    }

    try {
      const Welcome = require(path.join(__dirname, '..', 'models', 'welcome'));
      configs.welcome = await Welcome.findOne({ $or: [{ guildId }, { serverId: guildId }] });
    } catch {
      configs.welcome = null;
    }

    try {
      const { GuildSettings } = require(path.join(__dirname, '..', 'models', 'Level'));
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

app.post('/api/guild/:guildId/config/:model', requireAdmin, async (req, res) => {
  try {
    let Model;
    let query;

    if (req.params.model === 'Level') {
      Model = require(path.join(__dirname, '..', 'models', 'Level')).GuildSettings;
      query = { guildId: req.params.guildId };
    } else if (req.params.model === 'ServerLog') {
      Model = require(path.join(__dirname, '..', 'models', 'serverlogs'));
      query = { guildId: req.params.guildId };
    } else if (req.params.model === 'AutoRole') {
      Model = require(path.join(__dirname, '..', 'models', 'AutoRoles'));
      query = { $or: [{ guildId: req.params.guildId }, { serverId: req.params.guildId }] };
    } else if (req.params.model === 'Welcome') {
      Model = require(path.join(__dirname, '..', 'models', 'welcome'));
      query = { $or: [{ guildId: req.params.guildId }, { serverId: req.params.guildId }] };
    } else if (req.params.model === 'ButtonRole') {
      Model = require(path.join(__dirname, '..', 'models', 'ButtonRole'));
      query = { guildId: req.params.guildId };
    } else if (req.params.model === 'ServerStatus') {
      Model = require(path.join(__dirname, '..', 'models', 'ServerStatus'));
      query = { guildId: req.params.guildId };
    } else {
      Model = require(path.join(__dirname, '..', 'models', req.params.model));
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

// Leaderboard API
app.get('/api/guild/:guildId/leaderboard', requireAdmin, async (req, res) => {
  try {
    const { MemberData } = require(path.join(__dirname, '..', 'models', 'Level'));
    const type = req.query.type || 'level';

    let sortField;
    if (type === 'vc') {
      sortField = 'voiceSeconds';
    } else {
      sortField = 'totalXp';
    }

    const top = await MemberData.find({ guildId: req.params.guildId })
      .sort({ [sortField]: -1 })
      .limit(25);

    const userIds = top.map(m => m.userId);
    let userMap = {};

    if (userIds.length > 0) {
      try {
        const membersRes = await fetch(`https://discord.com/api/guilds/${req.params.guildId}/members/search?limit=100`, {
          headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` },
        });
        if (membersRes.ok) {
          const members = await membersRes.json();
          members.forEach(m => {
            userMap[m.user.id] = {
              username: m.user.username,
              avatar: m.user.avatar,
              discriminator: m.user.discriminator,
            };
          });
        }
      } catch (e) {
        console.error('Failed to fetch members:', e);
      }
    }

    const leaderboard = top.map((m, i) => ({
      rank: i + 1,
      userId: m.userId,
      username: userMap[m.userId]?.username || `User ${m.userId}`,
      avatar: userMap[m.userId]?.avatar || null,
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

// Serve dashboard
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

module.exports = { app, PORT };
