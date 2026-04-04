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
  switchPanel('overview');
}

async function loadConfigs() {
  if (!currentGuildId) return;

  try {
    const res = await fetch(`/api/guild/${currentGuildId}/configs`);
    if (!res.ok) return;
    const configs = await res.json();

    populateSwearFilter(configs.SwearFilter);
    populateAntiSpam(configs.AntiSpam);
    populateLinkFilter(configs.LinkFilter);
    populateStarboard(configs.Starboard);
    populateCrates(configs.CrateConfig);
    populateTickets(configs.TicketSettings);
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
  }

  try {
    const res = await fetch(`/api/guild/${currentGuildId}/config/${modelName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error('Failed to save');

    showToast('Settings saved successfully!', 'success');
    await loadConfigs();
  } catch (err) {
    showToast('Failed to save settings', 'error');
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
