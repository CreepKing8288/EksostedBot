const fs = require('fs');
const path = require('path');

module.exports = (client) => {
  const eventsPath = path.join(__dirname, '../events');
  let count = 0;

  const loadEvents = (dir) => {
    const files = fs.readdirSync(dir);

    files.forEach((file) => {
      const filePath = path.join(dir, file);
      const stat = fs.lstatSync(filePath);

      if (stat.isDirectory()) {
        if (file === 'lavalink') {
          const lavalinkFiles = fs.readdirSync(filePath);
          lavalinkFiles.forEach((lavalinkFile) => {
            if (lavalinkFile.endsWith('.js')) {
              const event = require(path.join(filePath, lavalinkFile));

              if (event.isNodeEvent) {
                client.lavalink.nodeManager.on(event.name, (...args) =>
                  event.execute(client, ...args)
                );
              } else {
                client.lavalink.on(event.name, (...args) =>
                  event.execute(client, ...args)
                );
              }
              count++;
            }
          });
        } else {
          loadEvents(filePath);
        }
      } else if (file.endsWith('.js')) {
        try {
          const event = require(filePath);
          if (event && event.name && event.execute) {
            if (event.once) {
              client.once(event.name, (...args) => {
                event.execute(...args).catch(err => console.error(`Event error [${event.name}]:`, err));
              });
            } else {
              client.on(event.name, (...args) => {
                event.execute(...args).catch(err => console.error(`Event error [${event.name}]:`, err));
              });
            }
            count++;
          }
        } catch (err) {
          console.error(`Failed to load event: ${file}`, err.message);
        }
      }
    });
  };

  loadEvents(eventsPath);

  console.log(
    global.styles.successColor(`✅ Successfully loaded ${count} events`)
  );
};
