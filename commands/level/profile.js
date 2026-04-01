const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const { MemberData, GuildSettings } = require('../../models/Level');
const { createCanvas, loadImage } = require('@napi-rs/canvas');

const calculateXpNeeded = (level, guildData) => {
  if (level === 1) return guildData.startingXp || 100;
  return (guildData.startingXp || 100) + (level - 1) * (guildData.xpPerLevel || 50);
};

const wrapText = (ctx, text, x, y, maxWidth, lineHeight) => {
  const words = text.split(' ');
  let line = '';

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    const testWidth = metrics.width;
    if (testWidth > maxWidth && n > 0) {
      ctx.fillText(line, x, y);
      line = words[n] + ' ';
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line.trim(), x, y);
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('Show a profile card for a user')
    .addUserOption((option) =>
      option.setName('user').setDescription('The user to show').setRequired(false)
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const target = interaction.options.getUser('user') || interaction.user;
    const guildData = await GuildSettings.findOne({
      guildId: interaction.guild.id,
    });

    if (!guildData || !guildData.levelingEnabled) {
      return interaction.editReply({
        content: '❌ Leveling system is not enabled in this server.',
      });
    }

    const memberData = await MemberData.findOne({
      guildId: interaction.guild.id,
      userId: target.id,
    });

    if (!memberData) {
      return interaction.editReply({
        content: 'No profile data found for that user.',
      });
    }

    const rank =
      (await MemberData.countDocuments({
        guildId: interaction.guild.id,
        $or: [
          { level: { $gt: memberData.level } },
          { level: memberData.level, xp: { $gt: memberData.xp } },
        ],
      })) + 1;

    const xpNeeded = calculateXpNeeded(memberData.level, guildData);
    const xpPercent = Math.min(
      Math.max(memberData.xp / xpNeeded, 0),
      1
    );

    const canvasWidth = 1000;
    const canvasHeight = 600;
    const canvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext('2d');

    const backgroundUrl = guildData.leaderboardBannerUrl || null;
    let backgroundImage = null;
    if (backgroundUrl) {
      try {
        backgroundImage = await loadImage(backgroundUrl);
      } catch (err) {
        console.error('Profile background load failed:', err);
      }
    }

    if (backgroundImage) {
      ctx.drawImage(backgroundImage, 0, 0, canvasWidth, canvasHeight);
    } else {
      const gradient = ctx.createLinearGradient(0, 0, 0, canvasHeight);
      gradient.addColorStop(0, '#1f2330');
      gradient.addColorStop(1, '#090b14');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    }

    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.strokeRect(24, 24, canvasWidth - 48, canvasHeight - 48);

    const avatarSize = 170;
    const avatarX = 70;
    const avatarY = 100;
    try {
      const avatar = await loadImage(
        target.displayAvatarURL({ format: 'png', size: 256 })
      );
      ctx.save();
      ctx.beginPath();
      ctx.arc(
        avatarX + avatarSize / 2,
        avatarY + avatarSize / 2,
        avatarSize / 2,
        0,
        Math.PI * 2
      );
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
      ctx.restore();
    } catch (err) {
      console.error('Avatar load failed:', err);
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 42px Arial, sans-serif';
    ctx.fillText(target.username, 280, 140);

    ctx.font = '24px Arial, sans-serif';
    ctx.fillStyle = '#b8c1d4';
    ctx.fillText(`#${target.discriminator}`, 280, 175);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 72px Arial, sans-serif';
    ctx.fillText(`${memberData.level}`, 280, 280);
    ctx.font = '24px Arial, sans-serif';
    ctx.fillText('Level', 280, 315);

    ctx.font = '22px Arial, sans-serif';
    ctx.fillStyle = '#b8c1d4';
    ctx.fillText(`Rank: #${rank}`, 280, 370);
    ctx.fillText(`XP: ${memberData.xp.toLocaleString()} / ${xpNeeded.toLocaleString()}`, 280, 400);
    ctx.fillText(`Total XP: ${memberData.totalXp.toLocaleString()}`, 280, 430);
    ctx.fillText(`Voice XP: ${memberData.voiceXp?.toLocaleString() || 0}`, 280, 460);

    const barX = 280;
    const barY = 470;
    const barWidth = 640;
    const barHeight = 26;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.fillRect(barX, barY, barWidth, barHeight);
    ctx.fillStyle = '#72b3ff';
    ctx.fillRect(barX, barY, barWidth * xpPercent, barHeight);
    ctx.strokeStyle = '#ffffff';
    ctx.strokeRect(barX, barY, barWidth, barHeight);

    const aboutX = 70;
    const aboutY = 330;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px Arial, sans-serif';
    ctx.fillText('About Me', aboutX, aboutY);

    ctx.font = '20px Arial, sans-serif';
    ctx.fillStyle = '#d9e1f2';
    wrapText(ctx, memberData.aboutMe || 'No bio set.', aboutX, aboutY + 36, 360, 28);

    const achievements = memberData.achievements || [];
    const achievementsStartX = 560;
    const achievementsStartY = 330;

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px Arial, sans-serif';
    ctx.fillText('Achievements', achievementsStartX, achievementsStartY);

    ctx.font = '18px Arial, sans-serif';
    if (achievements.length === 0) {
      ctx.fillStyle = '#d9e1f2';
      ctx.fillText('No achievements earned yet.', achievementsStartX, achievementsStartY + 40);
    } else {
      const displayed = achievements.slice(0, 4);
      let achievementY = achievementsStartY + 40;
      for (const achievement of displayed) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.fillRect(achievementsStartX, achievementY - 24, 380, 72);

        if (achievement.iconUrl) {
          try {
            const icon = await loadImage(achievement.iconUrl);
            ctx.drawImage(icon, achievementsStartX + 10, achievementY - 18, 50, 50);
          } catch {
            ctx.fillStyle = '#7289da';
            ctx.fillRect(achievementsStartX + 10, achievementY - 18, 50, 50);
          }
        } else {
          ctx.fillStyle = '#7289da';
          ctx.fillRect(achievementsStartX + 10, achievementY - 18, 50, 50);
        }

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 20px Arial, sans-serif';
        ctx.fillText(achievement.title, achievementsStartX + 70, achievementY + 8);
        ctx.fillStyle = '#d9e1f2';
        ctx.font = '16px Arial, sans-serif';
        wrapText(
          ctx,
          achievement.description,
          achievementsStartX + 70,
          achievementY + 30,
          300,
          20
        );
        achievementY += 90;
      }

      if (achievements.length > 4) {
        ctx.fillStyle = '#d9e1f2';
        ctx.font = '18px Arial, sans-serif';
        ctx.fillText(
          `+${achievements.length - 4} more achievements`,
          achievementsStartX,
          achievementY - 30
        );
      }
    }

    const buffer = await canvas.encode('png');
    const attachment = new AttachmentBuilder(buffer, {
      name: 'profile.png',
    });

    await interaction.editReply({ files: [attachment] });
  },
};
