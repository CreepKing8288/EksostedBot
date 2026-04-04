let currentGuildId = null;
let userGuilds = [];

// INIT
document.addEventListener('DOMContentLoaded', async () => {
  const user = await fetchUser();
  if (!user) {
    window.location.href = '/auth/login';
    return;
  }

  renderUser(user);
  userGuilds = user.guilds || [];
  renderServerList(userGuilds);

  document.getElementById('serverSelectBtn').addEventListener('click', toggleDropdown);
  document.getElementById('serverSearch').addEventListener('input', filterServers);
  document.getElementById('mobileMenuBtn').addEventListener('click', toggleMobileMenu);

  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const panel = item.dataset.panel;
      switchPanel(panel);
      closeMobileMenu();
    });
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.server-selector')) {
      closeDropdown();
    }
  });
});

async function fetchUser() {
  try {
    const res = await fetch('/api/user');
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

function renderUser(user) {
  document.getElementById('userName').textContent = user.username;
  document.getElementById('userId').textContent = `ID: ${user.id}`;

  const avatarEl = document.getElementById('userAvatar');
  if (user.avatar) {
    avatarEl.style.backgroundImage = `url(https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128)`;
  } else {
    avatarEl.style.backgroundImage = 'none';
    avatarEl.textContent = user.username[0].toUpperCase();
    avatarEl.style.display = 'flex';
    avatarEl.style.alignItems = 'center';
    avatarEl.style.justifyContent = 'center';
    avatarEl.style.fontSize = '1rem';
    avatarEl.style.fontWeight = '700';
  }
}

function renderServerList(guilds) {
  const list = document.getElementById('serverList');
  list.innerHTML = guilds.map(g => `
    <div class="dropdown-item" data-guild-id="${g.id}" onclick="selectServer('${g.id}', '${g.name.replace(/'/g, "\\'")}')">
      <div class="di-icon">${g.icon ? '🖼️' : '🏠'}</div>
      <span>${g.name}</span>
    </div>
  `).join('');
}

function filterServers(e) {
  const query = e.target.value.toLowerCase();
  document.querySelectorAll('.dropdown-item').forEach(item => {
    const name = item.querySelector('span').textContent.toLowerCase();
    item.style.display = name.includes(query) ? '' : 'none';
  });
}

function toggleDropdown() {
  document.getElementById('serverDropdown').classList.toggle('open');
}

function closeDropdown() {
  document.getElementById('serverDropdown').classList.remove('open');
}

async function selectServer(guildId, guildName) {
  currentGuildId = guildId;
  closeDropdown();

  document.getElementById('serverName').textContent = guildName;
  document.getElementById('serverIcon').textContent = '🏠';

  document.querySelectorAll('.dropdown-item').forEach(item => {
    item.classList.toggle('active', item.dataset.guildId === guildId);
  });

  await loadConfigs();
  await loadLeaderboard('level');
  await loadLeaderboard('vc');
  switchPanel('overview');
}

async function loadConfigs() {
  if (!currentGuildId) return;

  try {
    const res = await fetch(`/api/guild/${currentGuildId}/configs`);
    if (!res.ok) {
      console.error('Config fetch failed:', res.status, await res.text());
      return;
    }
    const configs = await res.json();
    console.log('Loaded configs:', Object.keys(configs));

    populateSwearFilter(configs.SwearFilter);
    populateAntiSpam(configs.AntiSpam);
    populateLinkFilter(configs.LinkFilter);
    populateStarboard(configs.Starboard);
    populateCrates(configs.CrateConfig);
    populateTickets(configs.TicketSettings);
    populateLeveling(configs.Level);
    populateWelcome(configs.welcome);
    populateAIChat(configs.AIChatConfig);
    populateProtection(configs.ProtectionSettings);
    populateServerLogs(configs.serverlogs);
    populateAutoRoles(configs.AutoRole);
    populateButtonRole(configs.ButtonRole);
    updateOverview(configs);
  } catch (err) {
    console.error('Failed to load configs:', err);
  }
}

function populateSwearFilter(data) {
  document.getElementById('swear-enabled').checked = data?.enabled || false;
  document.getElementById('swear-aimode').checked = data?.aiMode || false;
  document.getElementById('swear-words').value = data?.customWords?.join(', ') || '';
}

function populateAntiSpam(data) {
  document.getElementById('antispam-enabled').checked = data?.enabled || false;
  document.getElementById('antispam-max').value = data?.maxMessages || 5;
  document.getElementById('antispam-window').value = (data?.timeWindowMs || 5000) / 1000;
  document.getElementById('antispam-punishment').value = data?.punishment || 'delete';
  document.getElementById('antispam-timeout').value = data?.timeoutDuration || 60;
  document.getElementById('antispam-duplicate').checked = data?.duplicateCheck ?? true;
  document.getElementById('antispam-caps').checked = data?.capsCheck ?? true;
}

function populateLinkFilter(data) {
  document.getElementById('linkfilter-enabled').checked = data?.enabled || false;
  document.getElementById('linkfilter-invites').checked = data?.blockInvites ?? true;
  document.getElementById('linkfilter-alllinks').checked = data?.blockAllLinks || false;
  document.getElementById('linkfilter-domains').value = data?.allowedDomains?.join(', ') || '';
}

function populateStarboard(data) {
  document.getElementById('starboard-enabled').checked = data?.enabled || false;
  document.getElementById('starboard-channel').value = data?.channelId || '';
  document.getElementById('starboard-threshold').value = data?.threshold || 3;
  document.getElementById('starboard-emoji').value = data?.emoji || '⭐';
  document.getElementById('starboard-ignored').value = data?.ignoredChannels?.join(', ') || '';
}

function populateCrates(data) {
  document.getElementById('crate-enabled').checked = data?.enabled || false;
  document.getElementById('crate-autodrop').checked = data?.autoDropEnabled || false;
  document.getElementById('crate-min').value = data?.autoMinIntervalMinutes || 60;
  document.getElementById('crate-max').value = data?.autoMaxIntervalMinutes || 120;
  document.getElementById('crate-expiry').value = data?.claimExpiryMinutes || 5;
  document.getElementById('crate-channel').value = data?.dropChannelId || '';
}

function populateTickets(data) {
  document.getElementById('ticket-enabled').checked = data?.enabled || false;
  document.getElementById('ticket-category').value = data?.categoryId || '';
  document.getElementById('ticket-logs').value = data?.logChannelId || '';
  document.getElementById('ticket-limit').value = data?.ticketLimit || 3;
  document.getElementById('ticket-roles').value = data?.supportRoleIds?.join(', ') || '';
  document.getElementById('ticket-welcome').value = data?.welcomeMessage || '';
  document.getElementById('ticket-close').value = data?.closeMessage || '';
}

function populateLeveling(data) {
  document.getElementById('level-enabled').checked = data?.levelingEnabled ?? true;
  document.getElementById('level-xprate').value = data?.xpRate || 1;
  document.getElementById('level-startingxp').value = data?.startingXp || 1000;
  document.getElementById('level-xpperlevel').value = data?.xpPerLevel || 500;
  document.getElementById('level-style').value = data?.leaderboardUpdateStyle || 'image';
  document.getElementById('level-upchannel').value = data?.levelUpChannelId || '';
  document.getElementById('level-lbchannel').value = data?.leaderboardChannelId || '';
  document.getElementById('level-banner').value = data?.leaderboardBannerUrl || '';
}

function populateWelcome(data) {
  document.getElementById('welcome-enabled').checked = data?.enabled || false;
  document.getElementById('welcome-channel').value = data?.channelId || '';
  document.getElementById('welcome-message').value = data?.description || '';
}

function populateAIChat(data) {
  document.getElementById('aichat-enabled').checked = data?.enabled || false;
  document.getElementById('aichat-channels').value = data?.channels?.join(', ') || '';
  document.getElementById('aichat-timeout').value = data?.quietTimeoutMinutes || 30;
  document.getElementById('aichat-personality').value = data?.personality || '';
}

function populateProtection(data) {
  document.getElementById('prot-antibot').checked = data?.antiBot || false;
  document.getElementById('prot-antinuke').checked = data?.antiNuke || false;
  document.getElementById('prot-antiraid').checked = data?.antiRaid || false;
  document.getElementById('prot-antibot-thresh').value = data?.antiBotThreshold || 3;
  document.getElementById('prot-antinuke-thresh').value = data?.antiNukeThreshold || 3;
  document.getElementById('prot-antiraid-thresh').value = data?.antiRaidThreshold || 5;
  document.getElementById('prot-antiraid-time').value = data?.antiRaidTimeWindow || 10000;
  document.getElementById('prot-punishment').value = data?.punishment || 'ban';
  document.getElementById('prot-whitelist').value = data?.whitelistedUsers?.join(', ') || '';
}

function populateServerLogs(data) {
  document.getElementById('logs-channel').value = data?.logChannel || '';
  document.getElementById('logs-messages').checked = data?.categories?.messages || false;
  document.getElementById('logs-nicknames').checked = data?.categories?.nicknames || false;
  document.getElementById('logs-members').checked = data?.categories?.memberEvents || false;
  document.getElementById('logs-channels').checked = data?.categories?.channelEvents || false;
  document.getElementById('logs-roles').checked = data?.categories?.roleEvents || false;
  document.getElementById('logs-voice').checked = data?.categories?.voiceEvents || false;
  document.getElementById('logs-threads').checked = data?.categories?.threadEvents || false;
  document.getElementById('logs-boosts').checked = data?.categories?.boosts || false;
}

function populateAutoRoles(data) {
  document.getElementById('autoroles-roles').value = data?.roleIds?.join(', ') || '';
}

function populateButtonRole(data) {
  if (data && data.length > 0) {
    const p = data[0];
    document.getElementById('btnrole-panelname').value = p.panelName || '';
    document.getElementById('btnrole-description').value = p.panelData?.description || '';
    document.getElementById('btnrole-channel').value = p.channelId || '';
    document.getElementById('btnrole-buttons').value = JSON.stringify(p.buttons, null, 2);
  } else {
    document.getElementById('btnrole-panelname').value = '';
    document.getElementById('btnrole-description').value = '';
    document.getElementById('btnrole-channel').value = '';
    document.getElementById('btnrole-buttons').value = '';
  }
}

function updateOverview(configs) {
  const set = (id, val, onText, offText) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val ? onText : offText;
  };

  set('stat-swear', configs.SwearFilter?.enabled, 'Enabled', 'Disabled');
  set('stat-antispam', configs.AntiSpam?.enabled, 'Enabled', 'Disabled');
  set('stat-linkfilter', configs.LinkFilter?.enabled, 'Enabled', 'Disabled');
  set('stat-starboard', configs.Starboard?.enabled, 'Enabled', 'Disabled');
  set('stat-crates', configs.CrateConfig?.enabled, 'Enabled', 'Disabled');
  set('stat-tickets', configs.TicketSettings?.enabled, 'Enabled', 'Disabled');
  set('stat-leveling', configs.Level?.levelingEnabled !== false, 'Enabled', 'Disabled');
  set('stat-welcome', configs.welcome?.enabled, 'Enabled', 'Disabled');
  set('stat-aichat', configs.AIChatConfig?.enabled, 'Enabled', 'Disabled');
  const prot = configs.ProtectionSettings;
  set('stat-protection', prot?.antiBot || prot?.antiNuke || prot?.antiRaid, 'Enabled', 'Disabled');
  set('stat-logs', configs.serverlogs?.logChannel, 'Configured', 'Disabled');
  set('stat-autoroles', configs.AutoRole?.roleIds?.length > 0, 'Active', 'Disabled');
}

async function saveConfig(modelName) {
  if (!currentGuildId) return showToast('No server selected', 'error');

  let payload = {};

  switch (modelName) {
    case 'SwearFilter':
      payload = {
        enabled: document.getElementById('swear-enabled').checked,
        aiMode: document.getElementById('swear-aimode').checked,
        customWords: document.getElementById('swear-words').value
          .split(',').map(w => w.trim()).filter(w => w),
      };
      break;

    case 'AntiSpam':
      payload = {
        enabled: document.getElementById('antispam-enabled').checked,
        maxMessages: parseInt(document.getElementById('antispam-max').value),
        timeWindowMs: parseInt(document.getElementById('antispam-window').value) * 1000,
        punishment: document.getElementById('antispam-punishment').value,
        timeoutDuration: parseInt(document.getElementById('antispam-timeout').value),
        duplicateCheck: document.getElementById('antispam-duplicate').checked,
        capsCheck: document.getElementById('antispam-caps').checked,
      };
      break;

    case 'LinkFilter':
      payload = {
        enabled: document.getElementById('linkfilter-enabled').checked,
        blockInvites: document.getElementById('linkfilter-invites').checked,
        blockAllLinks: document.getElementById('linkfilter-alllinks').checked,
        allowedDomains: document.getElementById('linkfilter-domains').value
          .split(',').map(d => d.trim()).filter(d => d),
      };
      break;

    case 'Starboard':
      payload = {
        enabled: document.getElementById('starboard-enabled').checked,
        channelId: document.getElementById('starboard-channel').value,
        threshold: parseInt(document.getElementById('starboard-threshold').value),
        emoji: document.getElementById('starboard-emoji').value,
        ignoredChannels: document.getElementById('starboard-ignored').value
          .split(',').map(c => c.trim()).filter(c => c),
      };
      break;

    case 'CrateConfig':
      payload = {
        enabled: document.getElementById('crate-enabled').checked,
        autoDropEnabled: document.getElementById('crate-autodrop').checked,
        autoMinIntervalMinutes: parseInt(document.getElementById('crate-min').value),
        autoMaxIntervalMinutes: parseInt(document.getElementById('crate-max').value),
        claimExpiryMinutes: parseInt(document.getElementById('crate-expiry').value),
        dropChannelId: document.getElementById('crate-channel').value,
      };
      break;

    case 'TicketSettings':
      payload = {
        enabled: document.getElementById('ticket-enabled').checked,
        categoryId: document.getElementById('ticket-category').value,
        logChannelId: document.getElementById('ticket-logs').value,
        ticketLimit: parseInt(document.getElementById('ticket-limit').value),
        supportRoleIds: document.getElementById('ticket-roles').value
          .split(',').map(r => r.trim()).filter(r => r),
        welcomeMessage: document.getElementById('ticket-welcome').value,
        closeMessage: document.getElementById('ticket-close').value,
      };
      break;

    case 'Level':
      payload = {
        guildId: currentGuildId,
        levelingEnabled: document.getElementById('level-enabled').checked,
        xpRate: parseFloat(document.getElementById('level-xprate').value),
        startingXp: parseInt(document.getElementById('level-startingxp').value),
        xpPerLevel: parseInt(document.getElementById('level-xpperlevel').value),
        leaderboardUpdateStyle: document.getElementById('level-style').value,
        levelUpChannelId: document.getElementById('level-upchannel').value,
        leaderboardChannelId: document.getElementById('level-lbchannel').value,
        leaderboardBannerUrl: document.getElementById('level-banner').value,
      };
      break;

    case 'AIChatConfig':
      payload = {
        enabled: document.getElementById('aichat-enabled').checked,
        channels: document.getElementById('aichat-channels').value
          .split(',').map(c => c.trim()).filter(c => c),
        quietTimeoutMinutes: parseInt(document.getElementById('aichat-timeout').value),
        personality: document.getElementById('aichat-personality').value,
      };
      break;

    case 'ProtectionSettings':
      payload = {
        antiBot: document.getElementById('prot-antibot').checked,
        antiNuke: document.getElementById('prot-antinuke').checked,
        antiRaid: document.getElementById('prot-antiraid').checked,
        antiBotThreshold: parseInt(document.getElementById('prot-antibot-thresh').value),
        antiNukeThreshold: parseInt(document.getElementById('prot-antinuke-thresh').value),
        antiRaidThreshold: parseInt(document.getElementById('prot-antiraid-thresh').value),
        antiRaidTimeWindow: parseInt(document.getElementById('prot-antiraid-time').value),
        punishment: document.getElementById('prot-punishment').value,
        whitelistedUsers: document.getElementById('prot-whitelist').value
          .split(',').map(u => u.trim()).filter(u => u),
      };
      break;

    case 'ServerLog':
      payload = {
        logChannel: document.getElementById('logs-channel').value,
        categories: {
          messages: document.getElementById('logs-messages').checked,
          nicknames: document.getElementById('logs-nicknames').checked,
          memberEvents: document.getElementById('logs-members').checked,
          channelEvents: document.getElementById('logs-channels').checked,
          roleEvents: document.getElementById('logs-roles').checked,
          voiceEvents: document.getElementById('logs-voice').checked,
          threadEvents: document.getElementById('logs-threads').checked,
          boosts: document.getElementById('logs-boosts').checked,
        },
      };
      break;
  }

  try {
    const res = await fetch(`/api/guild/${currentGuildId}/config/${modelName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(errText);
    }

    showToast('Settings saved successfully!', 'success');
    await loadConfigs();
  } catch (err) {
    console.error('Save error:', err);
    showToast(`Failed to save: ${err.message}`, 'error');
  }
}

function switchPanel(panelName) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const panel = document.getElementById(`panel-${panelName}`);
  if (panel) panel.classList.add('active');

  const navItem = document.querySelector(`.nav-item[data-panel="${panelName}"]`);
  if (navItem) navItem.classList.add('active');

  const titles = {
    overview: 'Overview',
    swearfilter: 'Swear Filter',
    antispam: 'Anti-Spam',
    linkfilter: 'Link Filter',
    starboard: 'Starboard',
    crates: 'Crate Drops',
    tickets: 'Ticket Settings',
    leveling: 'Level Settings',
    'lvl-leaderboard': 'Level Leaderboard',
    'vc-leaderboard': 'VC Leaderboard',
    welcome: 'Welcome Messages',
    aichat: 'AI Chat',
    protection: 'Protection',
    serverlogs: 'Server Logs',
    autoroles: 'Auto Roles',
    buttonroles: 'Button Roles',
  };

  document.getElementById('topbarTitle').textContent = titles[panelName] || 'Dashboard';
}

function toggleMobileMenu() {
  document.getElementById('sidebar').classList.toggle('open');
}

function closeMobileMenu() {
  document.getElementById('sidebar').classList.remove('open');
}

function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  setTimeout(() => toast.classList.remove('show'), 3000);
}

async function saveWelcome() {
  if (!currentGuildId) return showToast('No server selected', 'error');
  const payload = {
    guildId: currentGuildId,
    serverId: currentGuildId,
    enabled: document.getElementById('welcome-enabled').checked,
    channelId: document.getElementById('welcome-channel').value,
    description: document.getElementById('welcome-message').value,
  };
  try {
    const res = await fetch(`/api/guild/${currentGuildId}/config/Welcome`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(errText);
    }
    showToast('Settings saved successfully!', 'success');
    await loadConfigs();
  } catch (err) {
    console.error('Save error:', err);
    showToast(`Failed to save: ${err.message}`, 'error');
  }
}

async function saveAutoRoles() {
  if (!currentGuildId) return showToast('No server selected', 'error');
  const payload = {
    guildId: currentGuildId,
    serverId: currentGuildId,
    roleIds: document.getElementById('autoroles-roles').value
      .split(',').map(r => r.trim()).filter(r => r),
  };
  try {
    const res = await fetch(`/api/guild/${currentGuildId}/config/AutoRole`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(errText);
    }
    showToast('Settings saved successfully!', 'success');
    await loadConfigs();
  } catch (err) {
    console.error('Save error:', err);
    showToast(`Failed to save: ${err.message}`, 'error');
  }
}

async function saveButtonRole() {
  if (!currentGuildId) return showToast('No server selected', 'error');
  const panelName = document.getElementById('btnrole-panelname').value.trim();
  const channelId = document.getElementById('btnrole-channel').value.trim();
  if (!panelName || !channelId) return showToast('Panel name and channel ID are required', 'error');
  let buttons;
  try {
    buttons = JSON.parse(document.getElementById('btnrole-buttons').value || '[]');
  } catch {
    return showToast('Invalid JSON for buttons', 'error');
  }
  const payload = {
    guildId: currentGuildId,
    panelName,
    panelData: { description: document.getElementById('btnrole-description').value },
    channelId,
    buttons,
  };
  try {
    const res = await fetch(`/api/guild/${currentGuildId}/config/ButtonRole`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(errText);
    }
    showToast('Button role panel saved!', 'success');
    await loadConfigs();
  } catch (err) {
    console.error('Save error:', err);
    showToast(`Failed to save: ${err.message}`, 'error');
  }
}

async function loadLeaderboard(type) {
  if (!currentGuildId) return;
  const container = document.getElementById(type === 'vc' ? 'vc-leaderboard-list' : 'lvl-leaderboard-list');
  container.innerHTML = '<p class="lb-loading">Loading...</p>';

  try {
    const res = await fetch(`/api/guild/${currentGuildId}/leaderboard?type=${type}`);
    if (!res.ok) throw new Error('Failed');
    const data = await res.json();

    if (data.length === 0) {
      container.innerHTML = '<p class="lb-empty">No data yet. Members need to chat/join VC to appear here.</p>';
      return;
    }

    let html = '<table class="lb-table"><thead><tr>';
    html += '<th>#</th><th>User</th>';
    if (type === 'vc') {
      html += '<th>VC Time</th><th>Voice XP</th>';
    } else {
      html += '<th>Level</th><th>Total XP</th><th>Voice XP</th>';
    }
    html += '</tr></thead><tbody>';

    data.forEach(entry => {
      const rankClass = entry.rank === 1 ? 'gold' : entry.rank === 2 ? 'silver' : entry.rank === 3 ? 'bronze' : '';
      const avatarUrl = entry.avatar
        ? `https://cdn.discordapp.com/avatars/${entry.userId}/${entry.avatar}.png?size=32`
        : '';

      html += `<tr>`;
      html += `<td class="lb-rank ${rankClass}">${entry.rank}</td>`;
      html += `<td><div class="lb-user">`;
      if (avatarUrl) {
        html += `<div class="lb-user-avatar" style="background-image: url(${avatarUrl})"></div>`;
      } else {
        html += `<div class="lb-user-avatar"></div>`;
      }
      html += `<span class="lb-user-name">${escapeHtml(entry.username)}</span>`;
      html += `</div></td>`;

      if (type === 'vc') {
        const hours = Math.floor(entry.voiceSeconds / 3600);
        const minutes = Math.floor((entry.voiceSeconds % 3600) / 60);
        html += `<td class="lb-stat">${hours}h ${minutes}m</td>`;
        html += `<td class="lb-stat"><strong>${Math.floor(entry.voiceXp)}</strong></td>`;
      } else {
        html += `<td class="lb-stat"><strong>${entry.level}</strong></td>`;
        html += `<td class="lb-stat"><strong>${Math.floor(entry.totalXp)}</strong></td>`;
        html += `<td class="lb-stat">${Math.floor(entry.voiceXp)}</td>`;
      }
      html += `</tr>`;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
  } catch (err) {
    console.error('Leaderboard error:', err);
    container.innerHTML = '<p class="lb-empty">Failed to load leaderboard.</p>';
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
