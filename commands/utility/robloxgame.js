const {
  SlashCommandBuilder,
  EmbedBuilder,
} = require('discord.js');

const ROBLOX_GAME_BASE = 'https://www.roblox.com/games/';

async function searchGames(keyword) {
  const res = await fetch(`https://games.roblox.com/v1/games/list?keyword=${encodeURIComponent(keyword)}&limit=10`);
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.data || data.data.length === 0) return null;
  return data.data;
}

async function getGameDetails(universeId) {
  try {
    const res = await fetch(`https://games.roblox.com/v1/games?universeIds=${universeId}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.data && data.data.length > 0) return data.data[0];
  } catch {}
  return null;
}

async function getGameThumbnail(universeId) {
  try {
    const res = await fetch(`https://thumbnails.roblox.com/v1/games/icons?universeIds=${universeId}&size=512x512&format=Png&isCircular=false`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.data && data.data.length > 0) return data.data[0].imageUrl;
  } catch {}
  return null;
}

function formatNumber(num) {
  if (num === null || num === undefined) return 'N/A';
  if (num >= 1000000000) return `${(num / 1000000000).toFixed(1)}B`;
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('robloxgame')
    .setDescription('Search for a Roblox game and view its info')
    .addStringOption((option) =>
      option
        .setName('query')
        .setDescription('Game name to search for')
        .setRequired(true)
    ),

  async execute(interaction) {
    const query = interaction.options.getString('query');

    await interaction.deferReply();

    try {
      const games = await searchGames(query);
      if (!games || games.length === 0) {
        return interaction.editReply({
          content: `❌ No Roblox games found matching "**${query}**".`,
        });
      }

      const game = games[0];
      const universeId = game.id;

      const [details, thumbnail] = await Promise.all([
        getGameDetails(universeId),
        getGameThumbnail(universeId),
      ]);

      const playing = details?.playing || game.playing || 0;
      const visits = details?.visits || game.visits || 0;
      const favorites = details?.favoritedCount || game.favoritedCount || 0;
      const maxPlayers = details?.maxPlayers || game.maxPlayers || 0;
      const creatorName = details?.creator?.name || game.creator?.name || 'Unknown';
      const creatorType = details?.creator?.type || game.creator?.type || 'User';
      const created = details?.created || game.created;
      const updated = details?.updated || game.updated;
      const description = details?.description || game.description || 'No description available.';

      const embed = new EmbedBuilder()
        .setTitle(game.name)
        .setURL(`${ROBLOX_GAME_BASE}${universeId}`)
        .setColor('#00B2FF')
        .setDescription(description.length > 250 ? `${description.slice(0, 247)}...` : description)
        .addFields(
          { name: 'Universe ID', value: `\`${universeId}\``, inline: true },
          { name: 'Playing', value: `\`${formatNumber(playing)}\``, inline: true },
          { name: 'Visits', value: `\`${formatNumber(visits)}\``, inline: true },
          { name: 'Favorites', value: `\`${formatNumber(favorites)}\``, inline: true },
          { name: 'Max Players', value: `\`${maxPlayers}\``, inline: true },
          { name: 'Creator', value: `${creatorName} (${creatorType})`, inline: true },
          { name: 'Created', value: created ? `<t:${Math.floor(new Date(created).getTime() / 1000)}:D>` : '`N/A`', inline: true },
          { name: 'Updated', value: updated ? `<t:${Math.floor(new Date(updated).getTime() / 1000)}:R>` : '`N/A`', inline: true },
        )
        .setFooter({ text: `Universe ID: ${universeId}` })
        .setTimestamp();

      if (thumbnail) {
        embed.setThumbnail(thumbnail);
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Roblox game search error:', error);
      await interaction.editReply({
        content: '❌ An error occurred while searching for the game.',
      });
    }
  },
};
