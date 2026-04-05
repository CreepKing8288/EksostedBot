let currentGuildId = null;
let userGuilds = [];
let currentLbType = 'level';
let currentLbPage = 1;

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
  document.getElementById('sidebarOverlay').addEventListener('click', closeMobileMenu);

  if (user.id !== '1394914695600934932') {
    const statusNav = document.querySelector('.nav-item[data-panel="botstatus"]');
    if (statusNav) statusNav.style.display = 'none';
    const annNav = document.querySelector('.nav-item[data-panel="announcement"]');
    if (annNav) annNav.style.display = 'none';
  }

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
  list.innerHTML = guilds.map(g => {
    const iconHtml = g.icon
      ? `<img class="di-icon-img" src="https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=32" alt="">`
      : `<div class="di-icon">🏠</div>`;
    return `
    <div class="dropdown-item" data-guild-id="${g.id}" onclick="selectServer('${g.id}', '${g.name.replace(/'/g, "\\'")}')">
      ${iconHtml}
      <span>${g.name}</span>
    </div>
  `;
  }).join('');
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

  const guild = userGuilds.find(g => g.id === guildId);
  const iconEl = document.getElementById('serverIcon');
  if (guild && guild.icon) {
    iconEl.innerHTML = `<img src="https://cdn.discordapp.com/icons/${guildId}/${guild.icon}.png?size=32" alt="" style="width:32px;height:32px;border-radius:8px;">`;
  } else {
    iconEl.textContent = '🏠';
    iconEl.innerHTML = '';
    iconEl.style.fontSize = '0.9rem';
  }

  document.getElementById('serverName').textContent = guildName;

  document.querySelectorAll('.dropdown-item').forEach(item => {
    item.classList.toggle('active', item.dataset.guildId === guildId);
  });

  await loadConfigs();
  await loadLeaderboard('level', 1);
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
    announcement: 'Global Announcement',
    botstatus: 'Bot Status',
    buttonroles: 'Button Roles',
  };

  document.getElementById('topbarTitle').textContent = titles[panelName] || 'Dashboard';

  if (panelName === 'botstatus') {
    loadBotStatus();
  }
  if (panelName === 'announcement') {
    loadAnnouncement();
  }
}

function toggleMobileMenu() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  const isOpen = sidebar.classList.contains('open');
  sidebar.classList.toggle('open');
  overlay.classList.toggle('open', !isOpen);
  document.body.style.overflow = isOpen ? '' : 'hidden';
}

function closeMobileMenu() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('open');
  document.body.style.overflow = '';
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

function changeLeaderboardType() {
  currentLbType = document.getElementById('lbTypeSelect').value;
  currentLbPage = 1;
  loadLeaderboard(currentLbType, 1);
}

async function loadLeaderboard(type, page) {
  if (!currentGuildId) return;
  currentLbType = type;
  currentLbPage = page;
  document.getElementById('lbTypeSelect').value = type;
  const container = document.getElementById('lb-container');
  const pagination = document.getElementById('lbPagination');
  container.innerHTML = '<p class="lb-loading">Loading...</p>';
  pagination.innerHTML = '';

  try {
    const res = await fetch(`/api/guild/${currentGuildId}/leaderboard?type=${type}&page=${page}`);
    if (!res.ok) throw new Error('Failed');
    const data = await res.json();

    if (data.leaderboard.length === 0) {
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

    data.leaderboard.forEach(entry => {
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

    // Pagination
    if (data.totalPages > 1) {
      let pagHtml = '<div class="lb-pages">';
      pagHtml += `<button class="lb-page-btn" ${page <= 1 ? 'disabled' : ''} onclick="loadLeaderboard('${type}', ${page - 1})">‹</button>`;
      for (let p = 1; p <= data.totalPages; p++) {
        pagHtml += `<button class="lb-page-btn ${p === page ? 'active' : ''}" onclick="loadLeaderboard('${type}', ${p})">${p}</button>`;
      }
      pagHtml += `<button class="lb-page-btn" ${page >= data.totalPages ? 'disabled' : ''} onclick="loadLeaderboard('${type}', ${page + 1})">›</button>`;
      pagHtml += `<span class="lb-page-info">${data.total} members</span>`;
      pagHtml += '</div>';
      pagination.innerHTML = pagHtml;
    }
  } catch (err) {
    console.error('Leaderboard error:', err);
    container.innerHTML = '<p class="lb-empty">Failed to load leaderboard.</p>';
  }
}

let statusEntries = [];
let entryCounter = 0;

function addStatusEntry() {
  entryCounter++;
  const entry = {
    id: entryCounter,
    order: statusEntries.length,
    type: 'PLAYING',
    state: '',
    url: '',
  };
  statusEntries.push(entry);
  renderStatusEntries();
}

function removeStatusEntry(id) {
  statusEntries = statusEntries.filter(e => e.id !== id);
  statusEntries.forEach((e, i) => e.order = i);
  renderStatusEntries();
}

function renderStatusEntries() {
  const container = document.getElementById('status-entries-list');
  if (statusEntries.length === 0) {
    container.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 2rem 0; font-size: 0.9rem;">No entries yet. Click "Add Entry" to create your first status.</p>';
    return;
  }

  let html = '';
  statusEntries.forEach((entry, index) => {
    html += `
    <div class="status-entry-card">
      <div class="status-entry-header">
        <div class="status-entry-order">${index + 1}</div>
        <select class="status-entry-type" onchange="statusEntries.find(e=>e.id===${entry.id}).type=this.value">
          <option value="PLAYING" ${entry.type === 'PLAYING' ? 'selected' : ''}>Playing</option>
          <option value="STREAMING" ${entry.type === 'STREAMING' ? 'selected' : ''}>Streaming</option>
          <option value="LISTENING" ${entry.type === 'LISTENING' ? 'selected' : ''}>Listening</option>
          <option value="WATCHING" ${entry.type === 'WATCHING' ? 'selected' : ''}>Watching</option>
          <option value="COMPETING" ${entry.type === 'COMPETING' ? 'selected' : ''}>Competing</option>
        </select>
        <button class="status-entry-remove" onclick="removeStatusEntry(${entry.id})" title="Remove">&times;</button>
      </div>
      <div class="status-entry-body">
        <div class="form-group">
          <label class="form-label">Status Text</label>
          <input type="text" class="form-input" value="${escapeAttr(entry.state)}" placeholder="e.g. {userCount} people." oninput="statusEntries.find(e=>e.id===${entry.id}).state=this.value">
          <small style="color: var(--text-muted); font-size: 0.7rem;">Variables: <code style="color: var(--accent-light);">{userCount}</code> <code style="color: var(--accent-light);">{serverCount}</code></small>
        </div>
        ${entry.type === 'STREAMING' ? `
        <div class="form-group">
          <label class="form-label">Stream URL</label>
          <input type="text" class="form-input" value="${escapeAttr(entry.url)}" placeholder="https://twitch.tv/yourchannel" oninput="statusEntries.find(e=>e.id===${entry.id}).url=this.value">
        </div>` : ''}
      </div>
    </div>`;
  });

  container.innerHTML = html;
}

function escapeAttr(text) {
  return (text || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function loadBotStatus() {
  try {
    const res = await fetch('/api/status');
    if (!res.ok) {
      if (res.status === 403) {
        const container = document.getElementById('status-entries-list');
        if (container) container.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 2rem 0;">You do not have permission to modify the bot status.</p>';
        return;
      }
      return;
    }
    const data = await res.json();
    document.getElementById('status-enabled').checked = data.enabled !== false;
    document.getElementById('status-interval').value = (data.interval || 30000) / 1000;

    statusEntries = [];
    entryCounter = 0;
    if (data.entries && data.entries.length > 0) {
      const sorted = [...data.entries].sort((a, b) => a.order - b.order);
      sorted.forEach((entry, i) => {
        entryCounter++;
        statusEntries.push({
          id: entryCounter,
          order: i,
          type: entry.type || 'PLAYING',
          state: entry.state || '',
          url: entry.url || '',
        });
      });
    }
    renderStatusEntries();
  } catch (err) {
    console.error('Failed to load bot status:', err);
  }
}

async function loadAnnouncement() {
  try {
    const res = await fetch('/api/announcement');
    if (!res.ok) return;
    const data = await res.json();
    document.getElementById('ann-content').value = data.content || '';
    document.getElementById('ann-title').value = data.embedTitle || '';
    document.getElementById('ann-desc').value = data.embedDescription || '';
    document.getElementById('ann-color').value = data.embedColor || '#7c3aed';
    document.getElementById('ann-footer').value = data.embedFooter || '';
    document.getElementById('ann-image').value = data.embedImage || '';
    document.getElementById('ann-thumbnail').value = data.embedThumbnail || '';
    document.getElementById('ann-channel').value = data.channelId || '';

    if (data.totalSent || data.totalFailed) {
      document.getElementById('ann-stats').style.display = 'block';
      document.getElementById('ann-sent').textContent = data.totalSent;
      document.getElementById('ann-failed').textContent = data.totalFailed;
      document.getElementById('ann-total').textContent = data.totalSent + data.totalFailed;
    }
  } catch (err) {
    console.error('Failed to load announcement:', err);
  }
}

async function saveAnnouncement() {
  const payload = {
    content: document.getElementById('ann-content').value,
    embedTitle: document.getElementById('ann-title').value,
    embedDescription: document.getElementById('ann-desc').value,
    embedColor: document.getElementById('ann-color').value,
    embedFooter: document.getElementById('ann-footer').value,
    embedImage: document.getElementById('ann-image').value,
    embedThumbnail: document.getElementById('ann-thumbnail').value,
    channelId: document.getElementById('ann-channel').value,
  };

  try {
    const res = await fetch('/api/announcement', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await res.text());
    showToast('Announcement draft saved!', 'success');
  } catch (err) {
    showToast(`Failed to save: ${err.message}`, 'error');
  }
}

async function sendAnnouncement() {
  const payload = {
    content: document.getElementById('ann-content').value,
    embedTitle: document.getElementById('ann-title').value,
    embedDescription: document.getElementById('ann-desc').value,
    embedColor: document.getElementById('ann-color').value,
    embedFooter: document.getElementById('ann-footer').value,
    embedImage: document.getElementById('ann-image').value,
    embedThumbnail: document.getElementById('ann-thumbnail').value,
    channelId: document.getElementById('ann-channel').value,
  };

  if (!payload.content && !payload.embedTitle && !payload.embedDescription) {
    return showToast('Add a message or embed content before sending', 'error');
  }

  showToast('Sending announcement...', 'success');

  try {
    const res = await fetch('/api/announcement/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();

    document.getElementById('ann-stats').style.display = 'block';
    document.getElementById('ann-sent').textContent = data.sent;
    document.getElementById('ann-failed').textContent = data.failed;
    document.getElementById('ann-total').textContent = data.total;

    showToast(`Sent to ${data.sent} servers (${data.failed} failed)`, data.failed === 0 ? 'success' : 'error');
  } catch (err) {
    showToast(`Failed to send: ${err.message}`, 'error');
  }
}
async function saveBotStatus() {
  const entries = statusEntries.map((entry, i) => ({
    order: i,
    type: entry.type,
    state: entry.state,
    url: entry.url,
  }));

  const payload = {
    enabled: document.getElementById('status-enabled').checked,
    interval: parseInt(document.getElementById('status-interval').value) * 1000,
    entries,
  };

  try {
    const res = await fetch('/api/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(errText);
    }

    showToast('Bot status updated successfully!', 'success');
    await loadBotStatus();
  } catch (err) {
    console.error('Save error:', err);
    showToast(`Failed to save: ${err.message}`, 'error');
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
