const { Events } = require('discord.js');

module.exports = {
  name: Events.MessageReactionAdd,
  once: false,
  async execute(reaction, user) {
    const { handleReaction } = require('../../utils/starboardHelper');
    return handleReaction(reaction, user, true);
  },
};
