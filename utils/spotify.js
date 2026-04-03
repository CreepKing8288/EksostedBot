const SpotifyWebApi = require('spotify-web-api-node');
const ytSearch = require('yt-search');

const spotify = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
});

let tokenRefreshed = false;

async function ensureToken() {
  if (!tokenRefreshed) {
    const data = await spotify.clientCredentialsGrant();
    spotify.setAccessToken(data.body.access_token);
    tokenRefreshed = true;
    setTimeout(() => { tokenRefreshed = false; }, data.body.expires_in * 1000);
  }
}

async function getSpotifyPlaylist(uri) {
  await ensureToken();
  const playlistId = uri.split('/').pop().split('?')[0];
  const result = await spotify.getPlaylist(playlistId);
  const tracks = [];
  let offset = 0;

  while (true) {
    const response = await spotify.getPlaylistTracks(playlistId, { limit: 100, offset });
    for (const item of response.body.items) {
      if (item.track) {
        tracks.push({
          title: item.track.name,
          artist: item.track.artists.map(a => a.name).join(', '),
          uri: item.track.external_urls.spotify,
          duration_ms: item.track.duration_ms,
          thumbnail: item.track.album.images[0]?.url || null,
        });
      }
    }
    if (!response.body.next) break;
    offset += 100;
  }

  return {
    name: result.body.name,
    owner: result.body.owner.display_name,
    thumbnail: result.body.images[0]?.url || null,
    uri: result.body.external_urls.spotify,
    tracks,
  };
}

async function searchYouTube(query) {
  const result = await ytSearch(query);
  const video = result.videos[0];
  if (!video) return null;
  return {
    title: video.title,
    url: video.url,
    duration: video.seconds * 1000,
    thumbnail: video.thumbnail,
    author: video.author.name,
  };
}

module.exports = { getSpotifyPlaylist, searchYouTube };
