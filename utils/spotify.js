const axios = require('axios');

let cachedToken = null;
let tokenExpiresAt = 0;

async function getSpotifyAccessToken() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Missing Spotify credentials. Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET.');
  }

  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt) {
    return cachedToken;
  }

  const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const response = await axios.post(
    'https://accounts.spotify.com/api/token',
    new URLSearchParams({ grant_type: 'client_credentials' }).toString(),
    {
      headers: {
        Authorization: `Basic ${authHeader}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }
  );

  cachedToken = response.data.access_token;
  tokenExpiresAt = now + (response.data.expires_in - 60) * 1000;
  return cachedToken;
}

function parseSpotifyLink(value) {
  if (!value) return null;
  const trimmed = value.trim();
  const spotifyRegex = /(?:spotify:|https?:\/\/open\.spotify\.com\/)(track|playlist)[:\/]([A-Za-z0-9]+)(?:\?.*)?/;
  const matches = trimmed.match(spotifyRegex);
  if (!matches) return null;
  return {
    type: matches[1],
    id: matches[2],
  };
}

async function searchSpotifyTracks(query, limit = 10) {
  const token = await getSpotifyAccessToken();
  const response = await axios.get(
    `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=${limit}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  return response.data.tracks?.items || [];
}

async function getSpotifyTrack(id) {
  const token = await getSpotifyAccessToken();
  const response = await axios.get(`https://api.spotify.com/v1/tracks/${id}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data;
}

async function getSpotifyPlaylistTracks(id, limit = 100) {
  const token = await getSpotifyAccessToken();
  const tracks = [];
  let url = `https://api.spotify.com/v1/playlists/${id}/tracks?limit=${Math.min(limit, 100)}`;

  while (url && tracks.length < limit) {
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const items = response.data.items || [];
    tracks.push(
      ...items
        .map((item) => item.track)
        .filter((track) => track && !track.is_local)
    );

    url = response.data.next;
    if (tracks.length >= limit) break;
  }

  return tracks.slice(0, limit);
}

function buildSpotifyTrackQuery(track) {
  const artistNames = track.artists.map((artist) => artist.name).join(' ');
  return `${track.name} ${artistNames}`;
}

module.exports = {
  getSpotifyAccessToken,
  parseSpotifyLink,
  searchSpotifyTracks,
  getSpotifyTrack,
  getSpotifyPlaylistTracks,
  buildSpotifyTrackQuery,
};
