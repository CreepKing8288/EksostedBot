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
  if (!groq) {
    console.log('[SwearFilter] GROQ_API_KEY not set, AI check skipped');
    return false;
  }

  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: 'You are a profanity detection system. Analyze the given message and determine if it contains any swear words, profanity, cursing, or vulgar language. Reply with ONLY the word "YES" if it contains profanity, or "NO" if it does not. Do not add any explanation.',
        },
        {
          role: 'user',
          content: `Message to analyze: "${content}"`,
        },
      ],
      max_tokens: 10,
      temperature: 0,
    });

    const response = completion.choices[0].message.content.trim().toLowerCase().replace(/[^a-z]/g, '');
    console.log(`[SwearFilter] AI response for "${content}": "${response}"`);
    return response.includes('yes');
  } catch (err) {
    console.error('[SwearFilter] AI check error:', err.message);
    return false;
  }
}

function checkWithWordList(content, allWords) {
  const lowerContent = content.toLowerCase();
  for (const word of allWords) {
    if (lowerContent.includes(word.toLowerCase())) {
      console.log(`[SwearFilter] Word-list match: "${word}" in "${content}"`);
      return true;
    }
  }
  return false;
}

module.exports = {
  name: Events.MessageCreate,
  once: false,
  async execute(message) {
    if (message.author.bot || !message.guild) return;

    const config = await SwearFilter.findOne({ guildId: message.guild.id });
    if (!config) {
      return;
    }
    if (!config.enabled) {
      return;
    }

    if (message.member.permissions.has('ManageMessages')) return;

    console.log(`[SwearFilter] Checking message from ${message.author.tag}: "${message.content}" (mode: ${config.aiMode ? 'AI' : 'word-list'})`);

    let isOffensive = false;

    if (config.aiMode) {
      isOffensive = await checkWithAI(message.content);
    } else {
      const allWords = [...defaultSwearWords, ...config.customWords.map(w => w.toLowerCase())];
      isOffensive = checkWithWordList(message.content, allWords);
    }

    if (isOffensive) {
      console.log(`[SwearFilter] Deleting offensive message from ${message.author.tag}`);
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
