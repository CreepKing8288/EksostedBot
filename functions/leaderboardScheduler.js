const { MemberData, GuildSettings } = require('../models/Level');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const { EmbedBuilder, AttachmentBuilder } = require('discord.js');

const defaultBannerUrl = null;

const formatDuration = (seconds) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  const parts = [];
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (secs || parts.length === 0) parts.push(`${secs}s`);
  return parts.join(' ');
};

async function renderLevelLeaderboardImage(client, guildId, guildData) {
  const leaderboard = await MemberData.find({ guildId }).sort({ level: -1, xp: -1 }).lean();
  if (!leaderboard.length) return null;

  const topMembers = leaderboard.slice(0, 10);
  const canvasWidth = 950;
  const canvasHeight = 600;
  const canvas = createCanvas(canvasWidth, canvasHeight);
  const ctx = canvas.getContext('2d');

  const bannerUrl = guildData?.leaderboardBannerUrl || defaultBannerUrl;
  let bannerImage = null;
  if (bannerUrl) {
    try {
      bannerImage = await loadImage(bannerUrl);
    } catch (err) {
      console.error(`Failed to load leaderboard banner: ${bannerUrl}`, err);
    }
  }

  if (bannerImage) {
    ctx.drawImage(bannerImage, 0, 0, canvasWidth, canvasHeight);
  } else {
    const gradient = ctx.createLinearGradient(0, 0, canvasWidth, canvasHeight);
    gradient.addColorStop(0, '#22303c');
    gradient.addColorStop(1, '#141927');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  }

  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  ctx.strokeStyle = '#FFD700';
  ctx.lineWidth = 8;
  ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 56px Arial, sans-serif';
  ctx.fillText('Leaderboard', 40, 110);

  ctx.font = 'bold 28px Arial, sans-serif';
  ctx.fillText('Rank', 40, 220);
  ctx.fillText('User', 140, 220);
  ctx.fillText('Level', 500, 220);
  ctx.fillText('XP', 700, 220);

  for (let index = 0; index < topMembers.length; index++) {
    const member = topMembers[index];
    let userTag = 'Unknown User';
    let avatarURL = 'https://cdn.discordapp.com/embed/avatars/0.png';

    try {
      const user = await client.users.fetch(member.userId);
      if (user) {
        userTag = user.tag;
        avatarURL = user.displayAvatarURL({ format: 'png', size: 64 });
      }
    } catch (err) {
      console.error(`Failed to fetch user ${member.userId}:`, err);
    }

    const y = 260 + index * 50;

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '24px Arial, sans-serif';
    ctx.fillText(`#${index + 1}`, 40, y);

    try {
      const avatar = await loadImage(avatarURL);
      ctx.drawImage(avatar, 100, y - 30, 40, 40);
    } catch (err) {
      console.error(`Failed to load avatar for ${member.userId}:`, err);
    }

    ctx.fillText(userTag, 160, y);
    ctx.fillText(`${member.level}`, 500, y);
    ctx.fillText(`${member.xp}`, 700, y);
  }

  const buffer = await canvas.encode('png');
  return new AttachmentBuilder(buffer, { name: 'leaderboard.png' });
}

async function createLevelLeaderboardEmbed(client, guildId) {
  const leaderboard = await MemberData.find({ guildId }).sort({ level: -1, xp: -1 }).lean();
  if (!leaderboard.length) {
    return new EmbedBuilder()
      .setTitle('Level Leaderboard')
      .setDescription('No members found in the leaderboard.')
      .setColor('Grey')
      .setTimestamp();
  }

  const topMembers = leaderboard.slice(0, 10);
  const rows = await Promise.all(
    topMembers.map(async (member, index) => {
      let userLabel = `Unknown User (${member.userId})`;
      try {
        const user = await client.users.fetch(member.userId);
        if (user) userLabel = user.tag;
      } catch {
        // ignore missing users
      }
      return `**#${index + 1}** • ${userLabel}\n• Level: **${member.level}** • XP: **${member.xp}**`;
    })
  );

  return new EmbedBuilder()
    .setTitle('Level Leaderboard')
    .setDescription(rows.join('\n\n'))
    .setColor('Gold')
    .setTimestamp();
}

async function renderVoiceLeaderboardImage(client, guildId, guildData) {
  const leaderboard = await MemberData.find({ guildId, voiceXp: { $gt: 0 } })
    .sort({ voiceXp: -1, voiceSeconds: -1 })
    .lean();
  if (!leaderboard.length) return null;

  const topMembers = leaderboard.slice(0, 10);
  const canvasWidth = 950;
  const canvasHeight = 600;
  const canvas = createCanvas(canvasWidth, canvasHeight);
  const ctx = canvas.getContext('2d');

  const bannerUrl = guildData?.leaderboardBannerUrl || defaultBannerUrl;
  let bannerImage = null;
  if (bannerUrl) {
    try {
      bannerImage = await loadImage(bannerUrl);
    } catch (err) {
      console.error(`Failed to load leaderboard banner: ${bannerUrl}`, err);
    }
  }

  if (bannerImage) {
    ctx.drawImage(bannerImage, 0, 0, canvasWidth, canvasHeight);
  } else {
    const gradient = ctx.createLinearGradient(0, 0, canvasWidth, canvasHeight);
    gradient.addColorStop(0, '#22303c');
    gradient.addColorStop(1, '#141927');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  }

  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  ctx.strokeStyle = '#FFD700';
  ctx.lineWidth = 8;
  ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 56px Arial, sans-serif';
  ctx.fillText('Voice Leaderboard', 40, 110);

  ctx.font = 'bold 28px Arial, sans-serif';
  ctx.fillText('Rank', 40, 220);
  ctx.fillText('User', 140, 220);
  ctx.fillText('VC XP', 520, 220);
  ctx.fillText('Time', 720, 220);

  for (let index = 0; index < topMembers.length; index++) {
    const member = topMembers[index];
    let userTag = 'Unknown User';
    let avatarURL = 'https://cdn.discordapp.com/embed/avatars/0.png';

    try {
      const user = await client.users.fetch(member.userId);
      if (user) {
        userTag = user.tag;
        avatarURL = user.displayAvatarURL({ format: 'png', size: 64 });
      }
    } catch (err) {
      console.error(`Failed to fetch user ${member.userId}:`, err);
    }

    const y = 260 + index * 50;

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '24px Arial, sans-serif';
    ctx.fillText(`#${index + 1}`, 40, y);

    try {
      const avatar = await loadImage(avatarURL);
      ctx.drawImage(avatar, 100, y - 30, 40, 40);
    } catch (err) {
      console.error(`Failed to load avatar for ${member.userId}:`, err);
    }

    ctx.fillText(userTag, 160, y);
    ctx.fillText(`${member.voiceXp}`, 520, y);
    ctx.fillText(formatDuration(member.voiceSeconds || 0), 720, y);
  }

  const buffer = await canvas.encode('png');
  return new AttachmentBuilder(buffer, { name: 'vcleaderboard.png' });
}

async function createVoiceLeaderboardEmbed(client, guildId) {
  const leaderboard = await MemberData.find({ guildId, voiceXp: { $gt: 0 } })
    .sort({ voiceXp: -1, voiceSeconds: -1 })
    .lean();

  if (!leaderboard.length) {
    return new EmbedBuilder()
      .setTitle('Voice Activity Leaderboard')
      .setDescription('No voice activity XP has been recorded yet.')
      .setColor('Blue')
      .setTimestamp();
  }

  const topMembers = leaderboard.slice(0, 10);
  const rows = await Promise.all(
    topMembers.map(async (member, index) => {
      let userLabel = `Unknown User (${member.userId})`;
      try {
        const user = await client.users.fetch(member.userId);
        if (user) userLabel = `${user.username}#${user.discriminator}`;
      } catch {
        // ignore fetch errors
      }
      return `**#${index + 1}** • ${userLabel}\n• VC XP: **${member.voiceXp}** • Time: **${formatDuration(
        member.voiceSeconds || 0
      )}**`;
    })
  );

  return new EmbedBuilder()
    .setTitle('Voice Activity Leaderboard')
    .setDescription(rows.join('\n\n'))
    .setColor('Blue')
    .setTimestamp();
}

async function postLeaderboardUpdate(client, guildId, channelId) {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return;

  const channel = guild.channels.cache.get(channelId) || (await client.channels.fetch(channelId).catch(() => null));
  if (!channel || !channel.isTextBased()) return;

  const guildData = await GuildSettings.findOne({ guildId });
  if (!guildData || !guildData.levelingEnabled) return;

  const levelEmbed = await createLevelLeaderboardEmbed(client, guildId);
  const voiceEmbed = await createVoiceLeaderboardEmbed(client, guildId);
  const lastUpdate = new Date();
  const nextUpdateText = '1 hour';

  const updateEmbed = new EmbedBuilder()
    .setTitle('Leaderboard Update')
    .addFields(
      { name: 'Last Update', value: `<t:${Math.floor(lastUpdate.getTime() / 1000)}:F>`, inline: false },
      { name: 'Updating in', value: nextUpdateText, inline: false }
    )
    .setColor('Blue')
    .setTimestamp(lastUpdate);

  if (levelEmbed.data.description.startsWith('No members') && voiceEmbed.data.description.startsWith('No voice activity')) {
    return;
  }

  let previousMessage;
  if (guildData.leaderboardUpdateMessageId) {
    try {
      previousMessage = await channel.messages.fetch(guildData.leaderboardUpdateMessageId);
    } catch {
      previousMessage = null;
    }
  }

  if (previousMessage) {
    await previousMessage.delete().catch(() => null);
  }

  const message = await channel.send({
    content: '📊 Hourly leaderboard update',
    embeds: [updateEmbed, levelEmbed, voiceEmbed],
  });

  await GuildSettings.findOneAndUpdate(
    { guildId },
    { leaderboardUpdateMessageId: message.id },
    { upsert: true }
  );
}

function startLeaderboardScheduler(client) {
  const runAll = async () => {
    const guildSettings = await GuildSettings.find({ leaderboardChannelId: { $ne: null } });
    if (!guildSettings.length) return;
    await Promise.allSettled(
      guildSettings.map((settings) =>
        postLeaderboardUpdate(client, settings.guildId, settings.leaderboardChannelId)
      )
    );
  };

  runAll().catch((err) => console.error('Leaderboard scheduler startup error:', err));
  setInterval(() => {
    runAll().catch((err) => console.error('Leaderboard scheduler error:', err));
  }, 60 * 60 * 1000);
  console.log('✅ Hourly leaderboard scheduler started');
}

module.exports = startLeaderboardScheduler;
