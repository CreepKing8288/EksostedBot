const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send('Everything is up!');
});

const port = process.env.PORT || 10000;
app.listen(port, () => {
  console.log(`✅ Express server running on http://localhost:${port}`);
});
const dotenv = require('dotenv');
const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

const defaultEnvPath = path.join(__dirname, '.env');
const explicitEnvFile = process.env.ENV_FILE ? path.join(__dirname, process.env.ENV_FILE) : null;
const requiredEnvVars = ['DISCORD_TOKEN', 'MONGODB_URI'];
const missingRequiredEnv = requiredEnvVars.some((key) => !process.env[key]);
let envPath = null;

if (!missingRequiredEnv) {
  console.log('✅ Environment variables already provided; skipping local env file load.');
} else {
  if (explicitEnvFile && fs.existsSync(explicitEnvFile)) {
    envPath = explicitEnvFile;
  } else if (fs.existsSync(defaultEnvPath)) {
    envPath = defaultEnvPath;
  }

  if (envPath) {
    dotenv.config({ path: envPath });
    console.log(`✅ Loaded environment from ${path.basename(envPath)}`);
  } else {
    console.log('⚠️ No local env file found. Using system environment only. Set ENV_FILE to choose a specific file if needed.');
  }
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
  ],
});
client.activeCrateMessages = new Map();

const styles = {
  successColor: chalk.bold.green,
  warningColor: chalk.bold.yellow,
  infoColor: chalk.bold.blue,
  commandColor: chalk.bold.cyan,
  userColor: chalk.bold.magenta,
  errorColor: chalk.red,
  highlightColor: chalk.bold.hex('#FFA500'),
  accentColor: chalk.bold.hex('#00FF7F'),
  secondaryColor: chalk.hex('#ADD8E6'),
  primaryColor: chalk.bold.hex('#FF1493'),
  dividerColor: chalk.hex('#FFD700'),
};

global.styles = styles;

const handlerFiles = fs
  .readdirSync(path.join(__dirname, 'handlers'))
  .filter((file) => file.endsWith('.js'));

(async () => {
  let counter = 0;
  for (const file of handlerFiles) {
    counter += 1;
    const handler = require(`./handlers/${file}`);
    if (typeof handler === 'function') {
      await handler(client);
    }
  }

  console.log(
    global.styles.successColor(`✅ Successfully loaded ${counter} handlers`)
  );

  await client.login(process.env.DISCORD_TOKEN);
})();
