const { ActivityType } = require('discord.js');
const fs = require('fs');
const path = require('path');

let activeInterval = null;
let currentConfig = null;

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

function applyPresence(client, config) {
  if (!client || !client.user) return;
  const activityType = getActivityType(config.type);
  let state = config.state
    .replace('{serverCount}', client.guilds.cache.size)
    .replace('{userCount}', client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0));

  const activity = { name: state, type: activityType };
  if (config.type && config.type.toUpperCase() === 'STREAMING' && config.url) {
    activity.url = config.url;
  }

  client.user.setPresence({
    activities: [activity],
    status: config.enabled !== false ? 'online' : 'idle',
  });
}

function startRotation(client, config) {
  if (activeInterval) {
    clearInterval(activeInterval);
    activeInterval = null;
  }
  if (!config || config.enabled === false) return;

  applyPresence(client, config);
  activeInterval = setInterval(() => applyPresence(client, config), config.interval || 30000);
}

async function updateBotStatus(client) {
  try {
    const BotStatus = require('../models/BotStatus');
    const dbStatus = await BotStatus.findById('global');

    if (dbStatus && dbStatus.enabled) {
      currentConfig = {
        type: dbStatus.type,
        state: dbStatus.state,
        url: dbStatus.url,
        enabled: dbStatus.enabled,
        interval: dbStatus.interval,
      };
      startRotation(client, currentConfig);
    } else {
      const fallback = getStatusConfig();
      currentConfig = {
        type: fallback.status.type,
        state: fallback.status.state,
        url: fallback.status.url,
        enabled: true,
        interval: fallback.interval,
      };
      startRotation(client, currentConfig);
    }
  } catch {
    const fallback = getStatusConfig();
    currentConfig = {
      type: fallback.status.type,
      state: fallback.status.state,
      url: fallback.status.url,
      enabled: true,
      interval: fallback.interval,
    };
    startRotation(client, currentConfig);
  }
}

// Legacy export for backward compatibility
function updateStatus(client) {
  updateBotStatus(client);
}

module.exports = updateStatus;
module.exports.updateBotStatus = updateBotStatus;
module.exports.applyPresence = applyPresence;
