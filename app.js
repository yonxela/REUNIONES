class MeetingManager {
  constructor() {
    this.meetings = [];
    this.currentMeetingId = null;
    this.currentStep = null;
    this.timerInterval = null;
    this.timerSeconds = 0;
    this.timerRunning = false;
    this.topicTimerInterval = null;
    this.topicTimerSeconds = 0;
    this.currentTopicIndex = -1;
    this.currentSubtopicIndex = -1;
    this.sidebarVisible = window.innerWidth > 900;
    // Multi-user
    this.currentUser = null;
    // Categories
    this.categories = [];
    this.activeCategory = null;
    this.collapsedCategories = new Set();
    // Realtime
    this.realtime = null;
    this.isGuestMode = false;
  }

  async init() {
    this.cacheDOM();
    this.bindEvents();
    this.bindMasterEvents();

    // Check if this is a guest joining via ?join= link
    const joinId = MeetingRealtime.getJoinIdFromURL();
    if (joinId) {
      this.showGuestJoinScreen(joinId);
      return;
    }

    // Auto-register legacy user (Yonathan Rodas / 1122) in master panel
    this.migrateLegacyUser();

    if (!this.checkAccess()) {
      return;
    }

    this.initializeApp();
  }

  async initializeApp() {
    this.appContainer.classList.toggle('sidebar-collapsed', !this.sidebarVisible);
    this.masterPanel?.classList.add('hidden');
    this.appContainer.classList.remove('hidden');

    // Sync users/config from cloud (non-blocking)
    this.syncFromCloud();

    // Show user name in sidebar
    const nameEl = document.getElementById('sidebarUserName');
    const avatarEl = document.getElementById('sidebarUserAvatar');
    if (this.currentUser && nameEl) {
      nameEl.textContent = this.currentUser.name;
      if (avatarEl) avatarEl.textContent = this.currentUser.name.charAt(0).toUpperCase();
    }

    const key = this.getMeetingsStorageKey();
    const localData = localStorage.getItem(key);
    if (localData) this.meetings = JSON.parse(localData);

    this.renderMeetingList();
    this.showWelcome();

    // Load categories
    this.loadCategories();
    this.bindCategoryEvents();
    this.renderMeetingList(); // re-render with categories

    await this.loadMeetings();

    // Initialize realtime
    if (typeof supabaseClient !== 'undefined') {
      this.realtime = new MeetingRealtime(supabaseClient);
      // Listen for state requests from guests
      this.realtime.onPresenceUpdate = (users) => this.updatePresenceUI(users);
    }

    // Bind share button
    this.bindShareEvents();
  }

  cacheDOM() {
    // Login
    this.loginScreen = document.getElementById('loginScreen');
    this.loginCodeInput = document.getElementById('loginCodeInput');
    this.btnLoginSubmit = document.getElementById('btnLoginSubmit');
    this.loginErrorMsg = document.getElementById('loginErrorMsg');

    // App container
    this.appContainer = document.getElementById('appContainer');
    this.sidebar = document.getElementById('sidebar');
    this.btnToggleSidebar = document.getElementById('btnToggleSidebar');
    this.meetingListEl = document.getElementById('meetingList');
    this.btnNewMeeting = document.getElementById('btnNewMeeting');

    // Views
    this.welcomeScreen = document.getElementById('welcomeScreen');
    this.stepSetup = document.getElementById('stepSetup');
    this.stepMeeting = document.getElementById('stepMeeting');
    this.stepSummary = document.getElementById('stepSummary');

    // Step indicators
    this.stepDots = document.querySelectorAll('.step-dot');
    this.stepLines = document.querySelectorAll('.step-line');

    // Setup step
    this.meetingTitleInput = document.getElementById('meetingTitle');
    this.participantsList = document.getElementById('participantsList');
    this.participantInput = document.getElementById('participantInput');
    this.btnAddParticipant = document.getElementById('btnAddParticipant');
    this.topicsListSetup = document.getElementById('topicsListSetup');
    this.topicInput = document.getElementById('topicInput');
    this.topicMinutes = document.getElementById('topicMinutes');
    this.btnAddTopic = document.getElementById('btnAddTopic');
    this.btnStartMeeting = document.getElementById('btnStartMeeting');

    // Meeting step
    this.meetingActiveTitle = document.getElementById('meetingActiveTitle');
    this.meetingActiveMeta = document.getElementById('meetingActiveMeta');
    this.btnParticipantsPopup = document.getElementById('btnParticipantsPopup');
    this.participantsPopup = document.getElementById('participantsPopup');
    this.participantsCountBadge = document.getElementById('participantsCountBadge');
    this.popupParticipantsList = document.getElementById('popupParticipantsList');
    this.popupParticipantInput = document.getElementById('popupParticipantInput');
    this.btnPopupAddParticipant = document.getElementById('btnPopupAddParticipant');

    // Timer
    this.timerDisplay = document.getElementById('timerDisplay');
    this.btnPlayTimer = document.getElementById('btnPlayTimer');
    this.btnPauseTimer = document.getElementById('btnPauseTimer');
    this.btnAIAssist = document.getElementById('btnAIAssist');
    this.aiAssistText = document.getElementById('aiAssistText');
    this.currentTopicDisplay = document.getElementById('currentTopicDisplay');
    this.currentTopicName = document.getElementById('currentTopicName');
    this.topicTimerDisplay = document.getElementById('topicTimerDisplay');
    this.btnTopicDone = document.getElementById('btnTopicDone');
    this.allTopicsDoneMsg = document.getElementById('allTopicsDoneMsg');

    // Agenda sidebar
    this.agendaItems = document.getElementById('agendaItems');
    this.agendaProgress = document.getElementById('agendaProgress');
    this.btnFinishMeeting = document.getElementById('btnFinishMeeting');

    // Tasks
    this.tasksList = document.getElementById('tasksList');
    this.taskInput = document.getElementById('taskInput');
    this.taskAssignee = document.getElementById('taskAssignee');
    this.taskDueDate = document.getElementById('taskDueDate');
    this.btnAddTask = document.getElementById('btnAddTask');
    this.tasksBadge = document.getElementById('tasksBadge');
    this.taskLinkedTopic = document.getElementById('taskLinkedTopic');

    // Summary
    this.summaryContent = document.getElementById('summaryContent');
    this.aiSummaryBox = document.getElementById('aiSummaryBox');
    this.aiSummaryText = document.getElementById('aiSummaryText');
    this.followupDate = document.getElementById('followupDate');
    this.followupTime = document.getElementById('followupTime');
    this.btnCopySummary = document.getElementById('btnCopySummary');
    this.btnNewAfterSummary = document.getElementById('btnNewAfterSummary');

    // Modal
    this.modalOverlay = document.getElementById('modalOverlay');
    this.modalTitle = document.getElementById('modalTitle');
    this.modalBody = document.getElementById('modalBody');
    this.btnModalCancel = document.getElementById('btnModalCancel');
    this.btnModalConfirm = document.getElementById('btnModalConfirm');

    // Master panel
    this.masterPanel = document.getElementById('masterPanel');
    this.masterUsersList = document.getElementById('masterUsersList');
    this.masterStats = document.getElementById('masterStats');
    this.masterUserForm = document.getElementById('masterUserForm');
    this.userFormName = document.getElementById('userFormName');
    this.userFormCode = document.getElementById('userFormCode');
    this.userFormExpiry = document.getElementById('userFormExpiry');
    this.userFormId = document.getElementById('userFormId');
    this.masterCodeInputEl = document.getElementById('masterCodeInput');

    // Toast
    this.toastContainer = document.getElementById('toastContainer');

    // Search
    this.globalSearchInput = document.getElementById('globalSearchInput');
    this.searchClearBtn = document.getElementById('searchClearBtn');
    this.searchResultsPanel = document.getElementById('searchResultsPanel');
    this.searchResultsCount = document.getElementById('searchResultsCount');
    this.searchResultsBody = document.getElementById('searchResultsBody');
    this.searchQueryDisplay = document.getElementById('searchQueryDisplay');
    this.btnCloseSearch = document.getElementById('btnCloseSearch');

    // Continuity
    this.btnCreateFollowup = document.getElementById('btnCreateFollowup');
    this.continuityBanner = document.getElementById('continuityBanner');
    this.continuityParentLink = document.getElementById('continuityParentLink');

    // Categories
    this.categoryBar = document.getElementById('categoryBar');
    this.categoryChips = document.getElementById('categoryChips');
    this.btnManageCategories = document.getElementById('btnManageCategories');
    this.categoryManager = document.getElementById('categoryManager');
    this.btnCloseCategoryManager = document.getElementById('btnCloseCategoryManager');
    this.newCategoryInput = document.getElementById('newCategoryInput');
    this.btnAddCategory = document.getElementById('btnAddCategory');
    this.categoryManagerList = document.getElementById('categoryManagerList');
    this.meetingContextMenu = document.getElementById('meetingContextMenu');
    this.contextMenuItems = document.getElementById('contextMenuItems');
  }

  bindEvents() {
    // Login
    this.btnLoginSubmit.addEventListener('click', () => this.handleLogin());
    this.loginCodeInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.handleLogin();
    });

    this.btnNewMeeting.addEventListener('click', () => this.createNewMeeting());
    this.btnToggleSidebar.addEventListener('click', () => this.toggleSidebar());

    // Setup
    this.meetingTitleInput.addEventListener('input', () => this.saveMeetingDetails());
    this.btnAddParticipant.addEventListener('click', () => this.addParticipant());
    this.participantInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.addParticipant(); });
    this.btnAddTopic.addEventListener('click', () => this.addTopic());
    this.topicInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.addTopic(); });
    this.btnStartMeeting.addEventListener('click', () => this.goToMeetingStep());

    // Meeting
    this.btnPlayTimer.addEventListener('click', () => this.startTimer());
    this.btnPauseTimer.addEventListener('click', () => this.pauseTimer());
    this.btnAIAssist.addEventListener('click', () => this.toggleAIAssistant());
    this.btnTopicDone.addEventListener('click', () => this.markCurrentTopicDone());
    this.btnFinishMeeting.addEventListener('click', () => this.finishMeeting());

    // Participants popup
    this.btnParticipantsPopup.addEventListener('click', (e) => {
      e.stopPropagation();
      this.participantsPopup.classList.toggle('show');
    });
    this.btnPopupAddParticipant.addEventListener('click', () => this.addParticipantFromPopup());
    this.popupParticipantInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.addParticipantFromPopup(); });
    document.addEventListener('click', (e) => {
      if (!this.participantsPopup.contains(e.target) && !this.btnParticipantsPopup.contains(e.target)) {
        this.participantsPopup.classList.remove('show');
      }
    });

    // Tasks
    this.btnAddTask.addEventListener('click', () => this.addTask());
    this.taskInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.addTask(); });

    // Summary
    this.btnCopySummary.addEventListener('click', () => this.copySummary());
    this.btnNewAfterSummary.addEventListener('click', () => this.createNewMeeting());
    this.followupDate.addEventListener('change', () => this.saveFollowup());
    this.followupTime.addEventListener('change', () => this.saveFollowup());

    // Modal
    this.btnModalCancel.addEventListener('click', () => this.closeModal());
    this.modalOverlay.addEventListener('click', (e) => {
      if (e.target === this.modalOverlay) this.closeModal();
    });

    // Continuity
    if (this.btnCreateFollowup) {
      this.btnCreateFollowup.addEventListener('click', () => this.createFollowupMeeting());
    }

    // Global Search
    if (this.globalSearchInput) {
      let searchTimer;
      this.globalSearchInput.addEventListener('input', () => {
        clearTimeout(searchTimer);
        const q = this.globalSearchInput.value.trim();
        this.searchClearBtn.classList.toggle('hidden', q.length === 0);
        if (q.length >= 2) {
          searchTimer = setTimeout(() => this.performGlobalSearch(q), 250);
        } else {
          this.closeSearchResults();
        }
      });
      this.globalSearchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { this.globalSearchInput.value = ''; this.searchClearBtn.classList.add('hidden'); this.closeSearchResults(); }
      });
      this.searchClearBtn.addEventListener('click', () => {
        this.globalSearchInput.value = '';
        this.searchClearBtn.classList.add('hidden');
        this.closeSearchResults();
        this.globalSearchInput.focus();
      });
      this.btnCloseSearch.addEventListener('click', () => this.closeSearchResults());
    }
  }

  // ===== GLOBAL SEARCH =====
  performGlobalSearch(query) {
    try {
    const meetings = this.meetings;
    if (!meetings || meetings.length === 0) {
      this.showSearchResults(query, []);
      return;
    }

    const q = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const results = [];

    meetings.forEach(m => {
      const meetingLabel = m.title || 'Sin título';
      const meetingDate = this.formatDate(m.date);

      // Search in meeting title
      const titleNorm = (m.title || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (titleNorm.includes(q)) {
        results.push({ type: 'title', meeting: m, meetingLabel, meetingDate, text: m.title || 'Sin título', detail: `Reunión del ${meetingDate}` });
      }

      // Search in participants
      (m.participants || []).forEach(p => {
        const pNorm = p.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (pNorm.includes(q)) {
          results.push({ type: 'participant', meeting: m, meetingLabel, meetingDate, text: p, detail: `Participante en "${meetingLabel}"` });
        }
      });

      // Search in topics
      (m.topics || []).forEach(t => {
        const topicName = t.name || t.title || '';
        const tNorm = topicName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (tNorm.includes(q)) {
          results.push({ type: 'topic', meeting: m, meetingLabel, meetingDate, text: topicName, detail: `Tema en "${meetingLabel}"`, extra: t.notes || '' });
        }
        // Also search in topic notes
        const notesNorm = (t.notes || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (notesNorm.includes(q) && !tNorm.includes(q)) {
          const snippet = this.getSearchSnippet(t.notes, query, 80);
          results.push({ type: 'topic', meeting: m, meetingLabel, meetingDate, text: `Nota en tema: ${topicName}`, detail: snippet });
        }
      });

      // Search in tasks
      (m.tasks || []).forEach(t => {
        const taskDesc = t.description || t.text || '';
        const descNorm = taskDesc.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const assigneeNorm = (t.assignee || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (descNorm.includes(q) || assigneeNorm.includes(q)) {
          results.push({ type: 'task', meeting: m, meetingLabel, meetingDate, text: taskDesc, detail: t.assignee ? `Asignado a: ${t.assignee}` : 'Sin asignar', completed: t.completed });
        }
      });

      // Search in AI summary
      if (m.aiSummary) {
        const sumNorm = m.aiSummary.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (sumNorm.includes(q)) {
          const snippet = this.getSearchSnippet(m.aiSummary, query, 120);
          results.push({ type: 'summary', meeting: m, meetingLabel, meetingDate, text: 'Resumen IA', detail: snippet });
        }
      }
    });

    this.showSearchResults(query, results);
    } catch(err) {
      console.warn('[Search] Error:', err.message);
      this.showSearchResults(query, []);
    }
  }

  getSearchSnippet(text, query, maxLen) {
    const idx = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').indexOf(
      query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    );
    if (idx === -1) return text.slice(0, maxLen) + (text.length > maxLen ? '...' : '');
    const start = Math.max(0, idx - 30);
    const end = Math.min(text.length, idx + query.length + maxLen - 30);
    let snippet = text.slice(start, end);
    if (start > 0) snippet = '...' + snippet;
    if (end < text.length) snippet += '...';
    return snippet;
  }

  highlightText(text, query) {
    if (!query || !text) return this.esc(text || '');
    const escaped = text;
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return this.esc(escaped).replace(regex, '<span class="search-highlight">$1</span>');
  }

  showSearchResults(query, results) {
    this.searchResultsPanel.classList.remove('hidden');
    this.searchResultsCount.textContent = results.length;
    this.searchQueryDisplay.innerHTML = `Mostrando resultados para <strong>"${this.esc(query)}"</strong> en ${this.meetings.length} reunión${this.meetings.length !== 1 ? 'es' : ''}`;

    if (results.length === 0) {
      this.searchResultsBody.innerHTML = `
        <div class="search-no-results">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/><line x1="8" x2="14" y1="11" y2="11"/></svg>
          <h3>Sin resultados</h3>
          <p>No se encontraron coincidencias para "${this.esc(query)}".<br>Intenta con otro término.</p>
        </div>`;
      return;
    }

    // Group by type
    const groups = {
      title: { label: 'Reuniones', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>', items: [] },
      participant: { label: 'Participantes', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>', items: [] },
      topic: { label: 'Temas / Agenda', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>', items: [] },
      task: { label: 'Tareas', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="m9 12 2 2 4-4"/></svg>', items: [] },
      summary: { label: 'Resúmenes IA', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>', items: [] },
    };

    results.forEach(r => {
      if (groups[r.type]) groups[r.type].items.push(r);
    });

    let html = '';
    for (const [type, group] of Object.entries(groups)) {
      if (group.items.length === 0) continue;
      html += `<div class="search-group">`;
      html += `<div class="search-group-title">${group.icon} ${group.label} <span class="search-group-count">${group.items.length}</span></div>`;

      group.items.forEach(r => {
        const catClass = `search-cat-${type}`;
        const catLabel = { title: 'Reunión', participant: 'Participante', topic: 'Tema', task: 'Tarea', summary: 'Resumen IA' }[type];

        let extraHtml = '';
        if (type === 'task') {
          const statusClass = r.completed ? 'done' : 'pending';
          const statusLabel = r.completed ? '✓ Completada' : '⏳ Pendiente';
          extraHtml = `<span class="search-task-status ${statusClass}">${statusLabel}</span>`;
        }

        html += `
          <div class="search-result-card" onclick="app.goToSearchResult('${r.meeting.id}')">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
              <div style="flex:1; min-width:0;">
                <div class="search-result-meeting-tag">
                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
                  ${this.esc(r.meetingLabel)} · ${r.meetingDate}
                </div>
                <div class="search-result-content">${this.highlightText(r.text, query)}</div>
                <div class="search-result-meta">
                  <span class="search-result-category ${catClass}">${catLabel}</span>
                  ${extraHtml}
                  ${r.detail ? `<span class="search-result-meta-item">${this.highlightText(r.detail, query)}</span>` : ''}
                </div>
              </div>
            </div>
          </div>`;
      });
      html += `</div>`;
    }

    this.searchResultsBody.innerHTML = html;
  }

  goToSearchResult(meetingId) {
    this.closeSearchResults();
    this.globalSearchInput.value = '';
    this.searchClearBtn.classList.add('hidden');
    this.selectMeeting(meetingId);
  }

  closeSearchResults() {
    this.searchResultsPanel.classList.add('hidden');
  }

  // ===== MULTI-USER AUTH =====
  getMasterCode() {
    return localStorage.getItem('meetflow_master_code') || 'mst000';
  }

  async saveMasterCode(code) {
    localStorage.setItem('meetflow_master_code', code);
    if (window.supabaseDb) {
      try {
        await window.supabaseDb.from('meetflow_config')
          .upsert([{ key: 'master_code', value: code, updatedAt: new Date().toISOString() }]);
      } catch (e) { console.warn('Config sync error:', e.message); }
    }
  }

  getUsers() {
    return JSON.parse(localStorage.getItem('meetflow_users') || '[]');
  }

  saveUsers(users) {
    localStorage.setItem('meetflow_users', JSON.stringify(users));
  }

  async saveUsersToCloud(users) {
    this.saveUsers(users);
    if (window.supabaseDb) {
      try {
        // Upsert each user
        const rows = users.map(u => ({
          id: u.id,
          name: u.name,
          code: u.code,
          active: u.active !== false,
          expiresAt: u.expiresAt || null,
          createdAt: u.createdAt || new Date().toISOString(),
          isLegacy: u.isLegacy || false
        }));
        if (rows.length > 0) {
          await window.supabaseDb.from('meetflow_users').upsert(rows);
        }
      } catch (e) { console.warn('Users sync error:', e.message); }
    }
  }

  async syncFromCloud() {
    if (!window.supabaseDb) return;
    try {
      // Sync master code
      const { data: configData } = await window.supabaseDb
        .from('meetflow_config').select('*').eq('key', 'master_code').single();
      if (configData && configData.value) {
        localStorage.setItem('meetflow_master_code', configData.value);
      }

      // Sync users
      const { data: usersData } = await window.supabaseDb
        .from('meetflow_users').select('*').order('createdAt', { ascending: true });
      if (usersData && usersData.length > 0) {
        // Merge: cloud data wins, but preserve any local-only users
        const localUsers = this.getUsers();
        const cloudIds = new Set(usersData.map(u => u.id));
        const localOnly = localUsers.filter(u => !cloudIds.has(u.id));
        const merged = [...usersData, ...localOnly];
        this.saveUsers(merged);
        // Push local-only users to cloud
        if (localOnly.length > 0) {
          await this.saveUsersToCloud(merged);
        }
      } else {
        // No cloud users — push local users up
        const localUsers = this.getUsers();
        if (localUsers.length > 0) {
          await this.saveUsersToCloud(localUsers);
        }
      }
    } catch (e) { console.warn('Cloud sync error:', e.message); }
  }

  // Migrates the pre-multiuser legacy account (1122 / Yonathan Rodas) into the
  // users list so it appears in the Master Panel. Called once at app startup.
  migrateLegacyUser() {
    const users = this.getUsers();
    const alreadyMigrated = users.find(u => u.id === 'legacy');
    if (alreadyMigrated) return;

    const legacyUser = {
      id: 'legacy',
      name: 'Yonathan Rodas',
      code: '1122',
      active: true,
      expiresAt: null,
      createdAt: new Date().toISOString(),
      isLegacy: true
    };
    users.push(legacyUser);
    this.saveUsers(users);

    // Migrate meeting data
    const oldKey = 'meetflow_meetings';
    const newKey = 'meetflow_meetings_legacy';
    const existingNew = localStorage.getItem(newKey);
    const existingOld = localStorage.getItem(oldKey);
    if (!existingNew && existingOld) {
      localStorage.setItem(newKey, existingOld);
    }
  }

  getMeetingsStorageKey() {
    if (this.currentUser && !this.currentUser.isMaster) {
      return `meetflow_meetings_${this.currentUser.id}`;
    }
    return 'meetflow_meetings';
  }

  checkAccess() {
    const session = sessionStorage.getItem('meetflow_session');
    if (session) {
      this.currentUser = JSON.parse(session);
      if (this.currentUser.isMaster) {
        this.loginScreen.classList.add('hidden');
        this.showMasterPanel();
        return false;
      }
      this.loginScreen.classList.add('hidden');
      return true;
    }
    this.loginScreen.classList.remove('hidden');
    return false;
  }

  handleLogin() {
    const code = this.loginCodeInput.value.trim();
    if (!code) return;

    // 1. Check master code
    if (code === this.getMasterCode()) {
      this.currentUser = { id: 'master', name: 'Master', isMaster: true };
      sessionStorage.setItem('meetflow_session', JSON.stringify(this.currentUser));
      this.loginErrorMsg.style.display = 'none';
      this.loginScreen.classList.add('hidden');
      this.loginCodeInput.value = '';
      this.showMasterPanel();
      return;
    }

    // 2. Check user codes
    const users = this.getUsers();
    const user = users.find(u => u.active && u.code === code);
    if (user) {
      // Check expiry
      if (user.expiresAt && new Date(user.expiresAt) < new Date()) {
        this.loginErrorMsg.textContent = 'Tu acceso ha expirado. Contacta al administrador.';
        this.loginErrorMsg.style.display = 'block';
        return;
      }
      this.currentUser = { id: user.id, name: user.name, isMaster: false };
      sessionStorage.setItem('meetflow_session', JSON.stringify(this.currentUser));
      this.loginErrorMsg.style.display = 'none';
      this.loginScreen.classList.add('hidden');
      this.loginCodeInput.value = '';
      this.initializeApp();
      return;
    }

    // 3. Legacy fallback — siempre válido para compatibilidad con usuarios anteriores
    const legacyCodes = JSON.parse(localStorage.getItem('meetflow_legacy_codes') || '["1122"]');
    if (legacyCodes.includes(code)) {
      // Use fixed id 'legacy' to preserve existing meeting data storage key
      this.currentUser = { id: 'legacy', name: 'Yonathan Rodas', isMaster: false };
      sessionStorage.setItem('meetflow_session', JSON.stringify(this.currentUser));
      this.loginErrorMsg.style.display = 'none';
      this.loginScreen.classList.add('hidden');
      this.loginCodeInput.value = '';
      this.initializeApp();
      return;
    }

    this.loginErrorMsg.textContent = 'Código incorrecto. Inténtalo de nuevo.';
    this.loginErrorMsg.style.display = 'block';
  }

  logout() {
    sessionStorage.removeItem('meetflow_session');
    this.currentUser = null;
    this.meetings = [];
    if (this.masterPanel) this.masterPanel.classList.add('hidden');
    if (this.appContainer) this.appContainer.classList.add('hidden');
    if (this.loginScreen) this.loginScreen.classList.remove('hidden');
    this.loginCodeInput.value = '';
  }

  // ===== MASTER PANEL =====
  showMasterPanel() {
    if (!this.masterPanel) return;
    this.appContainer.classList.add('hidden');
    this.masterPanel.classList.remove('hidden');
    const mc = this.getMasterCode();
    this.masterCodeInputEl.value = mc;
    this.renderMasterUsers();
    this.renderMasterStats();
  }

  bindMasterEvents() {
    const $ = id => document.getElementById(id);

    // Logout
    $('btnMasterLogout')?.addEventListener('click', () => this.logout());

    // Toggle password visibility
    $('btnToggleCode')?.addEventListener('click', () => {
      const inp = this.userFormCode;
      inp.type = inp.type === 'password' ? 'text' : 'password';
    });
    $('btnToggleMasterCode')?.addEventListener('click', () => {
      const inp = this.masterCodeInputEl;
      inp.type = inp.type === 'password' ? 'text' : 'password';
    });

    // Save master code
    $('btnSaveMasterCode')?.addEventListener('click', () => {
      const val = this.masterCodeInputEl.value.trim();
      if (!val || val.length < 4) {
        this.showToast('El código debe tener al menos 4 caracteres', 'warning');
        return;
      }
      this.saveMasterCode(val);
      this.showToast('Código master actualizado ✓', 'success');
    });

    // Add user
    $('btnAddUser')?.addEventListener('click', () => {
      this.userFormId.value = '';
      this.userFormName.value = '';
      this.userFormCode.value = '';
      this.userFormExpiry.value = '';
      this.masterUserForm.classList.remove('hidden');
      this.userFormName.focus();
    });

    // Save user
    $('btnSaveUser')?.addEventListener('click', () => this.saveMasterUser());

    // Cancel form
    $('btnCancelUser')?.addEventListener('click', () => {
      this.masterUserForm.classList.add('hidden');
    });

    // Enter on form inputs
    [$('userFormName'), $('userFormCode'), $('userFormExpiry')].forEach(el => {
      el?.addEventListener('keydown', e => { if (e.key === 'Enter') this.saveMasterUser(); });
    });
  }

  renderMasterUsers() {
    const users = this.getUsers();
    if (!this.masterUsersList) return;

    if (users.length === 0) {
      this.masterUsersList.innerHTML = `
        <div class="master-empty">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="23" x2="17" y1="11" y2="11"/></svg>
          <p>Aún no hay usuarios.<br>Crea el primero con el botón de arriba.</p>
        </div>`;
      return;
    }

    this.masterUsersList.innerHTML = users.map(u => {
      const now = new Date();
      const expired = u.expiresAt && new Date(u.expiresAt) < now;
      const statusClass = !u.active ? 'inactive' : expired ? 'expired' : 'active';
      const statusLabel = !u.active ? 'Inactivo' : expired ? 'Expirado' : 'Activo';
      const expiryStr = u.expiresAt ? this.formatDate(u.expiresAt) : 'Sin vencimiento';
      const meetings = JSON.parse(localStorage.getItem(`meetflow_meetings_${u.id}`) || '[]');

      // Calculate days remaining and time info
      let daysRemaining = null;
      let timeRemainingText = '';
      let timeBarPercent = 100;
      let timeBarClass = 'time-bar-ok';
      
      if (u.expiresAt) {
        const expiryDate = new Date(u.expiresAt);
        const diffMs = expiryDate - now;
        daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        
        if (daysRemaining < 0) {
          timeRemainingText = `Venció hace ${Math.abs(daysRemaining)} día${Math.abs(daysRemaining) !== 1 ? 's' : ''}`;
          timeBarPercent = 0;
          timeBarClass = 'time-bar-expired';
        } else if (daysRemaining === 0) {
          timeRemainingText = 'Vence hoy';
          timeBarPercent = 5;
          timeBarClass = 'time-bar-critical';
        } else if (daysRemaining <= 3) {
          timeRemainingText = `${daysRemaining} día${daysRemaining !== 1 ? 's' : ''} restante${daysRemaining !== 1 ? 's' : ''}`;
          timeBarPercent = Math.max(10, Math.min(100, (daysRemaining / 30) * 100));
          timeBarClass = 'time-bar-critical';
        } else if (daysRemaining <= 7) {
          timeRemainingText = `${daysRemaining} días restantes`;
          timeBarPercent = Math.max(15, Math.min(100, (daysRemaining / 30) * 100));
          timeBarClass = 'time-bar-warning';
        } else if (daysRemaining <= 30) {
          timeRemainingText = `${daysRemaining} días restantes`;
          timeBarPercent = Math.max(20, Math.min(100, (daysRemaining / 30) * 100));
          timeBarClass = 'time-bar-ok';
        } else {
          const months = Math.floor(daysRemaining / 30);
          const remDays = daysRemaining % 30;
          timeRemainingText = months > 0 
            ? `${months} mes${months > 1 ? 'es' : ''}${remDays > 0 ? ` y ${remDays}d` : ''}`
            : `${daysRemaining} días`;
          timeBarPercent = 100;
          timeBarClass = 'time-bar-ok';
        }
      } else {
        timeRemainingText = 'Acceso ilimitado';
        timeBarClass = 'time-bar-unlimited';
      }

      const createdStr = u.createdAt ? this.formatDate(u.createdAt.split('T')[0]) : '—';

      return `
        <div class="master-user-card ${statusClass}">
          <div class="master-user-info">
            <div class="master-user-avatar">${u.name.charAt(0).toUpperCase()}</div>
            <div class="master-user-details">
              <div class="master-user-name">${this.esc(u.name)}</div>
              <div class="master-user-meta">
                <span class="master-user-stat">
                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/></svg>
                  ${meetings.length} reuniones
                </span>
                <span class="master-user-stat">
                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  Creado: ${createdStr}
                </span>
              </div>
            </div>
            <span class="master-status-badge ${statusClass}">${statusLabel}</span>
          </div>
          
          <!-- Time Validation Section -->
          <div class="master-user-time-section">
            <div class="master-time-header">
              <div class="master-time-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
              </div>
              <span class="master-time-label">Validez del acceso</span>
              <span class="master-time-remaining ${timeBarClass}">${timeRemainingText}</span>
            </div>
            ${u.expiresAt ? `
              <div class="master-time-bar-container">
                <div class="master-time-bar ${timeBarClass}" style="width: ${timeBarPercent}%"></div>
              </div>
              <div class="master-time-dates">
                <span>Vence: ${expiryStr}</span>
                ${daysRemaining !== null && daysRemaining >= 0 ? `<span class="master-time-countdown">${daysRemaining}d</span>` : ''}
              </div>
            ` : `
              <div class="master-time-bar-container">
                <div class="master-time-bar time-bar-unlimited" style="width: 100%"></div>
              </div>
              <div class="master-time-dates">
                <span>Sin fecha de vencimiento</span>
                <span class="master-time-countdown">∞</span>
              </div>
            `}
          </div>

          <div class="master-user-actions">
            <button class="btn-master-action edit" onclick="app.editMasterUser('${u.id}')" title="Editar">
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="btn-master-action toggle" onclick="app.toggleMasterUser('${u.id}')" title="${u.active ? 'Desactivar' : 'Activar'}">
              ${u.active
                ? '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" x2="19.07" y1="4.93" y2="19.07"/></svg>'
                : '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>'
              }
            </button>
            <button class="btn-master-action delete" onclick="app.deleteMasterUser('${u.id}')" title="Eliminar">
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
            </button>
          </div>
        </div>`;
    }).join('');
  }

  renderMasterStats() {
    const users = this.getUsers();
    const total = users.length;
    const active = users.filter(u => u.active && (!u.expiresAt || new Date(u.expiresAt) >= new Date())).length;
    const expiring = users.filter(u => {
      if (!u.expiresAt) return false;
      const d = new Date(u.expiresAt);
      const now = new Date();
      const diff = (d - now) / (1000 * 60 * 60 * 24);
      return diff >= 0 && diff <= 7;
    }).length;

    this.masterStats.innerHTML = `
      <div class="master-stats-grid">
        <div class="master-stat-card">
          <div class="master-stat-number">${total}</div>
          <div class="master-stat-label">Usuarios totales</div>
        </div>
        <div class="master-stat-card success">
          <div class="master-stat-number">${active}</div>
          <div class="master-stat-label">Activos</div>
        </div>
        <div class="master-stat-card warning">
          <div class="master-stat-number">${expiring}</div>
          <div class="master-stat-label">Expiran pronto</div>
        </div>
      </div>`;
  }

  saveMasterUser() {
    const name = this.userFormName.value.trim();
    const code = this.userFormCode.value.trim();
    const expiry = this.userFormExpiry.value;
    const editId = this.userFormId.value;

    if (!name) { this.showToast('El nombre es obligatorio', 'warning'); return; }
    if (!editId && !code) { this.showToast('El código es obligatorio', 'warning'); return; }
    if (code && code.length < 3) { this.showToast('El código debe tener al menos 3 caracteres', 'warning'); return; }

    // Check duplicate code
    const users = this.getUsers();
    const duplicate = users.find(u => u.code === code && u.id !== editId);
    if (code && duplicate) { this.showToast('Ese código ya está en uso por otro usuario', 'warning'); return; }

    if (editId) {
      const idx = users.findIndex(u => u.id === editId);
      if (idx >= 0) {
        users[idx].name = name;
        if (code) users[idx].code = code;
        users[idx].expiresAt = expiry || null;
      }
      this.showToast('Usuario actualizado ✓', 'success');
    } else {
      users.push({
        id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36),
        name, code,
        expiresAt: expiry || null,
        createdAt: new Date().toISOString(),
        active: true
      });
      this.showToast('Usuario creado ✓', 'success');
    }

    this.saveUsersToCloud(users);
    this.masterUserForm.classList.add('hidden');
    this.userFormId.value = '';
    this.renderMasterUsers();
    this.renderMasterStats();
  }

  editMasterUser(userId) {
    const users = this.getUsers();
    const user = users.find(u => u.id === userId);
    if (!user) return;
    this.userFormId.value = user.id;
    this.userFormName.value = user.name;
    this.userFormCode.value = user.code;
    this.userFormExpiry.value = user.expiresAt || '';
    this.masterUserForm.classList.remove('hidden');
    this.userFormName.focus();
    this.masterUserForm.scrollIntoView({ behavior: 'smooth' });
  }

  toggleMasterUser(userId) {
    const users = this.getUsers();
    const user = users.find(u => u.id === userId);
    if (!user) return;
    user.active = !user.active;
    this.saveUsersToCloud(users);
    this.renderMasterUsers();
    this.renderMasterStats();
    this.showToast(user.active ? 'Usuario activado' : 'Usuario desactivado', 'info');
  }

  deleteMasterUser(userId) {
    this.openModal(
      'Eliminar usuario',
      '¿Eliminar este usuario? Sus reuniones se conservarán en local pero no podrá acceder.',
      () => {
        const users = this.getUsers().filter(u => u.id !== userId);
        this.saveUsersToCloud(users);
        // Also delete from Supabase
        if (window.supabaseDb) {
          window.supabaseDb.from('meetflow_users').delete().eq('id', userId)
            .then(() => {}).catch(() => {});
        }
        this.renderMasterUsers();
        this.renderMasterStats();
        this.showToast('Usuario eliminado', 'info');
      }
    );
  }

  // ===== PERSISTENCE =====
  async loadMeetings() {
    const key = this.getMeetingsStorageKey();

    if (window.supabaseDb) {
      try {
        const userId = this.currentUser?.id || 'legacy';
        const { data, error } = await window.supabaseDb
          .from('meetflow_reuniones')
          .select('*')
          .eq('userId', userId)
          .order('createdAt', { ascending: false });

        if (error) throw error;

        if (data && data.length > 0) {
          this.meetings = data;
          localStorage.setItem(key, JSON.stringify(this.meetings));
          this.renderMeetingList();
        }
      } catch (e) {
        console.error("Error loading meetings from Supabase:", e);
      }
    } else {
      // Fallback — use user-specific key
      const data = localStorage.getItem(key);
      this.meetings = data ? JSON.parse(data) : [];
      this.renderMeetingList();
    }
  }

  async saveMeetings() {
    const key = this.getMeetingsStorageKey();
    localStorage.setItem(key, JSON.stringify(this.meetings));

    if (window.supabaseDb && this.currentMeetingId) {
      const activeMeeting = this.meetings.find(m => m.id === this.currentMeetingId);
      if (activeMeeting) {
        try {
          const { error } = await window.supabaseDb
            .from('meetflow_reuniones')
            .upsert([{ ...activeMeeting, userId: this.currentUser?.id }]);
          if (error) throw error;
        } catch (e) {
          console.error('Error saving meeting to Supabase:', e);
        }
      }
    }
  }

  getMeeting(id) {
    return this.meetings.find(m => m.id === id);
  }

  // ===== NAVIGATION / VIEWS =====
  hideAllViews() {
    this.welcomeScreen.classList.add('hidden');
    this.stepSetup.classList.add('hidden');
    this.stepMeeting.classList.add('hidden');
    this.stepSummary.classList.add('hidden');
    // Force scroll to top using every method available
    this.scrollToTop();
  }

  scrollToTop() {
    // Scroll all possible containers
    window.scrollTo({ top: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    const mainArea = document.querySelector('.main-area');
    if (mainArea) mainArea.scrollTop = 0;
    // Also scroll the step indicator into view as an anchor
    const indicator = document.querySelector('.step-indicator');
    if (indicator) indicator.scrollIntoView({ behavior: 'instant', block: 'start' });
    // Force again after DOM reflow
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'instant' });
      if (mainArea) mainArea.scrollTop = 0;
      if (indicator) indicator.scrollIntoView({ behavior: 'instant', block: 'start' });
    }, 50);
  }

  showWelcome() {
    this.hideAllViews();
    this.welcomeScreen.classList.remove('hidden');
    this.currentMeetingId = null;
    this.currentStep = null;
    this.updateStepIndicator(-1);
  }

  updateStepIndicator(step) {
    // step: 0=setup, 1=meeting, 2=summary, -1=none
    this.stepDots.forEach((dot, i) => {
      dot.classList.remove('active', 'done');
      if (i < step) dot.classList.add('done');
      else if (i === step) dot.classList.add('active');
    });
    this.stepLines.forEach((line, i) => {
      line.classList.toggle('done', i < step);
    });
  }

  // ===== MEETING CRUD =====
  async createNewMeeting() {
    const now = new Date();
    const meeting = {
      id: Date.now().toString(),
      title: '',
      date: now.toISOString().split('T')[0],
      time: now.toTimeString().slice(0, 5),
      status: 'setup', // setup | active | completed
      participants: [],
      topics: [],
      tasks: [],
      totalTime: 0,
      followupDate: '',
      followupTime: '',
      createdAt: now.toISOString()
    };

    this.meetings.unshift(meeting);
    this.selectMeeting(meeting.id); // Set currentMeetingId so Supabase knows what to upsert
    await this.saveMeetings();
    this.renderMeetingList();
    this.showToast('Nueva reunión creada', 'success');
  }

  selectMeeting(id) {
    this.currentMeetingId = id;
    this.stopAllTimers();

    const meeting = this.getMeeting(id);
    if (!meeting) return;

    // Update sidebar active
    document.querySelectorAll('.meeting-item').forEach(el => el.classList.remove('active'));
    const activeEl = document.querySelector(`[data-meeting-id="${id}"]`);
    if (activeEl) activeEl.classList.add('active');

    if (meeting.status === 'setup') {
      this.currentStep = 'setup';
      this.hideAllViews();
      this.stepSetup.classList.remove('hidden');
      this.updateStepIndicator(0);

      this.meetingTitleInput.value = meeting.title;
      this.renderParticipantsSetup();
      this.renderTopicsSetup();
      this.updateStartButton();

    } else if (meeting.status === 'active') {
      this.goToMeetingStepDirect();
    } else if (meeting.status === 'completed') {
      this.goToSummaryStep();
    }
  }

  async deleteMeeting(id, event) {
    if (event) event.stopPropagation();
    this.openModal(
      'Eliminar reunión',
      '¿Estás seguro de que deseas eliminar esta reunión? Esta acción no se puede deshacer.',
      () => {
        this.meetings = this.meetings.filter(m => m.id !== id);
        this.saveMeetings();

        // Also delete explicitly from Supabase
        if (window.supabaseDb) {
          window.supabaseDb.from('meetflow_reuniones').delete().eq('id', id).then(r => {
            console.log('Deleted from DB', r);
          }).catch(console.error);
        }

        this.renderMeetingList();
        this.showToast('Reunión eliminada', 'info');

        // If we deleted the currently active meeting, go back to welcome screen
        if (this.currentMeetingId === id) {
          this.showWelcome();
        }
      }
    );
  }

  goToSetupStep() {
    const meeting = this.getMeeting(this.currentMeetingId);
    if (!meeting) return;

    this.currentStep = 'setup';
    this.hideAllViews();
    this.stepSetup.classList.remove('hidden');
    this.updateStepIndicator(0);

    this.meetingTitleInput.value = meeting.title;
    this.renderParticipants();
    this.renderTopicsSetup();
    this.updateStartButton();

    if (!meeting.title) this.meetingTitleInput.focus();
  }

  goToMeetingStep() {
    const meeting = this.getMeeting(this.currentMeetingId);
    if (!meeting || meeting.topics.length === 0) {
      this.showToast('Agrega al menos un tema a la agenda', 'warning');
      return;
    }

    meeting.status = 'active';
    // Find first uncompleted topic
    this.currentTopicIndex = meeting.topics.findIndex(t => !t.completed);
    if (this.currentTopicIndex === -1) this.currentTopicIndex = 0;

    this.saveMeetings();
    this.renderMeetingList();
    this.goToMeetingStepDirect();
    this.startTimer();
  }

  goToMeetingStepDirect() {
    const meeting = this.getMeeting(this.currentMeetingId);
    if (!meeting) return;

    this.currentStep = 'meeting';
    this.hideAllViews();
    this.stepMeeting.classList.remove('hidden');
    this.updateStepIndicator(1);

    // Header
    this.meetingActiveTitle.textContent = meeting.title || 'Reunión sin título';
    this.meetingActiveMeta.textContent = `${this.formatDate(meeting.date)} · ${meeting.time}`;

    // Timer
    this.timerSeconds = meeting.totalTime || 0;
    this.updateTimerDisplay();

    // Find current topic
    if (this.currentTopicIndex < 0) {
      this.currentTopicIndex = meeting.topics.findIndex(t => !t.completed);
    }

    // Participants count
    this.participantsCountBadge.textContent = meeting.participants.length;

    this.renderMeetingAgenda();
    this.renderCurrentTopic();
    this.renderPopupParticipants();
    this.updateTaskAssigneeOptions();
    this.renderTasks();
  }

  finishMeeting() {
    const meeting = this.getMeeting(this.currentMeetingId);
    if (!meeting) return;

    this.openModal('Finalizar Reunión', '¿Deseas finalizar esta reunión? Se generará tu historial y el resumen IA.', async () => {
      this.closeModal(); // Close modal immediately to show toast
      this.stopAllTimers();
      meeting.status = 'completed';
      meeting.totalTime = this.timerSeconds;
      meeting.completedAt = new Date().toISOString();

      if (window.meetflowAI && window.meetflowAI.isRecording) {
        this.btnAIAssist.classList.remove('recording');
        this.aiAssistText.textContent = "Procesando...";
        this.showToast('Procesando resumen IA, espera un momento...', 'info');

        const aiResult = await window.meetflowAI.stopAndSummarize((statusText) => {
          this.aiAssistText.textContent = statusText;
        });

        if (aiResult && aiResult.summary) {
          meeting.aiSummary = aiResult.summary;
        } else if (aiResult && aiResult.error) {
          this.showToast('Error IA: ' + aiResult.error, 'error');
        }
        this.aiAssistText.textContent = "Asistente IA";
      }

      this.saveMeetings();
      this.renderMeetingList();
      this.goToSummaryStep(true);
      this.showToast('¡Reunión finalizada con éxito!', 'success');
    });
  }

  async toggleAIAssistant() {
    if (!window.meetflowAI) return;

    if (window.meetflowAI.isRecording) {
      this.showToast('El asistente ya está escuchando. Se procesará al finalizar la reunión.', 'info');
      return;
    }

    this.btnAIAssist.disabled = true;
    this.aiAssistText.textContent = "Conectando...";
    const success = await window.meetflowAI.startListening();
    this.btnAIAssist.disabled = false;

    if (success) {
      this.btnAIAssist.classList.add('recording');
      this.aiAssistText.textContent = "IA Escuchando...";
      this.showToast('Asistente IA activado', 'success');
    } else {
      this.aiAssistText.textContent = "Asistente IA";
    }
  }

  goToSummaryStep(isNew) {
    const meeting = this.getMeeting(this.currentMeetingId);
    if (!meeting) return;

    this.currentStep = 'summary';
    this.hideAllViews();
    this.stepSummary.classList.remove('hidden');
    this.updateStepIndicator(2);

    this.followupDate.value = meeting.followupDate || '';
    this.followupTime.value = meeting.followupTime || '';

    // Show continuity banner if this meeting is a follow-up of another
    if (meeting.parentMeetingId && this.continuityBanner) {
      const parent = this.getMeeting(meeting.parentMeetingId);
      if (parent) {
        this.continuityBanner.classList.remove('hidden');
        this.continuityParentLink.textContent = parent.title || 'Reunión anterior';
      } else {
        this.continuityBanner.classList.add('hidden');
      }
    } else if (this.continuityBanner) {
      this.continuityBanner.classList.add('hidden');
    }

    this.renderSummary();
  }

  // ===== MEETING CONTINUITY =====
  async createFollowupMeeting() {
    const parent = this.getMeeting(this.currentMeetingId);
    if (!parent) return;

    const now = new Date();
    // Use the follow-up date if set, otherwise use today
    const followDate = parent.followupDate || now.toISOString().split('T')[0];
    const followTime = parent.followupTime || now.toTimeString().slice(0, 5);

    // Build a descriptive title based on parent
    const parentTitle = parent.title || 'Reunión';
    const followupTitle = `Seguimiento: ${parentTitle}`;

    // Carry over pending tasks and all participants
    const pendingTasks = (parent.tasks || []).filter(t => !t.completed).map(t => ({ ...t, id: Date.now().toString() + Math.random() }));

    const meeting = {
      id: Date.now().toString(),
      title: followupTitle,
      date: followDate,
      time: followTime,
      status: 'setup',
      participants: [...(parent.participants || [])],  // inherit participants
      topics: [],
      tasks: pendingTasks,  // carry over pending tasks
      totalTime: 0,
      followupDate: '',
      followupTime: '',
      parentMeetingId: parent.id,  // link to parent
      createdAt: now.toISOString()
    };

    // Mark the parent as having a follow-up meeting created
    parent.followupMeetingId = meeting.id;

    this.meetings.unshift(meeting);
    await this.saveMeetings();
    this.renderMeetingList();
    this.selectMeeting(meeting.id);
    this.showToast(`Seguimiento creado con ${pendingTasks.length} tarea${pendingTasks.length !== 1 ? 's' : ''} pendiente${pendingTasks.length !== 1 ? 's' : ''} heredada${pendingTasks.length !== 1 ? 's' : ''}`, 'success');
  }

  goToParentMeeting() {
    const meeting = this.getMeeting(this.currentMeetingId);
    if (!meeting || !meeting.parentMeetingId) return;
    this.selectMeeting(meeting.parentMeetingId);
  }

  saveMeetingDetails() {
    const meeting = this.getMeeting(this.currentMeetingId);
    if (!meeting) return;
    meeting.title = this.meetingTitleInput.value.trim();
    this.saveMeetings();
    this.renderMeetingList();
  }

  saveFollowup() {
    const meeting = this.getMeeting(this.currentMeetingId);
    if (!meeting) return;
    meeting.followupDate = this.followupDate.value;
    meeting.followupTime = this.followupTime.value;
    this.saveMeetings();
  }

  // ===== TIMER =====
  startTimer() {
    if (this.timerRunning) return;
    this.timerRunning = true;
    this.topicTimerDisplay.classList.add('running');
    this.btnPlayTimer.classList.add('hidden');
    this.btnPauseTimer.classList.remove('hidden');

    this.timerInterval = setInterval(() => {
      this.timerSeconds++;
      this.updateTimerDisplay();

      // Topic timer
      if (this.currentTopicIndex >= 0) {
        this.topicTimerSeconds++;
        this.updateTopicTimerDisplay();
        const meeting = this.getMeeting(this.currentMeetingId);
        if (meeting && meeting.topics[this.currentTopicIndex]) {
          meeting.topics[this.currentTopicIndex].elapsed = this.topicTimerSeconds;
        }
      }

      if (this.timerSeconds % 10 === 0) {
        const meeting = this.getMeeting(this.currentMeetingId);
        if (meeting) { meeting.totalTime = this.timerSeconds; this.saveMeetings(); }
      }

      // Broadcast state to guests every 2 seconds
      if (this.timerSeconds % 2 === 0) {
        this.broadcastMeetingState();
      }
    }, 1000);
  }

  pauseTimer() {
    this.timerRunning = false;
    this.topicTimerDisplay.classList.remove('running');
    clearInterval(this.timerInterval);
    this.timerInterval = null;
    this.btnPauseTimer.classList.add('hidden');
    this.btnPlayTimer.classList.remove('hidden');
  }

  stopAllTimers() {
    this.timerRunning = false;
    this.topicTimerDisplay?.classList.remove('running');
    clearInterval(this.timerInterval);
    this.timerInterval = null;
    this.topicTimerSeconds = 0;
    this.currentTopicIndex = -1;
    this.currentSubtopicIndex = -1;
    this.btnPauseTimer?.classList.add('hidden');
    this.btnPlayTimer?.classList.remove('hidden');
  }

  updateTimerDisplay() {
    const h = Math.floor(this.timerSeconds / 3600);
    const m = Math.floor((this.timerSeconds % 3600) / 60);
    const s = this.timerSeconds % 60;
    this.timerDisplay.textContent =
      `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  updateTopicTimerDisplay() {
    const m = Math.floor(this.topicTimerSeconds / 60);
    const s = this.topicTimerSeconds % 60;
    this.topicTimerDisplay.textContent = `${m}:${s.toString().padStart(2, '0')}`;
  }

  // ===== CURRENT TOPIC =====
  // Returns the "active leaf" — either a subtopic or the main topic itself
  getActiveLeaf() {
    const meeting = this.getMeeting(this.currentMeetingId);
    if (!meeting || this.currentTopicIndex < 0) return null;
    const topic = meeting.topics[this.currentTopicIndex];
    if (!topic) return null;
    if (this.currentSubtopicIndex >= 0 && topic.subtopics && topic.subtopics[this.currentSubtopicIndex]) {
      return { topic, subtopic: topic.subtopics[this.currentSubtopicIndex] };
    }
    return { topic, subtopic: null };
  }

  renderCurrentTopic() {
    const meeting = this.getMeeting(this.currentMeetingId);
    if (!meeting) return;

    const allDone = meeting.topics.every(t => t.completed);

    if (allDone || this.currentTopicIndex < 0 || this.currentTopicIndex >= meeting.topics.length) {
      this.currentTopicDisplay.classList.add('hidden');
      this.btnTopicDone.classList.add('hidden');
      this.allTopicsDoneMsg.classList.remove('hidden');
      this.topicTimerDisplay.textContent = '—';
      this.updateTaskLinkedTopic();
      return;
    }

    this.allTopicsDoneMsg.classList.add('hidden');
    this.currentTopicDisplay.classList.remove('hidden');
    this.btnTopicDone.classList.remove('hidden');

    const topic = meeting.topics[this.currentTopicIndex];
    const hasActiveSubtopic = this.currentSubtopicIndex >= 0 && topic.subtopics && topic.subtopics[this.currentSubtopicIndex];

    if (hasActiveSubtopic) {
      const sub = topic.subtopics[this.currentSubtopicIndex];
      // Show topic name small + subtopic name large
      this.currentTopicName.innerHTML =
        `<span class="current-topic-parent">${this.esc(topic.name)}</span>` +
        `<span class="current-subtopic-name">${this.esc(sub.name)}</span>`;
      this.topicTimerSeconds = sub.elapsed || 0;
      // Update button text
      this.btnTopicDone.querySelector('span') && (this.btnTopicDone.querySelector('span').textContent = 'Siguiente Tema');
    } else {
      this.currentTopicName.innerHTML = this.esc(topic.name);
      this.topicTimerSeconds = topic.elapsed || 0;
    }

    this.updateTopicTimerDisplay();
    this.updateTaskLinkedTopic();
  }

  markCurrentTopicDone() {
    const meeting = this.getMeeting(this.currentMeetingId);
    if (!meeting || this.currentTopicIndex < 0) return;

    const topic = meeting.topics[this.currentTopicIndex];
    const hasSubtopics = topic.subtopics && topic.subtopics.length > 0;

    if (hasSubtopics && this.currentSubtopicIndex >= 0) {
      // Mark current subtopic done
      topic.subtopics[this.currentSubtopicIndex].completed = true;
      topic.subtopics[this.currentSubtopicIndex].elapsed = this.topicTimerSeconds;

      // Find next uncompleted subtopic
      const nextSub = topic.subtopics.findIndex((s, i) => i > this.currentSubtopicIndex && !s.completed);
      if (nextSub >= 0) {
        this.currentSubtopicIndex = nextSub;
        this.topicTimerSeconds = topic.subtopics[nextSub].elapsed || 0;
        this.saveMeetings();
        this.renderCurrentTopic();
        this.renderMeetingAgenda();
        this.showToast('¡Subtema completado!', 'success');
        return;
      } else {
        // All subtopics done → mark the parent topic done
        topic.completed = true;
        this.currentSubtopicIndex = -1;
      }
    } else if (hasSubtopics && this.currentSubtopicIndex < 0) {
      // Topic has subtopics but we are on the parent — jump into first subtopic
      const firstSub = topic.subtopics.findIndex(s => !s.completed);
      if (firstSub >= 0) {
        this.currentSubtopicIndex = firstSub;
        this.topicTimerSeconds = topic.subtopics[firstSub].elapsed || 0;
        this.saveMeetings();
        this.renderCurrentTopic();
        this.renderMeetingAgenda();
        this.showToast(`Iniciando subtema: ${topic.subtopics[firstSub].name}`, 'info');
        return;
      } else {
        topic.completed = true;
      }
    } else {
      // No subtopics — mark topic done normally
      topic.completed = true;
    }

    this.saveMeetings();

    // Auto-advance to next uncompleted topic
    const nextIndex = meeting.topics.findIndex((t, i) => i > this.currentTopicIndex && !t.completed);
    if (nextIndex >= 0) {
      this.currentTopicIndex = nextIndex;
      this.currentSubtopicIndex = -1;
      this.topicTimerSeconds = meeting.topics[nextIndex].elapsed || 0;
    } else {
      const anyLeft = meeting.topics.findIndex(t => !t.completed);
      if (anyLeft >= 0) {
        this.currentTopicIndex = anyLeft;
        this.currentSubtopicIndex = -1;
        this.topicTimerSeconds = meeting.topics[anyLeft].elapsed || 0;
      } else {
        this.currentTopicIndex = -1;
        this.currentSubtopicIndex = -1;
        this.topicTimerSeconds = 0;
      }
    }

    this.renderCurrentTopic();
    this.renderMeetingAgenda();
    this.showToast('¡Tema completado!', 'success');
  }

  focusOnTopic(index, subtopicIndex = -1) {
    const meeting = this.getMeeting(this.currentMeetingId);
    if (!meeting) return;
    const topic = meeting.topics[index];
    if (!topic || topic.completed) return;

    this.currentTopicIndex = index;
    this.currentSubtopicIndex = subtopicIndex;

    if (subtopicIndex >= 0 && topic.subtopics && topic.subtopics[subtopicIndex]) {
      this.topicTimerSeconds = topic.subtopics[subtopicIndex].elapsed || 0;
    } else {
      this.topicTimerSeconds = topic.elapsed || 0;
    }
    this.renderCurrentTopic();
    this.renderMeetingAgenda();
  }

  // ===== PARTICIPANTS =====
  addParticipant() {
    const name = this.participantInput.value.trim();
    if (!name) return;
    const meeting = this.getMeeting(this.currentMeetingId);
    if (!meeting) return;
    if (meeting.participants.includes(name)) { this.showToast('Ya existe este participante', 'warning'); return; }
    meeting.participants.push(name);
    this.saveMeetings();
    this.participantInput.value = '';
    this.renderParticipants();
    this.updateStartButton();
    this.participantInput.focus();
  }

  addParticipantFromPopup() {
    const name = this.popupParticipantInput.value.trim();
    if (!name) return;
    const meeting = this.getMeeting(this.currentMeetingId);
    if (!meeting) return;
    if (meeting.participants.includes(name)) { this.showToast('Ya existe este participante', 'warning'); return; }
    meeting.participants.push(name);
    this.saveMeetings();
    this.popupParticipantInput.value = '';
    this.renderPopupParticipants();
    this.participantsCountBadge.textContent = meeting.participants.length;
    this.updateTaskAssigneeOptions();
    this.popupParticipantInput.focus();
  }

  removeParticipant(name) {
    const meeting = this.getMeeting(this.currentMeetingId);
    if (!meeting) return;
    meeting.participants = meeting.participants.filter(p => p !== name);
    this.saveMeetings();
    if (this.currentStep === 'setup') { this.renderParticipants(); this.updateStartButton(); }
    if (this.currentStep === 'meeting') {
      this.renderPopupParticipants();
      this.participantsCountBadge.textContent = meeting.participants.length;
      this.updateTaskAssigneeOptions();
    }
  }

  renderParticipants() {
    const meeting = this.getMeeting(this.currentMeetingId);
    if (!meeting) return;
    if (meeting.participants.length === 0) {
      this.participantsList.innerHTML = '';
      return;
    }
    this.participantsList.innerHTML = meeting.participants.map(name =>
      `<div class="participant-tag">
        <div class="avatar">${this.getInitials(name)}</div>
        <span>${this.esc(name)}</span>
        <button class="remove-participant" onclick="app.removeParticipant('${this.esc(name)}')" title="Quitar">×</button>
      </div>`
    ).join('');
  }

  renderPopupParticipants() {
    const meeting = this.getMeeting(this.currentMeetingId);
    if (!meeting) return;
    if (meeting.participants.length === 0) {
      this.popupParticipantsList.innerHTML = '<div class="empty-state"><p>Sin participantes</p></div>';
      return;
    }
    this.popupParticipantsList.innerHTML = meeting.participants.map(name =>
      `<div class="participant-tag">
        <div class="avatar">${this.getInitials(name)}</div>
        <span>${this.esc(name)}</span>
        <button class="remove-participant" onclick="app.removeParticipant('${this.esc(name)}')" title="Quitar">×</button>
      </div>`
    ).join('');
  }

  // ===== TOPICS =====
  addTopic() {
    const name = this.topicInput.value.trim();
    if (!name) return;
    const meeting = this.getMeeting(this.currentMeetingId);
    if (!meeting) return;
    const minutes = parseInt(this.topicMinutes.value) || 0;
    meeting.topics.push({ id: Date.now().toString(), name, estimatedMinutes: minutes, completed: false, elapsed: 0, subtopics: [] });
    this.saveMeetings();
    this.topicInput.value = '';
    this.topicMinutes.value = '';
    this.renderTopicsSetup();
    this.updateStartButton();
    this.topicInput.focus();
  }

  addSubtopic(topicIndex) {
    const input = document.getElementById(`subtopicInput_${topicIndex}`);
    if (!input) return;
    const name = input.value.trim();
    if (!name) return;
    const meeting = this.getMeeting(this.currentMeetingId);
    if (!meeting) return;
    if (!meeting.topics[topicIndex].subtopics) meeting.topics[topicIndex].subtopics = [];
    meeting.topics[topicIndex].subtopics.push({ id: Date.now().toString(), name, completed: false, elapsed: 0 });
    this.saveMeetings();
    input.value = '';
    this.renderTopicsSetup();
    input && document.getElementById(`subtopicInput_${topicIndex}`)?.focus();
  }

  removeSubtopic(topicIndex, subIndex) {
    const meeting = this.getMeeting(this.currentMeetingId);
    if (!meeting) return;
    meeting.topics[topicIndex].subtopics.splice(subIndex, 1);
    this.saveMeetings();
    this.renderTopicsSetup();
  }

  removeTopic(index) {
    const meeting = this.getMeeting(this.currentMeetingId);
    if (!meeting) return;
    meeting.topics.splice(index, 1);
    this.saveMeetings();
    this.renderTopicsSetup();
    this.updateStartButton();
  }

  renderTopicsSetup() {
    const meeting = this.getMeeting(this.currentMeetingId);
    if (!meeting) return;
    if (meeting.topics.length === 0) {
      this.topicsListSetup.innerHTML = `<div class="empty-state">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
        <p>Agrega temas a la agenda</p></div>`;
      return;
    }
    this.topicsListSetup.innerHTML = meeting.topics.map((t, i) => {
      const subtopicsHtml = (t.subtopics && t.subtopics.length > 0) ? `
        <div class="subtopics-list-setup">
          ${t.subtopics.map((sub, si) => `
            <div class="subtopic-item-setup">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              <span>${this.esc(sub.name)}</span>
              <button class="subtopic-delete" onclick="app.removeSubtopic(${i}, ${si})" title="Eliminar subtema">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          `).join('')}
        </div>
      ` : '';

      return `
        <div class="topic-item-setup">
          <div class="topic-number">${i + 1}</div>
          <div class="topic-info">
            <div class="topic-name">${this.esc(t.name)}</div>
            <div class="topic-time">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              ${t.estimatedMinutes ? `${t.estimatedMinutes} min` : 'Sin tiempo'}
            </div>
            ${subtopicsHtml}
            <div class="add-subtopic-row">
              <input type="text" id="subtopicInput_${i}" placeholder="+ Agregar subtema..."
                onkeydown="if(event.key==='Enter')app.addSubtopic(${i})">
              <button class="btn-add-subtopic" onclick="app.addSubtopic(${i})" title="Agregar subtema">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></svg>
              </button>
            </div>
          </div>
          <button class="topic-delete" onclick="app.removeTopic(${i})" title="Eliminar">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
          </button>
        </div>
      `;
    }).join('');
  }

  updateStartButton() {
    const meeting = this.getMeeting(this.currentMeetingId);
    if (!meeting) return;
    this.btnStartMeeting.disabled = meeting.topics.length === 0;
  }

  // ===== MEETING AGENDA SIDEBAR =====
  renderMeetingAgenda() {
    const meeting = this.getMeeting(this.currentMeetingId);
    if (!meeting) return;

    const done = meeting.topics.filter(t => t.completed).length;
    this.agendaProgress.textContent = `${done}/${meeting.topics.length}`;

    this.agendaItems.innerHTML = meeting.topics.map((t, i) => {
      const isCurrent = i === this.currentTopicIndex && !t.completed;
      const isDone = t.completed;
      let cls = '';
      if (isDone) cls = 'done';
      else if (isCurrent) cls = 'current';

      const icon = isDone
        ? `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`
        : isCurrent
          ? `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>`
          : `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/></svg>`;

      const elapsed = t.elapsed || 0;
      const eMin = Math.floor(elapsed / 60);
      const eSec = elapsed % 60;
      const timeStr = elapsed > 0 ? `${eMin}:${eSec.toString().padStart(2, '0')}` : '';

      // Render subtopics indented
      const subtopicsHtml = (t.subtopics && t.subtopics.length > 0 && !isDone) ? t.subtopics.map((sub, si) => {
        const isCurrentSub = isCurrent && si === this.currentSubtopicIndex;
        const isSubDone = sub.completed;
        let subCls = 'agenda-subtopic';
        if (isSubDone) subCls += ' done';
        else if (isCurrentSub) subCls += ' current';

        const subElapsed = sub.elapsed || 0;
        const seMin = Math.floor(subElapsed / 60);
        const seSec = subElapsed % 60;
        const subTimeStr = subElapsed > 0 ? `${seMin}:${seSec.toString().padStart(2, '0')}` : '';

        const subIcon = isSubDone
          ? `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`
          : isCurrentSub
            ? `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>`
            : `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/></svg>`;

        return `
          <div class="${subCls}" onclick="app.focusOnTopic(${i}, ${si})">
            <div class="agenda-subtopic-icon">${subIcon}</div>
            <span class="agenda-subtopic-name">${this.esc(sub.name)}</span>
            ${subTimeStr ? `<span class="agenda-item-time">${subTimeStr}</span>` : ''}
          </div>
        `;
      }).join('') : '';

      // Add-subtopic inline row (hidden by default, shown on toggle)
      const addSubRow = !isDone ? `
        <div class="agenda-add-subtopic-row" id="agendaSubRow_${i}" style="display:none;">
          <input
            type="text"
            id="agendaSubInput_${i}"
            placeholder="Nombre del subtema..."
            onkeydown="if(event.key==='Enter'){app.addSubtopicDuringMeeting(${i});} if(event.key==='Escape'){app.toggleAgendaSubRow(${i});}"
          >
          <button onclick="app.addSubtopicDuringMeeting(${i})" title="Agregar subtema">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></svg>
          </button>
        </div>
      ` : '';

      return `
        <div class="agenda-item ${cls}" onclick="app.focusOnTopic(${i})">
          <div class="agenda-icon">${icon}</div>
          <span class="agenda-item-name">${this.esc(t.name)}</span>
          <span class="agenda-item-right">
            ${timeStr ? `<span class="agenda-item-time">${timeStr}</span>` : ''}
            ${!isDone ? `<button class="agenda-check-btn" onclick="event.stopPropagation(); app.markTopicDoneById(${i})" title="Marcar como listo">
              <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </button>` : ''}
            ${!isDone ? `<button class="agenda-add-sub-btn" onclick="event.stopPropagation(); app.toggleAgendaSubRow(${i})" title="Agregar subtema">
              <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></svg>
            </button>` : ''}
          </span>
        </div>
        ${subtopicsHtml}
        ${addSubRow}
      `;
    }).join('');
  }

  markTopicDoneById(topicIndex) {
    const meeting = this.getMeeting(this.currentMeetingId);
    if (!meeting) return;
    const topic = meeting.topics[topicIndex];
    if (!topic || topic.completed) return;

    topic.completed = true;
    this.saveMeetings();

    // If this was the current topic, auto-advance
    if (this.currentTopicIndex === topicIndex) {
      const nextIndex = meeting.topics.findIndex((t, i) => i > topicIndex && !t.completed);
      if (nextIndex >= 0) {
        this.currentTopicIndex = nextIndex;
        this.currentSubtopicIndex = -1;
        this.topicTimerSeconds = meeting.topics[nextIndex].elapsed || 0;
      } else {
        const anyLeft = meeting.topics.findIndex(t => !t.completed);
        if (anyLeft >= 0) {
          this.currentTopicIndex = anyLeft;
          this.currentSubtopicIndex = -1;
          this.topicTimerSeconds = meeting.topics[anyLeft].elapsed || 0;
        } else {
          this.currentTopicIndex = -1;
          this.currentSubtopicIndex = -1;
          this.topicTimerSeconds = 0;
        }
      }
      this.renderCurrentTopic();
    }

    this.renderMeetingAgenda();
    this.showToast(`"${topic.name}" completado`, 'success');
  }

  toggleAgendaSubRow(topicIndex) {
    const row = document.getElementById(`agendaSubRow_${topicIndex}`);
    if (!row) return;
    const isVisible = row.style.display !== 'none';
    row.style.display = isVisible ? 'none' : 'flex';
    if (!isVisible) {
      setTimeout(() => document.getElementById(`agendaSubInput_${topicIndex}`)?.focus(), 50);
    }
  }

  addSubtopicDuringMeeting(topicIndex) {
    const input = document.getElementById(`agendaSubInput_${topicIndex}`);
    if (!input) return;
    const name = input.value.trim();
    if (!name) return;
    const meeting = this.getMeeting(this.currentMeetingId);
    if (!meeting) return;

    if (!meeting.topics[topicIndex].subtopics) meeting.topics[topicIndex].subtopics = [];
    meeting.topics[topicIndex].subtopics.push({ id: Date.now().toString(), name, completed: false, elapsed: 0 });
    this.saveMeetings();
    input.value = '';
    this.renderMeetingAgenda();
    // Keep the row open for adding more
    const row = document.getElementById(`agendaSubRow_${topicIndex}`);
    if (row) { row.style.display = 'flex'; setTimeout(() => document.getElementById(`agendaSubInput_${topicIndex}`)?.focus(), 20); }
    this.showToast('Subtema agregado', 'success');
  }

  addTopicDuringMeeting() {
    const input = document.getElementById('agendaAddTopicInput');
    if (!input) return;
    const name = input.value.trim();
    if (!name) return;
    const meeting = this.getMeeting(this.currentMeetingId);
    if (!meeting) return;
    meeting.topics.push({ id: Date.now().toString(), name, estimatedMinutes: 0, completed: false, elapsed: 0, subtopics: [] });
    this.saveMeetings();
    input.value = '';
    this.renderMeetingAgenda();
    // If no current topic (all were done), set focus to the new one
    if (this.currentTopicIndex < 0) {
      this.currentTopicIndex = meeting.topics.length - 1;
      this.topicTimerSeconds = 0;
      this.renderCurrentTopic();
    }
    this.showToast('Tema agregado', 'success');
  }

  // ===== TASKS =====
  updateTaskLinkedTopic() {
    const meeting = this.getMeeting(this.currentMeetingId);
    if (!meeting || this.currentTopicIndex < 0 || this.currentTopicIndex >= meeting.topics.length) {
      this.taskLinkedTopic.textContent = '';
      this.taskLinkedTopic.classList.add('hidden');
      return;
    }
    const topic = meeting.topics[this.currentTopicIndex];
    this.taskLinkedTopic.textContent = `Vinculada a: ${topic.name}`;
    this.taskLinkedTopic.classList.remove('hidden');
  }

  addTask() {
    const name = this.taskInput.value.trim();
    if (!name) return;
    const meeting = this.getMeeting(this.currentMeetingId);
    if (!meeting) return;

    const linkedTopic = (this.currentTopicIndex >= 0 && meeting.topics[this.currentTopicIndex])
      ? meeting.topics[this.currentTopicIndex].name : '';

    meeting.tasks.push({
      id: Date.now().toString(),
      name,
      assignee: this.taskAssignee.value,
      dueDate: this.taskDueDate.value,
      linkedTopic,
      completed: false
    });

    this.saveMeetings();
    this.taskInput.value = '';
    this.taskDueDate.value = '';
    this.renderTasks();
    this.taskInput.focus();
  }

  toggleTask(taskId) {
    const meeting = this.getMeeting(this.currentMeetingId);
    if (!meeting) return;
    const task = meeting.tasks.find(t => t.id === taskId);
    if (task) { task.completed = !task.completed; this.saveMeetings(); this.renderTasks(); }
  }

  removeTask(taskId) {
    const meeting = this.getMeeting(this.currentMeetingId);
    if (!meeting) return;
    meeting.tasks = meeting.tasks.filter(t => t.id !== taskId);
    this.saveMeetings();
    this.renderTasks();
  }

  renderTasks() {
    const meeting = this.getMeeting(this.currentMeetingId);
    if (!meeting) return;
    this.tasksBadge.textContent = meeting.tasks.length;

    if (meeting.tasks.length === 0) {
      this.tasksList.innerHTML = `<div class="empty-state">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="m9 12 2 2 4-4"/></svg>
        <p>Registra tareas pactadas</p></div>`;
      return;
    }

    this.tasksList.innerHTML = meeting.tasks.map(task => {
      const participantsOptions = meeting.participants.map(p =>
        `<option value="${this.esc(p)}" ${task.assignee === p ? 'selected' : ''}>${this.esc(p)}</option>`
      ).join('');

      return `
      <div class="task-item ${task.completed ? 'task-done' : ''}" id="taskItem_${task.id}">
        <div class="task-checkbox ${task.completed ? 'checked' : ''}" onclick="app.toggleTask('${task.id}')">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <div class="task-content">
          <div class="task-name">${this.esc(task.name)}</div>
          <div class="task-meta">
            ${task.assignee ? `<span class="task-meta-item assignee"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>${this.esc(task.assignee)}</span>` : ''}
            ${task.dueDate ? `<span class="task-meta-item due-date"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>${this.formatDate(task.dueDate)}</span>` : ''}
            ${task.linkedTopic ? `<span class="task-meta-item linked-topic"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>${this.esc(task.linkedTopic)}</span>` : ''}
          </div>
        </div>
        <div class="task-actions">
          <button class="task-edit-btn" onclick="app.toggleTaskEdit('${task.id}')" title="Editar tarea">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="task-delete-btn" onclick="app.removeTask('${task.id}')" title="Eliminar tarea">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
          </button>
        </div>
      </div>
      <div class="task-edit-panel" id="taskEditPanel_${task.id}" style="display:none;">
        <div class="task-edit-fields">
          <div class="task-edit-field">
            <label>Tarea</label>
            <input type="text" id="taskEditName_${task.id}" value="${this.esc(task.name)}" placeholder="Nombre de la tarea...">
          </div>
          <div class="task-edit-field">
            <label>Responsable</label>
            <select id="taskEditAssignee_${task.id}">
              <option value="">Sin responsable</option>
              ${participantsOptions}
            </select>
          </div>
          <div class="task-edit-field">
            <label>Fecha límite</label>
            <input type="date" id="taskEditDate_${task.id}" value="${task.dueDate || ''}">
          </div>
        </div>
        <div class="task-edit-actions">
          <button class="btn-task-edit-save" onclick="app.saveTaskEdit('${task.id}')">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            Guardar
          </button>
          <button class="btn-task-edit-cancel" onclick="app.toggleTaskEdit('${task.id}')">
            Cancelar
          </button>
        </div>
      </div>
      `;
    }).join('');
  }

  toggleTaskEdit(taskId) {
    const panel = document.getElementById(`taskEditPanel_${taskId}`);
    if (!panel) return;
    const isOpen = panel.style.display !== 'none';
    panel.style.display = isOpen ? 'none' : 'block';
    if (!isOpen) {
      setTimeout(() => document.getElementById(`taskEditName_${taskId}`)?.focus(), 50);
    }
  }

  saveTaskEdit(taskId) {
    const meeting = this.getMeeting(this.currentMeetingId);
    if (!meeting) return;
    const task = meeting.tasks.find(t => t.id === taskId);
    if (!task) return;

    const nameInput = document.getElementById(`taskEditName_${taskId}`);
    const assigneeInput = document.getElementById(`taskEditAssignee_${taskId}`);
    const dateInput = document.getElementById(`taskEditDate_${taskId}`);

    if (nameInput && nameInput.value.trim()) task.name = nameInput.value.trim();
    if (assigneeInput) task.assignee = assigneeInput.value;
    if (dateInput) task.dueDate = dateInput.value;

    this.saveMeetings();
    this.renderTasks();
    this.showToast('Tarea actualizada', 'success');
  }

  updateTaskAssigneeOptions() {
    const meeting = this.getMeeting(this.currentMeetingId);
    if (!meeting) return;
    const current = this.taskAssignee.value;
    this.taskAssignee.innerHTML = '<option value="">Responsable...</option>';
    meeting.participants.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p; opt.textContent = p;
      if (p === current) opt.selected = true;
      this.taskAssignee.appendChild(opt);
    });
  }

  // ===== SUMMARY =====
  renderSummary() {
    const meeting = this.getMeeting(this.currentMeetingId);
    if (!meeting) return;

    const totalMin = Math.floor((meeting.totalTime || 0) / 60);
    const completedTopics = meeting.topics.filter(t => t.completed);
    const pendingTopics = meeting.topics.filter(t => !t.completed);

    let html = `
      <div class="summary-block"><h4>
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        Duración: ${totalMin} minutos
      </h4></div>

      <div class="summary-block"><h4>
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
        Participantes (${meeting.participants.length})
      </h4><ul>${meeting.participants.map(p => `<li>${this.esc(p)}</li>`).join('')}</ul></div>
    `;

    if (meeting.topics.length > 0) {
      html += `<div class="summary-block"><h4>
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
        Temas (${completedTopics.length}/${meeting.topics.length} completados)
      </h4><ul>
        ${completedTopics.map(t => {
        const e = t.elapsed || 0; const eM = Math.floor(e / 60); const eS = e % 60;
        return `<li class="completed-topic">✓ ${this.esc(t.name)} (${eM}:${eS.toString().padStart(2, '0')})</li>`;
      }).join('')}
        ${pendingTopics.map(t => `<li class="pending-topic">✗ ${this.esc(t.name)} (No tratado)</li>`).join('')}
      </ul></div>`;
    }

    if (meeting.tasks.length > 0) {
      // Group tasks by topic
      const grouped = {};
      meeting.tasks.forEach(t => {
        const key = t.linkedTopic || 'General';
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(t);
      });

      html += `<div class="summary-block"><h4>
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="m9 12 2 2 4-4"/></svg>
        Tareas Pactadas (${meeting.tasks.length})
      </h4>`;

      Object.entries(grouped).forEach(([topic, tasks]) => {
        html += `<p style="font-size:0.78rem;color:var(--accent-secondary);margin:8px 0 4px 16px;font-weight:600;">${this.esc(topic)}</p><ul class="summary-task-list">`;
        tasks.forEach(t => {
          let meta = '';
          if (t.assignee) meta += `<span class="summary-task-meta">${this.esc(t.assignee)}</span>`;
          if (t.dueDate) meta += `<span class="summary-task-meta">${this.formatDate(t.dueDate)}</span>`;
          html += `
            <li class="summary-task-item ${t.completed ? 'done' : ''}" onclick="app.toggleTaskFromSummary('${t.id}')">
              <span class="summary-task-check">${t.completed
                ? '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
                : '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/></svg>'
              }</span>
              <span class="summary-task-name">${this.esc(t.name)}</span>
              ${meta ? `<span class="summary-task-metas">${meta}</span>` : ''}
            </li>`;
        });
        html += '</ul>';
      });
      html += '</div>';
    }

    this.summaryContent.innerHTML = html;

    // AI Summary
    if (meeting.aiSummary) {
      this.aiSummaryBox.classList.remove('hidden');
      this.aiSummaryText.innerHTML = this.esc(meeting.aiSummary).replace(/\n/g, '<br>');
    } else {
      this.aiSummaryBox.classList.add('hidden');
      this.aiSummaryText.innerHTML = '';
    }
  }

  toggleTaskFromSummary(taskId) {
    const meeting = this.getMeeting(this.currentMeetingId);
    if (!meeting) return;
    const task = meeting.tasks.find(t => t.id === taskId);
    if (!task) return;
    task.completed = !task.completed;
    this.saveMeetings();
    this.renderSummary();
    this.renderMeetingList(); // update pending badge in sidebar
    this.showToast(task.completed ? 'Tarea completada ✓' : 'Tarea reabierta', task.completed ? 'success' : 'info');
  }

  copySummary() {
    const meeting = this.getMeeting(this.currentMeetingId);
    if (!meeting) return;

    const totalMin = Math.floor((meeting.totalTime || 0) / 60);
    let text = `📋 RESUMEN DE REUNIÓN\n════════════════════════\n`;
    text += `📌 ${meeting.title || 'Sin título'}\n`;
    text += `📅 ${this.formatDate(meeting.date)} · ${meeting.time}\n`;
    text += `⏱ Duración: ${totalMin} minutos\n\n`;

    if (meeting.participants.length > 0) {
      text += `👥 PARTICIPANTES:\n`;
      meeting.participants.forEach(p => text += `  • ${p}\n`);
      text += '\n';
    }

    if (meeting.topics.length > 0) {
      text += `📝 TEMAS:\n`;
      meeting.topics.forEach(t => {
        const e = t.elapsed || 0; const eM = Math.floor(e / 60); const eS = e % 60;
        text += `  ${t.completed ? '✅' : '❌'} ${t.name} (${eM}:${eS.toString().padStart(2, '0')})\n`;
      });
      text += '\n';
    }

    if (meeting.tasks.length > 0) {
      text += `✅ TAREAS PACTADAS:\n`;
      const grouped = {};
      meeting.tasks.forEach(t => {
        const key = t.linkedTopic || 'General';
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(t);
      });
      Object.entries(grouped).forEach(([topic, tasks]) => {
        text += `\n  📎 ${topic}:\n`;
        tasks.forEach(t => {
          let line = `    • ${t.name}`;
          if (t.assignee) line += ` → ${t.assignee}`;
          if (t.dueDate) line += ` (${this.formatDate(t.dueDate)})`;
          text += line + '\n';
        });
      });
    }

    if (meeting.followupDate) {
      text += `\n📆 SEGUIMIENTO: ${this.formatDate(meeting.followupDate)}`;
      if (meeting.followupTime) text += ` a las ${meeting.followupTime}`;
      text += '\n';
    }

    navigator.clipboard.writeText(text).then(() => {
      this.showToast('Resumen copiado al portapapeles', 'success');
    }).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta);
      ta.select(); document.execCommand('copy');
      document.body.removeChild(ta);
      this.showToast('Resumen copiado', 'success');
    });
  }

  // ===== SIDEBAR =====
  toggleSidebar() {
    this.sidebarVisible = !this.sidebarVisible;
    this.appContainer.classList.toggle('sidebar-collapsed', !this.sidebarVisible);
  }

  renderMeetingList() {
    const cats = this.categories;
    const hasCats = cats.length > 0;

    // Show/hide category bar
    if (this.categoryBar) {
      this.categoryBar.classList.toggle('hidden', !hasCats);
    }

    // Filter by active category
    let filtered = this.meetings;
    if (this.activeCategory !== null && hasCats) {
      filtered = this.meetings.filter(m => (m.category || '') === this.activeCategory);
    }

    const active = filtered.filter(m => m.status !== 'completed');
    const completed = filtered.filter(m => m.status === 'completed');
    let html = '';

    if (active.length > 0) {
      html += `<div class="sidebar-section-title">En Curso</div><ul class="meeting-list">`;
      active.forEach(m => html += this.renderMeetingItem(m));
      html += '</ul>';
    }
    if (completed.length > 0) {
      html += `<div class="sidebar-section-title" style="margin-top:16px;">Historial</div><ul class="meeting-list">`;
      completed.forEach(m => html += this.renderMeetingItem(m));
      html += '</ul>';
    }
    if (filtered.length === 0) {
      html = `<div class="empty-state"><p>No hay reuniones${this.activeCategory ? ' en esta categoría' : ''}.<br>Crea una nueva.</p></div>`;
    }
    this.meetingListEl.innerHTML = html;

    // Render category chips
    if (hasCats) this.renderCategoryChips();
  }

  startRenameMeeting(meetingId) {
    const li = this.meetingListEl.querySelector(`[data-meeting-id="${meetingId}"]`);
    if (!li) return;
    const nameDiv = li.querySelector('.meeting-name');
    if (!nameDiv || nameDiv.tagName === 'INPUT') return; // already editing

    const meeting = this.getMeeting(meetingId);
    if (!meeting) return;

    const originalTitle = meeting.title || '';

    // Build inline input
    const input = document.createElement('input');
    input.type = 'text';
    input.value = originalTitle;
    input.placeholder = 'Título de la reunión...';
    input.className = 'meeting-name-input';

    nameDiv.replaceWith(input);
    input.select();
    input.focus();

    let committed = false;

    const commit = (newVal) => {
      if (committed) return;
      committed = true;
      const title = newVal.trim();
      if (title && title !== originalTitle) {
        meeting.title = title;
        this.saveMeetings();
        if (this.currentMeetingId === meetingId && this.meetingTitleInput) {
          this.meetingTitleInput.value = title;
        }
        this.showToast('Título actualizado', 'success');
      }
      // Restore nameDiv with updated text
      const restored = document.createElement('div');
      restored.className = 'meeting-name';
      restored.textContent = meeting.title || 'Sin título';
      input.replaceWith(restored);
      // Re-render sidebar to keep everything consistent
      this.renderMeetingList();
    };

    const cancel = () => {
      if (committed) return;
      committed = true;
      const restored = document.createElement('div');
      restored.className = 'meeting-name';
      restored.textContent = originalTitle || 'Sin título';
      input.replaceWith(restored);
    };

    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') { e.preventDefault(); commit(input.value); }
      if (e.key === 'Escape') { cancel(); }
    });
    input.addEventListener('blur', () => setTimeout(() => commit(input.value), 100));
    input.addEventListener('click', (e) => e.stopPropagation());
    input.addEventListener('mousedown', (e) => e.stopPropagation());
  }

  renderMeetingItem(m) {
    const isActive = m.id === this.currentMeetingId;
    const statusMap = { setup: ['active-status', 'Preparando'], active: ['active-status', 'En curso'], completed: ['completed-status', 'Finalizada'] };
    const [cls, label] = statusMap[m.status] || ['', ''];

    // Pending tasks badge
    const pendingTasks = (m.tasks || []).filter(t => !t.completed).length;
    const pendingBadge = pendingTasks > 0 ? `
      <span class="meeting-pending-badge" title="${pendingTasks} tarea${pendingTasks > 1 ? 's' : ''} pendiente${pendingTasks > 1 ? 's' : ''}">
        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="m9 12 2 2 4-4"/></svg>
        ${pendingTasks}
      </span>` : '';

    // Chain indicator: show if meeting is a follow-up or has a follow-up
    const chainBadge = m.parentMeetingId ? `
      <span class="meeting-chain-indicator" title="Seguimiento de reunión anterior">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
        Seguimiento
      </span>` : '';

    // Follow-up date
    const followupHtml = m.followupDate ? `
      <div class="meeting-followup">
        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
        Seguimiento: ${this.formatDate(m.followupDate)}
      </div>` : '';

    return `<li class="meeting-item status-${m.status} ${isActive ? 'active' : ''}" data-meeting-id="${m.id}" onclick="app.selectMeeting('${m.id}')">
      <div style="display:flex; justify-content:space-between; align-items:flex-start;">
        <div style="flex:1; overflow:hidden;">
          <div class="meeting-item-top">
            <div class="meeting-name">${m.title || 'Sin título'}</div>
            ${pendingBadge}
            ${chainBadge}
            <button class="btn-rename-meeting" onclick="event.stopPropagation(); app.startRenameMeeting('${m.id}')" title="Renombrar reunión">
              <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            ${this.categories.length > 0 ? `<button class="btn-move-meeting" onclick="event.stopPropagation(); app.showMeetingContextMenu('${m.id}', event)" title="Mover a categoría">
              <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
            </button>` : ''}
          </div>
          <div class="meeting-date">${this.formatDate(m.date)}</div>
          ${followupHtml}
        </div>
        <button class="btn-delete-meeting" onclick="event.stopPropagation(); app.deleteMeeting('${m.id}', event)" title="Eliminar reunión">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 6h18"></path>
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
          </svg>
        </button>
      </div>
    </li>`;
  }

  // ===== MODAL =====
  openModal(title, body, onConfirm) {
    this.modalTitle.textContent = title;
    this.modalBody.textContent = body;
    this.modalOverlay.classList.add('show');
    // Replace button to avoid stacking old handlers
    const newBtn = this.btnModalConfirm.cloneNode(true);
    this.btnModalConfirm.parentNode.replaceChild(newBtn, this.btnModalConfirm);
    this.btnModalConfirm = newBtn;
    this.btnModalConfirm.onclick = () => {
      this.closeModal();
      onConfirm();
    };
  }

  closeModal() { this.modalOverlay.classList.remove('show'); }

  // ===== TOAST =====
  showToast(message, type = 'info') {
    const icons = {
      success: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
      info: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>',
      warning: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>'
    };
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<div class="toast-icon">${icons[type]}</div><span class="toast-message">${message}</span>`;
    this.toastContainer.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  // ===== HELPERS =====
  getInitials(name) { return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2); }
  esc(str) { const d = document.createElement('div'); d.textContent = str; return d.innerHTML; }
  formatDate(ds) {
    if (!ds) return '';
    const [y, m, d] = ds.split('-');
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return `${parseInt(d)} ${months[parseInt(m) - 1]} ${y}`;
  }

  // ===== CATEGORIES =====
  getCategoriesKey() {
    const userId = this.currentUser?.id || 'legacy';
    return `meetflow_categories_${userId}`;
  }

  loadCategories() {
    const data = localStorage.getItem(this.getCategoriesKey());
    this.categories = data ? JSON.parse(data) : [];
  }

  saveCategories() {
    localStorage.setItem(this.getCategoriesKey(), JSON.stringify(this.categories));
    // Update toggle button state
    const toggleBtn = document.getElementById('btnToggleCategories');
    if (toggleBtn) toggleBtn.classList.toggle('has-categories', this.categories.length > 0);
  }

  addCategory(name) {
    name = name.trim();
    if (!name || this.categories.includes(name)) return;
    this.categories.push(name);
    this.saveCategories();
    this.renderMeetingList();
    this.renderCategoryManager();
  }

  deleteCategory(name) {
    this.categories = this.categories.filter(c => c !== name);
    // Reset meetings in this category to uncategorized
    this.meetings.forEach(m => { if (m.category === name) m.category = ''; });
    this.saveCategories();
    this.saveMeetings();
    if (this.activeCategory === name) this.activeCategory = null;
    this.renderMeetingList();
    this.renderCategoryManager();
  }

  filterByCategory(cat) {
    this.activeCategory = this.activeCategory === cat ? null : cat;
    this.renderMeetingList();
  }

  renderCategoryChips() {
    if (!this.categoryChips) return;
    const allCount = this.meetings.length;
    let html = `<button class="category-chip ${this.activeCategory === null ? 'active' : ''}" onclick="app.filterByCategory(null)">Todas (${allCount})</button>`;
    this.categories.forEach(cat => {
      const count = this.meetings.filter(m => (m.category || '') === cat).length;
      const isActive = this.activeCategory === cat;
      html += `<button class="category-chip ${isActive ? 'active' : ''}" onclick="app.filterByCategory('${this.esc(cat)}')">${this.esc(cat)} (${count})</button>`;
    });
    // Show uncategorized count
    const uncatCount = this.meetings.filter(m => !m.category).length;
    if (uncatCount > 0 && uncatCount < allCount) {
      const isActive = this.activeCategory === '';
      html += `<button class="category-chip ${isActive ? 'active' : ''}" onclick="app.filterByCategory('')">General (${uncatCount})</button>`;
    }
    this.categoryChips.innerHTML = html;
  }

  renderCategoryManager() {
    if (!this.categoryManagerList) return;
    if (this.categories.length === 0) {
      this.categoryManagerList.innerHTML = '<div style="font-size:0.72rem;color:var(--text-muted);padding:4px 8px;">Aún no hay categorías</div>';
      return;
    }
    this.categoryManagerList.innerHTML = this.categories.map(cat => {
      const count = this.meetings.filter(m => (m.category || '') === cat).length;
      return `<div class="category-list-item">
        <span class="cat-name">${this.esc(cat)}</span>
        <span style="display:flex;align-items:center;gap:4px;">
          <span class="cat-count">${count}</span>
          <button class="category-delete-btn" onclick="app.deleteCategory('${this.esc(cat)}')" title="Eliminar">✕</button>
        </span>
      </div>`;
    }).join('');
  }

  showMeetingContextMenu(meetingId, event) {
    event.preventDefault();
    event.stopPropagation();
    const menu = this.meetingContextMenu;
    if (!menu) return;

    const meeting = this.getMeeting(meetingId);
    if (!meeting) return;

    // Build menu items
    let html = `<div class="context-menu-item ${!meeting.category ? 'active-cat' : ''}" onclick="app.moveMeetingToCategory('${meetingId}', '')">📋 General</div>`;
    this.categories.forEach(cat => {
      const isActive = meeting.category === cat;
      html += `<div class="context-menu-item ${isActive ? 'active-cat' : ''}" onclick="app.moveMeetingToCategory('${meetingId}', '${this.esc(cat)}')">📁 ${this.esc(cat)}</div>`;
    });

    this.contextMenuItems.innerHTML = html;
    menu.classList.remove('hidden');

    // Position near click
    const x = Math.min(event.clientX, window.innerWidth - 180);
    const y = Math.min(event.clientY, window.innerHeight - 200);
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';

    // Close on click outside
    const close = (e) => {
      if (!menu.contains(e.target)) {
        menu.classList.add('hidden');
        document.removeEventListener('click', close);
      }
    };
    setTimeout(() => document.addEventListener('click', close), 10);
  }

  moveMeetingToCategory(meetingId, category) {
    const meeting = this.getMeeting(meetingId);
    if (!meeting) return;
    meeting.category = category;
    this.saveMeetings();
    this.meetingContextMenu?.classList.add('hidden');
    this.renderMeetingList();
    this.showToast(`Movida a: ${category || 'General'}`, 'success');
  }

  bindCategoryEvents() {
    // Main toggle button (always visible in search bar)
    const toggleBtn = document.getElementById('btnToggleCategories');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        this.categoryManager?.classList.toggle('hidden');
        if (!this.categoryManager?.classList.contains('hidden')) {
          this.renderCategoryManager();
          this.newCategoryInput?.focus();
        }
      });
    }
    if (this.btnManageCategories) {
      this.btnManageCategories.addEventListener('click', () => {
        this.categoryManager?.classList.toggle('hidden');
        this.renderCategoryManager();
      });
    }
    if (this.btnCloseCategoryManager) {
      this.btnCloseCategoryManager.addEventListener('click', () => {
        this.categoryManager?.classList.add('hidden');
      });
    }
    if (this.btnAddCategory) {
      this.btnAddCategory.addEventListener('click', () => {
        this.addCategory(this.newCategoryInput.value);
        this.newCategoryInput.value = '';
      });
    }
    if (this.newCategoryInput) {
      this.newCategoryInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          this.addCategory(this.newCategoryInput.value);
          this.newCategoryInput.value = '';
        }
      });
    }
  }

  // ===== REALTIME COLLABORATION =====

  bindShareEvents() {
    const btnShare = document.getElementById('btnShareMeeting');
    const btnClose = document.getElementById('btnCloseShareModal');
    const btnCopy = document.getElementById('btnCopyShareLink');
    const btnWhatsApp = document.getElementById('btnShareWhatsApp');
    const overlay = document.getElementById('shareModalOverlay');

    if (btnShare) {
      btnShare.addEventListener('click', () => this.shareMeeting());
    }
    if (btnClose) {
      btnClose.addEventListener('click', () => overlay?.classList.add('hidden'));
    }
    if (overlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.classList.add('hidden');
      });
    }
    if (btnCopy) {
      btnCopy.addEventListener('click', () => {
        const input = document.getElementById('shareLinkInput');
        if (input) {
          navigator.clipboard.writeText(input.value).then(() => {
            this.showToast('Link copiado ✓', 'success');
          });
        }
      });
    }
    if (btnWhatsApp) {
      btnWhatsApp.addEventListener('click', () => {
        const input = document.getElementById('shareLinkInput');
        if (input) {
          const meeting = this.getMeeting(this.currentMeetingId);
          const title = meeting?.title || 'reunión';
          const text = `📡 Únete a la reunión "${title}" en vivo:\n${input.value}`;
          window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
        }
      });
    }
  }

  async shareMeeting() {
    if (!this.currentMeetingId) return;

    const meeting = this.getMeeting(this.currentMeetingId);
    if (!meeting) return;

    let link;

    if (this.realtime) {
      // Start sharing (creates channel + returns link)
      link = await this.realtime.startSharing(this.currentMeetingId);

      // Listen for guest state requests
      this.realtime.channel.on('broadcast', { event: 'request_state' }, () => {
        this.broadcastMeetingState();
      });
    } else {
      // Fallback: generate link without channel
      const base = window.location.origin + window.location.pathname;
      link = `${base}?join=${this.currentMeetingId}`;
    }

    // Show modal with link
    const overlay = document.getElementById('shareModalOverlay');
    const input = document.getElementById('shareLinkInput');
    if (input) input.value = link;
    overlay?.classList.remove('hidden');

    // Show presence indicator
    const presenceEl = document.getElementById('livePresence');
    presenceEl?.classList.remove('hidden');

    this.showToast('📡 Reunión compartida en vivo', 'success');
  }

  broadcastMeetingState() {
    if (!this.realtime || !this.currentMeetingId) return;
    const meeting = this.getMeeting(this.currentMeetingId);
    if (meeting) {
      this.realtime.broadcastState(meeting);
    }
  }

  updatePresenceUI(users) {
    const presenceEl = document.getElementById('livePresence');
    const countEl = document.getElementById('liveCount');
    if (!presenceEl || !countEl) return;

    const guestCount = users.filter(u => u.role === 'guest').length;
    if (guestCount > 0) {
      presenceEl.classList.remove('hidden');
      countEl.textContent = guestCount;
    } else if (!this.realtime?.isHost) {
      // Don't hide if host, keep visible
    }
  }

  // ===== GUEST JOIN FLOW =====

  async showGuestJoinScreen(meetingId) {
    // Hide login and app
    this.loginScreen?.classList.add('hidden');
    this.appContainer?.classList.add('hidden');

    // Fetch meeting title from Supabase
    try {
      const { data } = await supabaseClient
        .from('meetflow_reuniones')
        .select('title, status')
        .eq('id', meetingId)
        .single();

      if (data) {
        const titleEl = document.getElementById('guestMeetingTitle');
        if (titleEl) titleEl.textContent = data.title || 'Reunión';

        if (data.status === 'completed') {
          const subtitleEl = document.querySelector('.guest-join-subtitle');
          if (subtitleEl) subtitleEl.textContent = 'Esta reunión ya finalizó';
          const btn = document.getElementById('btnGuestJoin');
          if (btn) { btn.disabled = true; btn.textContent = 'Reunión finalizada'; }
        }
      }
    } catch (e) {
      console.warn('Could not fetch meeting info:', e);
    }

    // Show guest join screen
    const screen = document.getElementById('guestJoinScreen');
    screen?.classList.remove('hidden');

    // Bind join button
    const btnJoin = document.getElementById('btnGuestJoin');
    const nameInput = document.getElementById('guestNameInput');

    const doJoin = () => {
      const name = nameInput?.value.trim();
      if (!name) {
        nameInput?.focus();
        return;
      }
      this.joinAsGuest(meetingId, name);
    };

    btnJoin?.addEventListener('click', doJoin);
    nameInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') doJoin();
    });

    nameInput?.focus();
  }

  async joinAsGuest(meetingId, guestName) {
    this.isGuestMode = true;

    // Hide join screen, show app
    document.getElementById('guestJoinScreen')?.classList.add('hidden');
    this.loginScreen?.classList.add('hidden');
    this.appContainer?.classList.remove('hidden');

    // Hide sidebar (guests don't need it)
    this.appContainer?.classList.add('sidebar-collapsed');

    // Init realtime
    this.realtime = new MeetingRealtime(supabaseClient);

    // When we receive state updates, render them
    this.realtime.onStateUpdate = (state) => {
      this.renderGuestView(state, guestName);
    };

    this.realtime.onPresenceUpdate = (users) => {
      this.updatePresenceUI(users);
    };

    // Join the channel
    await this.realtime.joinMeeting(meetingId, guestName);

    // Show initial loading state
    this.renderGuestView({ title: 'Conectando...', status: 'loading' }, guestName);

    // Also load from Supabase as fallback
    try {
      const { data } = await supabaseClient
        .from('meetflow_reuniones')
        .select('*')
        .eq('id', meetingId)
        .single();

      if (data) {
        this.renderGuestView({
          ...data,
          currentTopicIndex: 0,
          timerRunning: false,
          timerSeconds: data.totalTime || 0,
          topicTimerSeconds: 0
        }, guestName);
      }
    } catch (e) {
      console.warn('Could not load meeting from Supabase:', e);
    }
  }

  renderGuestView(state, guestName) {
    const main = document.querySelector('.main-content');
    if (!main) return;

    if (state.status === 'completed') {
      main.innerHTML = `
        <div class="welcome-screen" style="display:flex">
          <div class="welcome-icon" style="color: #10b981;">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
          <h2>Reunión Finalizada</h2>
          <p>La reunión "${state.title || ''}" ha terminado. Gracias por participar.</p>
        </div>`;
      return;
    }

    if (state.status === 'loading') {
      main.innerHTML = `
        <div class="welcome-screen" style="display:flex">
          <div class="welcome-icon"><svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>
          <h2>Conectando a la reunión...</h2>
          <p>Esperando datos del moderador</p>
        </div>`;
      return;
    }

    const topics = state.topics || [];
    const tasks = state.tasks || [];
    const currentIdx = state.currentTopicIndex ?? -1;
    const timerSec = state.topicTimerSeconds || 0;
    const totalSec = state.timerSeconds || 0;
    const running = state.timerRunning || false;

    const formatTime = (s) => {
      const m = Math.floor(s / 60);
      const sec = s % 60;
      return `${m}:${String(sec).padStart(2, '0')}`;
    };

    const topicsHtml = topics.map((t, i) => {
      const isCurrent = i === currentIdx;
      const icon = t.completed ? '✅' : (isCurrent ? '▶' : '○');
      const cls = isCurrent ? 'style="color:var(--accent-primary);font-weight:600;"' : '';
      const subtopicsHtml = (t.subtopics || []).map(st =>
        `<div style="padding:2px 0 2px 24px;font-size:0.8rem;color:var(--text-muted);">• ${this.esc(st.name)}</div>`
      ).join('');
      return `<div style="padding:8px 0;border-bottom:1px solid var(--border);" ${cls}>
        <span>${icon} ${this.esc(t.name)}</span>
        ${isCurrent ? `<span style="float:right;color:var(--accent-primary);font-size:0.85rem;">${formatTime(t.elapsed || 0)}</span>` : ''}
        ${subtopicsHtml}
      </div>`;
    }).join('');

    const tasksHtml = tasks.length > 0 ? tasks.map(t =>
      `<div style="padding:6px 0;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
        <span>${t.completed ? '✅' : '☐'} ${this.esc(t.name)}</span>
        <span style="font-size:0.75rem;color:var(--text-muted);">${this.esc(t.assignee || '')}</span>
      </div>`
    ).join('') : '<div style="color:var(--text-muted);font-size:0.85rem;padding:12px 0;">Aún no hay tareas</div>';

    const connectedUsers = this.realtime?.getConnectedUsers() || [];
    const presenceHtml = connectedUsers.map(u =>
      `<span style="padding:2px 8px;border-radius:10px;font-size:0.72rem;background:${u.role === 'host' ? 'rgba(139,92,246,0.2)' : 'rgba(16,185,129,0.2)'};color:${u.role === 'host' ? 'var(--accent-primary)' : '#10b981'};margin:2px;">${u.role === 'host' ? '👑' : '👤'} ${this.esc(u.name)}</span>`
    ).join('');

    main.innerHTML = `
      <div style="max-width:1000px;margin:0 auto;padding:24px;">
        <!-- Header -->
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;">
          <div>
            <h2 style="margin:0;font-size:1.5rem;color:var(--text-primary);">${this.esc(state.title || 'Reunión')}</h2>
            <p style="margin:4px 0 0;color:var(--text-muted);font-size:0.85rem;">${state.date || ''} · ${state.time || ''}</p>
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <div class="live-presence">
              <span class="live-dot"></span>
              <span>EN VIVO</span>
            </div>
          </div>
        </div>

        <!-- Connected Users -->
        <div style="margin-bottom:16px;display:flex;flex-wrap:wrap;gap:4px;">
          ${presenceHtml}
          <span style="padding:2px 8px;border-radius:10px;font-size:0.72rem;background:rgba(16,185,129,0.2);color:#10b981;margin:2px;">👤 ${this.esc(guestName)} (Tú)</span>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
          <!-- Left: Timer + Current Topic -->
          <div>
            <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius-lg);padding:24px;text-align:center;margin-bottom:16px;">
              <div style="font-size:0.7rem;text-transform:uppercase;letter-spacing:1px;color:var(--text-muted);margin-bottom:8px;">⏱ Tiempo Total</div>
              <div style="font-size:2rem;font-weight:700;color:var(--accent-primary);font-family:monospace;">${formatTime(totalSec)}</div>
              ${running ? '<div style="font-size:0.75rem;color:#10b981;margin-top:4px;">● En curso</div>' : '<div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px;">⏸ Pausado</div>'}
            </div>

            ${currentIdx >= 0 && topics[currentIdx] ? `
            <div style="background:var(--bg-secondary);border:2px solid var(--accent-primary);border-radius:var(--radius-lg);padding:20px;text-align:center;">
              <div style="font-size:0.7rem;text-transform:uppercase;letter-spacing:1px;color:var(--accent-primary);margin-bottom:8px;">Tema Actual</div>
              <div style="font-size:1.2rem;font-weight:600;color:var(--text-primary);">${this.esc(topics[currentIdx].name)}</div>
              <div style="font-size:1.5rem;font-weight:700;color:var(--accent-primary);margin-top:8px;font-family:monospace;">${formatTime(timerSec)}</div>
            </div>` : ''}
          </div>

          <!-- Right: Agenda -->
          <div>
            <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius-lg);padding:16px;">
              <div style="font-size:0.8rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;margin-bottom:8px;">📋 Agenda</div>
              ${topicsHtml || '<div style="color:var(--text-muted);">Sin temas</div>'}
            </div>
          </div>
        </div>

        <!-- Tasks -->
        <div style="margin-top:20px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius-lg);padding:16px;">
          <div style="font-size:0.8rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;margin-bottom:8px;">☑ Tareas Pactadas (${tasks.length})</div>
          ${tasksHtml}
        </div>
      </div>`;
  }
}

let app;
document.addEventListener('DOMContentLoaded', () => {
  app = new MeetingManager();
  app.init().then(() => {
    window.app = app; // Explicitly attach to window for inline onclick handlers
  });
});
