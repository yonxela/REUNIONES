class MeetingManager {
  constructor() {
    this.meetings = [];
    this.currentMeetingId = null;
    this.currentStep = null; // 'setup' | 'meeting' | 'summary'
    this.timerInterval = null;
    this.timerSeconds = 0;
    this.timerRunning = false;
    this.topicTimerInterval = null;
    this.topicTimerSeconds = 0;
    this.currentTopicIndex = -1;
    this.sidebarVisible = window.innerWidth > 900;
  }

  async init() {
    this.cacheDOM();
    this.bindEvents();

    // Ensure correct initial sidebar state
    this.appContainer.classList.toggle('sidebar-collapsed', !this.sidebarVisible);

    // Attempt local storage first to prevent white screens while fetching
    const localData = localStorage.getItem('meetflow_meetings');
    if (localData) this.meetings = JSON.parse(localData);

    this.renderMeetingList();
    this.showWelcome();

    // Now load from Supabase
    await this.loadMeetings();
  }

  cacheDOM() {
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

    // Toast
    this.toastContainer = document.getElementById('toastContainer');
  }

  bindEvents() {
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
  }

  // ===== PERSISTENCE =====
  async loadMeetings() {
    if (window.supabaseDb) {
      try {
        const { data, error } = await window.supabaseDb
          .from('meetflow_reuniones')
          .select('*')
          .order('createdAt', { ascending: false });

        if (error) throw error;

        if (data && data.length > 0) {
          this.meetings = data;
          localStorage.setItem('meetflow_meetings', JSON.stringify(this.meetings));
          this.renderMeetingList();
        }
      } catch (e) {
        console.error("Error loading meetings from Supabase:", e);
      }
    } else {
      // Fallback
      const data = localStorage.getItem('meetflow_meetings');
      this.meetings = data ? JSON.parse(data) : [];
      this.renderMeetingList();
    }
  }

  async saveMeetings() {
    // Save to local storage fast to ensure zero-lag UI
    localStorage.setItem('meetflow_meetings', JSON.stringify(this.meetings));

    if (window.supabaseDb && this.currentMeetingId) {
      const activeMeeting = this.meetings.find(m => m.id === this.currentMeetingId);
      if (activeMeeting) {
        try {
          const { error } = await window.supabaseDb
            .from('meetflow_reuniones')
            .upsert([activeMeeting]);

          if (error) throw error;
        } catch (e) {
          console.error("Error saving meeting to Supabase:", e);
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
    event.stopPropagation(); // Prevent selectMeeting from firing
    if (confirm('¿Estás seguro de que deseas eliminar esta reunión? Esta acción no se puede deshacer.')) {
      this.meetings = this.meetings.filter(m => m.id !== id);
      this.saveMeetings();

      // Also delete explicitly from Supabase
      if (window.supabaseDb) {
        window.supabaseDb.from('meetflow_reuniones').delete().eq('id', id).then(r => {
          console.log("Deleted from DB", r);
        }).catch(console.error);
      }

      this.renderMeetingList();

      // If we deleted the currently active meeting, go back to welcome screen
      if (this.currentMeetingId === id) {
        this.showWelcome();
      }
    }
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
    this.renderSummary();
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
    this.timerDisplay.classList.add('running');
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
    }, 1000);
  }

  pauseTimer() {
    this.timerRunning = false;
    this.timerDisplay.classList.remove('running');
    clearInterval(this.timerInterval);
    this.timerInterval = null;
    this.btnPauseTimer.classList.add('hidden');
    this.btnPlayTimer.classList.remove('hidden');
  }

  stopAllTimers() {
    this.timerRunning = false;
    this.timerDisplay?.classList.remove('running');
    clearInterval(this.timerInterval);
    this.timerInterval = null;
    this.topicTimerSeconds = 0;
    this.currentTopicIndex = -1;
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
    this.topicTimerDisplay.textContent = `${m}:${s.toString().padStart(2, '0')} en este tema`;
  }

  // ===== CURRENT TOPIC =====
  renderCurrentTopic() {
    const meeting = this.getMeeting(this.currentMeetingId);
    if (!meeting) return;

    const allDone = meeting.topics.every(t => t.completed);

    if (allDone || this.currentTopicIndex < 0 || this.currentTopicIndex >= meeting.topics.length) {
      this.currentTopicDisplay.classList.add('hidden');
      this.btnTopicDone.classList.add('hidden');
      this.allTopicsDoneMsg.classList.remove('hidden');
      this.topicTimerDisplay.textContent = '';
      this.updateTaskLinkedTopic();
      return;
    }

    this.allTopicsDoneMsg.classList.add('hidden');
    this.currentTopicDisplay.classList.remove('hidden');
    this.btnTopicDone.classList.remove('hidden');

    const topic = meeting.topics[this.currentTopicIndex];
    this.currentTopicName.textContent = topic.name;
    this.topicTimerSeconds = topic.elapsed || 0;
    this.updateTopicTimerDisplay();
    this.updateTaskLinkedTopic();
  }

  markCurrentTopicDone() {
    const meeting = this.getMeeting(this.currentMeetingId);
    if (!meeting || this.currentTopicIndex < 0) return;

    meeting.topics[this.currentTopicIndex].completed = true;
    this.saveMeetings();

    // Auto-advance to next uncompleted topic
    const nextIndex = meeting.topics.findIndex((t, i) => i > this.currentTopicIndex && !t.completed);
    if (nextIndex >= 0) {
      this.currentTopicIndex = nextIndex;
      this.topicTimerSeconds = meeting.topics[nextIndex].elapsed || 0;
    } else {
      // Check if any earlier topics are uncompleted
      const anyLeft = meeting.topics.findIndex(t => !t.completed);
      if (anyLeft >= 0) {
        this.currentTopicIndex = anyLeft;
        this.topicTimerSeconds = meeting.topics[anyLeft].elapsed || 0;
      } else {
        this.currentTopicIndex = -1;
        this.topicTimerSeconds = 0;
      }
    }

    this.renderCurrentTopic();
    this.renderMeetingAgenda();
    this.showToast('¡Tema completado!', 'success');
  }

  focusOnTopic(index) {
    const meeting = this.getMeeting(this.currentMeetingId);
    if (!meeting) return;
    const topic = meeting.topics[index];
    if (!topic || topic.completed) return;

    this.currentTopicIndex = index;
    this.topicTimerSeconds = topic.elapsed || 0;
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
    meeting.topics.push({ id: Date.now().toString(), name, estimatedMinutes: minutes, completed: false, elapsed: 0 });
    this.saveMeetings();
    this.topicInput.value = '';
    this.topicMinutes.value = '';
    this.renderTopicsSetup();
    this.updateStartButton();
    this.topicInput.focus();
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
    this.topicsListSetup.innerHTML = meeting.topics.map((t, i) => `
      <div class="topic-item-setup">
        <div class="topic-number">${i + 1}</div>
        <div class="topic-info">
          <div class="topic-name">${this.esc(t.name)}</div>
          <div class="topic-time">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            ${t.estimatedMinutes ? `${t.estimatedMinutes} min` : 'Sin tiempo'}
          </div>
        </div>
        <button class="topic-delete" onclick="app.removeTopic(${i})" title="Eliminar">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
        </button>
      </div>
    `).join('');
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

      return `
        <div class="agenda-item ${cls}" onclick="app.focusOnTopic(${i})">
          <div class="agenda-icon">${icon}</div>
          <span class="agenda-item-name">${this.esc(t.name)}</span>
          ${timeStr ? `<span class="agenda-item-time">${timeStr}</span>` : ''}
        </div>
      `;
    }).join('');
  }

  addTopicDuringMeeting() {
    const input = document.getElementById('agendaAddTopicInput');
    if (!input) return;
    const name = input.value.trim();
    if (!name) return;
    const meeting = this.getMeeting(this.currentMeetingId);
    if (!meeting) return;
    meeting.topics.push({ id: Date.now().toString(), name, estimatedMinutes: 0, completed: false, elapsed: 0 });
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

    this.tasksList.innerHTML = meeting.tasks.map(task => `
      <div class="task-item ${task.completed ? 'task-done' : ''}">
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
        <button class="task-delete-btn" onclick="app.removeTask('${task.id}')">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
        </button>
      </div>
    `).join('');
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
        html += `<p style="font-size:0.78rem;color:var(--accent-secondary);margin:8px 0 4px 16px;font-weight:600;">${this.esc(topic)}</p><ul>`;
        tasks.forEach(t => {
          let label = this.esc(t.name);
          if (t.assignee) label += ` → ${this.esc(t.assignee)}`;
          if (t.dueDate) label += ` (${this.formatDate(t.dueDate)})`;
          html += `<li>${t.completed ? '✓' : '○'} ${label}</li>`;
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
    const active = this.meetings.filter(m => m.status !== 'completed');
    const completed = this.meetings.filter(m => m.status === 'completed');
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
    if (this.meetings.length === 0) {
      html = `<div class="empty-state"><p>No hay reuniones.<br>Crea una nueva.</p></div>`;
    }
    this.meetingListEl.innerHTML = html;
  }

  renderMeetingItem(m) {
    const isActive = m.id === this.currentMeetingId;
    const statusMap = { setup: ['active-status', 'Preparando'], active: ['active-status', 'En curso'], completed: ['completed-status', 'Finalizada'] };
    const [cls, label] = statusMap[m.status] || ['', ''];
    return `<li class="meeting-item ${isActive ? 'active' : ''}" data-meeting-id="${m.id}" onclick="app.selectMeeting('${m.id}')">
      <div style="display:flex; justify-content:space-between; align-items:flex-start;">
        <div style="flex:1; overflow:hidden;">
          <div class="meeting-name">${m.title || 'Sin título'}</div>
          <div class="meeting-date">${this.formatDate(m.date)}</div>
          <span class="meeting-status ${cls}">${label}</span>
        </div>
        <button class="btn-delete-meeting" onclick="app.deleteMeeting('${m.id}', event)" title="Eliminar reunión">
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
    this.btnModalConfirm.onclick = () => onConfirm();
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
}

let app;
document.addEventListener('DOMContentLoaded', () => {
  app = new MeetingManager();
  app.init().then(() => {
    window.app = app; // Explicitly attach to window for inline onclick handlers
  });
});
