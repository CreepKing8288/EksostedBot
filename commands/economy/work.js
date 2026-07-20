const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const EksosCoin = require('../../models/EksosCoin');

const WORK_MIN = 50;
const WORK_MAX = 300;
const WORK_COOLDOWN = 60000;

const jobs = [
  'worked as a code reviewer',
  'sold lemonade on the street',
  'fixed a broken bot',
  'walked someone\'s dog',
  'delivered pizza',
  'cleaned a server room',
  'graded exams for a school',
  'built a website',
  'streamed on Twitch',
  'did some freelance art',
  'moderated a Discord server',
  'organized a LAN party',
  'wrote a bug report',
  'played songs at a café',
  'ran a marathon',
  'helped move furniture',
  'painted a mural',
  'tutored a student',
  'sold handmade crafts',
  'drove a taxi',
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('work')
    .setDescription('Work a job to earn EksosCoin.'),

  async execute(interaction) {
    const userId = interaction.user.id;
    let userData = await EksosCoin.findOne({ userId });

    if (!userData) {
      userData = await EksosCoin.create({ userId });
    }

    const now = new Date();
    if (userData.lastWork) {
      const elapsed = now.getTime() - new Date(userData.lastWork).getTime();
      if (elapsed < WORK_COOLDOWN) {
        const remaining = Math.ceil((WORK_COOLDOWN - elapsed) / 1000);
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xed4245)
              .setTitle('Job Cooldown')
              .setDescription(`You need to rest! Try again in **${remaining}s**.`),
          ],
          ephemeral: true,
        });
      }
    }

    const earned = Math.floor(Math.random() * (WORK_MAX - WORK_MIN + 1)) + WORK_MIN;
    const job = jobs[Math.floor(Math.random() * jobs.length)];

    userData.balance += earned;
    userData.totalEarned += earned;
    userData.lastWork = now;
    await userData.save();

    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle('Work Complete!')
      .setDescription(`You ${job} and earned **${earned.toLocaleString()} eksoscoin**!`)
      .addFields(
        { name: 'New Balance', value: `${userData.balance.toLocaleString()} eksoscoin`, inline: true }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
