const { Events } = require('discord.js');

module.exports = {
  name: Events.MessageReactionRemove,
  once: false,
  async execute(reaction, user) {
    const { handleReaction } = require('../../utils/starboardHelper');
    return handleReaction(reaction, user, false);
  },
};
