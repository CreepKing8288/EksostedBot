const { Events } = require('discord.js');
const { MemberData } = require('../models/Level');

module.exports = {
  name: Events.GuildMemberRemove,
  async execute(member) {
    try {
      await MemberData.deleteOne({
        guildId: member.guild.id,
        userId: member.user.id,
      });
    } catch (error) {
      console.error('Error cleaning up member data on leave:', error);
    }
  },
};
