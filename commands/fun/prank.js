const {
  SlashCommandBuilder,
  EmbedBuilder,
  ChannelType,
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('prank')
    .setDescription('Prank the server members!')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('fakeban')
        .setDescription('Fake ban a user (just kidding!)')
        .addUserOption((option) =>
          option
            .setName('user')
            .setDescription('The user to "ban"')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('fakedm')
        .setDescription('Send a fake DM notification')
        .addUserOption((option) =>
          option.setName('user').setDescription('The user').setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('message')
            .setDescription('The fake message content')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('nick')
        .setDescription("Change a user's nickname to something funny")
        .addUserOption((option) =>
          option
            .setName('user')
            .setDescription('The user to prank')
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('nickname')
            .setDescription('The funny nickname')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('role')
        .setDescription('Give a user a funny role temporarily')
        .addUserOption((option) =>
          option
            .setName('user')
            .setDescription('The user to prank')
            .setRequired(true)
        )
        .addRoleOption((option) =>
          option
            .setName('role')
            .setDescription('The role to give')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('fakereport')
        .setDescription('Send a fake report notification')
        .addUserOption((option) =>
          option
            .setName('user')
            .setDescription('The reported user')
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('reason')
            .setDescription('The fake report reason')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('hack')
        .setDescription('Fake hacking animation on a user')
        .addUserOption((option) =>
          option
            .setName('user')
            .setDescription('The user to "hack"')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('mirror')
        .setDescription("Mirror a user's messages")
        .addUserOption((option) =>
          option
            .setName('user')
            .setDescription('The user to mirror')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('vaporwave')
        .setDescription('Give a user a vaporwave aesthetic role')
        .addUserOption((option) =>
          option
            .setName('user')
            .setDescription('The user to vaporwave')
            .setRequired(true)
        )
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (!interaction.member.permissions.has('Administrator')) {
      return interaction.reply({
        content: 'You need `Administrator` permission to use this command!',
        ephemeral: true,
      });
    }

    switch (subcommand) {
      case 'fakeban': {
        const user = interaction.options.getUser('user');
        const member = interaction.guild.members.cache.get(user.id);

        if (!member) {
          return interaction.reply({
            content: 'User not found in this server!',
            ephemeral: true,
          });
        }

        const fakeBanEmbed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('🔨 User Banned')
          .setDescription(`${user.tag} has been banned from the server!`)
          .addFields(
            { name: 'Reason', value: 'Enjoy your vacation 😈', inline: true },
            { name: 'Banned by', value: interaction.user.tag, inline: true }
          )
          .setTimestamp();

        await interaction.reply({ embeds: [fakeBanEmbed] });

        const originalNick = member.nickname || user.username;
        await member.setNickname(`[PRANKED] ${originalNick}`).catch(() => {});

        setTimeout(async () => {
          try {
            await member.setNickname(originalNick);
          } catch (e) {}
        }, 10000);

        setTimeout(async () => {
          const undoEmbed = new EmbedBuilder()
            .setColor(0x00ff00)
            .setTitle('😂 Just Kidding!')
            .setDescription(
              `Good news! ${user.tag} was NOT actually banned. It was just a prank!`
            )
            .setTimestamp();
          await interaction.channel.send({ embeds: [undoEmbed] });
        }, 5000);
        break;
      }

      case 'fakedm': {
        const user = interaction.options.getUser('user');
        const fakeMessage = interaction.options.getString('message');

        const fakeDmEmbed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle('📩 Fake DM Sent')
          .setDescription(`Pretended to send a DM to ${user.tag}`)
          .addFields({
            name: 'Fake Message',
            value: fakeMessage,
            inline: false,
          })
          .setTimestamp();

        await interaction.reply({ embeds: [fakeDmEmbed] });
        break;
      }

      case 'nick': {
        const user = interaction.options.getUser('user');
        const newNick = interaction.options.getString('nickname');
        const member = interaction.guild.members.cache.get(user.id);

        if (!member) {
          return interaction.reply({
            content: 'User not found in this server!',
            ephemeral: true,
          });
        }

        const originalNick = member.nickname || user.username;

        try {
          await member.setNickname(newNick);

          const nickEmbed = new EmbedBuilder()
            .setColor(0x00ff00)
            .setTitle('😏 Nickname Changed')
            .setDescription(`${user.tag}'s nickname was changed!`)
            .addFields(
              { name: 'Old Nickname', value: originalNick, inline: true },
              { name: 'New Nickname', value: newNick, inline: true }
            )
            .setTimestamp();

          await interaction.reply({ embeds: [nickEmbed] });
        } catch (error) {
          return interaction.reply({
            content: "I cannot change this user's nickname!",
            ephemeral: true,
          });
        }
        break;
      }

      case 'role': {
        const user = interaction.options.getUser('user');
        const role = interaction.options.getRole('role');
        const member = interaction.guild.members.cache.get(user.id);

        if (!member) {
          return interaction.reply({
            content: 'User not found in this server!',
            ephemeral: true,
          });
        }

        const hasRole = member.roles.cache.has(role.id);
        const action = hasRole ? 'removed from' : 'added to';
        const actionVerb = hasRole ? 'Removing' : 'Giving';

        await member.roles[hasRole ? 'remove' : 'add'](role.id);

        const roleEmbed = new EmbedBuilder()
          .setColor(0xffd700)
          .setTitle('🎭 Role Prank')
          .setDescription(`${actionVerb} ${role.name} ${action} ${user.tag}!`)
          .setTimestamp();

        await interaction.reply({ embeds: [roleEmbed] });
        break;
      }

      case 'fakereport': {
        const user = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason');

        const reportEmbed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('⚠️ User Reported')
          .setDescription(`${user.tag} has been reported!`)
          .addFields(
            { name: 'Report Reason', value: reason, inline: true },
            { name: 'Reported by', value: interaction.user.tag, inline: true }
          )
          .setTimestamp();

        await interaction.reply({ embeds: [reportEmbed] });

        setTimeout(async () => {
          const fakeModEmbed = new EmbedBuilder()
            .setColor(0x00ff00)
            .setTitle('🛡️ Report Dismissed')
            .setDescription(
              `Fake report against ${user.tag} was dismissed. No action taken.`
            )
            .setTimestamp();
          await interaction.channel.send({ embeds: [fakeModEmbed] });
        }, 5000);
        break;
      }

      case 'hack': {
        const user = interaction.options.getUser('user');

        await interaction.reply({
          content: `🔓 Hacking ${user.tag}...`,
        });

        const stages = [
          'Bypassing firewall...',
          'Accessing private files...',
          'Downloading data...',
          'Covering tracks...',
          'Hacking complete!',
        ];

        for (let i = 0; i < stages.length; i++) {
          await new Promise((resolve) => setTimeout(resolve, 1500)).then(
            async () => {
              const hackEmbed = new EmbedBuilder()
                .setColor(0x00ff00)
                .setTitle('💻 HACKING IN PROGRESS')
                .setDescription(`${user.tag}`)
                .addFields(
                  { name: 'Status', value: stages[i], inline: false },
                  {
                    name: 'Progress',
                    value: '█'.repeat(i + 1) + '░'.repeat(4 - i),
                    inline: false,
                  }
                )
                .setTimestamp();
              await interaction.editReply({ embeds: [hackEmbed] });
            }
          );
        }

        setTimeout(async () => {
          const completeEmbed = new EmbedBuilder()
            .setColor(0x9b59b6)
            .setTitle('😂 Just Kidding!')
            .setDescription(
              `I didn't actually hack ${user.tag}. That was just for fun!`
            )
            .setTimestamp();
          await interaction.editReply({ embeds: [completeEmbed] });
        }, 3000);
        break;
      }

      case 'mirror': {
        const user = interaction.options.getUser('user');

        const mirrorEmbed = new EmbedBuilder()
          .setColor(0x00ffff)
          .setTitle('🪞 Mirror Mode Activated')
          .setDescription(`${user.tag}'s messages will appear mirrored!`)
          .addFields({
            name: 'Warning',
            value: 'Type in chat and see the magic! (Lasts 30 seconds)',
            inline: false,
          })
          .setTimestamp();

        await interaction.reply({ embeds: [mirrorEmbed] });

        const collectorFilter = (m) => m.author.id === user.id;
        const collector = interaction.channel.createMessageCollector({
          filter: collectorFilter,
          time: 30000,
        });

        collector.on('collect', async (message) => {
          const mirroredText = message.content.split('').reverse().join('');
          await message.reply(`🪞 Mirrored: ${mirroredText}`);
        });

        collector.on('end', async () => {
          const endEmbed = new EmbedBuilder()
            .setColor(0x808080)
            .setTitle('🪞 Mirror Mode Ended')
            .setDescription('The mirror effect has been deactivated.')
            .setTimestamp();
          await interaction.channel.send({ embeds: [endEmbed] });
        });
        break;
      }

      case 'vaporwave': {
        const user = interaction.options.getUser('user');
        const member = interaction.guild.members.cache.get(user.id);

        if (!member) {
          return interaction.reply({
            content: 'User not found in this server!',
            ephemeral: true,
          });
        }

        const vaporNick = `( ⌑̈⑅ᵔ༚ᵔ⌑̈ ) ${user.username}`;

        try {
          await member.setNickname(vaporNick);

          const vaporEmbed = new EmbedBuilder()
            .setColor(0xff71ce)
            .setTitle('🌆 Vaporwave Mode')
            .setDescription(`${user.tag} has been vaporized!`)
            .setFields({
              name: 'New Nickname',
              value: vaporNick,
              inline: false,
            })
            .setTimestamp();

          await interaction.reply({ embeds: [vaporEmbed] });
        } catch (error) {
          return interaction.reply({
            content: "I cannot change this user's nickname!",
            ephemeral: true,
          });
        }
        break;
      }
    }
  },
};
