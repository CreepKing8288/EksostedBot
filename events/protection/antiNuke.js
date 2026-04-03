const { EmbedBuilder, AuditLogEvent } = require('discord.js');
const ProtectionSettings = require('../../models/ProtectionSettings');

const nukeTracker = new Map();

module.exports = {
  name: 'guildAuditLogEntryCreate',
  once: false,
  async execute(entry, guild) {
    if (!guild) return;

    const settings = await ProtectionSettings.findOne({ guildId: guild.id });
    if (!settings || !settings.antiNuke) return;

    const destructiveActions = [
      AuditLogEvent.ChannelDelete,
      AuditLogEvent.ChannelCreate,
      AuditLogEvent.ChannelUpdate,
      AuditLogEvent.RoleDelete,
      AuditLogEvent.RoleCreate,
      AuditLogEvent.RoleUpdate,
      AuditLogEvent.WebhookCreate,
      AuditLogEvent.WebhookDelete,
      AuditLogEvent.WebhookUpdate,
      AuditLogEvent.BotAdd,
      AuditLogEvent.MemberKick,
      AuditLogEvent.MemberBanAdd,
      AuditLogEvent.MemberPrune,
      AuditLogEvent.IntegrationCreate,
      AuditLogEvent.IntegrationDelete,
      AuditLogEvent.IntegrationUpdate,
      AuditLogEvent.GuildUpdate,
    ];

    if (!destructiveActions.includes(entry.actionType)) return;

    const executorId = entry.executorId;
    if (!executorId) return;

    if (settings.whitelistedUsers.includes(executorId)) return;

    const botMember = guild.members.cache.get(guild.client.user.id);
    if (executorId === botMember?.id) return;

    if (!nukeTracker.has(guild.id)) {
      nukeTracker.set(guild.id, new Map());
    }

    const userTracker = nukeTracker.get(guild.id);
    if (!userTracker.has(executorId)) {
      userTracker.set(executorId, []);
    }

    const actions = userTracker.get(executorId);
    const now = Date.now();
    actions.push({ action: entry.actionType, timestamp: now });

    const recentActions = actions.filter((a) => now - a.timestamp < 30000);
    userTracker.set(executorId, recentActions);

    if (recentActions.length >= settings.antiNukeThreshold) {
      try {
        const executor = await guild.members.fetch(executorId).catch(() => null);
        if (!executor) return;

        const botHighestRole = botMember?.roles.highest;
        if (botHighestRole && executor.roles.highest.position >= botHighestRole.position) {
          const logChannel = guild.channels.cache.find(
            (ch) =>
              ch.name === 'protection-logs' ||
              ch.name === 'mod-logs' ||
              ch.name === 'server-logs'
          );

          const embed = new EmbedBuilder()
            .setColor(0xffa500)
            .setTitle('🛡️ Anti-Nuke Protection Alert')
            .setDescription(
              `**${executor.user.tag}** (${executorId}) triggered anti-nuke protection,\n` +
              `but I cannot punish them because they have a higher or equal role than me.`
            )
            .addFields(
              { name: 'Actions in 30s', value: `${recentActions.length}`, inline: true },
              { name: 'Threshold', value: `${settings.antiNukeThreshold}`, inline: true },
              { name: 'Punishment', value: settings.punishment, inline: true }
            )
            .setFooter({ text: 'Anti-Nuke Protection' })
            .setTimestamp();

          if (logChannel) await logChannel.send({ embeds: [embed] });
          return;
        }

        switch (settings.punishment) {
          case 'ban':
            await executor.ban({ reason: `Anti-Nuke Protection: ${recentActions.length} destructive actions in 30s` });
            break;
          case 'kick':
            await executor.kick(`Anti-Nuke Protection: ${recentActions.length} destructive actions in 30s`);
            break;
          case 'timeout':
            await executor.timeout(86400000 * 7, `Anti-Nuke Protection: ${recentActions.length} destructive actions in 30s`);
            break;
        }

        const actionNames = {
          [AuditLogEvent.ChannelDelete]: 'Channel Delete',
          [AuditLogEvent.ChannelCreate]: 'Channel Create',
          [AuditLogEvent.ChannelUpdate]: 'Channel Update',
          [AuditLogEvent.RoleDelete]: 'Role Delete',
          [AuditLogEvent.RoleCreate]: 'Role Create',
          [AuditLogEvent.RoleUpdate]: 'Role Update',
          [AuditLogEvent.WebhookCreate]: 'Webhook Create',
          [AuditLogEvent.WebhookDelete]: 'Webhook Delete',
          [AuditLogEvent.WebhookUpdate]: 'Webhook Update',
          [AuditLogEvent.BotAdd]: 'Bot Add',
          [AuditLogEvent.MemberKick]: 'Member Kick',
          [AuditLogEvent.MemberBanAdd]: 'Member Ban',
          [AuditLogEvent.MemberPrune]: 'Member Prune',
          [AuditLogEvent.IntegrationCreate]: 'Integration Create',
          [AuditLogEvent.IntegrationDelete]: 'Integration Delete',
          [AuditLogEvent.IntegrationUpdate]: 'Integration Update',
          [AuditLogEvent.GuildUpdate]: 'Guild Update',
        };

        const lastAction = recentActions[recentActions.length - 1].action;
        const actionName = actionNames[lastAction] || 'Unknown';

        const logChannel = guild.channels.cache.find(
          (ch) =>
            ch.name === 'protection-logs' ||
            ch.name === 'mod-logs' ||
            ch.name === 'server-logs'
        );

        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('🛡️ Anti-Nuke Protection Triggered')
          .setDescription(
            `**${executor.user.tag}** (${executorId}) was automatically ${settings.punishment}ed.\n` +
            `**Reason:** ${recentActions.length} destructive actions in 30 seconds.\n` +
            `**Last action:** ${actionName}`
          )
          .addFields(
            { name: 'Actions in 30s', value: `${recentActions.length}`, inline: true },
            { name: 'Threshold', value: `${settings.antiNukeThreshold}`, inline: true },
            { name: 'Punishment', value: settings.punishment, inline: true }
          )
          .setFooter({ text: 'Anti-Nuke Protection' })
          .setTimestamp();

        if (logChannel) await logChannel.send({ embeds: [embed] });

        userTracker.delete(executorId);
      } catch (err) {
        console.error(`[Anti-Nuke] Failed to punish user ${executorId}:`, err.message);
      }
    }
  },
};
