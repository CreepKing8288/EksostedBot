const { Events } = require('discord.js');
const SwearFilter = require('../../models/SwearFilter');
const Groq = require('groq-sdk');

const groq = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;

const defaultSwearWords = [
  'fuck', 'shit', 'bitch', 'ass', 'damn', 'dick', 'pussy', 'cock', 'cunt',
  'bastard', 'nigger', 'nigga', 'faggot', 'whore', 'slut', 'fag', 'retard',
  'motherfucker', 'bullshit', 'asshole', 'fucking', 'shitting', 'bitching',
  'fck', 'sht', 'btch', 'dck', 'pssy', 'cnt', 'fckr',
];

async function checkWithAI(content) {
  if (!groq) return false;

  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: 'You are a content moderation assistant. Your only task is to determine if a message contains swearing, profanity, offensive language, or inappropriate content. Respond with ONLY "yes" or "no".',
        },
        {
          role: 'user',
          content: `Does this message contain swearing, profanity, or offensive language? Message: "${content}"`,
        },
      ],
      max_tokens: 5,
      temperature: 0,
    });

    const response = completion.choices[0].message.content.trim().toLowerCase();
    return response === 'yes';
  } catch {
    return false;
  }
}

function checkWithWordList(content, allWords) {
  const lowerContent = content.toLowerCase();
  return allWords.some(word => {
    const regex = new RegExp(`\\b${escapeRegex(word)}\\b`, 'i');
    return regex.test(lowerContent);
  });
}

module.exports = {
  name: Events.MessageCreate,
  once: false,
  async execute(message) {
    if (message.author.bot || !message.guild) return;

    const config = await SwearFilter.findOne({ guildId: message.guild.id });
    if (!config || !config.enabled) return;

    if (message.member.permissions.has('ManageMessages')) return;

    let isOffensive = false;

    if (config.aiMode) {
      isOffensive = await checkWithAI(message.content);
    } else {
      const allWords = [...defaultSwearWords, ...config.customWords.map(w => w.toLowerCase())];
      isOffensive = checkWithWordList(message.content, allWords);
    }

    if (isOffensive) {
      await message.delete().catch(() => {});
      const warning = await message.channel.send({
        content: `${message.author}, swearing is not allowed in this server.`,
      }).catch(() => {});
      if (warning) {
        setTimeout(async () => {
          await warning.delete().catch(() => {});
        }, 5000);
      }
    }
  },
};

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
