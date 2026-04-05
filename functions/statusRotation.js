const { ActivityType } = require('discord.js');
const fs = require('fs');
const path = require('path');

let activeInterval = null;
let currentIndex = 0;

function getStatusConfig() {
  try {
    const statusConfigPath = path.join(process.cwd(), 'status.json');
    return JSON.parse(fs.readFileSync(statusConfigPath, 'utf8'));
  } catch {
    return {
      interval: 30000,
      status: { type: 'PLAYING', state: '{userCount} people.', url: 'https://twitch.tv/lanya' },
    };
  }
}

function getActivityType(typeStr) {
  switch ((typeStr || 'PLAYING').toUpperCase()) {
    case 'PLAYING': return ActivityType.Playing;
    case 'STREAMING': return ActivityType.Streaming;
    case 'LISTENING': return ActivityType.Listening;
    case 'WATCHING': return ActivityType.Watching;
    case 'COMPETING': return ActivityType.Competing;
    default: return ActivityType.Playing;
  }
}

function applyPresence(client, entry) {
  if (!client || !client.user || !entry) return;
  const activityType = getActivityType(entry.type);
  let state = entry.state
    .replace('{serverCount}', client.guilds.cache.size)
    .replace('{userCount}', client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0));

  const activity = { name: state, type: activityType };
  if (entry.type && entry.type.toUpperCase() === 'STREAMING' && entry.url) {
    activity.url = entry.url;
  }

  client.user.setPresence({
    activities: [activity],
    status: 'online',
  });
}

function startRotation(client, entries, intervalMs) {
  if (activeInterval) {
    clearInterval(activeInterval);
    activeInterval = null;
  }
  if (!entries || entries.length === 0) return;

  currentIndex = 0;
  applyPresence(client, entries[0]);

  activeInterval = setInterval(() => {
    currentIndex = (currentIndex + 1) % entries.length;
    applyPresence(client, entries[currentIndex]);
  }, intervalMs || 30000);
}

async function updateBotStatus(client) {
  try {
    const BotStatus = require('../models/BotStatus');
    const dbStatus = await BotStatus.findById('global');

    if (dbStatus && dbStatus.enabled && dbStatus.entries && dbStatus.entries.length > 0) {
      const sorted = [...dbStatus.entries].sort((a, b) => a.order - b.order);
      startRotation(client, sorted, dbStatus.interval);
    } else {
      const fallback = getStatusConfig();
      const fallbackEntry = {
        type: fallback.status.type,
        state: fallback.status.state,
        url: fallback.status.url,
        buttons: [],
      };
      startRotation(client, [fallbackEntry], fallback.interval);
    }
  } catch {
    const fallback = getStatusConfig();
    const fallbackEntry = {
      type: fallback.status.type,
      state: fallback.status.state,
      url: fallback.status.url,
      buttons: [],
    };
    startRotation(client, [fallbackEntry], fallback.interval);
  }
}

function updateStatus(client) {
  updateBotStatus(client);
}

module.exports = updateStatus;
module.exports.updateBotStatus = updateBotStatus;
module.exports.applyPresence = applyPresence;
