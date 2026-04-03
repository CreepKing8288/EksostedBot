const { Events } = require('discord.js');
const { MemberData, GuildSettings } = require('../models/Level');
const levelUpEvent = require('./levelUp');

const activeVoiceTimers = new Map();
let voiceTicker = null;
let clientInstance = null;

const createVoiceKey = (guildId, userId) => `${guildId}:${userId}`;
const isVoiceActive = (state) =>
  state?.channelId &&
  state.member &&
  !state.member.user.bot &&
  !state.selfMute &&
  !state.serverMute;

const calculateXpNeeded = (level, guildData) => {
  if (level === 1) return guildData.startingXp || 100;
  return (guildData.startingXp || 100) + (level - 1) * (guildData.xpPerLevel || 50);
};

const calculateVoiceXp = (durationMs, xpRate, allowPartial = false) => {
  const seconds = Math.floor(durationMs / 1000);
  const wholeMinutes = Math.floor(seconds / 60);
  if (wholeMinutes > 0) return wholeMinutes * xpRate;
  if (allowPartial && seconds > 0) return xpRate;
  return 0;
};

const awardVoiceXp = async (guild, memberId, durationMs, allowPartial = false) => {
  if (durationMs <= 0 || !guild) return;

  const guildData = await GuildSettings.findOne({ guildId: guild.id });
  if (!guildData || !guildData.levelingEnabled) return;

  const xpToAdd = calculateVoiceXp(durationMs, guildData.xpRate || 1, allowPartial);
  if (!xpToAdd) return;

  const durationSeconds = Math.floor(durationMs / 1000);
  let memberData = await MemberData.findOne({ guildId: guild.id, userId: memberId });
  if (!memberData) {
    memberData = new MemberData({
      guildId: guild.id,
      userId: memberId,
      level: 1,
      xp: 0,
      totalXp: 0,
      voiceXp: 0,
      voiceSeconds: 0,
    });
  }

  memberData.xp = (memberData.xp || 0) + xpToAdd;
  memberData.totalXp = (memberData.totalXp || 0) + xpToAdd;
  memberData.voiceXp = (memberData.voiceXp || 0) + xpToAdd;
  memberData.voiceSeconds = (memberData.voiceSeconds || 0) + durationSeconds;

  await levelUpEvent.processLevelUp(memberData, guildData, {
    guild,
    author: { id: memberId },
    channel: null,
  });

  await memberData.save();
};

const startVoiceTicker = (client) => {
  if (voiceTicker) return;
  clientInstance = client;
  voiceTicker = setInterval(async () => {
    if (!clientInstance) return;

    const now = Date.now();
    for (const [key, timer] of activeVoiceTimers.entries()) {
      const [guildId] = key.split(':');
      const elapsed = now - timer.lastClaimed;
      const fullMinuteMs = Math.floor(elapsed / 60000) * 60000;
      if (fullMinuteMs <= 0) continue;

      const guild = clientInstance.guilds.cache.get(guildId);
      if (!guild) continue;
      await awardVoiceXp(guild, key.split(':')[1], fullMinuteMs, false);
      timer.lastClaimed += fullMinuteMs;
    }
  }, 30000);
};

const initializeActiveVoiceSessions = (client) => {
  client.guilds.cache.forEach((guild) => {
    guild.channels.cache
      .filter((channel) => channel.isVoiceBased())
      .forEach((channel) => {
        channel.members.forEach((member) => {
          if (!member.user.bot && isVoiceActive(member.voice)) {
            const key = createVoiceKey(guild.id, member.id);
            if (!activeVoiceTimers.has(key)) {
              activeVoiceTimers.set(key, {
                since: Date.now(),
                lastClaimed: Date.now(),
              });
            }
          }
        });
      });
  });
};

module.exports = {
  name: Events.VoiceStateUpdate,
  async initialize(client) {
    startVoiceTicker(client);
    initializeActiveVoiceSessions(client);
  },
  async execute(oldState, newState) {
    const guild = oldState.guild || newState.guild;
    if (!guild) return;

    const client = oldState.client || newState.client;
    startVoiceTicker(client);

    const member = newState.member || oldState.member;
    if (!member || member.user.bot) return;

    const userId = member.user.id;
    const key = createVoiceKey(guild.id, userId);

    const oldActive = isVoiceActive(oldState);
    const newActive = isVoiceActive(newState);

    if (oldActive && !newActive) {
      if (activeVoiceTimers.has(key)) {
        const timer = activeVoiceTimers.get(key);
        activeVoiceTimers.delete(key);
        const durationMs = Date.now() - timer.lastClaimed;
        await awardVoiceXp(guild, userId, durationMs, true);
      } else {
        await awardVoiceXp(guild, userId, 60000, true);
      }
    }

    if (!oldActive && newActive && !activeVoiceTimers.has(key)) {
      activeVoiceTimers.set(key, {
        since: Date.now(),
        lastClaimed: Date.now(),
      });
    }

    if (!client.lavalink) return;
    const player = client.lavalink.players.get(guild.id);
    if (!player) return;

    if (oldState.id === client.user.id && !newState.channelId) {
      player.destroy();
      return;
    }

    const voiceChannel = guild.channels.cache.get(player.voiceChannelId);
    if (!voiceChannel) return;

    const members = voiceChannel.members.filter((member) => !member.user.bot).size;

    if (members === 0) {
      player.inactivityTimeout = setTimeout(() => {
        if (player.playing) player.stopPlaying();
        player.destroy();

        const textChannel = guild.channels.cache.get(player.textChannelId);
        if (textChannel) {
          textChannel.send(
            '👋 Left the voice channel due to inactivity (3 minutes with no listeners)'
          );
        }
      }, 180000);
      if (player.collector) {
        player.collector.stop();
      }
    } else if (player.inactivityTimeout) {
      clearTimeout(player.inactivityTimeout);
      player.inactivityTimeout = null;
    }
  },
};
