const { Events } = require('discord.js');

module.exports = {
  name: Events.MessageReactionAdd,
  once: false,
  async execute(reaction, user) {
    console.log(`[Starboard] Reaction added: ${reaction.emoji.name} by ${user.tag} on message ${reaction.message.id}`);
    const { handleReaction } = require('../../utils/starboardHelper');
    return handleReaction(reaction, user, true);
  },
};
