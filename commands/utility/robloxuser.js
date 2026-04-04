const {
  SlashCommandBuilder,
  EmbedBuilder,
} = require('discord.js');

async function searchUser(username) {
  const res = await fetch(`https://users.roblox.com/v1/users/search?keyword=${encodeURIComponent(username)}`);
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.data || data.data.length === 0) return null;
  return data.data[0];
}

async function getUserDetails(userId) {
  const res = await fetch(`https://users.roblox.com/v1/users/${userId}`);
  if (!res.ok) return null;
  return res.json();
}

async function getAvatarUrl(userId) {
  try {
    const res = await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?size=420x420&format=Png&isCircular=false&userIds=${userId}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.data && data.data.length > 0) {
      return data.data[0].imageUrl;
    }
  } catch {}
  return null;
}

async function getFriendCount(userId) {
  try {
    const res = await fetch(`https://friends.roblox.com/v1/users/${userId}/friends/count`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.count;
  } catch {
    return null;
  }
}

async function getFollowersCount(userId) {
  try {
    const res = await fetch(`https://friends.roblox.com/v1/users/${userId}/followers/count`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.count;
  } catch {
    return null;
  }
}

async function getFollowingCount(userId) {
  try {
    const res = await fetch(`https://friends.roblox.com/v1/users/${userId}/followings/count`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.count;
  } catch {
    return null;
  }
}

function formatNumber(num) {
  if (num === null || num === undefined) return 'N/A';
  if (num >= 1000000000) return `${(num / 1000000000).toFixed(1)}B`;
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('robloxuser')
    .setDescription('Search for a Roblox user and view their profile info')
    .addStringOption((option) =>
      option
        .setName('username')
        .setDescription('Roblox username to search for')
        .setRequired(true)
    ),

  async execute(interaction) {
    const username = interaction.options.getString('username');

    await interaction.deferReply();

    try {
      const searchResult = await searchUser(username);
      if (!searchResult) {
        return interaction.editReply({
          content: `❌ No Roblox user found matching "**${username}**".`,
        });
      }

      const [userDetails, avatarUrl, friendCount, followersCount, followingCount] = await Promise.all([
        getUserDetails(searchResult.id),
        getAvatarUrl(searchResult.id),
        getFriendCount(searchResult.id),
        getFollowersCount(searchResult.id),
        getFollowingCount(searchResult.id),
      ]);

      const embed = new EmbedBuilder()
        .setTitle(`${searchResult.displayName} (@${searchResult.name})`)
        .setURL(`https://www.roblox.com/users/${searchResult.id}/profile`)
        .setColor('#E2231A')
        .addFields(
          { name: 'ID', value: `\`${searchResult.id}\``, inline: true },
          { name: 'Display Name', value: searchResult.displayName, inline: true },
          { name: 'Username', value: `@${searchResult.name}`, inline: true },
          { name: 'Friends', value: formatNumber(friendCount), inline: true },
          { name: 'Followers', value: formatNumber(followersCount), inline: true },
          { name: 'Following', value: formatNumber(followingCount), inline: true },
          { name: 'Created', value: userDetails?.created ? `<t:${Math.floor(new Date(userDetails.created).getTime() / 1000)}:D>` : '`N/A`', inline: true },
          { name: 'Banned', value: userDetails?.isBanned ? '`Yes`' : '`No`', inline: true },
        )
        .setFooter({ text: `Profile ID: ${searchResult.id}` })
        .setTimestamp();

      if (avatarUrl) {
        embed.setThumbnail(avatarUrl);
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Roblox user search error:', error);
      await interaction.editReply({
        content: '❌ An error occurred while searching for the user.',
      });
    }
  },
};
