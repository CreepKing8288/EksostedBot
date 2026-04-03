const { Player, QueueRepeatMode } = require('discord-player');
const { SpotifyExtractor, DefaultExtractors } = require('@discord-player/extractor');

let playerInstance = null;

function getPlayer(client) {
  if (!playerInstance) {
    playerInstance = new Player(client, {
      ytdlOptions: { quality: 'highestaudio', highWaterMark: 1 << 25 },
    });
    playerInstance.extractors.register(SpotifyExtractor, {});
    playerInstance.extractors.loadMulti(DefaultExtractors);
  }
  return playerInstance;
}

async function addToQueue(guildId, track, textChannel) {
  const player = getPlayer(textChannel.client);
  let queue = player.queues.get(guildId);

  if (!queue) {
    queue = await player.queues.create(guildId, {
      metadata: {
        channel: textChannel,
        client: textChannel.guild.members.me,
        requestedBy: track.requester,
      },
      selfDeaf: true,
    });
  }

  await queue.addTrack(track);

  if (!queue.isPlaying()) {
    await queue.node.connect(track.requester.voice.channel);
    await queue.node.play();
  }

  return queue;
}

function getNowPlaying(guildId) {
  const player = getPlayer(global._client);
  const queue = player.queues.get(guildId);
  if (!queue || !queue.currentTrack) return null;

  return {
    title: queue.currentTrack.title,
    url: queue.currentTrack.url,
    duration: queue.currentTrack.durationMS,
    thumbnail: queue.currentTrack.thumbnail,
    artist: queue.currentTrack.author || queue.currentTrack.artist || 'Unknown',
    requester: queue.currentTrack.requestedBy,
  };
}

function getQueueInfo(guildId) {
  const player = getPlayer(global._client);
  const queue = player.queues.get(guildId);
  if (!queue) return { tracks: [], length: 0 };

  const tracks = queue.tracks.map((t) => ({
    title: t.title,
    url: t.url,
    duration: t.durationMS,
    thumbnail: t.thumbnail,
    artist: t.author || t.artist || 'Unknown',
    requester: t.requestedBy,
  }));

  return { tracks, length: tracks.length };
}

function skipTrack(guildId) {
  const player = getPlayer(global._client);
  const queue = player.queues.get(guildId);
  if (!queue) return false;
  queue.node.skip();
  return true;
}

function clearQueue(guildId) {
  const player = getPlayer(global._client);
  const queue = player.queues.get(guildId);
  if (queue) queue.delete();
}

function joinVoice(guildId, voiceChannel) {
  const player = getPlayer(voiceChannel.client);
  let queue = player.queues.get(guildId);
  if (!queue) {
    player.queues.create(guildId, {
      metadata: { channel: voiceChannel, client: voiceChannel.guild.members.me },
      selfDeaf: true,
    });
  }
  queue = player.queues.get(guildId);
  queue.node.connect(voiceChannel);
  return queue;
}

function leaveVoice(guildId) {
  const player = getPlayer(global._client);
  const queue = player.queues.get(guildId);
  if (queue) queue.delete();
}

function setLoopMode(guildId, mode) {
  const player = getPlayer(global._client);
  const queue = player.queues.get(guildId);
  if (!queue) return;

  switch (mode) {
    case 'track': queue.setRepeatMode(QueueRepeatMode.TRACK); break;
    case 'queue': queue.setRepeatMode(QueueRepeatMode.QUEUE); break;
    default: queue.setRepeatMode(QueueRepeatMode.OFF);
  }
}

function getLoopMode(guildId) {
  const player = getPlayer(global._client);
  const queue = player.queues.get(guildId);
  if (!queue) return 'off';
  const mode = queue.repeatMode;
  if (mode === QueueRepeatMode.TRACK) return 'track';
  if (mode === QueueRepeatMode.QUEUE) return 'queue';
  return 'off';
}

function getPlayerInstance(client) {
  global._client = client;
  return getPlayer(client);
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
  setLoopMode,
  getLoopMode,
  getPlayerInstance,
};
