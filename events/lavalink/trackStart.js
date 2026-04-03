const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const { formatTime, createProgressBar } = require('../../utils/utils');

const guildVolumes = new Map();

function getVolume(player) {
  return guildVolumes.get(player.guildId) ?? player.volume ?? 100;
}

function setVolume(player, vol) {
  const clamped = Math.max(0, Math.min(150, vol));
  guildVolumes.set(player.guildId, clamped);
  player.setVolume(clamped);
  return clamped;
}

module.exports = {
  name: 'trackStart',
  isNodeEvent: false,
  async execute(client, player, track) {
    const channel = client.channels.cache.get(player.textChannelId);
    if (!channel) return;

    const volume = getVolume(player);

    const embed = new EmbedBuilder()
      .setColor('#DDA0DD')
      .setAuthor({ name: 'Now Playing 🎵', iconURL: client.user.displayAvatarURL() })
      .setTitle(track.info.title)
      .setURL(track.info.uri)
      .setThumbnail(track.info.artworkUrl)
      .addFields(
        { name: '👤 Artist', value: `\`${track.info.author}\``, inline: true },
        { name: '⌛ Duration', value: `\`${formatTime(track.info.duration)}\``, inline: true },
        { name: '🔊 Volume', value: `\`${volume}%\``, inline: true }
      )
      .setFooter({ text: `Requested by ${track.userData?.requester?.user?.tag || 'Unknown'}`, iconURL: track.userData?.requester?.user?.displayAvatarURL() })
      .setTimestamp();

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('pause').setEmoji('⏸️').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('resume').setEmoji('▶️').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('skip').setEmoji('⏭️').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('stop').setEmoji('⏹️').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('shuffle').setEmoji('🔀').setStyle(ButtonStyle.Secondary)
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('loop').setEmoji('🔄').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('voldown').setEmoji('🔉').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('volup').setEmoji('🔊').setStyle(ButtonStyle.Secondary),
      new StringSelectMenuBuilder()
        .setCustomId('volume_select')
        .setPlaceholder(`Volume: ${volume}%`)
        .addOptions(
          new StringSelectMenuOptionBuilder().setLabel('25%').setValue('25'),
          new StringSelectMenuOptionBuilder().setLabel('50%').setValue('50'),
          new StringSelectMenuOptionBuilder().setLabel('75%').setValue('75'),
          new StringSelectMenuOptionBuilder().setLabel('100%').setValue('100'),
          new StringSelectMenuOptionBuilder().setLabel('150%').setValue('150')
        )
    );

    const message = await channel.send({ embeds: [embed], components: [row1, row2] });

    const collector = message.createMessageComponentCollector({ time: 300000 });

    collector.on('collect', async (i) => {
      try {
        const currentPlayer = client.lavalink.players.get(player.guildId);
        if (!currentPlayer) return;

        switch (i.customId) {
          case 'pause':
            await currentPlayer.pause();
            await i.reply({ content: '⏸️ Paused', ephemeral: true });
            break;
          case 'resume':
            await currentPlayer.resume();
            await i.reply({ content: '▶️ Resumed', ephemeral: true });
            break;
          case 'skip':
            if (currentPlayer.queue.tracks?.length) {
              await currentPlayer.skip();
              await i.reply({ content: '⏭️ Skipped', ephemeral: true });
            } else {
              await i.reply({ content: 'Queue is empty!', ephemeral: true });
            }
            break;
          case 'stop':
            await currentPlayer.stopPlaying();
            await i.reply({ content: '⏹️ Stopped', ephemeral: true });
            break;
          case 'shuffle': {
            if (currentPlayer.queue.tracks?.length) {
              currentPlayer.queue.shuffle();
              await i.reply({ content: '🔀 Queue shuffled!', ephemeral: true });
            } else {
              await i.reply({ content: 'Queue is empty!', ephemeral: true });
            }
            break;
          }
          case 'loop': {
            const modes = ['off', 'track', 'queue'];
            const current = currentPlayer.repeatMode;
            const next = modes[(modes.indexOf(current) + 1) % modes.length];
            currentPlayer.setRepeatMode(next);
            const emoji = next === 'off' ? '🔁' : next === 'track' ? '🔂' : '🔁';
            await i.reply({ content: `${emoji} Loop mode: **${next}**`, ephemeral: true });
            break;
          }
          case 'voldown': {
            const vol = getVolume(currentPlayer);
            const newVol = setVolume(currentPlayer, vol - 10);
            await i.reply({ content: `🔉 Volume: **${newVol}%**`, ephemeral: true });
            break;
          }
          case 'volup': {
            const vol = getVolume(currentPlayer);
            const newVol = setVolume(currentPlayer, vol + 10);
            await i.reply({ content: `🔊 Volume: **${newVol}%**`, ephemeral: true });
            break;
          }
          case 'volume_select': {
            const vol = parseInt(i.values[0], 10);
            const newVol = setVolume(currentPlayer, vol);
            await i.reply({ content: `🔊 Volume set to **${newVol}%**`, ephemeral: true });
            break;
          }
        }
      } catch (err) {
        if (err.code !== 40060) console.error('Controls error:', err.message);
      }
    });

    collector.on('end', () => {
      const disabledRow1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('pause').setEmoji('⏸️').setStyle(ButtonStyle.Secondary).setDisabled(true),
        new ButtonBuilder().setCustomId('resume').setEmoji('▶️').setStyle(ButtonStyle.Secondary).setDisabled(true),
        new ButtonBuilder().setCustomId('skip').setEmoji('⏭️').setStyle(ButtonStyle.Secondary).setDisabled(true),
        new ButtonBuilder().setCustomId('stop').setEmoji('⏹️').setStyle(ButtonStyle.Danger).setDisabled(true),
        new ButtonBuilder().setCustomId('shuffle').setEmoji('🔀').setStyle(ButtonStyle.Secondary).setDisabled(true)
      );
      const disabledRow2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('loop').setEmoji('🔄').setStyle(ButtonStyle.Secondary).setDisabled(true),
        new ButtonBuilder().setCustomId('voldown').setEmoji('🔉').setStyle(ButtonStyle.Secondary).setDisabled(true),
        new ButtonBuilder().setCustomId('volup').setEmoji('🔊').setStyle(ButtonStyle.Secondary).setDisabled(true),
        new StringSelectMenuBuilder().setCustomId('volume_select').setPlaceholder('Volume').setDisabled(true)
      );
      message.edit({ components: [disabledRow1, disabledRow2] }).catch(() => {});
    });
  },
};
