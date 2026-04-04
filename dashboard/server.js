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
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: DISCORD_REDIRECT_URI,
    response_type: 'code',
    scope: 'identify guilds',
  });
  res.redirect(`https://discord.com/api/oauth2/authorize?${params}`);
});

// OAuth2 Callback
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

    res.redirect('/dashboard');
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
    const models = [
      'SwearFilter', 'AntiSpam', 'LinkFilter', 'Starboard',
      'CrateConfig', 'TicketSettings', 'AFK',
    ];

    for (const modelName of models) {
      try {
        const Model = require(path.join(__dirname, '..', 'models', modelName));
        const data = await Model.findOne({ guildId: req.params.guildId });
        configs[modelName] = data;
      } catch {
        configs[modelName] = null;
      }
    }

    res.json(configs);
  } catch (err) {
    console.error('Error fetching configs:', err);
    res.status(500).json({ error: 'Failed to fetch configs' });
  }
});

app.post('/api/guild/:guildId/config/:model', requireAdmin, async (req, res) => {
  try {
    const Model = require(path.join(__dirname, '..', 'models', req.params.model));
    const data = await Model.findOneAndUpdate(
      { guildId: req.params.guildId },
      { $set: req.body },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json(data);
  } catch (err) {
    console.error('Error saving config:', err);
    res.status(500).json({ error: 'Failed to save config' });
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
