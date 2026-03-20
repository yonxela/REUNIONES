// ===== SISDEL Meets - Realtime Collaboration =====
// Uses Supabase Realtime Channels for live meeting sync

class MeetingRealtime {
  constructor(supabaseClient) {
    this.supabase = supabaseClient;
    this.channel = null;
    this.meetingId = null;
    this.isHost = false;
    this.guestName = null;
    this.onStateUpdate = null; // callback for state updates
    this.onPresenceUpdate = null; // callback for presence changes
    this.presenceState = {};
  }

  // ===== HOST: Start sharing a meeting =====
  async startSharing(meetingId) {
    this.meetingId = meetingId;
    this.isHost = true;

    // Mark meeting as shared in Supabase
    try {
      await this.supabase.from('meetflow_reuniones')
        .update({ isShared: true })
        .eq('id', meetingId);
    } catch (e) {
      console.warn('Could not update isShared flag:', e);
    }

    // Create realtime channel
    this.channel = this.supabase.channel(`meeting:${meetingId}`, {
      config: {
        presence: { key: 'host' },
        broadcast: { self: false }
      }
    });

    // Listen for presence changes
    this.channel.on('presence', { event: 'sync' }, () => {
      this.presenceState = this.channel.presenceState();
      this._notifyPresence();
    });

    // Subscribe
    await this.channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        // Track host presence
        await this.channel.track({
          name: app.currentUser?.name || 'Host',
          role: 'host',
          joinedAt: new Date().toISOString()
        });
        console.log('✅ Realtime: Host connected to channel');
      }
    });

    return this.getShareLink(meetingId);
  }

  // ===== HOST: Broadcast meeting state =====
  broadcastState(meeting) {
    if (!this.channel || !this.isHost) return;

    this.channel.send({
      type: 'broadcast',
      event: 'meeting_state',
      payload: {
        title: meeting.title,
        date: meeting.date,
        time: meeting.time,
        status: meeting.status,
        participants: meeting.participants,
        topics: meeting.topics,
        tasks: meeting.tasks,
        totalTime: meeting.totalTime,
        currentTopicIndex: app.currentTopicIndex,
        currentSubtopicIndex: app.currentSubtopicIndex,
        timerRunning: app.timerRunning,
        timerSeconds: app.timerSeconds,
        topicTimerSeconds: app.topicTimerSeconds,
        followupDate: meeting.followupDate
      }
    });
  }

  // ===== GUEST: Join a shared meeting =====
  async joinMeeting(meetingId, guestName) {
    this.meetingId = meetingId;
    this.isHost = false;
    this.guestName = guestName;

    // Create channel
    this.channel = this.supabase.channel(`meeting:${meetingId}`, {
      config: {
        presence: { key: guestName.replace(/\s/g, '_') },
        broadcast: { self: false }
      }
    });

    // Listen for state broadcasts from host
    this.channel.on('broadcast', { event: 'meeting_state' }, (payload) => {
      if (this.onStateUpdate) {
        this.onStateUpdate(payload.payload);
      }
    });

    // Listen for meeting end
    this.channel.on('broadcast', { event: 'meeting_ended' }, () => {
      if (this.onStateUpdate) {
        this.onStateUpdate({ status: 'completed' });
      }
    });

    // Listen for presence
    this.channel.on('presence', { event: 'sync' }, () => {
      this.presenceState = this.channel.presenceState();
      this._notifyPresence();
    });

    // Subscribe
    await this.channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await this.channel.track({
          name: guestName,
          role: 'guest',
          joinedAt: new Date().toISOString()
        });
        console.log('✅ Realtime: Guest connected to channel');
      }
    });

    // Request current state from host
    this.channel.send({
      type: 'broadcast',
      event: 'request_state',
      payload: { guestName }
    });
  }

  // ===== Presence helpers =====
  _notifyPresence() {
    const users = [];
    Object.values(this.presenceState).forEach(presences => {
      presences.forEach(p => {
        users.push({ name: p.name, role: p.role });
      });
    });
    if (this.onPresenceUpdate) {
      this.onPresenceUpdate(users);
    }
  }

  getConnectedUsers() {
    const users = [];
    Object.values(this.presenceState).forEach(presences => {
      presences.forEach(p => {
        users.push({ name: p.name, role: p.role });
      });
    });
    return users;
  }

  // ===== Share link =====
  getShareLink(meetingId) {
    const base = window.location.origin + window.location.pathname;
    return `${base}?join=${meetingId}`;
  }

  // ===== Check if URL has join param =====
  static getJoinIdFromURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get('join');
  }

  // ===== Cleanup =====
  async disconnect() {
    if (this.channel) {
      await this.channel.untrack();
      await this.supabase.removeChannel(this.channel);
      this.channel = null;
      console.log('🔌 Realtime: Disconnected');
    }
  }
}
