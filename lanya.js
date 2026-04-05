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

// ===== GIVEAWAY API =====
app.get('/api/giveaways', requireAuth, async (req, res) => {
  try {
    const { guildId } = req.query;
    if (!guildId) return res.status(400).json({ error: 'guildId required' });
    const Giveaway = require('./models/Giveaway');
    const ongoing = await Giveaway.find({ guildId, ongoing: true }).sort({ endTime: 1 });
    const ended = await Giveaway.find({ guildId, ongoing: false }).sort({ endTime: -1 }).limit(20);
    res.json({ ongoing, ended });
  } catch (err) {
    console.error('Error fetching giveaways:', err);
    res.status(500).json({ error: 'Failed to fetch giveaways' });
  }
});

app.post('/api/giveaway', requireAuth, async (req, res) => {
  try {
    const { guildId, prize, duration, winners, channelId, requiredRole } = req.body;
    if (!guildId || !prize || !duration || !channelId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const durationMatch = duration.match(/^(?:(\d+)d)?(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
    if (!durationMatch) return res.status(400).json({ error: 'Invalid duration format. Use: 1d2h3m4s' });
    const [, d, h, m, s] = durationMatch;
    const durationMs = ((parseInt(d) || 0) * 86400000) + ((parseInt(h) || 0) * 3600000) + ((parseInt(m) || 0) * 60000) + ((parseInt(s) || 0) * 1000);
    if (durationMs < 30000 || durationMs > 2592000000) return res.status(400).json({ error: 'Duration must be between 30s and 30 days' });

    const channel = client.channels.cache.get(channelId);
    if (!channel) return res.status(400).json({ error: 'Channel not found' });

    const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
    const endTime = new Date(Date.now() + durationMs);
    const embed = new EmbedBuilder()
      .setTitle(`🎉 ${prize}`)
      .setDescription(`React with the button below to enter!\n**Ends:** <t:${Math.floor(endTime.getTime() / 1000)}:R>\n**Winners:** ${winners || 1}`)
      .setColor('#7c3aed')
      .setFooter({ text: `Hosted by ${req.session.user.username}` })
      .setTimestamp();

    const button = new ButtonBuilder().setCustomId('join_giveaway').setLabel('🎉 Enter Giveaway').setStyle(ButtonStyle.Primary);
    const row = new ActionRowBuilder().addComponents(button);
    const msg = await channel.send({ embeds: [embed], components: [row] });

    const Giveaway = require('./models/Giveaway');
    const giveaway = new Giveaway({
      guildId,
      channelId,
      messageId: msg.id,
      prize,
      endTime,
      winners: winners || 1,
      participants: [],
      ongoing: true,
      requiredRole: requiredRole || null,
      hostId: req.session.user.id,
    });
    await giveaway.save();
    res.json(giveaway);
  } catch (err) {
    console.error('Error creating giveaway:', err);
    res.status(500).json({ error: `Failed to create giveaway: ${err.message}` });
  }
});

app.post('/api/giveaway/end', requireAuth, async (req, res) => {
  try {
    const { messageId } = req.body;
    if (!messageId) return res.status(400).json({ error: 'messageId required' });
    const Giveaway = require('./models/Giveaway');
    const giveaway = await Giveaway.findOne({ messageId, ongoing: true });
    if (!giveaway) return res.status(404).json({ error: 'Giveaway not found or already ended' });

    giveaway.ongoing = false;
    await giveaway.save();

    try {
      const channel = client.channels.cache.get(giveaway.channelId);
      if (channel) {
        const msg = await channel.messages.fetch(messageId).catch(() => null);
        if (msg) {
          const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
          const endedEmbed = EmbedBuilder.from(msg.embeds[0]).setColor('#ef4444').setFooter({ text: 'Giveaway Ended' });
          const endedButton = new ButtonBuilder().setCustomId('join_giveaway').setLabel('Giveaway Ended').setStyle(ButtonStyle.Secondary).setDisabled(true);
          const row = new ActionRowBuilder().addComponents(endedButton);
          await msg.edit({ embeds: [endedEmbed], components: [row] });
        }
      }
    } catch {}

    res.json({ success: true, giveaway });
  } catch (err) {
    console.error('Error ending giveaway:', err);
    res.status(500).json({ error: `Failed to end giveaway: ${err.message}` });
  }
});

app.post('/api/giveaway/reroll', requireAuth, async (req, res) => {
  try {
    const { messageId } = req.body;
    if (!messageId) return res.status(400).json({ error: 'messageId required' });
    const Giveaway = require('./models/Giveaway');
    const giveaway = await Giveaway.findOne({ messageId, ongoing: false });
    if (!giveaway) return res.status(404).json({ error: 'Giveaway not found or still ongoing' });

    const participants = giveaway.participants.filter(p => p !== giveaway.hostId);
    if (participants.length === 0) return res.status(400).json({ error: 'No participants to reroll' });

    const winners = [];
    const pool = [...participants];
    for (let i = 0; i < Math.min(giveaway.winners, pool.length); i++) {
      const idx = Math.floor(Math.random() * pool.length);
      winners.push(pool.splice(idx, 1)[0]);
    }

    try {
      const channel = client.channels.cache.get(giveaway.channelId);
      if (channel) {
        const msg = await channel.messages.fetch(messageId).catch(() => null);
        if (msg) {
          const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
          const rerolledEmbed = EmbedBuilder.from(msg.embeds[0]).setColor('#f59e0b').setFooter({ text: `Rerolled! Winners: ${winners.map(w => `<@${w}>`).join(', ')}` });
          const endedButton = new ButtonBuilder().setCustomId('join_giveaway').setLabel('Giveaway Ended').setStyle(ButtonStyle.Secondary).setDisabled(true);
          const row = new ActionRowBuilder().addComponents(endedButton);
          await msg.edit({ embeds: [rerolledEmbed], components: [row] });
          await channel.send(`🎉 New winner(s): ${winners.map(w => `<@${w}>`).join(', ')}! Congratulations!`);
        }
      }
    } catch {}

    res.json({ success: true, winners });
  } catch (err) {
    console.error('Error rerolling giveaway:', err);
    res.status(500).json({ error: `Failed to reroll: ${err.message}` });
  }
});

// ===== ANALYTICS API =====
app.get('/api/analytics/overview', requireAuth, async (req, res) => {
  try {
    const { guildId } = req.query;
    if (!guildId) return res.status(400).json({ error: 'guildId required' });

    const guild = client.guilds.cache.get(guildId);
    if (!guild) return res.status(404).json({ error: 'Guild not found' });

    const { MemberData } = require('./models/Level');
    const Giveaway = require('./models/Giveaway');

    const totalMembers = await MemberData.countDocuments({ guildId });
    const activeMembers = await MemberData.countDocuments({ guildId, totalXp: { $gt: 0 } });
    const avgLevel = await MemberData.aggregate([{ $match: { guildId } }, { $group: { _id: null, avg: { $avg: '$level' } } }]);
    const totalVoiceSeconds = await MemberData.aggregate([{ $match: { guildId } }, { $group: { _id: null, total: { $sum: '$voiceSeconds' } } }]);
    const totalGiveaways = await Giveaway.countDocuments({ guildId });
    const activeGiveaways = await Giveaway.countDocuments({ guildId, ongoing: true });

    const topUsers = await MemberData.find({ guildId }).sort({ messageCount: -1 }).limit(10).lean();
    const topVoice = await MemberData.find({ guildId }).sort({ voiceSeconds: -1 }).limit(10).lean();

    const userIds = [...new Set([...topUsers.map(u => u.userId), ...topVoice.map(u => u.userId)])];
    const userMap = {};
    for (const uid of userIds) {
      try {
        const user = await client.users.fetch(uid).catch(() => null);
        if (user) {
          userMap[uid] = { username: user.username, avatar: user.avatar };
        }
      } catch {}
    }

    const enrichUsers = (list) => list.map(u => ({
      ...u,
      username: userMap[u.userId]?.username || `User ${u.userId}`,
      avatar: userMap[u.userId]?.avatar || null,
    }));

    const totalMessages = await MemberData.aggregate([{ $match: { guildId } }, { $group: { _id: null, total: { $sum: '$messageCount' } } }]);

    res.json({
      guild: { name: guild.name, memberCount: guild.memberCount, icon: guild.icon },
      totalMembers,
      activeMembers,
      avgLevel: avgLevel.length > 0 ? Math.round(avgLevel[0].avg) : 0,
      totalMessages: totalMessages.length > 0 ? totalMessages[0].total : 0,
      totalVoiceHours: totalVoiceSeconds.length > 0 ? Math.round(totalVoiceSeconds[0].total / 3600) : 0,
      totalGiveaways,
      activeGiveaways,
      topUsers: enrichUsers(topUsers),
      topVoice: enrichUsers(topVoice),
    });
  } catch (err) {
    console.error('Error fetching analytics:', err);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

app.get('/api/analytics/activity', requireAuth, async (req, res) => {
  try {
    const { guildId } = req.query;
    if (!guildId) return res.status(400).json({ error: 'guildId required' });

    const { MemberData } = require('./models/Level');
    const members = await MemberData.find({ guildId, totalXp: { $gt: 0 } }).lean();

    const levelDistribution = {};
    members.forEach(m => {
      const bucket = Math.floor(m.level / 5) * 5;
      const key = `${bucket}-${bucket + 4}`;
      levelDistribution[key] = (levelDistribution[key] || 0) + 1;
    });

    const voiceDistribution = {};
    members.forEach(m => {
      const hours = Math.floor(m.voiceSeconds / 3600);
      const bucket = Math.floor(hours / 5) * 5;
      const key = `${bucket}-${bucket + 4}h`;
      voiceDistribution[key] = (voiceDistribution[key] || 0) + 1;
    });

    res.json({
      levelDistribution,
      voiceDistribution,
      totalActive: members.length,
    });
  } catch (err) {
    console.error('Error fetching activity analytics:', err);
    res.status(500).json({ error: 'Failed to fetch activity analytics' });
  }
});

// ===== UTILITY API =====
app.get('/api/config/backup', requireAuth, async (req, res) => {
  try {
    const { guildId } = req.query;
    if (!guildId) return res.status(400).json({ error: 'guildId required' });

    const modelsWithGuildId = [
      'SwearFilter', 'AntiSpam', 'LinkFilter', 'Starboard',
      'CrateConfig', 'TicketSettings', 'AFK',
      'AIChatConfig', 'ProtectionSettings', 'serverlogs',
      'ButtonRole', 'ServerStatus', 'AutoRoles',
    ];

    const backup = { guildId, exportedAt: new Date().toISOString(), configs: {} };

    for (const modelName of modelsWithGuildId) {
      try {
        let Model;
        if (modelName === 'AutoRoles') Model = require('./models/AutoRoles');
        else Model = require(`./models/${modelName}`);
        const data = await Model.find({ guildId }).lean();
        backup.configs[modelName] = data;
      } catch {
        backup.configs[modelName] = null;
      }
    }

    try {
      const Welcome = require('./models/welcome');
      backup.configs.welcome = await Welcome.find({ $or: [{ guildId }, { serverId: guildId }] }).lean();
    } catch { backup.configs.welcome = null; }

    try {
      const { GuildSettings, MemberData, LevelRoles } = require('./models/Level');
      backup.configs.leveling = {
        settings: await GuildSettings.findOne({ guildId }).lean(),
        roles: await LevelRoles.find({ guildId }).lean(),
      };
    } catch { backup.configs.leveling = null; }

    try {
      const Giveaway = require('./models/Giveaway');
      backup.configs.giveaways = await Giveaway.find({ guildId }).lean();
    } catch { backup.configs.giveaways = null; }

    res.json(backup);
  } catch (err) {
    console.error('Error creating backup:', err);
    res.status(500).json({ error: 'Failed to create backup' });
  }
});

app.post('/api/config/restore', requireAuth, async (req, res) => {
  try {
    const { guildId, configs } = req.body;
    if (!guildId || !configs) return res.status(400).json({ error: 'Missing guildId or configs' });

    let restored = 0;
    for (const [modelName, data] of Object.entries(configs)) {
      if (!data || !Array.isArray(data)) continue;
      try {
        let Model;
        if (modelName === 'AutoRoles') Model = require('./models/AutoRoles');
        else if (modelName === 'welcome') Model = require('./models/welcome');
        else Model = require(`./models/${modelName}`);

        for (const doc of data) {
          const { _id, ...rest } = doc;
          await Model.findOneAndUpdate({ guildId: doc.guildId || guildId }, rest, { upsert: true });
          restored++;
        }
      } catch {}
    }

    res.json({ success: true, restored });
  } catch (err) {
    console.error('Error restoring config:', err);
    res.status(500).json({ error: 'Failed to restore config' });
  }
});

app.get('/api/prefix', requireAuth, async (req, res) => {
  try {
    const { guildId } = req.query;
    if (!guildId) return res.status(400).json({ error: 'guildId required' });
    const PrefixConfig = require('./models/PrefixConfig');
    let config = await PrefixConfig.findOne({ guildId });
    if (!config) {
      config = { guildId, prefix: '!' };
    }
    res.json(config);
  } catch (err) {
    console.error('Error fetching prefix:', err);
    res.status(500).json({ error: 'Failed to fetch prefix' });
  }
});

app.post('/api/prefix', requireAuth, async (req, res) => {
  try {
    const { guildId, prefix } = req.body;
    if (!guildId || !prefix) return res.status(400).json({ error: 'Missing fields' });
    const PrefixConfig = require('./models/PrefixConfig');
    const config = await PrefixConfig.findOneAndUpdate(
      { guildId },
      { prefix },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json(config);
  } catch (err) {
    console.error('Error saving prefix:', err);
    res.status(500).json({ error: 'Failed to save prefix' });
  }
});

app.get('/api/templates', requireAuth, async (req, res) => {
  try {
    const { guildId } = req.query;
    if (!guildId) return res.status(400).json({ error: 'guildId required' });
    const MessageTemplate = require('./models/MessageTemplate');
    const templates = await MessageTemplate.find({ guildId }).sort({ name: 1 });
    res.json(templates);
  } catch (err) {
    console.error('Error fetching templates:', err);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

app.post('/api/templates', requireAuth, async (req, res) => {
  try {
    const { guildId, name, content, embedTitle, embedDescription, embedColor, embedFooter, embedImage, embedThumbnail } = req.body;
    if (!guildId || !name) return res.status(400).json({ error: 'Missing guildId or name' });
    const MessageTemplate = require('./models/MessageTemplate');
    const template = await MessageTemplate.findOneAndUpdate(
      { guildId, name },
      { $set: { content, embedTitle, embedDescription, embedColor, embedFooter, embedImage, embedThumbnail } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json(template);
  } catch (err) {
    console.error('Error saving template:', err);
    res.status(500).json({ error: 'Failed to save template' });
  }
});

app.delete('/api/templates/:id', requireAuth, async (req, res) => {
  try {
    const MessageTemplate = require('./models/MessageTemplate');
    await MessageTemplate.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting template:', err);
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

app.get('/api/goodbye', requireAuth, async (req, res) => {
  try {
    const { guildId } = req.query;
    if (!guildId) return res.status(400).json({ error: 'guildId required' });
    const Goodbye = require('./models/Goodbye');
    let config = await Goodbye.findOne({ guildId });
    if (!config) {
      config = new Goodbye({ guildId });
      await config.save();
    }
    res.json(config);
  } catch (err) {
    console.error('Error fetching goodbye:', err);
    res.status(500).json({ error: 'Failed to fetch goodbye config' });
  }
});

app.post('/api/goodbye', requireAuth, async (req, res) => {
  try {
    const { guildId, enabled, description, channelId, embedTitle, embedColor, embedImage, embedThumbnail, embedFooter } = req.body;
    if (!guildId) return res.status(400).json({ error: 'guildId required' });
    const Goodbye = require('./models/Goodbye');
    const config = await Goodbye.findOneAndUpdate(
      { guildId },
      { $set: { enabled, description, channelId, embedTitle, embedColor, embedImage, embedThumbnail, embedFooter } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json(config);
  } catch (err) {
    console.error('Error saving goodbye:', err);
    res.status(500).json({ error: 'Failed to save goodbye config' });
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
