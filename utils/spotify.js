const ytSearch = require('yt-search');

let cachedToken = null;
let tokenExpiry = 0;

async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64')}`,
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Spotify token error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000;
  return cachedToken;
}

async function spotifyFetch(url) {
  const token = await getAccessToken();
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Spotify API error ${response.status}: ${errText}`);
  }

  return response.json();
}

async function getSpotifyPlaylist(uri) {
  const id = extractId(uri);
  if (!id) throw new Error('Could not extract playlist ID from URL');

  const [playlist, tracksData] = await Promise.all([
    spotifyFetch(`https://api.spotify.com/v1/playlists/${id}`),
    spotifyFetch(`https://api.spotify.com/v1/playlists/${id}/tracks?limit=100`),
  ]);

  const tracks = [];
  const addItems = (items) => {
    for (const item of items) {
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
  };

  addItems(tracksData.items);

  let next = tracksData.next;
  while (next) {
    const moreData = await spotifyFetch(next);
    addItems(moreData.items);
    next = moreData.next;
  }

  return {
    name: playlist.name,
    owner: playlist.owner.display_name,
    thumbnail: playlist.images[0]?.url || null,
    uri: playlist.external_urls.spotify,
    tracks,
  };
}

function extractId(uri) {
  try {
    const url = new URL(uri);
    const parts = url.pathname.split('/').filter(Boolean);
    return parts[parts.length - 1] || null;
  } catch {
    return uri.split('/').pop().split('?')[0].split('&')[0] || null;
  }
}

async function getSpotifyTrack(uri) {
  const id = extractId(uri);
  if (!id) throw new Error('Could not extract track ID from URL');
  const track = await spotifyFetch(`https://api.spotify.com/v1/tracks/${id}`);

  return {
    title: track.name,
    artist: track.artists.map(a => a.name).join(', '),
    uri: track.external_urls.spotify,
    duration_ms: track.duration_ms,
    thumbnail: track.album.images[0]?.url || null,
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

module.exports = { getSpotifyPlaylist, getSpotifyTrack, searchYouTube };
