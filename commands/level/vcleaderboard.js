const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const { MemberData, GuildSettings } = require('../../models/Level');
const { createCanvas, loadImage } = require('@napi-rs/canvas');

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

module.exports = {
  data: new SlashCommandBuilder()
    .setName('vcleaderboard')
    .setDescription('View the server voice leaderboard based on VC XP.'),

  async execute(interaction) {
    await interaction.deferReply();

    const guildData = await GuildSettings.findOne({ guildId: interaction.guild.id });
    if (!guildData || !guildData.levelingEnabled) {
      return interaction.editReply({
        content: '❌ Leveling system is not enabled in this server.',
      });
    }

    const leaderboard = await MemberData.find({ guildId: interaction.guild.id, voiceXp: { $gt: 0 } })
      .sort({ voiceXp: -1, voiceSeconds: -1 })
      .lean();

    if (!leaderboard.length) {
      return interaction.editReply({
        content: 'No voice activity XP has been recorded yet.',
      });
    }

    const topMembers = leaderboard.slice(0, 10);
    const canvasWidth = 950;
    const canvasHeight = 750;
    const canvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext('2d');

    const bannerUrl = guildData.leaderboardBannerUrl || defaultBannerUrl;
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
        const user = await interaction.client.users.fetch(member.userId);
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
    const attachment = new AttachmentBuilder(buffer, { name: 'vcleaderboard.png' });

    await interaction.editReply({
      content: 'Here is the current voice leaderboard:',
      files: [attachment],
    });
  },
};
