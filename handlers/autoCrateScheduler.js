const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const CrateConfig = require('../models/CrateConfig');

const crateInfo = {
  small: {
    label: 'Small Crate',
    description: 'A small reward crate. Fast and easy to claim.',
    color: 0x57f287,
  },
  medium: {
    label: 'Medium Crate',
    description: 'A medium reward crate with a better XP prize.',
    color: 0xf1c40f,
  },
  large: {
    label: 'Large Crate',
    description: 'A large reward crate for a big XP bonus.',
    color: 0xe91e63,
  },
};

const randomBetween = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const crateSizes = Object.keys(crateInfo);

module.exports = async (client) => {
  const timers = new Map();

  const clearGuildTimer = (guildId) => {
    const timeout = timers.get(guildId);
    if (timeout) {
      clearTimeout(timeout);
      timers.delete(guildId);
    }
  };

  const scheduleGuild = async (guildId) => {
    clearGuildTimer(guildId);

    const config = await CrateConfig.findOne({ guildId });
    if (!config || !config.enabled || !config.autoDropEnabled || !config.dropChannelId) {
      return;
    }

    const min = Math.max(1, config.autoMinIntervalMinutes ?? 60);
    const max = Math.max(min, config.autoMaxIntervalMinutes ?? 120);
    const delayMinutes = randomBetween(min, max);
    const delayMs = delayMinutes * 60_000;

    const timeout = setTimeout(async () => {
      try {
        const latestConfig = await CrateConfig.findOne({ guildId });
        if (!latestConfig || !latestConfig.enabled || !latestConfig.autoDropEnabled || !latestConfig.dropChannelId) {
          return;
        }
        await sendAutoDrop(client, latestConfig);
      } catch (error) {
        console.error('Auto crate drop error:', error);
      } finally {
        await scheduleGuild(guildId);
      }
    }, delayMs);

    timers.set(guildId, timeout);
    const guild = client.guilds.cache.get(guildId);
    const name = guild ? guild.name : guildId;
    console.log(`✅ Scheduled next crate drop for ${name} in ${delayMinutes} minute(s)`);
  };

  const sendAutoDrop = async (client, config) => {
    const guild = client.guilds.cache.get(config.guildId);
    if (!guild) {
      console.warn(`⚠️ Cannot send auto crate drop: guild ${config.guildId} is not cached.`);
      return;
    }

    let channel = guild.channels.cache.get(config.dropChannelId);
    if (!channel) {
      try {
        channel = await guild.channels.fetch(config.dropChannelId);
      } catch (err) {
        console.warn(`⚠️ Cannot fetch drop channel ${config.dropChannelId} for guild ${guild.id}.`);
      }
    }

    if (!channel || !channel.isTextBased()) {
      console.warn(`⚠️ Invalid drop channel for guild ${guild.id}.`);
      return;
    }

    const size = crateSizes[randomBetween(0, crateSizes.length - 1)];
    const crate = crateInfo[size];
    const claimLimit = Math.max(
      1,
      config.claimLimits?.[size] ?? { small: 3, medium: 2, large: 1 }[size]
    );
    const expiryMinutes = Math.max(1, config.claimExpiryMinutes ?? 5);

    if (!client.activeCrateMessages) {
      client.activeCrateMessages = new Map();
    }

    const embed = new EmbedBuilder()
      .setTitle(`${crate.label} Has Appeared!`)
      .setDescription(
        `${crate.description}\n\nThis crate can be claimed by up to **${claimLimit}** users. It will expire in **${expiryMinutes}** minute(s).`
      )
      .setColor(crate.color)
      .addFields({ name: 'How to Claim', value: 'Press the button below to claim the crate before it expires.' });

    const button = new ButtonBuilder()
      .setCustomId(`claimcrate_${size}`)
      .setLabel('Claim Crate')
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(button);

    const message = await channel.send({ embeds: [embed], components: [row] });
    client.activeCrateMessages.set(message.id, {
      size,
      maxClaims: claimLimit,
      claimedBy: new Set(),
    });

    setTimeout(async () => {
      try {
        const current = await message.fetch();
        const crateState = client.activeCrateMessages.get(message.id);
        if (crateState && crateState.claimedBy.size > 0) {
          const claimers = [...crateState.claimedBy].map(id => `<@${id}>`).join(', ');
          await current.channel.send(`⏰ This crate has expired! Claimed by: ${claimers}`);
        }
        await current.delete();
      } catch (error) {
        if (error.code !== 10008) {
          console.error('Failed to delete expired crate message:', error);
        }
      } finally {
        client.activeCrateMessages.delete(message.id);
      }
    }, expiryMinutes * 60_000);
  };

  client.scheduleCrateDropsForGuild = scheduleGuild;
  client.cancelCrateDropSchedule = clearGuildTimer;

  const initialize = async () => {
    if (!client.isReady()) {
      client.once('ready', initialize);
      return;
    }

    const configs = await CrateConfig.find({ enabled: true, autoDropEnabled: true, dropChannelId: { $ne: null } });
    for (const config of configs) {
      scheduleGuild(config.guildId);
    }
  };

  await initialize();
};
