const Groq = require('groq-sdk');
const AIChatConfig = require('../models/AIChatConfig');

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const quietCheckIntervals = new Map();
const channelLastMessageTime = new Map();
const channelConversationHistory = new Map();

const randomTopics = [
  "What's the most interesting game you've played recently?",
  "If you could have any superpower, what would it be and why?",
  "What's your favorite movie or TV show right now?",
  "Anyone have any cool hobbies they want to share?",
  "What's the best song you've listened to lately?",
  "If you could travel anywhere in the world, where would you go?",
  "What's your dream job?",
  "Anyone playing any new games this week?",
  "What's the most underrated game in your opinion?",
  "If you could only eat one food for the rest of your life, what would it be?",
  "What's your favorite memory from this server?",
  "Who here has the best music taste? Drop your favorite artist!",
  "What's a skill you've always wanted to learn?",
  "If you could meet any fictional character, who would it be?",
  "What's the weirdest dream you've ever had?",
  "Anyone have any hot takes or unpopular opinions?",
  "What's your go-to comfort food?",
  "If you won the lottery tomorrow, what's the first thing you'd buy?",
  "What's the best piece of advice you've ever received?",
  "What's something you're really proud of?",
];

function getSystemPrompt(config) {
  return `You are a friendly and engaging member of a Discord community. Your personality is ${config.personality}. 
Keep responses concise (under 200 characters). Be natural and conversational. 
You can use casual language, occasional slang, and be fun. Never break character or mention being an AI.
If someone asks a question, answer it naturally. If the conversation is casual, keep it light and fun.`;
}

async function getOpenAIResponse(messages, config) {
  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: getSystemPrompt(config) },
      ...messages,
    ],
    max_tokens: 150,
    temperature: 0.8,
  });
  return completion.choices[0].message.content;
}

function getConversationHistory(channelId) {
  return channelConversationHistory.get(channelId) || [];
}

function addMessageToHistory(channelId, role, content) {
  const history = getConversationHistory(channelId);
  history.push({ role, content });
  if (history.length > 20) {
    history.shift();
  }
  channelConversationHistory.set(channelId, history);
}

function clearConversationHistory(channelId) {
  channelConversationHistory.delete(channelId);
}

async function startQuietCheck(client, config) {
  if (quietCheckIntervals.has(config.guildId)) {
    clearInterval(quietCheckIntervals.get(config.guildId));
  }

  const interval = setInterval(async () => {
    const currentConfig = await AIChatConfig.findOne({ guildId: config.guildId });
    if (!currentConfig || !currentConfig.enabled) {
      clearInterval(quietCheckIntervals.get(config.guildId));
      quietCheckIntervals.delete(config.guildId);
      return;
    }

    const guild = client.guilds.cache.get(config.guildId);
    if (!guild) return;

    for (const channelId of currentConfig.channels) {
      const channel = guild.channels.cache.get(channelId);
      if (!channel || !channel.isTextBased()) continue;

      const lastMessageTime = channelLastMessageTime.get(channelId) || 0;
      const quietMs = (currentConfig.quietTimeoutMinutes || 30) * 60 * 1000;

      if (Date.now() - lastMessageTime > quietMs) {
        const topic = randomTopics[Math.floor(Math.random() * randomTopics.length)];
        try {
          await channel.send(topic);
          channelLastMessageTime.set(channelId, Date.now());
          clearConversationHistory(channelId);
        } catch (err) {
          console.error(`[AIChat] Failed to send topic to ${channelId}:`, err.message);
        }
      }
    }
  }, 60 * 1000);

  quietCheckIntervals.set(config.guildId, interval);
}

module.exports = async (client) => {
  if (!process.env.GROQ_API_KEY) {
    console.log('[AIChat] GROQ_API_KEY not set, AI chat disabled.');
    return;
  }

  client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    const config = await AIChatConfig.findOne({ guildId: message.guildId, enabled: true });
    if (!config || !config.channels.includes(message.channelId)) return;

    channelLastMessageTime.set(message.channelId, Date.now());

    const mentionPattern = new RegExp(`^<@!?${client.user.id}>\\s*`);
    const isMentioned = message.content.match(mentionPattern);

    if (!isMentioned) return;

    const content = message.content.replace(mentionPattern, '').trim();
    if (!content) return;

    await message.channel.sendTyping().catch(() => {});

    addMessageToHistory(message.channelId, 'user', `${message.author.username}: ${content}`);

    try {
      const history = getConversationHistory(message.channelId);
      const response = await getOpenAIResponse(history, config);
      addMessageToHistory(message.channelId, 'assistant', response);
      await message.reply(response);
    } catch (err) {
      console.error('[AIChat] Groq error:', err.message);
      await message.reply('Sorry, I had a bit of trouble thinking about that. Try again?').catch(() => {});
    }
  });

  client.on('ready', async () => {
    const configs = await AIChatConfig.find({ enabled: true });
    for (const config of configs) {
      startQuietCheck(client, config);
    }
  });

  console.log(global.styles.successColor('✅ AI Chat handler loaded'));
};

module.exports.startQuietCheck = startQuietCheck;
