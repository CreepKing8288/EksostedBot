const fs = require('fs');
const path = require('path');

module.exports = (client) => {
  client.commands = new Map();
  const commandsPath = path.join(__dirname, '../commands');
  
  let commandCount = 0;
  const categories = fs.readdirSync(commandsPath);

  categories.forEach((category) => {
    const categoryPath = path.join(commandsPath, category);
    
    // Ensure we are reading a directory
    if (!fs.lstatSync(categoryPath).isDirectory()) return;

    const commandFiles = fs
      .readdirSync(categoryPath)
      .filter((file) => file.endsWith('.js'));

    for (const file of commandFiles) {
      const filePath = path.join(categoryPath, file);
      const command = require(filePath);

      // SAFETY GUARD: Check if the file has the required 'data' and 'name'
      if (command && command.data && command.data.name) {
        client.commands.set(command.data.name, { ...command, category });
        commandCount++;
      } else {
        // This will print a warning instead of crashing the bot
        console.warn(`⚠️  Skipped loading ${file} in ${category}: Not a valid command file.`);
      }
    }
  });

  console.log(
    global.styles.successColor(
      `✅ Loaded ${commandCount} commands across ${categories.length} categories.`
    )
  );
};