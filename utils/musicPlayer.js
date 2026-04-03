const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');

let playerInstance = null;

function getPlayerInstance(client) {
  if (!playerInstance) {
    const { Player } = require('discord-player');
    const { SpotifyExtractor } = require('@discord-player/extractor');
    playerInstance = new Player(client, {
      ytdlOptions: { quality: 'highestaudio', highWaterMark: 1 << 25 },
    });
    playerInstance.extractors.register(SpotifyExtractor, {});
    playerInstance.extractors.loadDefault();
  }
  return playerInstance;
}

const guildQueues = new Map();
const guildPlayers = new Map();
const guildConnections = new Map();
const loopModes = new Map();

function getQueue(guildId) {
  if (!guildQueues.has(guildId)) {
    guildQueues.set(guildId, []);
  }
  return guildQueues.get(guildId);
}

function getPlayer(guildId) {
  if (!guildPlayers.has(guildId)) {
    const player = createAudioPlayer();
    player.on('stateChange', (oldState, newState) => {
      if (newState.status === AudioPlayerStatus.Idle && oldState.status !== AudioPlayerStatus.Idle) {
        const queue = getQueue(guildId);
        const loopMode = loopModes.get(guildId) || 'off';

        if (loopMode === 'track') {
          const currentTrack = queue[0];
          if (currentTrack) {
            playTrack(guildId, currentTrack, queue.textChannel);
            return;
          }
        } else if (loopMode === 'queue' && queue.length > 1) {
          const currentTrack = queue.shift();
          queue.push(currentTrack);
          playNext(guildId);
          return;
        }

        if (queue.length > 0) {
          queue.shift();
          if (queue.length > 0) {
            playNext(guildId);
          }
        }
      }
    });
    guildPlayers.set(guildId, player);
  }
  return guildPlayers.get(guildId);
}

function getConnection(guildId) {
  return guildConnections.get(guildId);
}

async function playNext(guildId) {
  const queue = getQueue(guildId);
  const textChannel = queue.textChannel || null;

  if (queue.length === 0) {
    if (textChannel) {
      textChannel.send('⏹️ Queue is empty. Use `/play` to add songs!').catch(() => {});
    }
    return;
  }

  const track = queue[0];
  await playTrack(guildId, track, textChannel);
}

async function playTrack(guildId, track, textChannel) {
  const player = getPlayer(guildId);
  const connection = getConnection(guildId);

  if (!connection) return;

  try {
    const stream = await track.stream;
    const resource = createAudioResource(stream.stream, { inlineVolume: true });
    player.play(resource);
    connection.subscribe(player);
  } catch (err) {
    console.error('[Music] Playback error:', err.message);
    if (textChannel) {
      textChannel.send(`❌ Failed to play **${track.title}**. Skipping...`).catch(() => {});
    }
    const queue = getQueue(guildId);
    queue.shift();
    if (queue.length > 0) {
      playNext(guildId);
    }
  }
}

async function addToQueue(guildId, track, textChannel) {
  const queue = getQueue(guildId);
  queue.textChannel = textChannel;
  queue.push(track);

  if (queue.length === 1) {
    await playNext(guildId);
  }
}

function skipTrack(guildId) {
  const player = guildPlayers.get(guildId);
  if (!player) return false;
  player.stop();
  return true;
}

function getNowPlaying(guildId) {
  const queue = getQueue(guildId);
  return queue.length > 0 ? queue[0] : null;
}

function getQueueInfo(guildId) {
  const queue = getQueue(guildId);
  return {
    tracks: queue.filter(t => typeof t === 'object'),
    length: queue.length,
  };
}

function clearQueue(guildId) {
  guildQueues.set(guildId, []);
  const player = guildPlayers.get(guildId);
  if (player) player.stop();
}

function joinVoice(guildId, voiceChannel) {
  const existing = guildConnections.get(guildId);
  if (existing) return existing;

  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: guildId,
    adapterCreator: voiceChannel.guild.voiceAdapterCreator,
  });

  guildConnections.set(guildId, connection);
  return connection;
}

function leaveVoice(guildId) {
  const connection = guildConnections.get(guildId);
  if (connection) {
    connection.destroy();
    guildConnections.delete(guildId);
  }
  const player = guildPlayers.get(guildId);
  if (player) {
    player.stop();
    guildPlayers.delete(guildId);
  }
  guildQueues.delete(guildId);
}

function setLoopMode(guildId, mode) {
  loopModes.set(guildId, mode);
}

function getLoopMode(guildId) {
  return loopModes.get(guildId) || 'off';
}

module.exports = {
  addToQueue,
  skipTrack,
  getNowPlaying,
  getQueueInfo,
  clearQueue,
  joinVoice,
  leaveVoice,
  getPlayer,
  getConnection,
  getQueue,
  setLoopMode,
  getLoopMode,
  getPlayerInstance,
};
