// LFGOS Sports Fiesta 2026 - Production Front-End PWA Application
// Mobile First (390px baseline) • Strict Read-Only • Zero Browser Tokens
// Motion, Sound, Notification & Tournament Bracket Layer

(function() {
  'use strict';

  // --- CONFIRMED EVENT CONFIGURATION ---
  const EVENT_CONFIG = {
    title: 'LFGOS SPORTS FIESTA 2026',
    venue: 'Dr. Bhimrao Ambedkar Sports Stadium, Mau',
    venueMapsUrl: 'https://www.google.com/maps/search/?api=1&query=Dr.+Bhimrao+Ambedkar+Sports+Stadium+Mau',
    dates: '13 & 14 Nov 2026',
    hostedBy: 'LFIS Mau',
    officialWebsite: 'https://lfcsschools.com/',
    contactLabel: 'Little Flower Group of Schools · lfcsschools.com'
  };

  // --- SCHOOL CODE TO CANONICAL CREST MAPPING ---
  const CREST_BY_CODE = {
    'SKT': 'assets/crests/sikatiya.png',
    'GHS': 'assets/crests/ghoshi.png',
    'KHL': 'assets/crests/international.png',
    'NZM': 'assets/crests/nizamuddinpura.png',
    'KRP': 'assets/crests/kiriharpur.png',
    'KSM': 'assets/crests/kasimabad.png'
  };

  // Fixed UI Scaffolding (shown before first live fetch completes, scores strictly '—')
  const SCAFFOLD_SCHOOLS = [
    { id: '6ae208b1fe097a3f4f0d6fba', name: 'Little Flower Children School, Sikatiya Mau', short_name: 'LFCS Sikatiya', code: 'SKT', color: '#D0021B', seed: 1, points: '—', medals: { first: '—', second: '—', third: '—' }, matches_won: '—' },
    { id: '6ae208b1fe097a3f4f0d6fbb', name: 'Little Flower Children School, Ghosi', short_name: 'LFCS Ghosi', code: 'GHS', color: '#0052CC', seed: 2, points: '—', medals: { first: '—', second: '—', third: '—' }, matches_won: '—' },
    { id: '6ae208b1fe097a3f4f0d6fbc', name: 'Little Flower International School, Khalishpur', short_name: 'LFIS Khalishpur', code: 'KHL', color: '#00875A', seed: 3, points: '—', medals: { first: '—', second: '—', third: '—' }, matches_won: '—' },
    { id: '6ae208b1fe097a3f4f0d6fbe', name: 'Little Flower Children School, Nizamuddinpura Mau', short_name: 'LFCS Nizamuddinpura', code: 'NZM', color: '#FF8B00', seed: 4, points: '—', medals: { first: '—', second: '—', third: '—' }, matches_won: '—' },
    { id: '6ae208b1fe097a3f4f0d6fbd', name: 'Little Flower Children School, Kiriharapur', short_name: 'LFCS Kiriharapur', code: 'KRP', color: '#6554C0', seed: 5, points: '—', medals: { first: '—', second: '—', third: '—' }, matches_won: '—' },
    { id: '6ae208b1fe097a3f4f0d6fbf', name: 'Little Flower Children School, Kasimabad', short_name: 'LFCS Kasimabad', code: 'KSM', color: '#36B37E', seed: 6, points: '—', medals: { first: '—', second: '—', third: '—' }, matches_won: '—' }
  ];

  const SCAFFOLD_FEED = {
    meet: {
      title: 'LFGOS Sports Fiesta 2026',
      dates: ['2026-11-13', '2026-11-14'],
      venue: 'Dr. Bhimrao Ambedkar Sports Stadium, Mau'
    },
    schools: SCAFFOLD_SCHOOLS,
    events: [],
    competitions: [],
    results: [],
    fixtures: [],
    announcements: [],
    media: [],
    stream: {
      active: false,
      url: '',
      startTime: '2026-11-14T09:00:00+05:30',
      notice: 'Live stream broadcast begins 14 Nov 2026'
    }
  };

  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function getCrestUrl(school) {
    if (!school) return 'assets/crests/international.png';
    if (school.code && CREST_BY_CODE[school.code]) return CREST_BY_CODE[school.code];
    const name = (school.name || school.short_name || '').toLowerCase();
    if (name.includes('sikatiya')) return 'assets/crests/sikatiya.png';
    if (name.includes('ghosi') || name.includes('ghoshi')) return 'assets/crests/ghoshi.png';
    if (name.includes('international') || name.includes('lfis') || name.includes('khalishpur')) return 'assets/crests/international.png';
    if (name.includes('nizamuddinpura')) return 'assets/crests/nizamuddinpura.png';
    if (name.includes('kirihar') || name.includes('ballia')) return 'assets/crests/kiriharpur.png';
    if (name.includes('kasimabad')) return 'assets/crests/kasimabad.png';
    return 'assets/crests/international.png';
  }

  // --- GLOBAL APPLICATION STATE ---
  const State = {
    data: null,
    previousData: null,
    etag: null,
    lastSavedTime: null,
    isOffline: !navigator.onLine,
    isWarmingUp: false,
    initialSyncDone: false,
    currentRoute: 'home',
    routeParams: {},
    
    // User Preferences
    theme: localStorage.getItem('fiesta_theme') || 'auto',
    followedSchoolId: localStorage.getItem('fiesta_followed_school') || null,
    reminders: JSON.parse(localStorage.getItem('fiesta_reminders') || '[]'),
    soundEnabled: localStorage.getItem('fiesta_sound_enabled') === 'true', // OFF by default
    soundVolume: parseFloat(localStorage.getItem('fiesta_sound_volume') || '0.6'),
    hapticsEnabled: localStorage.getItem('fiesta_haptics_enabled') !== 'false',
    motionPreference: localStorage.getItem('fiesta_motion') || 'auto', // 'auto' | 'reduced' | 'full'
    
    // Notification Preferences
    notifPrefs: JSON.parse(localStorage.getItem('fiesta_notif_prefs') || JSON.stringify({
      results: true,
      live: true,
      announcements: true,
      matches: false,
      ranks: false,
      scope: 'all' // 'all' or 'followed'
    })),
    
    // In-App Notification Center
    notifications: JSON.parse(localStorage.getItem('fiesta_notifications') || '[]'),
    notifSheetOpen: false,
    seenMoments: new Set(JSON.parse(localStorage.getItem('fiesta_seen_moments') || '[]')),
    toasts: [],
    
    // Scores screen state
    scoresPrevPositions: new Map(),
    
    // Live screen state
    liveSubTab: 'now', // 'now' | 'medals' | 'schedule'
    plyrInstance: null,
    plyrLoaded: false,
    wakeLock: null,
    
    // Photos screen state
    selectedAlbumId: null,
    photoSwipeLoaded: false,
    
    // School detail screen state
    schoolAchievementsTab: 'matches', // 'matches' | 'medals' | 'trophies'

    // Fixtures screen state
    fixtureDay: '14', // '13' or '14'
    fixtureFilters: {
      game: 'all',
      school: 'all',
      status: 'all'
    },
    filterSheetOpen: false
  };

  // --- ACCESSIBILITY & MOTION CHECKS ---
  function isReducedMotion() {
    if (State.motionPreference === 'reduced') return true;
    if (State.motionPreference === 'full') return false;
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  // Native View Transitions Wrapper with graceful fallback
  function transitionView(updateDomCallback) {
    if (document.startViewTransition && !isReducedMotion()) {
      return document.startViewTransition(() => {
        updateDomCallback();
      });
    } else {
      updateDomCallback();
    }
  }

  // Section Error Boundary Guard
  function tryCatchSection(sectionName, renderFn) {
    try {
      return renderFn();
    } catch (err) {
      console.error(`[${sectionName}] Render error:`, err);
      return `
        <section class="card col" style="gap: 8px; text-align: center; padding: 20px 16px;">
          <div class="lab mut">Could not load ${sectionName}</div>
          <button class="chip" onclick="window.App.renderApp()" style="margin: 0 auto; min-height: 40px;">Retry</button>
        </section>
      `;
    }
  }

  // --- INDEXEDDB STORAGE CLIENT ---
  function openDB() {
    return new Promise((resolve) => {
      if (!window.indexedDB) return resolve(null);
      const req = indexedDB.open('fiesta_pwa_v2', 1);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('cache')) {
          db.createObjectStore('cache');
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });
  }

  async function getCachedFeed() {
    try {
      const db = await openDB();
      if (!db) return null;
      return new Promise((resolve) => {
        const tx = db.transaction('cache', 'readonly');
        const req = tx.objectStore('cache').get('feed');
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    } catch (e) {
      return null;
    }
  }

  async function setCachedFeed(data, etag) {
    try {
      const db = await openDB();
      if (!db) return;
      const tx = db.transaction('cache', 'readwrite');
      tx.objectStore('cache').put({
        data,
        etag,
        savedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }, 'feed');
    } catch (e) {}
  }

  // --- SOUND & HAPTIC ENGINE (HOWLER + WEB AUDIO SYNTHESIS) ---
  const SoundEngine = {
    ctx: null,
    unlocked: false,
    howl: null,
    howlLoaded: false,
    lastPlayedTime: 0,

    unlock() {
      if (this.unlocked) return;
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          if (!this.ctx) this.ctx = new AudioCtx();
          if (this.ctx.state === 'suspended') this.ctx.resume();
        }
        this.unlocked = true;
      } catch (e) {}
    },

    loadHowler() {
      if (this.howlLoaded) return;
      const script = document.createElement('script');
      script.src = './vendor/howler.min.js';
      script.onload = () => {
        this.howlLoaded = true;
        if (window.Howl) {
          this.howl = new Howl({
            src: ['./assets/sounds/fiesta_audio_sprite.wav'],
            sprite: {
              tap: [0, 40],
              result_declared: [80, 370],
              win_chime: [500, 750],
              live_started: [1300, 400],
              alert: [1750, 300],
              error: [2100, 300]
            },
            volume: State.soundVolume
          });
        }
      };
      document.body.appendChild(script);
    },

    play(cue) {
      if (!State.soundEnabled) return;
      const now = performance.now();
      // Rate limiting: At most one sound per 3.0 seconds
      if (now - this.lastPlayedTime < 3000) return;

      // Live stream ducking: Mute app sounds while stream video is playing & unmuted
      if (State.plyrInstance && !State.plyrInstance.paused && !State.plyrInstance.muted) {
        return;
      }

      this.lastPlayedTime = now;

      // Try Howler if available
      if (this.howl) {
        try {
          this.howl.volume(State.soundVolume);
          this.howl.play(cue);
          return;
        } catch (e) {}
      }

      // High-Fidelity Web Audio Synthesizer (Instantaneous, Zero-latency, CC0)
      try {
        this.unlock();
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        const vol = State.soundVolume * 0.35;

        const playTone = (freq, start, dur) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, t + start);
          gain.gain.setValueAtTime(vol, t + start);
          gain.gain.exponentialRampToValueAtTime(0.0001, t + start + dur);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start(t + start);
          osc.stop(t + start + dur);
        };

        if (cue === 'tap') {
          playTone(750, 0, 0.035);
        } else if (cue === 'result_declared') {
          playTone(523.25, 0, 0.16); // C5
          playTone(659.25, 0.16, 0.22); // E5
        } else if (cue === 'win_chime') {
          playTone(523.25, 0, 0.14); // C5
          playTone(659.25, 0.14, 0.14); // E5
          playTone(783.99, 0.28, 0.16); // G5
          playTone(1046.50, 0.44, 0.35); // C6
        } else if (cue === 'live_started') {
          playTone(698.46, 0, 0.16); // F5
          playTone(880.00, 0.16, 0.25); // A5
        } else if (cue === 'alert') {
          playTone(587.33, 0, 0.12); // D5
          playTone(880.00, 0.12, 0.20); // A5
        } else if (cue === 'error') {
          playTone(329.63, 0, 0.12); // E4
          playTone(261.63, 0.12, 0.18); // C4
        }
      } catch (e) {}
    }
  };

  function triggerHaptic(type = 'tap') {
    if (!State.hapticsEnabled || !navigator.vibrate) return;
    try {
      if (type === 'tap') navigator.vibrate(10);
      else if (type === 'result') navigator.vibrate([30, 40, 30]);
      else if (type === 'win') navigator.vibrate([40, 60, 40, 60, 80]);
      else if (type === 'alert') navigator.vibrate([50, 50, 50]);
    } catch (e) {}
  }

  // Celebration Confetti (Lazy-loaded, under 5KB)
  function triggerConfetti() {
    if (isReducedMotion()) return;
    const launch = () => {
      if (window.confetti) {
        window.confetti({
          particleCount: 45,
          spread: 60,
          origin: { y: 0.7 },
          colors: ['#2448FF', '#FFC342', '#00C2FF']
        });
      }
    };
    if (window.confetti) {
      launch();
    } else {
      const script = document.createElement('script');
      script.src = './vendor/canvas-confetti.min.js';
      script.onload = launch;
      document.body.appendChild(script);
    }
  }

  // --- "MOMENT" DETECTOR & NOTIFICATION ENGINE ---
  function saveSeenMoments() {
    const arr = Array.from(State.seenMoments).slice(-200);
    localStorage.setItem('fiesta_seen_moments', JSON.stringify(arr));
  }

  function saveNotifications() {
    localStorage.setItem('fiesta_notifications', JSON.stringify(State.notifications.slice(0, 50)));
    updateAppBadge();
  }

  function updateAppBadge() {
    const unreadCount = State.notifications.filter(n => n.unread).length;
    if ('setAppBadge' in navigator) {
      if (unreadCount > 0) navigator.setAppBadge(unreadCount).catch(() => {});
      else navigator.clearAppBadge().catch(() => {});
    }
  }

  function showToast(title, body, actionLink = null, actionText = 'View &rarr;') {
    const toast = {
      id: 'toast_' + Date.now() + Math.random().toString(36).slice(2, 6),
      title,
      body,
      actionLink,
      actionText
    };
    State.toasts.push(toast);
    if (State.toasts.length > 3) State.toasts.shift();
    renderToasts();
    setTimeout(() => {
      dismissToast(toast.id);
    }, 4000);
  }

  function dismissToast(id) {
    const idx = State.toasts.findIndex(t => t.id === id);
    if (idx > -1) {
      State.toasts.splice(idx, 1);
      renderToasts();
    }
  }

  function renderToasts() {
    let container = document.getElementById('toast-root');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-root';
      container.className = 'toast-container';
      container.setAttribute('aria-live', 'polite');
      document.body.appendChild(container);
    }
    container.innerHTML = State.toasts.map(t => `
      <div class="toast-item" role="alert" onclick="window.App.dismissToast('${t.id}')">
        <div style="flex: 1; min-width: 0;">
          <div style="font-weight: 800; font-size: 13.5px;">${t.title}</div>
          ${t.body ? `<div style="font-size: 12px; color: rgba(255,255,255,0.8); margin-top: 2px;">${t.body}</div>` : ''}
        </div>
        ${t.actionLink ? `
          <button class="toast-action-btn" onclick="event.stopPropagation(); window.App.navigate('${t.actionLink.replace('#', '')}')">
            ${t.actionText}
          </button>
        ` : ''}
      </div>
    `).join('');
  }

  function processMoment(moment) {
    // Check user category preferences
    if (moment.category === 'results' && !State.notifPrefs.results) return;
    if (moment.category === 'live' && !State.notifPrefs.live) return;
    if (moment.category === 'announcements' && !State.notifPrefs.announcements) return;
    if (moment.category === 'matches' && !State.notifPrefs.matches) return;
    if (moment.category === 'ranks' && !State.notifPrefs.ranks) return;

    // Filter by followed school if applicable
    if (State.notifPrefs.scope === 'followed' && State.followedSchoolId && moment.schoolId) {
      if (moment.schoolId !== State.followedSchoolId) return;
    }

    // Add to Notification Center history
    const entry = {
      id: 'notif_' + Date.now() + Math.random().toString(36).slice(2, 6),
      title: moment.title,
      body: moment.body,
      icon: moment.icon || 'trophy',
      link: moment.link || '#home',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      dateGroup: 'Today',
      unread: true
    };
    State.notifications.unshift(entry);
    saveNotifications();

    // Trigger Feedback if document is visible
    if (document.visibilityState === 'visible') {
      showToast(moment.title, moment.body, moment.link);
      if (moment.soundCue) SoundEngine.play(moment.soundCue);
      if (moment.hapticCue) triggerHaptic(moment.hapticCue);
      if (moment.confetti) triggerConfetti();
    }
  }

  function detectAndProcessMoments(prevFeed, newFeed) {
    // RULE 1: Never fire moments on initial load or cached data restore
    if (!prevFeed || !State.initialSyncDone) {
      State.initialSyncDone = true;
      (newFeed.results || []).forEach(r => State.seenMoments.add(`res:${r.id || r.event_id}`));
      (newFeed.fixtures || []).forEach(f => State.seenMoments.add(`fix:${f.id}:${f.status}`));
      (newFeed.announcements || []).forEach(a => State.seenMoments.add(`ann:${a.id}`));
      saveSeenMoments();
      return;
    }

    // RULE 2: If version unchanged, skip detection
    if (prevFeed.version === newFeed.version) return;

    // Detect approved results
    const prevResultsMap = new Map((prevFeed.results || []).map(r => [r.id || r.event_id, r]));
    const newApproved = [];
    (newFeed.results || []).forEach(r => {
      const rKey = r.id || r.event_id;
      const prev = prevResultsMap.get(rKey);
      const dedupeKey = `res:${rKey}:${newFeed.version}`;
      if (!prev && !State.seenMoments.has(dedupeKey)) {
        State.seenMoments.add(dedupeKey);
        const ev = newFeed.events?.find(e => e.id === r.event_id);
        const p1 = r.places?.find(p => p.rank === 1);
        const winSchoolId = p1?.school_id || r.first_place_school_id || r.first_school_id;
        const winSchool = winSchoolId ? newFeed.schools?.find(s => s.id === winSchoolId) : null;
        newApproved.push({
          eventId: r.event_id,
          category: ev?.category,
          gender: ev?.gender,
          event: ev?.name || 'Athletics Event',
          winner: winSchool?.short_name || 'Winner',
          points: p1?.points || r.points_first || 20,
          schoolId: winSchoolId
        });
      }
    });

    if (newApproved.length === 1) {
      const item = newApproved[0];
      const targetLink = item.eventId 
        ? `#game?event=${item.eventId}&cat=${encodeURIComponent(item.category || '')}&gender=${encodeURIComponent(item.gender || '')}`
        : `#scores?mode=points`;
      processMoment({
        category: 'results',
        title: 'Result Declared: ' + item.event,
        body: `1st: ${item.winner} (+${item.points} pts)`,
        icon: 'medal',
        link: targetLink,
        soundCue: 'win_chime',
        hapticCue: 'win',
        schoolId: item.schoolId
      });
    } else if (newApproved.length > 1) {
      processMoment({
        category: 'results',
        title: `${newApproved.length} New Results Approved!`,
        body: newApproved.map(i => i.event).slice(0, 2).join(', ') + ' and others.',
        icon: 'medal',
        link: `#scores?mode=points`,
        soundCue: 'win_chime',
        hapticCue: 'win'
      });
    }

    // Detect fixture events
    const prevFixturesMap = new Map((prevFeed.fixtures || []).map(f => [f.id, f]));
    (newFeed.fixtures || []).forEach(f => {
      const prev = prevFixturesMap.get(f.id);
      if (!prev) return;
      const comp = newFeed.competitions?.find(c => c.id === f.competition_id);
      const sA = newFeed.schools?.find(s => s.id === f.school_a_id);
      const sB = newFeed.schools?.find(s => s.id === f.school_b_id);

      if (f.status === 'Live' && prev.status !== 'Live') {
        const key = `fix_live:${f.id}:${newFeed.version}`;
        if (!State.seenMoments.has(key)) {
          State.seenMoments.add(key);
          processMoment({
            category: 'matches',
            title: `Match Now LIVE: ${comp?.name || 'Match'}`,
            body: `${sA?.short_name || 'Team A'} vs ${sB?.short_name || 'Team B'}`,
            icon: 'play',
            link: `#match?id=${f.id}`,
            soundCue: 'live_started',
            hapticCue: 'result'
          });
        }
      }

      if (f.status === 'Completed' && prev.status !== 'Completed' && f.winner_school_id) {
        const key = `fix_done:${f.id}:${newFeed.version}`;
        if (!State.seenMoments.has(key)) {
          State.seenMoments.add(key);
          const winSchool = newFeed.schools?.find(s => s.id === f.winner_school_id);
          const isFinal = f.round === 'Final';
          processMoment({
            category: 'matches',
            title: isFinal ? `CHAMPION DECIDED: ${comp?.name}` : `Match Finished: ${comp?.name}`,
            body: `Winner: ${winSchool?.short_name || 'Winner'}`,
            icon: 'trophy',
            link: `#match?id=${f.id}`,
            soundCue: 'win_chime',
            hapticCue: 'win',
            confetti: isFinal,
            schoolId: f.winner_school_id
          });
        }
      }
    });

    // Detect live stream changes
    if (newFeed.stream?.state === 'live' && prevFeed.stream?.state !== 'live') {
      const key = `live_on:${newFeed.version}`;
      if (!State.seenMoments.has(key)) {
        State.seenMoments.add(key);
        processMoment({
          category: 'live',
          title: 'Live Stream Is Broadcasting Now!',
          body: 'Broadcasting live athletics and finals from Mau.',
          icon: 'play',
          link: `#live`,
          soundCue: 'live_started',
          hapticCue: 'alert'
        });
      }
    }

    // Detect announcements
    const prevAnnouncements = new Set((prevFeed.announcements || []).map(a => a.id));
    (newFeed.announcements || []).forEach(a => {
      const key = `ann:${a.id}`;
      if (!prevAnnouncements.has(a.id) && !State.seenMoments.has(key)) {
        State.seenMoments.add(key);
        processMoment({
          category: 'announcements',
          title: 'Official Announcement',
          body: a.message,
          icon: 'info',
          link: `#home`,
          soundCue: 'alert',
          hapticCue: 'alert'
        });
      }
    });

    // Detect leaderboard lead change (rank 1 swap)
    if (prevFeed.schools && newFeed.schools) {
      const prevLeader = [...prevFeed.schools].sort((a, b) => (b.points || 0) - (a.points || 0))[0];
      const newLeader = [...newFeed.schools].sort((a, b) => (b.points || 0) - (a.points || 0))[0];
      if (prevLeader && newLeader && prevLeader.id !== newLeader.id && (newLeader.points || 0) > 0) {
        const key = `rank1:${newLeader.id}:${newFeed.version}`;
        if (!State.seenMoments.has(key)) {
          State.seenMoments.add(key);
          processMoment({
            category: 'ranks',
            title: 'Leaderboard Lead Change!',
            body: `${newLeader.short_name || newLeader.name} takes 1st Place with ${newLeader.points} pts!`,
            icon: 'trophy',
            link: '#scores?mode=points',
            soundCue: 'win_chime',
            hapticCue: 'win',
            confetti: true,
            schoolId: newLeader.id
          });
        }
      }
    }

    saveSeenMoments();
  }

  // --- DATA FETCHING & 30s SCOPED POLLING ---
  let isFetching = false;
  let fetchTimer = null;
  const BACKOFF_SCHEDULE = [8000, 8000, 12000, 12000, 20000];
  let backoffStep = 0;
  let backoffTimer = null;

  function scheduleBackoffRetry() {
    if (backoffTimer) clearTimeout(backoffTimer);
    const delay = BACKOFF_SCHEDULE[Math.min(backoffStep, BACKOFF_SCHEDULE.length - 1)];
    backoffStep++;
    console.log(`[Feed] Scheduling warming retry in ${delay}ms (attempt ${backoffStep})`);
    backoffTimer = setTimeout(() => {
      fetchPublicFeed();
    }, delay);
  }

  async function fetchPublicFeed() {
    if (isFetching) return;
    isFetching = true;

    // Show warming banner if request takes > 3 seconds
    if (!fetchTimer) {
      fetchTimer = setTimeout(() => {
        State.isWarmingUp = true;
        renderApp();
      }, 3000);
    }

    try {
      const headers = {};
      if (State.etag) {
        headers['If-None-Match'] = State.etag;
      }
      const res = await fetch('/api/public_feed', { headers });
      clearTimeout(fetchTimer);
      fetchTimer = null;

      if (res.status === 304) {
        // Data unchanged, free 304 response
        State.isOffline = false;
        State.isWarmingUp = false;
        backoffStep = 0;
        if (backoffTimer) clearTimeout(backoffTimer);
        isFetching = false;
        dismissSplash();
        renderApp();
        return;
      }

      if (res.status === 503) {
        // Cold start on Render
        try {
          const body = await res.json();
          if (body && body.warming) {
            State.isWarmingUp = true;
            scheduleBackoffRetry();
            renderApp();
            return;
          }
        } catch(e) {}
      }

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      const newEtag = res.headers.get('etag');

      State.isWarmingUp = false;
      State.isOffline = false;
      backoffStep = 0;
      if (backoffTimer) clearTimeout(backoffTimer);

      if (!State.data || data.version !== State.data.version) {
        const prev = State.data;
        State.previousData = prev;
        State.data = data;
        State.etag = newEtag;
        State.lastSavedTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setCachedFeed(data, newEtag);

        // Run moment engine on real data updates
        detectAndProcessMoments(prev, data);

        // FLIP Animation: record previous positions of ranked schools
        const prevRects = new Map();
        if (typeof document !== 'undefined') {
          document.querySelectorAll('[data-school-id]').forEach(el => {
            const id = el.getAttribute('data-school-id');
            if (id) prevRects.set(id, el.getBoundingClientRect());
          });
        }

        transitionView(() => {
          renderApp();
          // FLIP Play step
          if (prevRects.size > 0 && typeof requestAnimationFrame !== 'undefined') {
            requestAnimationFrame(() => {
              document.querySelectorAll('[data-school-id]').forEach(el => {
                const id = el.getAttribute('data-school-id');
                const prev = prevRects.get(id);
                if (prev) {
                  const cur = el.getBoundingClientRect();
                  const deltaY = prev.top - cur.top;
                  if (Math.abs(deltaY) > 3) {
                    el.style.transform = `translateY(${deltaY}px)`;
                    el.style.transition = 'none';
                    requestAnimationFrame(() => {
                      el.style.transition = 'transform 0.45s cubic-bezier(0.2, 0, 0, 1)';
                      el.style.transform = '';
                      el.classList.add('rank-changed-highlight');
                      setTimeout(() => el.classList.remove('rank-changed-highlight'), 1800);
                    });
                  }
                }
              });
            });
          }
        });
        dismissSplash();
      }
      State.isOffline = false;
    } catch (err) {
      if (fetchTimer) {
        clearTimeout(fetchTimer);
        fetchTimer = null;
      }
      console.warn('[Feed] Fetch failed, retaining last saved data:', err.message);
      // NEVER replace existing data with an error
      if (!State.data) {
        State.isOffline = true;
      }
      renderApp();
    } finally {
      isFetching = false;
    }
  }

  // Adaptive Polling: 25s when visible, 90s when hidden
  let pollingInterval = null;
  function schedulePolling() {
    if (pollingInterval) clearInterval(pollingInterval);
    const delay = (typeof document !== 'undefined' && document.visibilityState === 'visible') ? 25000 : 90000;
    pollingInterval = setInterval(() => {
      if (!navigator.onLine) return;
      fetchPublicFeed();
    }, delay);
  }
  schedulePolling();

  // Visibility & Connectivity Event Listeners
  window.addEventListener('visibilitychange', () => {
    schedulePolling();
    if (document.visibilityState === 'visible') {
      document.body.classList.remove('tab-hidden');
      if (navigator.onLine) fetchPublicFeed();
    } else {
      document.body.classList.add('tab-hidden');
    }
  });
  window.addEventListener('online', () => {
    State.isOffline = false;
    fetchPublicFeed();
  });
  window.addEventListener('offline', () => {
    State.isOffline = true;
    renderApp();
  });

  // Mobile pull-to-refresh
  let touchStartY = 0;
  let isPulling = false;
  window.addEventListener('touchstart', (e) => {
    if (window.scrollY === 0 && e.touches.length === 1) {
      touchStartY = e.touches[0].clientY;
      isPulling = true;
    } else {
      isPulling = false;
    }
  }, { passive: true });

  window.addEventListener('touchmove', (e) => {
    if (!isPulling) return;
    const currentY = e.touches[0].clientY;
    const diff = currentY - touchStartY;
    if (diff > 80 && window.scrollY === 0) {
      isPulling = false;
      fetchPublicFeed();
    }
  }, { passive: true });

  // Audio gesture unlock
  document.addEventListener('pointerdown', () => {
    SoundEngine.unlock();
  }, { once: true });

  // --- LUCIDE INLINE SVG SPRITE HELPER ---
  function renderIcon(name, extraClass = '') {
    return `<svg class="lucide-ic ${extraClass}" aria-hidden="true"><use href="#icon-${name}"></use></svg>`;
  }

  function getLucideSpriteSvg() {
    if (typeof document !== 'undefined' && document.getElementById('lucide-sprite')) {
      return '';
    }
    return `
      <svg width="0" height="0" style="position: absolute; width: 0; height: 0; overflow: hidden; pointer-events: none;" id="lucide-sprite" aria-hidden="true">
        <defs>
          <g id="icon-home"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></g>
          <g id="icon-trophy"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path><path d="M4 22h16"></path><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path></g>
          <g id="icon-medal"><circle cx="12" cy="8" r="6"></circle><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"></path></g>
          <g id="icon-calendar"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"></rect><line x1="16" x2="16" y1="2" y2="6"></line><line x1="8" x2="8" y1="2" y2="6"></line><line x1="3" x2="21" y1="10" y2="10"></line></g>
          <g id="icon-stopwatch"><circle cx="12" cy="14" r="8"></circle><line x1="12" y1="2" x2="12" y2="6"></line><line x1="10" y1="2" x2="14" y2="2"></line></g>
          <g id="icon-play"><polygon points="6 3 20 12 6 21 6 3"></polygon></g>
          <g id="icon-pause"><rect width="4" height="16" x="6" y="4"></rect><rect width="4" height="16" x="14" y="4"></rect></g>
          <g id="icon-volume-2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></g>
          <g id="icon-volume-x"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="22" x2="16" y1="9" y2="15"></line><line x1="16" x2="22" y1="9" y2="15"></line></g>
          <g id="icon-image"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"></rect><circle cx="9" cy="9" r="2"></circle><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"></path></g>
          <g id="icon-filter"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></g>
          <g id="icon-x"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></g>
          <g id="icon-download"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" x2="12" y1="15" y2="3"></line></g>
          <g id="icon-search"><circle cx="11" cy="11" r="8"></circle><line x1="21" x2="16.65" y1="21" y2="16.65"></line></g>
          <g id="icon-info"><circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4"></path><path d="M12 8h.01"></path></g>
          <g id="icon-bell"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"></path><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"></path></g>
          <g id="icon-sun"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2"></path><path d="M12 20v2"></path><path d="m4.93 4.93 1.41 1.41"></path><path d="m17.66 17.66 1.41 1.41"></path><path d="M2 12h2"></path><path d="M20 12h2"></path><path d="m6.34 17.66-1.41 1.41"></path><path d="m19.07 4.93-1.41 1.41"></path></g>
          <g id="icon-moon"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path></g>
          <g id="icon-star"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></g>
          <g id="icon-arrow-left"><line x1="19" x2="5" y1="12" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></g>
          <g id="icon-arrow-right"><line x1="5" x2="19" y1="12" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></g>
          <g id="icon-external-link"><path d="M15 3h6v6"></path><path d="M10 14 21 3"></path><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path></g>
          <g id="icon-chevron-left"><polyline points="15 18 9 12 15 6"></polyline></g>
          <g id="icon-chevron-right"><polyline points="9 18 15 12 9 6"></polyline></g>
          <g id="icon-check"><polyline points="20 6 9 17 4 12"></polyline></g>
          <g id="icon-clock"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></g>
          <g id="icon-git-branch"><line x1="6" x2="6" y1="3" y2="15"></line><circle cx="18" cy="6" r="3"></circle><circle cx="6" cy="18" r="3"></circle><path d="M18 9a9 9 0 0 1-9 9"></path></g>
        </defs>
      </svg>
    `;
  }

  // --- SCHOOL CREST RENDERER ---
  function renderSchoolCrest(school, sizeClass = 'c40') {
    if (!school) {
      return `
        <div class="shield-box ${sizeClass}">
          <div class="shield-fallback">LF</div>
        </div>
      `;
    }
    const crestUrl = getCrestUrl(school);
    const initials = (school.short_name || school.name || 'LF')
      .split(' ')
      .map(w => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();

    return `
      <div class="shield-box ${sizeClass}">
        <img 
          class="cr" 
          src="${crestUrl}" 
          alt="${school.short_name || school.name} Crest" 
          loading="lazy" 
          decoding="async"
          onerror="console.warn('Crest failed to load:', '${crestUrl}'); this.style.display='none'; this.nextElementSibling.style.display='flex';"
        >
        <div class="shield-fallback" style="display: none;">${initials}</div>
      </div>
    `;
  }

  // --- UNIFIED CHIP COMPONENT (Barlow SemiBold 13px, 28/32 heights, 48px hit areas) ---
  function renderChip({
    variant = 'status',
    label = '',
    status = 'upcoming',
    icon = null,
    compact = false,
    selected = false,
    count = null,
    school = null,
    tappable = false,
    extraClass = '',
    onClick = '',
    style = '',
    attrs = ''
  } = {}) {
    let classes = ['fiesta-chip', extraClass];
    if (compact) classes.push('compact');
    if (tappable) classes.push('tappable');

    let content = '';

    switch (variant) {
      case 'status': {
        const s = (status || label || '').toLowerCase();
        if (s === 'live') {
          classes.push('status-live');
          content = `<span class="live-dot-pulse"></span><span>${escapeHtml(label || 'LIVE').toUpperCase()}</span>`;
        } else if (s === 'completed' || s === 'done') {
          classes.push('status-done');
          content = `<span>${escapeHtml(label || 'DONE').toUpperCase()}</span>`;
        } else {
          classes.push('status-upcoming');
          content = `<span>${escapeHtml(label || 'UPCOMING').toUpperCase()}</span>`;
        }
        break;
      }
      case 'winner': {
        classes.push('chip-winner');
        const ic = icon ? renderIcon(icon, 'lucide-ic') : renderIcon('trophy', 'lucide-ic');
        content = `${ic}<span>${escapeHtml(label)}</span>`;
        break;
      }
      case 'win': {
        classes.push('chip-win-badge');
        content = `<span>WIN</span>`;
        break;
      }
      case 'loss': {
        classes.push('chip-loss-badge');
        content = `<span>LOSS</span>`;
        break;
      }
      case 'filter': {
        classes.push('chip-filter');
        if (selected) classes.push('selected');
        const ic = icon ? renderIcon(icon, 'lucide-ic') : '';
        content = `${ic}<span>${escapeHtml(label)}</span>`;
        break;
      }
      case 'category': {
        classes.push('chip-category');
        const ic = icon ? renderIcon(icon, 'lucide-ic') : '';
        content = `${ic}<span>${escapeHtml(label)}</span>`;
        break;
      }
      case 'school': {
        classes.push('chip-school');
        const sch = school || {};
        const isKasimabad = (sch.code === 'KSM') || (sch.short_name || '').toLowerCase().includes('kasimabad');
        if (isKasimabad) classes.push('school-kasimabad');
        const color = sch.color || sch.accent_color || '#2448FF';
        content = `<span class="fiesta-chip-bar" style="background: ${color};"></span><span>${escapeHtml(sch.short_name || label)}</span>`;
        break;
      }
      case 'count': {
        classes.push('chip-count');
        content = `<span>${escapeHtml(label)}</span><span class="count-bubble">${count != null ? count : ''}</span>`;
        break;
      }
      default: {
        const ic = icon ? renderIcon(icon, 'lucide-ic') : '';
        content = `${ic}<span>${escapeHtml(label)}</span>`;
      }
    }

    const clickAttr = onClick ? `onclick="${onClick}" role="button" tabindex="0"` : '';
    const styleAttr = style ? `style="${style}"` : '';

    return `<span class="${classes.filter(Boolean).join(' ')}" ${clickAttr} ${styleAttr} ${attrs}>${content}</span>`;
  }

  // --- CALM WARMING BANNER COMPONENT ---
  function renderWarmingBanner() {
    if (!State.isWarmingUp) return '';
    return `
      <div class="warming-banner row" style="align-items: center; justify-content: center; gap: 10px; padding: 10px 16px; background: rgba(36, 72, 255, 0.12); border-bottom: 1px solid var(--ln); color: var(--tx); font-size: 13px; font-weight: 700;">
        <span class="inline-spinner" style="width: 14px; height: 14px; border: 2px solid var(--pri); border-top-color: transparent; border-radius: 50%; display: inline-block; animation: spin 0.8s linear infinite;"></span>
        <span>Connecting to the live server, this can take up to a minute...</span>
      </div>
    `;
  }

  // --- ROUTING SYSTEM ---
  function parseHashRoute() {
    const raw = location.hash.slice(1) || 'home';
    const [pathPart, queryPart] = raw.split('?');
    const params = {};
    if (queryPart) {
      queryPart.split('&').forEach(pair => {
        const [k, v] = pair.split('=');
        if (k) params[decodeURIComponent(k)] = decodeURIComponent(v || '');
      });
    }
    return { route: pathPart || 'home', params };
  }

  function navigate(route, params = {}) {
    if (typeof route === 'string') {
      if (route.startsWith('#')) route = route.slice(1);
      if (route.startsWith('./#')) route = route.slice(3);
      if (route.startsWith('/#')) route = route.slice(2);
      if (route.includes('?')) {
        const [pathPart, queryPart] = route.split('?');
        route = pathPart;
        const parsed = { ...params };
        queryPart.split('&').forEach(pair => {
          const [k, v] = pair.split('=');
          if (k) parsed[decodeURIComponent(k)] = decodeURIComponent(v || '');
        });
        params = parsed;
      }
    }

    State.currentRoute = route || 'home';
    State.routeParams = params || {};

    // Single URL mode: Keep browser address bar strictly clean at / without hash slugging
    if (window.history && window.history.replaceState) {
      window.history.replaceState({ route: State.currentRoute, params: State.routeParams }, '', window.location.pathname || '/');
    }
    if (window.location.hash && window.history && window.history.replaceState) {
      window.history.replaceState({ route: State.currentRoute, params: State.routeParams }, '', window.location.pathname || '/');
    }

    transitionView(() => renderApp());
  }

  // --- THEME MANAGEMENT ---
  function isDarkMode() {
    const isSysDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    return State.theme === 'dark' || (State.theme === 'auto' && isSysDark);
  }

  function applyTheme(theme) {
    State.theme = theme;
    localStorage.setItem('fiesta_theme', theme);
    const isDark = isDarkMode();
    if (isDark) {
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.setAttribute('data-theme', 'light');
    }
  }

  function cycleTheme() {
    const next = State.theme === 'light' ? 'dark' : State.theme === 'dark' ? 'auto' : 'light';
    applyTheme(next);
    transitionView(() => renderApp());
  }

  // --- SECTION ERROR BOUNDARY HELPER ---
  function tryCatchSection(sectionName, renderFn) {
    try {
      return renderFn();
    } catch (err) {
      console.error(`[Fiesta Section Error] Failed rendering "${sectionName}":`, err);
      return `
        <section class="card col" style="gap: 8px; text-align: center; padding: 20px 16px; border: 1px dashed var(--bdr);">
          <div style="font-weight: 800; font-size: 14px; color: var(--tx);">Unable to load ${escapeHtml(sectionName)}</div>
          <div class="lab mut" style="font-size: 12px;">A temporary display issue occurred.</div>
          <button class="btn btn-secondary" onclick="window.App.retrySection()" style="margin: 6px auto 0; padding: 6px 14px; font-size: 12px;">Retry</button>
        </section>
      `;
    }
  }

  // --- SHARED APP BAR & TAB BAR ---
  function renderAppBar(title, opts = {}) {
    const dark = isDarkMode();
    const themeIcon = State.theme === 'dark' ? 'moon' : 'sun';
    const logoSrc = dark ? './assets/logo-dark.png' : './assets/logo-36.png';
    const unreadCount = State.notifications.filter(n => n.unread).length;

    return `
      <header class="bar" aria-label="Top Bar">
        <div style="display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1;">
          ${opts.backHref ? `
            <a href="javascript:void(0)" onclick="window.App.navigate('${opts.backHref.replace(/^#/, '')}')" class="notif-bell-btn" aria-label="Go back" style="display: grid; place-items: center; text-decoration: none; flex-shrink: 0;">
              ${renderIcon('arrow-left')}
            </a>
          ` : opts.showBackAction ? `
            <button type="button" class="notif-bell-btn" onclick="history.back()" aria-label="Go back" style="display: grid; place-items: center; flex-shrink: 0;">
              ${renderIcon('arrow-left')}
            </button>
          ` : `
            <a href="javascript:void(0)" class="topbar-logo-btn" aria-label="Home" onclick="window.App.navigate('home'); this.classList.remove('topbar-logo-pop'); void this.offsetWidth; this.classList.add('topbar-logo-pop');">
              <img 
                src="${logoSrc}" 
                alt="Fiesta Logo" 
                class="fiesta-logo"
                onerror="this.src='./fiesta.png'"
                style="width: 36px; height: 36px; border-radius: 50%; object-fit: contain; display: block;"
              >
            </a>
          `}
          <div style="display: flex; flex-direction: column; min-width: 0;">
            ${opts.breadcrumb 
              ? `<span class="lab mut" style="font-size: 11px; line-height: 1.2;">${escapeHtml(opts.breadcrumb)}</span>` 
              : (State.lastSavedTime 
                  ? `<span class="lab mut" style="font-size: 11px; line-height: 1.2;">Updated ${State.lastSavedTime}</span>` 
                  : '')}
            <h1 class="t" style="margin: 0; font-size: ${opts.breadcrumb || State.lastSavedTime ? '17px' : '19px'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              ${title || EVENT_CONFIG.title}
            </h1>
          </div>
        </div>

        <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
          <!-- Search Shortcut (48px Touch Target) -->
          <a href="javascript:void(0)" onclick="window.App.navigate('search')" class="theme-toggle-btn" aria-label="Search Fiesta" title="Search" style="display: grid; place-items: center; text-decoration: none;">
            ${renderIcon('search')}
          </a>

          <!-- Notification Center Bell (48px Touch Target) -->
          <button 
            type="button"
            class="notif-bell-btn" 
            onclick="window.App.toggleNotifSheet(true)" 
            aria-label="Open Notifications Center" 
            title="Notifications"
          >
            ${renderIcon('bell')}
            ${unreadCount > 0 ? `<span class="notif-badge-dot"></span>` : ''}
          </button>

          <!-- Theme Toggle (48px Touch Target) -->
          <button 
            type="button"
            class="theme-toggle-btn" 
            onclick="window.App.cycleTheme()" 
            aria-label="Toggle Light Dark Theme" 
            title="Current theme: ${State.theme}"
          >
            ${renderIcon(themeIcon)}
          </button>
        </div>
      </header>
    `;
  }

  function renderTabBar() {
    const r = State.currentRoute;
    const isHome = r === 'home';
    const isScores = r === 'scores' || r === 'schools' || r === 'school' || r === 'schoolDetail';
    const isLive = r === 'live';
    const isFixtures = r === 'fixtures' || r === 'match' || r === 'matchDetail';
    const isPhotos = r === 'photos' || r === 'photo' || r === 'photoViewer';

    const isLiveActive = Boolean(
      State.data?.fixtures?.some(f => f.status === 'Live') ||
      State.data?.display_state?.is_live ||
      State.data?.display_state?.ticker_live ||
      State.data?.live_snapshot?.is_live
    );

    return `
      <nav class="bnav" aria-label="Bottom Navigation">
        <!-- 1. Home -->
        <a href="javascript:void(0)" class="bnav-btn ${isHome ? 'on' : ''}" aria-label="Home" onclick="window.App.navigate('home'); window.scrollTo({top:0,behavior:'smooth'});">
          ${renderIcon('home')}
          <span>Home</span>
        </a>
        <!-- 2. Scores -->
        <a href="javascript:void(0)" class="bnav-btn ${isScores ? 'on' : ''}" aria-label="Scores and Standings" onclick="window.App.navigate('scores', {mode:'points'}); window.scrollTo({top:0,behavior:'smooth'});">
          ${renderIcon('trophy')}
          <span>Scores</span>
        </a>
        <!-- 3. Live (Raised Centre Button) -->
        <a href="javascript:void(0)" class="bnav-btn bnav-btn-live ${isLive ? 'on' : ''}" aria-label="Live Stream and Arena" onclick="window.App.navigate('live', {tab:'now'}); window.scrollTo({top:0,behavior:'smooth'});">
          <div class="bnav-btn-live-raised" style="position: relative;">
            ${renderIcon('play')}
            ${isLiveActive ? '<span class="pdot"></span><span class="live-ring-pulse" aria-hidden="true"></span>' : ''}
          </div>
          <span>Live</span>
        </a>
        <!-- 4. Fixtures -->
        <a href="javascript:void(0)" class="bnav-btn ${isFixtures ? 'on' : ''}" aria-label="Schedule and Fixtures" onclick="window.App.navigate('fixtures', {day:'13'}); window.scrollTo({top:0,behavior:'smooth'});">
          ${renderIcon('calendar')}
          <span>Fixtures</span>
        </a>
        <!-- 5. Photos -->
        <a href="javascript:void(0)" class="bnav-btn ${isPhotos ? 'on' : ''}" aria-label="Event Photos" onclick="window.App.navigate('photos'); window.scrollTo({top:0,behavior:'smooth'});">
          ${renderIcon('image')}
          <span>Photos</span>
        </a>
      </nav>
    `;
  }

  function renderOfflineBanner() {
    if (!State.isOffline && !State.lastSavedTime) return '';
    if (!State.isOffline) return '';
    return `
      <div class="offline-banner" role="status">
        ${renderIcon('info', 'lucide-ic')}
        <span>Offline — Showing saved data from ${State.lastSavedTime || 'earlier today'}</span>
      </div>
    `;
  }

  // --- SCREEN 1: HOME SCREEN ---
  function renderHomePodiumLeaderboard(schools) {
    if (!schools || schools.length === 0) {
      return `
        <div class="card" style="text-align: center; padding: 24px 16px;">
          <div class="lab mut">School points and standings will appear here once events conclude.</div>
        </div>
      `;
    }

    const s1 = schools[0];
    const s2 = schools[1];
    const s3 = schools[2];
    const remainder = schools.slice(3, 6);

    let html = `
      <section class="col" style="gap: 12px; width: 100%;">
        <div class="row sb" style="align-items: baseline;">
          <span class="ttab">School Leaderboard</span>
          <a href="javascript:void(0)" onclick="window.App.navigate('scores', {mode:'points'})" class="link-accent lab">View all &rarr;</a>
        </div>
    `;

    if (schools.length >= 3) {
      html += `
        <div class="home-podium">
          <!-- Rank 2: Silver -->
          <a href="javascript:void(0)" onclick="window.App.navigate('school', {id:'${s2.id}'})" class="home-podium-col rank-2" data-school-id="${s2.id}" aria-label="Rank 2: ${escapeHtml(s2.short_name)}" style="text-decoration: none; color: inherit;">
            ${renderSchoolCrest(s2, 'c56')}
            <div style="font-weight: 700; font-size: 13px; margin-top: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;">
              ${s2.short_name}
            </div>
            <div class="home-podium-pedestal">
              <span class="rk r2" style="font-size: 15px; width: 28px; height: 28px;">2</span>
              <span class="num" style="font-size: 16px; font-weight: 800; margin-top: 2px;">${s2.points}</span>
              <span class="lab" style="font-size: 10px; color: var(--mut); font-weight: 700;">PTS</span>
            </div>
          </a>

          <!-- Rank 1: Gold Center -->
          <a href="javascript:void(0)" onclick="window.App.navigate('school', {id:'${s1.id}'})" class="home-podium-col rank-1" data-school-id="${s1.id}" aria-label="Rank 1: ${escapeHtml(s1.short_name)}" style="text-decoration: none; color: inherit;">
            <div class="gold-shine" style="border-radius: 50%; padding: 4px; display: inline-flex;">
              ${renderSchoolCrest(s1, 'c72')}
            </div>
            <div style="font-weight: 800; font-size: 14px; margin-top: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; color: var(--tx);">
              ${s1.short_name}
            </div>
            <div class="home-podium-pedestal gold-shine">
              <span class="rk r1" style="font-size: 17px; width: 32px; height: 32px;">1</span>
              <span class="num" style="font-size: 19px; font-weight: 800; margin-top: 2px; color: var(--tx);">${s1.points}</span>
              <span class="lab" style="font-size: 10px; color: var(--gold); font-weight: 800;">PTS</span>
            </div>
          </a>

          <!-- Rank 3: Bronze -->
          <a href="javascript:void(0)" onclick="window.App.navigate('school', {id:'${s3.id}'})" class="home-podium-col rank-3" data-school-id="${s3.id}" aria-label="Rank 3: ${escapeHtml(s3.short_name)}" style="text-decoration: none; color: inherit;">
            ${renderSchoolCrest(s3, 'c56')}
            <div style="font-weight: 700; font-size: 13px; margin-top: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;">
              ${s3.short_name}
            </div>
            <div class="home-podium-pedestal">
              <span class="rk r3" style="font-size: 15px; width: 28px; height: 28px;">3</span>
              <span class="num" style="font-size: 16px; font-weight: 800; margin-top: 2px;">${s3.points}</span>
              <span class="lab" style="font-size: 10px; color: var(--mut); font-weight: 700;">PTS</span>
            </div>
          </a>
        </div>
      `;
    }

    if (remainder.length > 0) {
      html += `
        <div class="col" style="gap: 8px; width: 100%;">
          ${remainder.map((s, idx) => `
            <a href="javascript:void(0)" onclick="window.App.navigate('school', {id:'${s.id}'})" class="srow" data-school-id="${s.id}" style="--acc: ${s.accent_color};" aria-label="Rank ${idx + 4}: ${escapeHtml(s.short_name)}">
              <span class="rk r${idx + 4}">${idx + 4}</span>
              ${renderSchoolCrest(s, 'c40')}
              <div class="fl" style="min-width: 0;">
                <div style="font-weight: 700; font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${s.short_name}</div>
                <div class="med">
                  <span class="med"><b class="g"></b>${s.medals?.first || 0}</span>
                  <span class="med"><b class="s"></b>${s.medals?.second || 0}</span>
                  <span class="med"><b class="z"></b>${s.medals?.third || 0}</span>
                </div>
              </div>
              <span class="pts num">${s.points}</span>
            </a>
          `).join('')}
        </div>
      `;
    }

    html += `</section>`;
    return html;
  }

  function renderHomePhotoCarousel(feed) {
    const albums = deriveAlbums(feed.media, feed);
    if (!albums || albums.length === 0) return '';
    const photos = albums[0]?.items || [];
    if (photos.length === 0) return '';

    return `
      <section class="col" style="gap: 8px; width: 100%;">
        <div class="row sb" style="align-items: baseline;">
          <span class="ttab">Fiesta Moments</span>
          <a href="#photos" class="link-accent lab">All photos &rarr;</a>
        </div>
        <div class="photo-carousel" style="display: flex; gap: 12px; overflow-x: auto; scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch; padding-bottom: 6px;">
          ${photos.slice(0, 6).map(p => `
            <a href="#photos" class="col" style="flex: 0 0 240px; scroll-snap-align: start; border-radius: 14px; overflow: hidden; background: var(--alt); position: relative; text-decoration: none; box-shadow: var(--card-shadow); border: 1px solid var(--ln);">
              <div style="width: 100%; aspect-ratio: 16/10; overflow: hidden; background: #000;">
                <img src="${p.file_url || p.url}" alt="${escapeHtml(p.caption || 'Event photo')}" loading="lazy" style="width: 100%; height: 100%; object-fit: cover;">
              </div>
              ${p.caption ? `
                <div style="padding: 8px 10px; font-size: 12px; font-weight: 700; color: var(--tx); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                  ${escapeHtml(p.caption)}
                </div>
              ` : ''}
            </a>
          `).join('')}
        </div>
      </section>
    `;
  }

  function renderHomeScreen() {
    const feed = State.data || SCAFFOLD_FEED;
    const schools = feed.schools || [];
    const results = feed.results || [];
    const events = feed.events || [];
    const fixtures = feed.fixtures || [];
    const announcements = feed.announcements || [];

    const completedResults = results.filter(r => {
      if (!r) return false;
      const s = (r.status || '').toLowerCase();
      const isApproved = s === 'approved' || s === 'completed';
      const hasWinner = !!(r.first_place_school_id || r.first_school_id || (r.places && r.places.some(p => p.rank === 1)));
      return isApproved && hasWinner;
    });
    const topResult = completedResults[0];
    const ev = topResult ? events.find(e => e.id === topResult.event_id) : null;
    let winSchool = null;
    let p1Points = 20;
    let p1Athlete = '';
    if (topResult) {
      const winnerId = topResult.first_place_school_id || topResult.first_school_id || (topResult.places && topResult.places.find(p => p.rank === 1)?.school_id);
      winSchool = winnerId ? schools.find(s => s.id === winnerId) : null;
      p1Points = topResult.first_place_points || topResult.points_first || 20;
      p1Athlete = topResult.first_place_athlete || topResult.athlete_first || '';
    }
    const hasApprovedWinner = Boolean(topResult && winSchool);

    const activeAnnouncements = announcements.filter(a => {
      if (!a || !a.message) return false;
      if (a.active === false) return false;
      if (a.expires_at && new Date(a.expires_at).getTime() < Date.now()) return false;
      const msg = a.message.toLowerCase();
      if (msg.includes('probe') || msg.includes('safe to ignore') || msg.includes('dummy') || msg.includes('test message')) return false;
      return true;
    });

    return `
      <div class="app" style="padding-bottom: 84px;">
        ${renderAppBar(EVENT_CONFIG.title)}
        ${renderWarmingBanner()}
        ${renderOfflineBanner()}

        ${activeAnnouncements.length > 0 ? `
          <div style="background: var(--alt); border-bottom: 1px solid var(--ln); padding: 8px 16px; display: flex; align-items: center; gap: 10px; overflow: hidden;">
            <span class="st lv" style="font-size: 11px; padding: 2px 8px; flex: none;">ALERT</span>
            <div style="flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 13px; font-weight: 700; color: var(--tx);">
              ${activeAnnouncements.map(a => escapeHtml(a.message)).join('  •  ')}
            </div>
          </div>
        ` : ''}

        <div class="main">
          ${hasApprovedWinner ? `
            <!-- Hero Section: Recent Result -->
            <div class="hero vt-hero" style="background: linear-gradient(135deg, var(--deep), #1e3a8a);">
              <div class="row sb">
                <span class="ttab" style="background: var(--gold); color: var(--ink);">Recent Result</span>
                <span class="lab" style="color: var(--glacier); font-weight: 700;">Completed</span>
              </div>
              <div class="dsp h-title" style="margin: 0; font-size: 26px;">${escapeHtml(ev?.name || 'Athletics Event')}</div>
              <div class="lab" style="color: var(--glacier);">${escapeHtml(ev?.category || 'Sub-Junior')} · ${escapeHtml(ev?.gender || 'Boys')}</div>

              <div class="row gold-shine" style="gap: 14px; background: rgba(0,0,0,0.25); padding: 12px 16px; border-radius: 14px; margin-top: 2px;">
                <span class="rk r1" style="width: 36px; height: 36px; font-size: 20px;">1</span>
                ${renderSchoolCrest(winSchool, 'c40')}
                <div class="fl" style="min-width: 0;">
                  <div style="font-weight: 800; font-size: 16px; color: #FFFFFF;">${winSchool.short_name}</div>
                  <div class="lab" style="color: var(--gold); font-size: 12px;">Winner · +${p1Points} pts${p1Athlete ? ` · ${escapeHtml(p1Athlete)}` : ''}</div>
                </div>
              </div>

              <div class="row" style="gap: 10px; margin-top: 4px;">
                <a href="#scores?mode=points" class="btn on-hero" style="min-height: 40px; padding: 0 16px; font-size: 14px;">View Points Table</a>
              </div>
            </div>
          ` : `
            <!-- Hero Section: Welcome & Intro (No phantom result) -->
            <div class="hero vt-hero" style="background: linear-gradient(135deg, var(--deep), #1e3a8a);">
              <div class="row sb">
                <span class="ttab" style="background: var(--gold); color: var(--ink);">LFGOS Sports Fiesta 2026</span>
                <span class="lab" style="color: var(--glacier); font-weight: 700;">13 & 14 Nov 2026</span>
              </div>
              <div class="dsp h-title" style="margin: 0; font-size: 26px;">PLAY • COMPETE • ACHIEVE</div>
              <div class="lab" style="color: var(--glacier); font-weight: 600;">Sports Fiesta 2026</div>

              <div class="row" style="gap: 10px; margin-top: 6px;">
                <a href="javascript:void(0)" onclick="window.App.navigate('scores', {mode:'points'})" class="btn on-hero" style="min-height: 40px; padding: 0 16px; font-size: 14px;">School Standings</a>
                <a href="javascript:void(0)" onclick="window.App.navigate('fixtures', {day:'13'})" class="btn on-hero" style="min-height: 40px; padding: 0 16px; font-size: 14px; background: rgba(255,255,255,0.15);">Event Schedule</a>
              </div>
            </div>
          `}

          <!-- Podium Leaderboard (Top 3 on Podium, Ranks 4-6 in Rows) -->
          ${tryCatchSection('School Leaderboard', () => renderHomePodiumLeaderboard(schools))}

          <!-- Confirmed Fixtures (Now and Next) -->
          ${tryCatchSection('Now and Next', () => `
            <section class="col" style="gap: 8px; width: 100%;">
              <div class="row sb" style="align-items: baseline;">
                <span class="ttab">Now and Next</span>
                <a href="javascript:void(0)" onclick="window.App.navigate('fixtures')" class="link-accent lab">All fixtures &rarr;</a>
              </div>
              ${fixtures.length === 0 ? `
                <div class="card" style="text-align: center; padding: 24px 16px;">
                  <div class="lab mut">Fixtures appear here once teams are confirmed.</div>
                </div>
              ` : fixtures.slice(0, 3).map(f => {
                const comp = feed.competitions?.find(c => c.id === f.competition_id);
                const sA = schools.find(s => s.id === f.school_a_id);
                const sB = schools.find(s => s.id === f.school_b_id);
                return `
                  <a href="javascript:void(0)" onclick="window.App.navigate('match', {id:'${f.id}'})" class="card col" style="gap: 8px; text-decoration: none; color: inherit;">
                    <div class="row sb">
                      <span class="lab mut">${escapeHtml(comp?.name || 'Match')} · ${escapeHtml(f.round || '')}</span>
                      <span class="${f.status === 'Completed' ? 'st done' : f.status === 'Live' ? 'badge-live-pulse' : 'st'}">
                        ${f.status === 'Live' ? '<i></i> LIVE' : escapeHtml(f.status || 'Scheduled')}
                      </span>
                    </div>
                    <div class="row sb" style="align-items: center;">
                      <div class="row" style="gap: 8px; min-width: 0; flex: 1;">
                        ${renderSchoolCrest(sA, 'c32')}
                        <span style="font-weight: 700; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${sA?.short_name || 'Team A'}</span>
                      </div>
                      <span class="lab mut" style="padding: 0 8px; font-weight: 800;">VS</span>
                      <div class="row" style="gap: 8px; min-width: 0; flex: 1; justify-content: flex-end;">
                        <span style="font-weight: 700; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${sB?.short_name || 'Team B'}</span>
                        ${renderSchoolCrest(sB, 'c32')}
                      </div>
                    </div>
                    <div class="lab mut" style="font-size: 12px;">${escapeHtml(f.time || '')} · ${escapeHtml(f.ground || EVENT_CONFIG.venue)}</div>
                  </a>
                `;
              }).join('')}
            </section>
          `)}

          <!-- Photo Carousel (Only when valid photos exist) -->
          ${tryCatchSection('Fiesta Moments', () => renderHomePhotoCarousel(feed))}

          <!-- Quick Links (3x2 Grid) -->
          ${tryCatchSection('Quick Links', () => `
            <section class="col" style="gap: 8px; width: 100%;">
              <span class="ttab">Quick Links</span>
              <div class="g3">
                <a href="javascript:void(0)" onclick="window.App.navigate('scores')" class="tile">
                  <span class="ico">${renderIcon('trophy')}</span>
                  <span>Scores</span>
                </a>
                <a href="javascript:void(0)" onclick="window.App.navigate('fixtures')" class="tile">
                  <span class="ico">${renderIcon('calendar')}</span>
                  <span>Fixtures</span>
                </a>
                <a href="javascript:void(0)" onclick="window.App.navigate('games')" class="tile">
                  <span class="ico">${renderIcon('medal')}</span>
                  <span>Games</span>
                </a>
                <a href="javascript:void(0)" onclick="window.App.navigate('photos')" class="tile">
                  <span class="ico">${renderIcon('image')}</span>
                  <span>Photos</span>
                </a>
                <a href="javascript:void(0)" onclick="window.App.navigate('search')" class="tile">
                  <span class="ico">${renderIcon('search')}</span>
                  <span>Search</span>
                </a>
                <a href="javascript:void(0)" onclick="window.App.navigate('info')" class="tile">
                  <span class="ico">${renderIcon('info')}</span>
                  <span>Event Info</span>
                </a>
              </div>
            </section>
          `)}
        </div>

        ${renderTabBar()}
      </div>
    `;
  }

  // --- SCREEN 2: SCORES (POINTS TABLE vs MEDAL TALLY) ---
  function getSchoolPointsBreakdown(school, feed) {
    let trackPts = 0;
    let indivPts = 0;
    let teamPts = 0;

    (feed.results || []).forEach(r => {
      const p = r.places?.find(pl => pl.school_id === school.id);
      if (p) {
        const ev = feed.events?.find(e => e.id === r.event_id);
        const name = (ev?.name || '').toLowerCase();
        const pts = p.points || 0;
        if (name.includes('race') || name.includes('sprint') || name.includes('relay') || name.includes('m ')) {
          trackPts += pts;
        } else if (name.includes('jump') || name.includes('put') || name.includes('throw') || name.includes('disc')) {
          indivPts += pts;
        } else {
          teamPts += pts;
        }
      }
    });

    const total = school.points || 0;
    if (total === 0) {
      return { track: 0, indiv: 0, team: 0, trackPct: 33, indivPct: 33, teamPct: 34 };
    }
    const sum = trackPts + indivPts + teamPts;
    if (sum === 0) {
      return { track: total, indiv: 0, team: 0, trackPct: 100, indivPct: 0, teamPct: 0 };
    }
    return {
      track: trackPts,
      indiv: indivPts,
      team: teamPts,
      trackPct: Math.round((trackPts / sum) * 100),
      indivPct: Math.round((indivPts / sum) * 100),
      teamPct: Math.round((teamPts / sum) * 100)
    };
  }

  function renderScoresScreen() {
    const feed = State.data || {};
    const schools = feed.schools || [];
    const mode = State.routeParams.mode || 'points';

    const sortedSchools = [...schools].sort((a, b) => {
      if (mode === 'medals') {
        const gDiff = (b.medals?.first || 0) - (a.medals?.first || 0);
        if (gDiff !== 0) return gDiff;
        const sDiff = (b.medals?.second || 0) - (a.medals?.second || 0);
        if (sDiff !== 0) return sDiff;
        const zDiff = (b.medals?.third || 0) - (a.medals?.third || 0);
        if (zDiff !== 0) return zDiff;
        const bTot = (b.medals?.first || 0) + (b.medals?.second || 0) + (b.medals?.third || 0);
        const aTot = (a.medals?.first || 0) + (a.medals?.second || 0) + (a.medals?.third || 0);
        if (bTot !== aTot) return bTot - aTot;
        return (b.points || 0) - (a.points || 0) || (b.matches_won || 0) - (a.matches_won || 0) || (a.seed || 0) - (b.seed || 0);
      } else {
        const pDiff = (b.points || 0) - (a.points || 0);
        if (pDiff !== 0) return pDiff;
        const gDiff = (b.medals?.first || 0) - (a.medals?.first || 0);
        if (gDiff !== 0) return gDiff;
        const sDiff = (b.medals?.second || 0) - (a.medals?.second || 0);
        if (sDiff !== 0) return sDiff;
        const zDiff = (b.medals?.third || 0) - (a.medals?.third || 0);
        if (zDiff !== 0) return zDiff;
        return (b.matches_won || 0) - (a.matches_won || 0) || (a.seed || 0) - (b.seed || 0);
      }
    });

    return `
      <div class="app" style="padding-bottom: 84px;">
        ${renderAppBar('Tournament Scores')}
        ${renderOfflineBanner()}

        <div class="main">
          <!-- 48px Segmented Switch -->
          <div class="seg-48" role="tablist" aria-label="Scores Mode">
            <a 
              href="#scores?mode=points" 
              class="${mode === 'points' ? 'on' : ''}" 
              role="tab" 
              aria-selected="${mode === 'points'}"
            >
              Points Table
            </a>
            <a 
              href="#scores?mode=medals" 
              class="${mode === 'medals' ? 'on' : ''}" 
              role="tab" 
              aria-selected="${mode === 'medals'}"
            >
              Medal Tally
            </a>
          </div>

          <div class="mode-explanation">
            ${mode === 'points' 
              ? 'Ranked by total points (tie-breakers: Gold &rarr; Silver &rarr; Bronze &rarr; Matches Won)' 
              : 'Ranked by Gold, then Silver, then Bronze (tie-breakers: Total Medals &rarr; Points)'}
          </div>

          <!-- School Cards List -->
          <div class="col" style="gap: 12px;" id="scores-card-list">
            ${sortedSchools.map((s, idx) => {
              const breakdown = getSchoolPointsBreakdown(s, feed);
              const totalMedals = (s.medals?.first || 0) + (s.medals?.second || 0) + (s.medals?.third || 0);

              if (mode === 'points') {
                return `
                  <a href="#schoolDetail?id=${s.id}" class="card col flip-card" data-school-id="${s.id}" style="gap: 10px;">
                    <div class="row sb" style="gap: 12px;">
                      <div class="row" style="gap: 12px; flex: 1; min-width: 0;">
                        <span class="rk r${idx + 1}" style="width: 32px; height: 32px; font-size: 16px;">${idx + 1}</span>
                        ${renderSchoolCrest(s, 'c48')}
                        <div class="fl">
                          <div style="font-weight: 800; font-size: 16px; color: var(--tx);">${s.short_name}</div>
                          <div class="row" style="gap: 6px; margin-top: 3px;">
                            <span class="matches-won-chip">★ ${s.matches_won || 0} won</span>
                            <span class="lab mut" style="font-size: 11px;">${totalMedals} medals</span>
                          </div>
                        </div>
                      </div>
                      
                      <div style="text-align: right; flex-shrink: 0;">
                        <div class="pts num" style="color: var(--pri); font-size: 32px;">${s.points}</div>
                        <div class="lab mut" style="font-size: 11px;">TOTAL PTS</div>
                      </div>
                    </div>

                    <div class="stacked-bar-container">
                      <div class="stacked-bar">
                        <div class="stacked-bar-seg seg-track" style="width: ${breakdown.trackPct}%;"></div>
                        <div class="stacked-bar-seg seg-indiv" style="width: ${breakdown.indivPct}%;"></div>
                        <div class="stacked-bar-seg seg-team" style="width: ${breakdown.teamPct}%;"></div>
                      </div>
                      <div class="stacked-bar-legend">
                        <span><i class="legend-dot seg-track"></i> Track</span>
                        <span><i class="legend-dot seg-indiv"></i> Field</span>
                        <span><i class="legend-dot seg-team"></i> Team</span>
                      </div>
                    </div>
                  </a>
                `;
              } else {
                return `
                  <a href="#schoolDetail?id=${s.id}" class="card col flip-card" data-school-id="${s.id}" style="gap: 12px;">
                    <div class="row sb" style="gap: 12px;">
                      <div class="row" style="gap: 12px; flex: 1; min-width: 0;">
                        <span class="rk r${idx + 1}" style="width: 32px; height: 32px; font-size: 16px;">${idx + 1}</span>
                        ${renderSchoolCrest(s, 'c48')}
                        <div class="fl">
                          <div style="font-weight: 800; font-size: 16px; color: var(--tx);">${s.short_name}</div>
                          <div class="row" style="gap: 6px; margin-top: 2px;">
                            <span class="matches-won-chip">★ ${s.matches_won || 0} won</span>
                            <span class="lab mut" style="font-size: 12px; font-weight: 700; color: var(--pri);">${s.points} pts</span>
                          </div>
                        </div>
                      </div>

                      <div style="text-align: right; flex-shrink: 0;">
                        <div class="pts num" style="color: var(--gold); font-size: 28px;">${totalMedals}</div>
                        <div class="lab mut" style="font-size: 10px;">TOTAL MEDALS</div>
                      </div>
                    </div>

                    <div class="medal-cells">
                      <div class="medal-cell gold-cell">
                        <span class="m-count num" style="color: var(--gold);">${s.medals?.first || 0}</span>
                        <span class="m-label">🥇 Gold</span>
                      </div>
                      <div class="medal-cell silver-cell">
                        <span class="m-count num" style="color: var(--silver);">${s.medals?.second || 0}</span>
                        <span class="m-label">🥈 Silver</span>
                      </div>
                      <div class="medal-cell bronze-cell">
                        <span class="m-count num" style="color: var(--bronze);">${s.medals?.third || 0}</span>
                        <span class="m-label">🥉 Bronze</span>
                      </div>
                    </div>
                  </a>
                `;
              }
            }).join('')}
          </div>
        </div>

        ${renderTabBar()}
      </div>
    `;
  }

  // --- SCREEN 3: LIVE ARENA (CUSTOM PLYR + SCOREBOARD) ---
  function isLiveNow() {
    const today = new Date().toISOString().slice(0, 10);
    const isNov14 = today === '2026-11-14';
    const stream = State.data?.stream;
    return isNov14 && stream && stream.state === 'live';
  }

  function renderLiveScreen() {
    const feed = State.data || {};
    const stream = feed.stream || {};
    const schools = feed.schools || [];
    const events = feed.events || [];
    const fixtures = feed.fixtures || [];
    const isLive = isLiveNow();
    const today = new Date().toISOString().slice(0, 10);
    const isNov13 = today === '2026-11-13';

    const liveEvent = events.find(e => e.status === 'Live') || events.find(e => e.status === 'Scheduled') || events[0];
    const teamFixture = fixtures.find(f => f.status === 'Live') || fixtures.find(f => f.status === 'Scheduled') || fixtures[0];
    const sA = teamFixture ? schools.find(s => s.id === teamFixture.school_a_id) : null;
    const sB = teamFixture ? schools.find(s => s.id === teamFixture.school_b_id) : null;

    const subTab = State.liveSubTab || 'now';

    setTimeout(() => {
      loadPlyrPlayer();
    }, 100);

    return `
      <div class="app" style="padding-bottom: 84px;">
        ${renderAppBar('Official Live Arena')}
        ${renderOfflineBanner()}

        <div class="main">
          <!-- STICKY 16:9 PLYR PLAYER -->
          <div class="live-player-sticky" id="live-player-container">
            ${isLive ? `
              <div id="live-plyr-target" data-plyr-provider="youtube" data-plyr-embed-id="${stream.youtube_id || 'jfKfPfyJRdk'}"></div>
            ` : `
              <div style="width: 100%; height: 100%; position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; background: radial-gradient(circle at center, #1746A2 0%, #080F2B 100%); padding: 20px; text-align: center; color: #FFFFFF;">
                <img src="./assets/logo.png" alt="Fiesta" style="width: 72px; height: 72px; object-fit: contain; margin-bottom: 8px;">
                <div class="badge-live-pulse" style="margin-bottom: 8px;">
                  <i></i> ${isNov13 ? '13 NOV • CRICKET DAY 1' : 'STARTS 14 NOV 2026'}
                </div>
                <div class="dsp" style="font-size: 22px; margin: 0; color: #FFFFFF;">Live Stream Starts on 14 Nov 2026</div>
                <div class="lab" style="color: #FFFFFF; font-size: 13px; margin-top: 4px; opacity: 0.95;">09:00 AM IST • Sports Fiesta Live Stream</div>
                ${stream.fallback_url ? `
                  <a href="${stream.fallback_url}" target="_blank" rel="noopener noreferrer" class="link-accent lab" style="margin-top: 10px; color: #FFE082; font-weight: 700;">
                    Watch on YouTube &nearr;
                  </a>
                ` : ''}
              </div>
            `}
          </div>

          <!-- Sub Tabs: Now | Medal table | Schedule -->
          <div class="seg-48" style="margin-bottom: 12px;" role="tablist">
            <a href="#live?tab=now" class="${subTab === 'now' ? 'on' : ''}" role="tab" aria-selected="${subTab === 'now'}">Now Playing</a>
            <a href="#live?tab=medals" class="${subTab === 'medals' ? 'on' : ''}" role="tab" aria-selected="${subTab === 'medals'}">Medal Table</a>
            <a href="#live?tab=schedule" class="${subTab === 'schedule' ? 'on' : ''}" role="tab" aria-selected="${subTab === 'schedule'}">Schedule</a>
          </div>

          ${subTab === 'now' ? `
            <!-- NOW PLAYING CARD -->
            <a href="#game?event=${liveEvent?.id || ''}&cat=${encodeURIComponent(liveEvent?.category || '')}&gender=${encodeURIComponent(liveEvent?.gender || '')}" class="card col" style="gap: 12px; text-decoration: none; color: inherit;">
              <div class="row sb">
                <span class="ttab">${isLive ? 'Currently Active Event' : 'Up Next'}</span>
                <span class="${isLive ? 'badge-live-pulse' : 'st'}">${isLive ? '<i></i> LIVE' : 'Scheduled'}</span>
              </div>
              
              <div class="dsp h-title" style="margin: 0; font-size: 24px;">
                ${liveEvent?.name || 'Grand Championship Athletics'}
              </div>
              <div class="lab" style="color: var(--mut); font-size: 14px;">
                ${liveEvent?.category || 'Senior'} · ${liveEvent?.gender || 'Boys'} · Starts ${liveEvent?.time || '09:30 AM'}
              </div>
              <div class="lab mut" style="font-size: 13px;">
                ${EVENT_CONFIG.venue}
              </div>

              ${teamFixture && sA && sB ? `
                <div style="background: var(--alt); border-radius: 14px; padding: 12px; margin-top: 4px;">
                  <div class="row sb">
                    <div class="row" style="gap: 8px;">
                      ${renderSchoolCrest(sA, 'c32')}
                      <span style="font-weight: 700;">${sA.short_name}</span>
                    </div>
                    <span class="dsp num" style="font-size: 20px; color: var(--mut);">VS</span>
                    <div class="row" style="gap: 8px;">
                      <span style="font-weight: 700;">${sB.short_name}</span>
                      ${renderSchoolCrest(sB, 'c32')}
                    </div>
                  </div>
                </div>
              ` : ''}
            </a>

            <!-- CURRENT POINTS LIVE LEADERBOARD -->
            <section class="col" style="gap: 8px; margin-top: 4px;">
              <div class="row sb">
                <span class="ttab">Live Points Standing</span>
                <a href="#scores?mode=points" class="link-accent lab">Full table &rarr;</a>
              </div>
              ${schools.map((s, idx) => `
                <div class="srow" style="--acc: ${s.accent_color};">
                  <span class="rk r${idx + 1}">${idx + 1}</span>
                  ${renderSchoolCrest(s, 'c32')}
                  <div class="fl">
                    <div style="font-weight: 700; font-size: 15px;">${s.short_name}</div>
                    <div class="med">
                      <span class="med"><b class="g"></b>${s.medals?.first || 0}</span>
                      <span class="med"><b class="s"></b>${s.medals?.second || 0}</span>
                      <span class="med"><b class="z"></b>${s.medals?.third || 0}</span>
                    </div>
                  </div>
                  <span class="pts num" style="font-size: 24px;">${s.points}</span>
                </div>
              `).join('')}
            </section>
          ` : subTab === 'medals' ? `
            <div class="col" style="gap: 12px;">
              ${schools.map((s, idx) => `
                <div class="card row sb" style="gap: 12px;">
                  <div class="row" style="gap: 12px; flex: 1; min-width: 0;">
                    <span class="rk r${idx + 1}">${idx + 1}</span>
                    ${renderSchoolCrest(s, 'c40')}
                    <div class="fl">
                      <div style="font-weight: 800; font-size: 15px;">${s.short_name}</div>
                      <div class="row" style="gap: 6px; margin-top: 2px;">
                        <span class="matches-won-chip">★ ${s.matches_won || 0} won</span>
                        <span class="lab mut">${s.points} pts</span>
                      </div>
                    </div>
                  </div>
                  <div class="row" style="gap: 8px;">
                    <span class="med"><b class="g"></b>${s.medals?.first || 0}</span>
                    <span class="med"><b class="s"></b>${s.medals?.second || 0}</span>
                    <span class="med"><b class="z"></b>${s.medals?.third || 0}</span>
                  </div>
                </div>
              `).join('')}
            </div>
          ` : `
            <div class="col" style="gap: 10px;">
              ${events.slice(0, 10).map(e => `
                <div class="card row sb">
                  <div>
                    <div style="font-weight: 700; font-size: 15px;">${e.name}</div>
                    <div class="lab mut">${e.category || ''} · ${e.gender || ''} · ${e.time || '09:00 AM'}</div>
                  </div>
                  <span class="${e.status === 'Completed' ? 'st done' : 'st'}">${e.status}</span>
                </div>
              `).join('')}
            </div>
          `}
        </div>

        ${renderTabBar()}
      </div>
    `;
  }

  function loadPlyrPlayer() {
    if (State.plyrLoaded) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = './vendor/plyr.css';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = './vendor/plyr.js';
    script.onload = () => {
      State.plyrLoaded = true;
      const target = document.getElementById('live-plyr-target');
      if (target && window.Plyr) {
        State.plyrInstance = new Plyr(target, {
          autoplay: true,
          muted: false,
          hideControls: true,
          controls: ['play-large', 'play', 'progress', 'current-time', 'mute', 'volume', 'pip', 'fullscreen']
        });
        if ('wakeLock' in navigator) {
          navigator.wakeLock.request('screen').then(lock => {
            State.wakeLock = lock;
          }).catch(() => {});
        }
      }
    };
    document.body.appendChild(script);
  }

  // --- SCREEN 4: PHOTOS (ALL PHOTOS DIRECT GALLERY & ADVANCED PHOTOSWIPE V5) ---
  function isNotLogo(u) {
    if (!u) return false;
    const s = u.toLowerCase();
    return !s.includes('logo') && !s.includes('fiesta.png') && !s.includes('og-image') && !s.includes('crest') &&
           !s.includes('sikatiya') && !s.includes('ghoshi') && !s.includes('international') && !s.includes('nizamuddinpura') &&
           !s.includes('kirihar') && !s.includes('kasimabad');
  }

  function getValidPhotos(media) {
    if (!media || !Array.isArray(media)) return [];
    return media
      .filter(m => m.consent_approved !== false && m.active !== false)
      .filter(m => {
        const u = m.file_url || m.url;
        return u && isNotLogo(u);
      });
  }

  function deriveAlbums(media, feed) {
    const valid = getValidPhotos(media);
    if (valid.length === 0) return [];
    return [{ id: 'all', title: 'All Photos', cover: valid[0]?.file_url || valid[0]?.url, items: valid }];
  }

  async function downloadPhoto(url, filename) {
    if (!url) return;
    const cleanName = (filename || 'Sports-Fiesta-Photo.jpg').replace(/[^a-zA-Z0-9_.-]/g, '_');
    const targetFilename = cleanName.toLowerCase().endsWith('.jpg') || cleanName.toLowerCase().endsWith('.png')
      ? cleanName
      : `${cleanName}.jpg`;

    try {
      showToast('Downloading photo...');
      const res = await fetch(url, { mode: 'cors' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = targetFilename;
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
      }, 500);
      showToast('Photo downloaded!');
    } catch (err) {
      console.warn('[Download fallback]', err);
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.download = targetFilename;
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        if (link.parentNode) link.parentNode.removeChild(link);
      }, 500);
      showToast('Photo opened in new tab');
    }
  }

  async function loadPhotoSwipeModule() {
    try {
      const mod = await import('./vendor/photoswipe.esm.min.js');
      if (mod && mod.default) return mod.default;
    } catch (e1) {
      console.warn('[PhotoSwipe] Local module failed, trying jsdelivr CDN...', e1.message);
    }
    try {
      const mod = await import('https://cdn.jsdelivr.net/npm/photoswipe@5.4.4/dist/photoswipe.esm.min.js');
      if (mod && mod.default) return mod.default;
    } catch (e2) {
      console.warn('[PhotoSwipe] jsdelivr failed, trying unpkg CDN...', e2.message);
    }
    try {
      const mod = await import('https://unpkg.com/photoswipe@5.4.4/dist/photoswipe.esm.js');
      if (mod && mod.default) return mod.default;
    } catch (e3) {
      console.error('[PhotoSwipe] All PhotoSwipe imports failed:', e3.message);
    }
    return null;
  }

  function renderPhotosScreen() {
    const feed = State.data || {};
    const photos = getValidPhotos(feed.media || []);

    if (photos.length === 0) {
      return `
        <div class="app" style="padding-bottom: 84px;">
          ${renderAppBar('Fiesta Moments')}
          ${renderOfflineBanner()}
          <div class="main" style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 50vh; text-align: center;">
            <div style="width: 64px; height: 64px; border-radius: 50%; background: var(--alt); display: grid; place-items: center; margin-bottom: 12px;">
              ${renderIcon('image', 'lucide-ic')}
            </div>
            <div class="dsp h-title" style="margin: 0; font-size: 22px;">Photos Appear Here After Approval</div>
            <div class="lab mut" style="margin-top: 6px; max-width: 280px;">
              Consent-approved action photos from stadium events will be published live during match days.
            </div>
          </div>
          ${renderTabBar()}
        </div>
      `;
    }

    return `
      <div class="app" style="padding-bottom: 84px;">
        ${renderAppBar('Fiesta Moments')}
        ${renderOfflineBanner()}

        <div class="main">
          <div class="row sb" style="margin: 4px 0 14px; align-items: baseline;">
            <div>
              <span class="ttab" style="font-size: 18px;">All Photos</span>
              <span class="lab mut" style="margin-left: 8px;">(${photos.length} photos)</span>
            </div>
            <span class="lab mut" style="font-size: 12px;">Tap photo to swipe · Tap icon to download</span>
          </div>

          <div class="photo-direct-grid">
            ${photos.map((item, idx) => `
              <div class="photo-direct-card">
                <div class="photo-direct-img-wrap" onclick="window.App.openPhotoSwipe(${idx})">
                  <img 
                    src="${item.file_url || item.url}" 
                    alt="${escapeHtml(item.caption || item.title || 'Action photo')}" 
                    loading="lazy" 
                    decoding="async"
                    onerror="const p = this.closest('.photo-direct-card'); if (p) p.style.display='none';"
                  >
                  <div class="photo-expand-badge" title="Tap to expand">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="15 3 21 3 21 9"></polyline>
                      <polyline points="9 21 3 21 3 15"></polyline>
                      <line x1="21" y1="3" x2="14" y2="10"></line>
                      <line x1="3" y1="21" x2="10" y2="14"></line>
                    </svg>
                  </div>
                </div>
                <div class="photo-direct-meta row sb">
                  <div class="photo-direct-caption" title="${escapeHtml(item.caption || item.title || 'Stadium action')}">
                    ${escapeHtml(item.caption || item.title || 'Stadium Action')}
                  </div>
                  <button 
                    type="button"
                    class="photo-card-download-btn" 
                    onclick="event.stopPropagation(); window.App.downloadPhoto('${item.file_url || item.url}', '${escapeHtml((item.caption || item.title || 'sports-fiesta').replace(/[^a-zA-Z0-9_-]/g, '_'))}.jpg')"
                    title="Download High-Res Photo"
                    aria-label="Download photo"
                  >
                    ${renderIcon('download')}
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        ${renderTabBar()}
      </div>
    `;
  }

  function openPhotoSwipe(index = 0) {
    const feed = State.data || {};
    const photos = getValidPhotos(feed.media || []);
    if (!photos || photos.length === 0) return;

    loadPhotoSwipeModule().then(PhotoSwipe => {
      if (!PhotoSwipe) {
        window.open(photos[index]?.file_url || photos[index]?.url, '_blank');
        return;
      }

      const cardImgs = document.querySelectorAll('.photo-direct-card img');
      const dataSource = photos.map((m, i) => {
        const img = cardImgs[i];
        const w = (img && img.naturalWidth) ? img.naturalWidth : 1600;
        const h = (img && img.naturalHeight) ? img.naturalHeight : 1200;
        const title = m.caption || m.title || 'Stadium Action Photo';
        return {
          src: m.file_url || m.url,
          msrc: m.file_url || m.url,
          w,
          h,
          title,
          alt: title
        };
      });

      const pswp = new PhotoSwipe({
        dataSource,
        index: Math.max(0, Math.min(index, dataSource.length - 1)),
        bgOpacity: 0.94,
        closeOnVerticalDrag: true,
        wheelToZoom: true,
        pinchToClose: true,
        padding: { top: 20, bottom: 60, left: 10, right: 10 }
      });

      pswp.on('imageLoadComplete', (e) => {
        const slide = e.slide;
        if (slide && slide.data && slide.content && slide.content.element) {
          const img = slide.content.element;
          if (img.naturalWidth && img.naturalHeight) {
            if (slide.data.w !== img.naturalWidth || slide.data.h !== img.naturalHeight) {
              slide.data.w = img.naturalWidth;
              slide.data.h = img.naturalHeight;
              pswp.refreshSlideContent(slide.index);
            }
          }
        }
      });

      pswp.on('uiRegister', function() {
        pswp.ui.registerElement({
          name: 'download-button',
          order: 8,
          isButton: true,
          tagName: 'button',
          html: '<svg class="pswp__icn" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="margin: auto;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>',
          title: 'Download High-Res Photo',
          onClick: () => {
            const item = pswp.currSlide?.data;
            if (item) {
              const url = item.src;
              const rawTitle = item.title || 'sports-fiesta-2026';
              const filename = rawTitle.replace(/[^a-zA-Z0-9_-]/g, '_') + '.jpg';
              downloadPhoto(url, filename);
            }
          }
        });

        pswp.ui.registerElement({
          name: 'custom-caption',
          order: 9,
          isButton: false,
          appendTo: 'root',
          html: '',
          onInit: (el, pswpInstance) => {
            el.className = 'pswp__custom-caption';
            const updateCaption = () => {
              const currSlide = pswpInstance.currSlide;
              if (currSlide && currSlide.data && currSlide.data.title) {
                el.innerHTML = `<div class="pswp__caption-text">${escapeHtml(currSlide.data.title)}</div>`;
                el.style.display = 'block';
              } else {
                el.innerHTML = '';
                el.style.display = 'none';
              }
            };
            pswpInstance.on('change', updateCaption);
            updateCaption();
          }
        });
      });

      pswp.init();
    }).catch(err => {
      console.warn('PhotoSwipe init error:', err);
      window.open(photos[index]?.file_url || photos[index]?.url, '_blank');
    });
  }

  // --- SCREEN 5: FIXTURES (TIME RAIL + BOTTOM SHEET) ---
  function renderFixturesScreen() {
    const feed = State.data || {};
    const schools = feed.schools || [];
    const comps = feed.competitions || [];
    const allFixtures = feed.fixtures || [];

    const selectedDay = State.routeParams.day || State.fixtureDay || '13';
    const targetDate = selectedDay === '13' ? '2026-11-13' : '2026-11-14';

    const filteredFixtures = allFixtures.filter(f => {
      if (f.day && f.day !== targetDate) return false;
      if (State.fixtureFilters.game !== 'all' && f.competition_id !== State.fixtureFilters.game) return false;
      if (State.fixtureFilters.school !== 'all' && f.school_a_id !== State.fixtureFilters.school && f.school_b_id !== State.fixtureFilters.school) return false;
      if (State.fixtureFilters.status !== 'all' && f.status !== State.fixtureFilters.status) return false;
      return true;
    });

    const groupedByTime = new Map();
    filteredFixtures.forEach(f => {
      const slot = f.time || '10:00 AM';
      if (!groupedByTime.has(slot)) groupedByTime.set(slot, []);
      groupedByTime.get(slot).push(f);
    });

    const activeFilterCount = (State.fixtureFilters.game !== 'all' ? 1 : 0) +
                              (State.fixtureFilters.school !== 'all' ? 1 : 0) +
                              (State.fixtureFilters.status !== 'all' ? 1 : 0);

    return `
      <div class="app" style="padding-bottom: 84px;">
        ${renderAppBar('Fixtures & Schedule')}
        ${renderOfflineBanner()}

        <div class="main">
          <div class="seg-48" role="tablist">
            <a 
              href="#fixtures?day=13" 
              class="${selectedDay === '13' ? 'on' : ''}" 
              role="tab"
              aria-selected="${selectedDay === '13'}"
            >
              13 Nov (Cricket)
            </a>
            <a 
              href="#fixtures?day=14" 
              class="${selectedDay === '14' ? 'on' : ''}" 
              role="tab"
              aria-selected="${selectedDay === '14'}"
            >
              14 Nov 2026 (Main Games)
            </a>
          </div>

          <div class="fixtures-filter-bar">
            <button 
              class="chip ${activeFilterCount > 0 ? 'on' : ''}" 
              onclick="window.App.toggleFilterSheet(true)"
              style="display: flex; align-items: center; gap: 6px;"
            >
              ${renderIcon('filter')}
              <span>Filters ${activeFilterCount > 0 ? `(${activeFilterCount})` : ''}</span>
            </button>

            ${activeFilterCount > 0 ? `
              <button 
                class="chip" 
                onclick="window.App.clearFixtureFilters()" 
                style="background: none; border: 1px solid var(--ln); color: var(--mut);"
              >
                Clear All
              </button>
            ` : ''}
          </div>

          ${filteredFixtures.length === 0 ? `
            <div class="card col" style="text-align: center; padding: 48px 16px; gap: 8px;">
              <div class="dsp h-title" style="margin: 0; font-size: 20px;">No Fixtures Confirmed</div>
              <div class="lab mut">Fixtures appear here once teams are confirmed.</div>
            </div>
          ` : `
            <div class="col" style="gap: 20px; margin-top: 8px;">
              ${Array.from(groupedByTime.entries()).map(([timeSlot, fixturesInSlot]) => `
                <div class="time-rail-group">
                  <div class="time-rail-line"></div>
                  
                  <div class="time-rail-slot">
                    <div class="time-rail-dot"></div>
                    <span>${timeSlot}</span>
                  </div>

                  ${fixturesInSlot.map(f => {
                    const comp = comps.find(c => c.id === f.competition_id);
                    const sA = schools.find(s => s.id === f.school_a_id);
                    const sB = schools.find(s => s.id === f.school_b_id);
                    const isWinnerA = f.winner_school_id && f.winner_school_id === sA?.id;
                    const isWinnerB = f.winner_school_id && f.winner_school_id === sB?.id;
                    const isReminded = State.reminders.includes(f.id);

                    // When school filter is active, show WIN/LOSS chip for the filtered school
                    const schoolFilter = State.fixtureFilters.school;
                    let filterOutcomeChip = '';
                    if (schoolFilter !== 'all' && f.status === 'Completed') {
                      if (f.winner_school_id === schoolFilter) {
                        filterOutcomeChip = '<span class="chip-win">WIN</span>';
                      } else if (f.winner_school_id && (f.school_a_id === schoolFilter || f.school_b_id === schoolFilter)) {
                        filterOutcomeChip = '<span class="chip-loss">LOSS</span>';
                      }
                    }

                    return `
                      <div class="card col" style="gap: 10px;">
                        <div class="row sb">
                          <span class="ttab">${comp?.name || 'Tournament'} · ${f.round}</span>
                          <div class="row" style="gap: 6px; align-items: center;">
                            ${filterOutcomeChip}
                            <button 
                              class="chip ${isReminded ? 'on' : ''}" 
                              onclick="window.App.toggleReminder('${f.id}')"
                              style="min-height: 32px; padding: 0 8px; font-size: 11px; display: flex; align-items: center; gap: 4px;"
                            >
                              ${renderIcon('star')}
                              <span>${isReminded ? 'Saved' : 'Remind'}</span>
                            </button>
                            <span class="${f.status === 'Completed' ? 'st done' : f.status === 'Live' ? 'badge-live-pulse' : 'st'}">
                              ${f.status === 'Live' ? '<i></i> LIVE' : f.status}
                            </span>
                          </div>
                        </div>

                        <a href="#match?id=${f.id}" class="col" style="gap: 8px;">
                          <div class="row sb" style="padding: 6px 0; border-bottom: 1px solid var(--ln);">
                            <div class="row" style="gap: 10px;">
                              ${renderSchoolCrest(sA, 'c32')}
                              <span style="font-weight: ${isWinnerA ? '800' : '600'}; color: var(--tx); font-size: 15px;">
                                ${sA?.short_name || 'Team A'}
                              </span>
                            </div>
                            ${isWinnerA ? '<span class="st done" style="background: var(--gold); color: var(--ink); font-weight: 800;">WINNER 🥇</span>' : ''}
                          </div>

                          <div class="row sb" style="padding: 6px 0;">
                            <div class="row" style="gap: 10px;">
                              ${renderSchoolCrest(sB, 'c32')}
                              <span style="font-weight: ${isWinnerB ? '800' : '600'}; color: var(--tx); font-size: 15px;">
                                ${sB?.short_name || 'Team B'}
                              </span>
                            </div>
                            ${isWinnerB ? '<span class="st done" style="background: var(--gold); color: var(--ink); font-weight: 800;">WINNER 🥇</span>' : ''}
                          </div>
                        </a>

                        <div class="row sb" style="border-top: 1px solid var(--ln); padding-top: 8px;">
                          <span class="lab mut" style="font-size: 12px;">${EVENT_CONFIG.venue}</span>
                          <a href="#match?id=${f.id}" class="link-accent lab">Details &rarr;</a>
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>
              `).join('')}
            </div>
          `}
        </div>

        <!-- Bottom Sheet Filter Drawer -->
        <div 
          class="filter-bottom-sheet-backdrop ${State.filterSheetOpen ? 'open' : ''}" 
          onclick="window.App.toggleFilterSheet(false)"
          ${State.filterSheetOpen ? '' : 'style="display: none;" aria-hidden="true"'}
        ></div>
        <div 
          class="filter-bottom-sheet ${State.filterSheetOpen ? 'open' : ''}"
          role="dialog"
          aria-modal="true"
          aria-label="Filter Fixtures"
          ${State.filterSheetOpen ? '' : 'style="display: none;" aria-hidden="true" inert'}
        >
          <div class="row sb" style="margin-bottom: 16px;">
            <div class="dsp h-title" style="margin: 0; font-size: 20px;">Filter Fixtures</div>
            <button onclick="window.App.toggleFilterSheet(false)" style="background: none; border: 0; cursor: pointer; color: var(--tx);">
              ${renderIcon('x')}
            </button>
          </div>

          <div style="font-weight: 700; font-size: 14px; margin-bottom: 8px;">Sport / Competition</div>
          <div class="chips" style="margin-bottom: 16px;">
            <button class="chip ${State.fixtureFilters.game === 'all' ? 'on' : ''}" onclick="window.App.setFixtureFilter('game', 'all')">All Sports</button>
            ${comps.map(c => `
              <button class="chip ${State.fixtureFilters.game === c.id ? 'on' : ''}" onclick="window.App.setFixtureFilter('game', '${c.id}')">${c.name}</button>
            `).join('')}
          </div>

          <div style="font-weight: 700; font-size: 14px; margin-bottom: 8px;">Participating School</div>
          <div class="chips" style="margin-bottom: 16px;">
            <button class="chip ${State.fixtureFilters.school === 'all' ? 'on' : ''}" onclick="window.App.setFixtureFilter('school', 'all')">All Schools</button>
            ${schools.map(s => `
              <button class="chip ${State.fixtureFilters.school === s.id ? 'on' : ''}" onclick="window.App.setFixtureFilter('school', '${s.id}')">${s.short_name}</button>
            `).join('')}
          </div>

          <div style="font-weight: 700; font-size: 14px; margin-bottom: 8px;">Match Status</div>
          <div class="chips" style="margin-bottom: 24px;">
            <button class="chip ${State.fixtureFilters.status === 'all' ? 'on' : ''}" onclick="window.App.setFixtureFilter('status', 'all')">All Statuses</button>
            <button class="chip ${State.fixtureFilters.status === 'Live' ? 'on' : ''}" onclick="window.App.setFixtureFilter('status', 'Live')">LIVE</button>
            <button class="chip ${State.fixtureFilters.status === 'Scheduled' ? 'on' : ''}" onclick="window.App.setFixtureFilter('status', 'Scheduled')">Scheduled</button>
            <button class="chip ${State.fixtureFilters.status === 'Completed' ? 'on' : ''}" onclick="window.App.setFixtureFilter('status', 'Completed')">Completed</button>
          </div>

          <button class="btn" style="width: 100%;" onclick="window.App.toggleFilterSheet(false)">Apply Filters</button>
        </div>

        ${renderTabBar()}
      </div>
    `;
  }

  // --- SCREEN 6: MATCH DETAIL & TOURNAMENT BRACKET ---
  function renderTournamentBracket(compId, feed) {
    const fixtures = (feed.fixtures || []).filter(f => f.competition_id === compId);
    const schools = feed.schools || [];
    if (fixtures.length === 0) return '';

    const pMatches = fixtures.filter(f => f.round === 'Preliminary' || f.code?.startsWith('P'));
    const sMatches = fixtures.filter(f => f.round === 'Semifinal' || f.code?.startsWith('S'));
    const finalMatch = fixtures.find(f => f.round === 'Final');

    // Winning path determination
    const champWinnerId = finalMatch?.winner_school_id;
    const sf1WinnerId = sMatches[0]?.winner_school_id;
    const sf2WinnerId = sMatches[1]?.winner_school_id;

    const isSf1FinalWinner = champWinnerId && champWinnerId === sf1WinnerId;
    const isSf2FinalWinner = champWinnerId && champWinnerId === sf2WinnerId;

    const isQf1WinnerInSf = sf1WinnerId && (sf1WinnerId === pMatches[0]?.winner_school_id);
    const isQf2WinnerInSf = sf2WinnerId && (sf2WinnerId === pMatches[1]?.winner_school_id);

    return `
      <section class="card col" style="gap: 12px; margin-top: 14px;">
        <div class="row sb">
          <span class="ttab">Tournament Bracket (6 Seeds)</span>
          <span class="lab mut" style="font-size: 11px;">Seeds 1 & 2 have byes</span>
        </div>

        <div class="bracket-wrapper" tabindex="0" role="region" aria-label="Tournament bracket scrollable area">
          <div class="bracket-container">
            <!-- SVG Connectors Layer -->
            <svg class="bracket-svg-layer" viewBox="0 0 540 250" preserveAspectRatio="none">
              <!-- QF1 to SF1 -->
              <path class="bracket-path ${isQf1WinnerInSf ? 'winner-path' : ''}" d="M 155 60 H 191" />
              <!-- QF2 to SF2 -->
              <path class="bracket-path ${isQf2WinnerInSf ? 'winner-path' : ''}" d="M 155 180 H 191" />
              <!-- SF1 to Final -->
              <path class="bracket-path ${isSf1FinalWinner ? 'winner-path' : ''}" d="M 346 60 H 364 V 120 H 382" />
              <!-- SF2 to Final -->
              <path class="bracket-path ${isSf2FinalWinner ? 'winner-path' : ''}" d="M 346 180 H 364 V 120 H 382" />
            </svg>

            <!-- Round 1: Quarterfinals -->
            <div class="bracket-round-col">
              <div class="bracket-round-header">Quarterfinals</div>
              ${pMatches.map((m, idx) => {
                const s1 = schools.find(s => s.id === m.school_a_id);
                const s2 = schools.find(s => s.id === m.school_b_id);
                const isWin1 = m.winner_school_id && m.winner_school_id === s1?.id;
                const isWin2 = m.winner_school_id && m.winner_school_id === s2?.id;
                return `
                  <div class="bracket-match-card">
                    <div class="bracket-seed-row ${isWin1 ? 'winner' : ''}">
                      <span class="row" style="gap: 6px; align-items: center; min-width: 0;">
                        ${renderSchoolCrest(s1, 'c28')}
                        <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 90px; display: inline-block;">${s1?.short_name || 'Team A'}</span>
                      </span>
                      ${isWin1 ? '🥇' : ''}
                    </div>
                    <div class="bracket-seed-row ${isWin2 ? 'winner' : ''}">
                      <span class="row" style="gap: 6px; align-items: center; min-width: 0;">
                        ${renderSchoolCrest(s2, 'c28')}
                        <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 90px; display: inline-block;">${s2?.short_name || 'Team B'}</span>
                      </span>
                      ${isWin2 ? '🥇' : ''}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>

            <!-- Round 2: Semifinals -->
            <div class="bracket-round-col">
              <div class="bracket-round-header">Semifinals</div>
              ${sMatches.map((m, idx) => {
                const s1 = schools.find(s => s.id === m.school_a_id);
                const s2 = schools.find(s => s.id === m.school_b_id);
                const isWin1 = m.winner_school_id && m.winner_school_id === s1?.id;
                const isWin2 = m.winner_school_id && m.winner_school_id === s2?.id;
                return `
                  <div class="bracket-match-card">
                    <div class="bracket-seed-row ${isWin1 ? 'winner' : ''}">
                      <span class="row" style="gap: 6px; align-items: center; min-width: 0;">
                        ${renderSchoolCrest(s1, 'c28')}
                        <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 90px; display: inline-block;">${s1?.short_name || 'Seed ' + (idx + 1)}</span>
                      </span>
                      ${isWin1 ? '🥇' : ''}
                    </div>
                    <div class="bracket-seed-row ${isWin2 ? 'winner' : ''}">
                      <span class="row" style="gap: 6px; align-items: center; min-width: 0;">
                        ${renderSchoolCrest(s2, 'c28')}
                        <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 90px; display: inline-block;">${s2?.short_name || 'Winner QF' + (idx + 1)}</span>
                      </span>
                      ${isWin2 ? '🥇' : ''}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>

            <!-- Round 3: Final -->
            <div class="bracket-round-col">
              <div class="bracket-round-header">Championship</div>
              ${finalMatch ? (() => {
                const s1 = schools.find(s => s.id === finalMatch.school_a_id);
                const s2 = schools.find(s => s.id === finalMatch.school_b_id);
                const isWin1 = finalMatch.winner_school_id && finalMatch.winner_school_id === s1?.id;
                const isWin2 = finalMatch.winner_school_id && finalMatch.winner_school_id === s2?.id;
                return `
                  <div class="bracket-match-card is-final ${finalMatch.winner_school_id ? 'gold-shine' : ''}">
                    <div class="bracket-seed-row ${isWin1 ? 'winner' : ''}">
                      <span class="row" style="gap: 6px; align-items: center; min-width: 0;">
                        ${renderSchoolCrest(s1, 'c28')}
                        <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 90px; display: inline-block;">${s1?.short_name || 'Finalist 1'}</span>
                      </span>
                      ${isWin1 ? '👑 1st' : ''}
                    </div>
                    <div class="bracket-seed-row ${isWin2 ? 'winner' : ''}">
                      <span class="row" style="gap: 6px; align-items: center; min-width: 0;">
                        ${renderSchoolCrest(s2, 'c28')}
                        <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 90px; display: inline-block;">${s2?.short_name || 'Finalist 2'}</span>
                      </span>
                      ${isWin2 ? '👑 1st' : ''}
                    </div>
                  </div>
                `;
              })() : `
                <div class="bracket-match-card is-final">
                  <div class="bracket-seed-row"><span>Finalist 1</span></div>
                  <div class="bracket-seed-row"><span>Finalist 2</span></div>
                </div>
              `}
            </div>
          </div>
        </div>
      </section>
    `;
  }

  function renderMatchDetailScreen() {
    const feed = State.data || {};
    const fixtureId = State.routeParams.id;
    const f = fixtureId 
      ? (feed.fixtures || []).find(fix => fix.id === fixtureId || (fix.round && fix.round.toLowerCase().includes(fixtureId.toLowerCase()))) 
      : (feed.fixtures || [])[0];

    if (!f) return render404Screen('Match details not found.');

    const comp = feed.competitions?.find(c => c.id === f.competition_id);
    const sA = feed.schools?.find(s => s.id === f.school_a_id);
    const sB = feed.schools?.find(s => s.id === f.school_b_id);
    const winner = f.winner_school_id ? feed.schools?.find(s => s.id === f.winner_school_id) : null;

    return `
      <div class="app" style="padding-bottom: 84px;">
        ${renderAppBar(comp?.name || 'Match Detail', { breadcrumb: 'Fixtures > Match Details', backHref: '#fixtures' })}
        ${renderOfflineBanner()}
        <div class="main col" style="gap: 14px;">
          <a href="#fixtures" class="link-accent lab row" style="min-height: 40px; gap: 4px; align-self: flex-start;">
            ${renderIcon('arrow-left')}
            All Fixtures
          </a>

          <div class="card col" style="gap: 16px; align-items: center; text-align: center; padding: 24px 16px;">
            <div class="row sb" style="width: 100%;">
              <a href="#team?comp=${comp?.id}&tab=fixtures" class="ttab link-accent" style="text-decoration: none;">${escapeHtml(comp?.name || 'Tournament')} · ${escapeHtml(f.round || 'Match')}</a>
              <span class="${f.status === 'Completed' ? 'st done' : f.status === 'Live' ? 'badge-live-pulse' : 'st'}">${f.status === 'Live' ? '<i></i> LIVE' : f.status}</span>
            </div>

            <div class="row sb" style="width: 100%; margin: 12px 0;">
              <a href="#school?id=${sA?.id}" style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 8px; text-decoration: none; color: inherit;">
                ${renderSchoolCrest(sA, 'c72')}
                <div style="font-weight: 800; font-size: 16px;">${sA?.short_name || 'Team A'}</div>
              </a>
              <div class="dsp num" style="font-size: 32px; color: var(--mut); margin: 0 16px;">VS</div>
              <a href="#school?id=${sB?.id}" style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 8px; text-decoration: none; color: inherit;">
                ${renderSchoolCrest(sB, 'c72')}
                <div style="font-weight: 800; font-size: 16px;">${sB?.short_name || 'Team B'}</div>
              </a>
            </div>

            ${winner ? `
              <a href="#school?id=${winner.id}" class="gold-shine" style="background: var(--alt); width: 100%; padding: 12px; border-radius: 12px; border: 1px solid var(--ln); text-decoration: none; color: inherit; display: block;">
                <div class="lab mut" style="font-size: 12px;">OFFICIAL APPROVED WINNER</div>
                <div class="row" style="justify-content: center; gap: 8px; margin-top: 4px;">
                  <span class="rk r1">1</span>
                  <span style="font-weight: 800; font-size: 16px; color: var(--gold);">${winner.short_name} 🥇</span>
                </div>
              </a>
            ` : ''}

            <div class="lab mut" style="margin-top: 8px;">
              ${f.time} · ${EVENT_CONFIG.venue}
            </div>
          </div>

          <!-- Tournament Bracket View -->
          ${comp?.id ? renderTournamentBracket(comp.id, feed) : ''}
        </div>
        ${renderTabBar()}
      </div>
    `;
  }

  // --- SCREEN 7: GAMES & PODIUM REVEAL ---
  function renderGamesScreen() {
    const feed = State.data || {};
    const events = feed.events || [];
    const comps = feed.competitions || [];

    return `
      <div class="app" style="padding-bottom: 84px;">
        ${renderAppBar('Sports & Games')}
        ${renderOfflineBanner()}
        <div class="main">
          <!-- Team Games Section -->
          <section class="col" style="gap: 10px;">
            <span class="ttab">Team Championships</span>
            <div class="col" style="gap: 8px;">
              ${comps.map(c => `
                <a href="#team?comp=${c.id}&tab=fixtures" class="card row sb" style="text-decoration: none; color: inherit;">
                  <div>
                    <div style="font-weight: 800; font-size: 16px;">${escapeHtml(c.name || c.game || 'Championship')}</div>
                    <div class="lab mut">${c.gender || 'Boys & Girls'} · Classes ${c.classes || 'All'}</div>
                  </div>
                  <span class="link-accent lab">View &rarr;</span>
                </a>
              `).join('')}
            </div>
          </section>

          <!-- Track Events Section -->
          <section class="col" style="gap: 10px; margin-top: 14px;">
            <span class="ttab">Track & Sprint Events</span>
            <div class="col" style="gap: 8px;">
              ${events.filter(e => (e.name || '').toLowerCase().includes('race') || (e.name || '').toLowerCase().includes('sprint') || (e.name || '').toLowerCase().includes('m ')).map(e => `
                <a href="#game?event=${e.id}&cat=${encodeURIComponent(e.category || '')}&gender=${encodeURIComponent(e.gender || '')}" class="card row sb" style="text-decoration: none; color: inherit;">
                  <div>
                    <div style="font-weight: 700; font-size: 15px;">${e.name}</div>
                    <div class="lab mut">${e.category || 'Sub-Junior'} · ${e.gender || 'Boys'}</div>
                  </div>
                  <span class="${e.status === 'Completed' ? 'st done' : 'st'}">${e.status}</span>
                </a>
              `).join('')}
            </div>
          </section>
        </div>
        ${renderTabBar()}
      </div>
    `;
  }

  function renderGameIndividualScreen() {
    const feed = State.data || {};
    const eventId = State.routeParams.event || State.routeParams.id;
    const events = feed.events || [];
    let ev = eventId ? events.find(e => e.id === eventId || (e.name && e.name.toLowerCase().includes(eventId.toLowerCase()))) : null;

    if (!ev && State.routeParams.name) {
      const decodedName = decodeURIComponent(State.routeParams.name).toLowerCase();
      ev = events.find(e => (e.name || '').toLowerCase().includes(decodedName));
    }

    if (eventId && !ev) {
      return render404Screen('Track or athletics event not found.');
    }
    const currentEv = ev || events[0] || {};
    const gameName = currentEv.name || 'Athletics Event';
    const res = currentEv.id ? (feed.results || []).find(r => r.event_id === currentEv.id) : null;
    const places = (res?.places && res.places.length > 0) ? res.places : (res ? [
      (res.first_place_school_id || res.first_school_id) ? { rank: 1, school_id: res.first_place_school_id || res.first_school_id, points: res.points_first || 20, athlete: res.athlete_first || '' } : null,
      (res.second_place_school_id || res.second_school_id) ? { rank: 2, school_id: res.second_place_school_id || res.second_school_id, points: res.points_second || 15, athlete: res.athlete_second || '' } : null,
      (res.third_place_school_id || res.third_school_id) ? { rank: 3, school_id: res.third_place_school_id || res.third_school_id, points: res.points_third || 10, athlete: res.athlete_third || '' } : null
    ].filter(Boolean) : []);
    const p1 = places.find(p => p.rank === 1);
    const p2 = places.find(p => p.rank === 2);
    const p3 = places.find(p => p.rank === 3);

    const s1 = p1 ? feed.schools?.find(s => s.id === p1.school_id) : null;
    const s2 = p2 ? feed.schools?.find(s => s.id === p2.school_id) : null;
    const s3 = p3 ? feed.schools?.find(s => s.id === p3.school_id) : null;
    const isCompleted = currentEv.status === 'Completed' || (res && ((res.status || '').toLowerCase() === 'completed' || (res.status || '').toLowerCase() === 'approved'));

    return `
      <div class="app" style="padding-bottom: 84px;">
        ${renderAppBar(gameName, { breadcrumb: 'Games > ' + gameName, backHref: '#games' })}
        ${renderOfflineBanner()}
        <div class="main col" style="gap: 14px;">
          <a href="#games" class="link-accent lab row" style="min-height: 40px; gap: 4px; align-self: flex-start;">
            ${renderIcon('arrow-left')}
            All Games
          </a>

          <div class="card col" style="gap: 12px;">
            <div class="row sb">
              <span class="ttab">${currentEv.category || 'Sub-Junior'} · ${currentEv.gender || 'Boys'}</span>
              <span class="${isCompleted ? 'st done' : 'st'}">${isCompleted ? 'Completed' : (currentEv.status || 'Scheduled')}</span>
            </div>
            <div class="dsp h-title" style="margin: 0; font-size: 24px;">${currentEv.name || gameName}</div>
            <div class="lab mut">${currentEv.venue || EVENT_CONFIG.venue} · Scheduled: ${currentEv.time || '09:00 AM'}</div>

            <!-- INTERACTIVE 3D PODIUM REVEAL (Schools link to #school?id=) -->
            ${places.length > 0 ? `
              <div class="podium-container">
                <!-- 2nd Place (Silver) -->
                <div class="podium-col podium-col-2">
                  <a href="#school?id=${s2?.id}" style="text-decoration: none; color: inherit; display: flex; flex-direction: column; align-items: center;">
                    ${renderSchoolCrest(s2, 'c40')}
                    <div style="font-weight: 800; font-size: 13px; margin: 4px 0 2px; text-align: center;">${s2?.short_name || 'LFCS'}</div>
                    <div class="lab mut" style="font-size: 11px;">+${p2?.points || 15} pts</div>
                  </a>
                  <div class="podium-block podium-block-2">
                    <span class="num" style="font-size: 28px; color: var(--silver);">2</span>
                    <span class="lab" style="font-size: 10px;">SILVER</span>
                  </div>
                </div>

                <!-- 1st Place (Gold with Sheen & Confetti Trigger) -->
                <div class="podium-col podium-col-1">
                  <a href="#school?id=${s1?.id}" style="text-decoration: none; color: inherit; display: flex; flex-direction: column; align-items: center;">
                    <div class="gold-shine" style="border-radius: 50%;">
                      ${renderSchoolCrest(s1, 'c48')}
                    </div>
                    <div style="font-weight: 800; font-size: 14px; margin: 4px 0 2px; color: var(--tx); text-align: center;">${s1?.short_name || 'LFCS'}</div>
                    <div class="lab" style="font-size: 11px; font-weight: 700; color: var(--pri);">+${p1?.points || 20} pts</div>
                  </a>
                  <div class="podium-block podium-block-1 gold-shine">
                    <span class="num" style="font-size: 34px; color: var(--gold);">1</span>
                    <span class="lab" style="font-size: 11px;">CHAMPION</span>
                  </div>
                </div>

                <!-- 3rd Place (Bronze) -->
                <div class="podium-col podium-col-3">
                  <a href="#school?id=${s3?.id}" style="text-decoration: none; color: inherit; display: flex; flex-direction: column; align-items: center;">
                    ${renderSchoolCrest(s3, 'c40')}
                    <div style="font-weight: 800; font-size: 13px; margin: 4px 0 2px; text-align: center;">${s3?.short_name || 'LFCS'}</div>
                    <div class="lab mut" style="font-size: 11px;">+${p3?.points || 10} pts</div>
                  </a>
                  <div class="podium-block podium-block-3">
                    <span class="num" style="font-size: 24px; color: var(--bronze);">3</span>
                    <span class="lab" style="font-size: 10px;">BRONZE</span>
                  </div>
                </div>
              </div>

              <!-- Official Ranked Results Table -->
              <div class="col" style="gap: 8px; margin-top: 12px; border-top: 1px solid var(--ln); padding-top: 12px;">
                <span class="ttab">Official Results</span>
                ${places.map(p => {
                  const s = feed.schools?.find(x => x.id === p.school_id);
                  const medalColor = p.rank === 1 ? 'var(--gold)' : p.rank === 2 ? 'var(--silver)' : 'var(--bronze)';
                  return `
                    <a href="#school?id=${s?.id}" class="card row sb" style="align-items: center; padding: 10px 14px; text-decoration: none; color: inherit; border-left: 4px solid ${medalColor};">
                      <div class="row" style="gap: 10px; align-items: center;">
                        <span class="rk r${p.rank}" style="width: 28px; height: 28px; font-size: 14px;">${p.rank}</span>
                        ${renderSchoolCrest(s, 'c32')}
                        <div>
                          <div style="font-weight: 800; font-size: 14px; color: var(--tx);">${s?.short_name || 'School'}</div>
                          <div class="lab mut" style="font-size: 12px;">${p.athlete_name ? escapeHtml(p.athlete_name) : 'Athlete'}${p.class ? ` (Class ${escapeHtml(p.class)})` : ''}</div>
                        </div>
                      </div>
                      <span class="pts num" style="font-size: 16px; color: var(--pri);">+${p.points} pts</span>
                    </a>
                  `;
                }).join('')}
              </div>

              <button type="button" class="btn" onclick="window.App.triggerConfetti()" style="align-self: center; min-height: 48px; padding: 0 22px; font-size: 13.5px; margin-top: 6px;">
                Celebrate Winner 🎉
              </button>
            ` : `
              <div class="lab mut" style="text-align: center; padding: 24px 0;">
                Official podium will be revealed once results are verified and approved.
              </div>
            `}
          </div>
        </div>
        ${renderTabBar()}
      </div>
    `;
  }

  function renderGameTeamScreen() {
    const feed = State.data || {};
    const compId = State.routeParams.comp || State.routeParams.id;
    const comps = feed.competitions || [];
    const comp = compId ? comps.find(c => c.id === compId || ((c.name || c.game) && (c.name || c.game).toLowerCase().includes(compId.toLowerCase()))) : comps[0];

    if (compId && !comp) {
      return render404Screen('Team competition not found.');
    }
    const currentComp = comp || comps[0] || {};
    const compDisplayName = currentComp.name || currentComp.game || 'Team Championship';
    const activeTab = State.routeParams.tab || 'fixtures';
    const compFixtures = (feed.fixtures || []).filter(f => f.competition_id === currentComp.id);
    const schools = feed.schools || [];

    // Final match & champion
    const finalMatch = compFixtures.find(f => f.round === 'Final');
    const champSchool = finalMatch?.winner_school_id ? schools.find(s => s.id === finalMatch.winner_school_id) : null;
    const runnerSchool = finalMatch?.winner_school_id ? schools.find(s => s.id === (finalMatch.school_a_id === finalMatch.winner_school_id ? finalMatch.school_b_id : finalMatch.school_a_id)) : null;

    return `
      <div class="app" style="padding-bottom: 84px;">
        ${renderAppBar(compDisplayName, { breadcrumb: 'Games > ' + compDisplayName, backHref: '#games' })}
        ${renderOfflineBanner()}
        <div class="main col" style="gap: 14px;">
          <a href="#games" class="link-accent lab row" style="min-height: 40px; gap: 4px; align-self: flex-start;">
            ${renderIcon('arrow-left')}
            All Games
          </a>

          <div class="card col" style="gap: 8px;">
            <div class="row sb">
              <span class="ttab">${currentComp.gender || 'Boys & Girls'} · Classes ${currentComp.classes || 'All'}</span>
              <span class="${currentComp.status === 'Completed' ? 'st done' : 'st'}">${currentComp.status || 'Active'}</span>
            </div>
            <div class="dsp h-title" style="margin: 0; font-size: 24px;">${compDisplayName}</div>
            <div class="lab mut">${EVENT_CONFIG.venue}</div>
          </div>

          <!-- 3 Tabs: Fixtures | Bracket | Result -->
          <div class="tabs" style="width: 100%;" role="tablist">
            <a 
              href="#team?comp=${currentComp.id}&tab=fixtures" 
              class="tab ${activeTab === 'fixtures' ? 'on' : ''}" 
              role="tab"
              aria-selected="${activeTab === 'fixtures'}"
              style="text-decoration: none;"
            >
              Fixtures (${compFixtures.length})
            </a>
            <a 
              href="#team?comp=${currentComp.id}&tab=bracket" 
              class="tab ${activeTab === 'bracket' ? 'on' : ''}" 
              role="tab"
              aria-selected="${activeTab === 'bracket'}"
              style="text-decoration: none;"
            >
              Bracket
            </a>
            <a 
              href="#team?comp=${currentComp.id}&tab=result" 
              class="tab ${activeTab === 'result' ? 'on' : ''}" 
              role="tab"
              aria-selected="${activeTab === 'result'}"
              style="text-decoration: none;"
            >
              Result
            </a>
          </div>

          <!-- Tab Content -->
          ${activeTab === 'fixtures' ? `
            <div class="col" style="gap: 10px; width: 100%;">
              ${compFixtures.length === 0 ? `
                <div class="card col" style="text-align: center; padding: 24px 16px;">
                  <div class="lab mut">No fixtures scheduled for this tournament yet.</div>
                </div>
              ` : compFixtures.map(f => {
                const sA = schools.find(s => s.id === f.school_a_id);
                const sB = schools.find(s => s.id === f.school_b_id);
                const isWonA = f.status === 'Completed' && f.winner_school_id === sA?.id;
                const isWonB = f.status === 'Completed' && f.winner_school_id === sB?.id;
                return `
                  <div class="card col" style="gap: 8px;">
                    <div class="row sb">
                      <span class="ttab">${escapeHtml(f.round || 'Match')}</span>
                      <span class="${f.status === 'Completed' ? 'st done' : f.status === 'Live' ? 'badge-live-pulse' : 'st'}">
                        ${f.status === 'Live' ? '<i></i> LIVE' : f.status}
                      </span>
                    </div>

                    <a href="#match?id=${f.id}" class="col" style="gap: 6px; text-decoration: none; color: inherit; padding: 4px 0;">
                      <div class="row sb" style="align-items: center; padding: 4px 0; border-bottom: 1px solid var(--ln);">
                        <div class="row" style="gap: 8px; align-items: center;">
                          ${renderSchoolCrest(sA, 'c28')}
                          <span style="font-weight: ${isWonA ? '800' : '600'}; font-size: 14px; color: var(--tx);">${sA?.short_name || 'Team A'}</span>
                        </div>
                        ${isWonA ? '<span class="chip-win">WIN 🥇</span>' : ''}
                      </div>

                      <div class="row sb" style="align-items: center; padding: 4px 0;">
                        <div class="row" style="gap: 8px; align-items: center;">
                          ${renderSchoolCrest(sB, 'c28')}
                          <span style="font-weight: ${isWonB ? '800' : '600'}; font-size: 14px; color: var(--tx);">${sB?.short_name || 'Team B'}</span>
                        </div>
                        ${isWonB ? '<span class="chip-win">WIN 🥇</span>' : ''}
                      </div>
                    </a>

                    <div class="row sb" style="border-top: 1px solid var(--ln); padding-top: 6px; font-size: 12px;">
                      <span class="lab mut">${escapeHtml(f.time || '')} · ${escapeHtml(f.ground || EVENT_CONFIG.venue)}</span>
                      <a href="#match?id=${f.id}" class="link-accent lab">Match Details &rarr;</a>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          ` : activeTab === 'bracket' ? `
            <div class="col" style="gap: 10px; width: 100%;">
              ${renderTournamentBracket(currentComp.id, feed)}
            </div>
          ` : `
            <div class="col" style="gap: 12px; width: 100%;">
              ${champSchool ? `
                <a href="#school?id=${champSchool.id}" class="card col gold-shine" style="gap: 10px; text-align: center; padding: 24px 16px; text-decoration: none; color: inherit; border: 1px solid var(--gold);">
                  <div style="font-size: 36px;">🏆</div>
                  <span class="ttab" style="color: var(--gold); font-size: 13px;">OFFICIAL TOURNAMENT CHAMPION</span>
                  <div class="vt-crest" style="margin: 4px auto;">
                    ${renderSchoolCrest(champSchool, 'c72')}
                  </div>
                  <div class="dsp h-title" style="margin: 0; font-size: 22px; color: var(--tx);">${escapeHtml(champSchool.name)}</div>
                  <div class="lab mut" style="font-size: 13px;">Winner of the 2026 ${escapeHtml(compDisplayName)} Tournament</div>
                  <span class="link-accent lab" style="margin-top: 4px;">View School Profile &rarr;</span>
                </a>

                ${runnerSchool ? `
                  <a href="#school?id=${runnerSchool.id}" class="card row sb" style="align-items: center; padding: 14px 16px; text-decoration: none; color: inherit;">
                    <div class="row" style="gap: 12px; align-items: center;">
                      ${renderSchoolCrest(runnerSchool, 'c40')}
                      <div>
                        <span class="ttab" style="font-size: 11px;">RUNNER-UP 🥈</span>
                        <div style="font-weight: 800; font-size: 15px; color: var(--tx);">${escapeHtml(runnerSchool.name)}</div>
                      </div>
                    </div>
                    <span class="link-accent lab">View &rarr;</span>
                  </a>
                ` : ''}
              ` : `
                <div class="card col" style="text-align: center; padding: 32px 16px; gap: 8px;">
                  <div style="font-size: 32px;">🎖️</div>
                  <div style="font-weight: 800; font-size: 16px; color: var(--tx);">Championship in Progress</div>
                  <div class="lab mut" style="font-size: 13px; max-width: 280px; margin: 0 auto; line-height: 1.5;">
                    The tournament champion will be announced and crowned following the Final match on 14 Nov 2026.
                  </div>
                </div>
              `}
            </div>
          `}
        </div>
        ${renderTabBar()}
      </div>
    `;
  }

  // --- SCREEN 8: SCHOOL DETAIL (RICH BENTO & ACHIEVEMENTS SYSTEM) ---
  function renderSchoolDetailScreen() {
    const feed = State.data || {};
    const schools = feed.schools || [];
    const schoolId = State.routeParams.id || schools[0]?.id;
    const school = schools.find(s => 
      s.id === schoolId || 
      (s.code && s.code.toLowerCase() === (schoolId || '').toLowerCase()) || 
      (s.short_name && s.short_name.toLowerCase().includes((schoolId || '').toLowerCase())) ||
      (s.name && s.name.toLowerCase().includes((schoolId || '').toLowerCase()))
    );
    
    if (State.routeParams.id && !school) {
      return render404Screen('The requested school could not be found.');
    }
    const currentSchool = school || schools[0] || {};
    const contact = currentSchool.contact || {};
    const isFollowed = currentSchool.id === State.followedSchoolId;
    const rank = (schools.findIndex(s => s.id === currentSchool.id) || 0) + 1;

    // Fixtures involving this school
    const schoolFixtures = (feed.fixtures || []).filter(f => f.school_a_id === currentSchool.id || f.school_b_id === currentSchool.id);
    const completedFixtures = schoolFixtures.filter(f => f.status === 'Completed');
    const matchesPlayed = completedFixtures.length;
    const matchesWon = completedFixtures.filter(f => f.winner_school_id === currentSchool.id).length;
    const matchesLost = Math.max(0, matchesPlayed - matchesWon);
    const winRate = matchesPlayed > 0 ? Math.round((matchesWon / matchesPlayed) * 100) : 0;
    const rRing = 16;
    const circRing = 2 * Math.PI * rRing;
    const offsetRing = circRing - (circRing * winRate / 100);

    // Points breakdown
    const bd = getSchoolPointsBreakdown(currentSchool, feed);
    const totalBd = (bd.trackPts + bd.indivPts + bd.teamPts) || 1;
    const pctTrack = Math.round((bd.trackPts / totalBd) * 100);
    const pctIndiv = Math.round((bd.indivPts / totalBd) * 100);
    const pctTeam = Math.max(0, 100 - pctTrack - pctIndiv);

    // Medals won by this school (approved results only)
    const medalsWonList = [];
    (feed.results || []).forEach(r => {
      const p = r.places?.find(pl => pl.school_id === currentSchool.id && pl.rank <= 3);
      if (p) {
        const ev = feed.events?.find(e => e.id === r.event_id);
        medalsWonList.push({
          eventId: r.event_id,
          name: ev?.name || 'Athletics Event',
          category: ev?.category || '',
          gender: ev?.gender || '',
          rank: p.rank,
          points: p.points || 0,
          athlete: p.athlete_name || '',
          studentClass: p.class || ''
        });
      }
    });

    // Highlights (Approved photos involving this school)
    const schoolCode = (currentSchool.code || '').toLowerCase();
    const schoolShort = (currentSchool.short_name || '').toLowerCase();
    const approvedPhotos = deriveAlbums(feed.media, feed).flatMap(a => a.items || []).filter(m => {
      if (m.school_id && m.school_id === currentSchool.id) return true;
      const cap = (m.caption || '').toLowerCase();
      return cap.includes(schoolCode) || cap.includes(schoolShort);
    });

    const activeTab = State.routeParams.tab || State.schoolAchievementsTab || 'matches';

    // Group matches by day (13 Nov Cricket vs 14 Nov Main Games)
    const nov13Matches = schoolFixtures.filter(f => f.day === '2026-11-13' || (f.time && f.time.includes('13 Nov')));
    const nov14Matches = schoolFixtures.filter(f => f.day === '2026-11-14' || !nov13Matches.includes(f));

    return `
      <div class="app" style="padding-bottom: 84px;">
        ${renderAppBar(currentSchool.short_name || 'School Detail', { breadcrumb: 'Scores > ' + (currentSchool.short_name || currentSchool.name), backHref: '#scores?mode=points' })}
        ${renderOfflineBanner()}

        <!-- Hero Header with 6px School Accent Bar & 160px Shield -->
        <section class="arena" style="position: relative; overflow: hidden; padding: 24px 16px 20px; display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center;">
          <div style="position: absolute; top: 0; left: 0; right: 0; height: 6px; background: ${currentSchool.accent_color || 'var(--royal)'};"></div>

          <a href="#scores?mode=points" class="link-accent lab row" style="align-self: flex-start; min-height: 40px; gap: 4px; position: relative; z-index: 1;">
            ${renderIcon('arrow-left')}
            Scores & Standings
          </a>

          <div class="vt-crest" style="margin-top: -4px;">
            ${renderSchoolCrest(currentSchool, 'c160')}
          </div>

          <h1 class="dsp h-title" style="margin: 0; font-size: 24px; position: relative; z-index: 1;">${escapeHtml(currentSchool.name || '')}</h1>
          
          <div class="row" style="gap: 8px; justify-content: center; align-items: center; position: relative; z-index: 1;">
            <span class="st" style="font-size: 12px; padding: 3px 10px; background: var(--alt); font-weight: 700; color: var(--tx);">Rank #${rank} of 6</span>
            <span class="lab" style="color: var(--pri); font-weight: 700; font-size: 13px;">${escapeHtml(contact.campus || currentSchool.short_name)}</span>
          </div>

          <button 
            type="button"
            class="btn ${isFollowed ? 'ghost' : ''}" 
            onclick="window.App.toggleFollow('${currentSchool.id}')" 
            style="min-height: 40px; padding: 0 18px; font-size: 13px; margin-top: 4px; position: relative; z-index: 1;"
          >
            ${isFollowed ? 'Following School ★' : 'Follow This School ☆'}
          </button>
        </section>

        <div class="main">
          <!-- (b) Stat Bento Grid (2x2) -->
          <section class="col" style="gap: 8px; width: 100%;">
            <span class="ttab">School Performance</span>
            <div class="bento-grid">
              <!-- Card 1: Total Points -->
              <div class="bento-card">
                <span class="lab mut" style="font-size: 11px; font-weight: 800; text-transform: uppercase;">Total Points</span>
                <div class="num pts" style="font-size: 36px; line-height: 1;">${currentSchool.points || 0}</div>
                <div class="lab mut" style="font-size: 11px;">Rank #${rank} Overall</div>
              </div>

              <!-- Card 2: Medals Tally (Navigates to Medals Tab) -->
              <a href="#school?id=${currentSchool.id}&tab=medals" class="bento-card" style="text-decoration: none; color: inherit; cursor: pointer;">
                <span class="lab mut" style="font-size: 11px; font-weight: 800; text-transform: uppercase;">Medals Tally</span>
                <div class="row" style="gap: 8px; margin: 4px 0;">
                  <span class="med" style="font-size: 16px;"><b class="g"></b>${currentSchool.medals?.first || 0}</span>
                  <span class="med" style="font-size: 16px;"><b class="s"></b>${currentSchool.medals?.second || 0}</span>
                  <span class="med" style="font-size: 16px;"><b class="z"></b>${currentSchool.medals?.third || 0}</span>
                </div>
                <div class="lab mut" style="font-size: 11px;">${(currentSchool.medals?.first || 0) + (currentSchool.medals?.second || 0) + (currentSchool.medals?.third || 0)} Total Medals &rarr;</div>
              </a>

              <!-- Card 3: Matches Played (Navigates to Matches Tab) -->
              <a href="#school?id=${currentSchool.id}&tab=matches" class="bento-card" style="text-decoration: none; color: inherit; cursor: pointer;">
                <span class="lab mut" style="font-size: 11px; font-weight: 800; text-transform: uppercase;">Matches Played</span>
                <div class="num pts" style="font-size: 36px; line-height: 1;">${matchesPlayed}</div>
                <div class="lab mut" style="font-size: 11px;">${schoolFixtures.length} Total Fixtures &rarr;</div>
              </a>

              <!-- Card 4: Matches Won (Navigates to Matches Tab) -->
              <a href="#school?id=${currentSchool.id}&tab=matches" class="bento-card" style="text-decoration: none; color: inherit; cursor: pointer;">
                <span class="lab mut" style="font-size: 11px; font-weight: 800; text-transform: uppercase;">Matches Won</span>
                <div class="row sb" style="align-items: center;">
                  <div>
                    <div class="num pts" style="font-size: 32px; line-height: 1;">${matchesWon}</div>
                    <div class="lab mut" style="font-size: 11px; margin-top: 2px;">${matchesLost} lost</div>
                  </div>
                  <svg width="42" height="42" viewBox="0 0 42 42" aria-label="Win rate ${winRate}%">
                    <circle cx="21" cy="21" r="16" fill="transparent" stroke="var(--alt)" stroke-width="4"></circle>
                    <circle cx="21" cy="21" r="16" fill="transparent" stroke="var(--gold)" stroke-width="4" stroke-dasharray="${circRing}" stroke-dashoffset="${offsetRing}" stroke-linecap="round" transform="rotate(-90 21 21)"></circle>
                    <text x="21" y="25" text-anchor="middle" font-size="10" font-weight="800" fill="var(--tx)">${winRate}%</text>
                  </svg>
                </div>
                <div class="lab mut" style="font-size: 11px;">${winRate}% Win Rate &rarr;</div>
              </a>
            </div>
          </section>

          <!-- (c) Stacked Points Bar -->
          <section class="card col" style="gap: 10px; width: 100%;">
            <span class="ttab" style="align-self: flex-start; margin-left: -16px; margin-top: -4px;">Points Breakdown</span>
            <div class="stacked-points-bar" role="progressbar" aria-label="Points breakdown: Track ${bd.trackPts}, Field ${bd.indivPts}, Team ${bd.teamPts}">
              <div class="spb-seg-track" style="width: ${pctTrack}%;" title="Track: ${bd.trackPts} pts"></div>
              <div class="spb-seg-indiv" style="width: ${pctIndiv}%;" title="Field / Individual: ${bd.indivPts} pts"></div>
              <div class="spb-seg-team" style="width: ${pctTeam}%;" title="Team: ${bd.teamPts} pts"></div>
            </div>
            <div class="row sb" style="font-size: 12px; flex-wrap: wrap; gap: 6px;">
              <span class="row" style="gap: 4px;"><span style="width: 8px; height: 8px; border-radius: 50%; background: var(--royal); display: inline-block;"></span> Track (${bd.trackPts} pts)</span>
              <span class="row" style="gap: 4px;"><span style="width: 8px; height: 8px; border-radius: 50%; background: var(--cyan); display: inline-block;"></span> Field (${bd.indivPts} pts)</span>
              <span class="row" style="gap: 4px;"><span style="width: 8px; height: 8px; border-radius: 50%; background: var(--gold); display: inline-block;"></span> Team (${bd.teamPts} pts)</span>
            </div>
          </section>

          <!-- (d) Achievements Section with Segmented Tabs -->
          <section class="col" style="gap: 10px; width: 100%;">
            <div class="row sb" style="align-items: baseline;">
              <span class="ttab">Achievements & History</span>
            </div>

            <!-- Segmented Control stored in Hash -->
            <div class="tabs" style="width: 100%;" role="tablist">
              <a 
                href="#school?id=${currentSchool.id}&tab=matches" 
                class="tab ${activeTab === 'matches' ? 'on' : ''}" 
                role="tab"
                aria-selected="${activeTab === 'matches'}"
                style="text-decoration: none;"
              >
                Matches (${schoolFixtures.length})
              </a>
              <a 
                href="#school?id=${currentSchool.id}&tab=medals" 
                class="tab ${activeTab === 'medals' ? 'on' : ''}" 
                role="tab"
                aria-selected="${activeTab === 'medals'}"
                style="text-decoration: none;"
              >
                Medals (${medalsWonList.length})
              </a>
              <a 
                href="#school?id=${currentSchool.id}&tab=trophies" 
                class="tab ${activeTab === 'trophies' ? 'on' : ''}" 
                role="tab"
                aria-selected="${activeTab === 'trophies'}"
                style="text-decoration: none;"
              >
                Trophies
              </a>
            </div>

            <!-- Tab Content -->
            ${activeTab === 'matches' ? `
              <div class="col" style="gap: 14px; width: 100%;">
                ${schoolFixtures.length === 0 ? `
                  <div class="card" style="text-align: center; padding: 24px 16px;">
                    <div class="lab mut">Matches will appear here as they are played.</div>
                  </div>
                ` : `
                  ${nov13Matches.length > 0 ? `
                    <div class="col" style="gap: 8px; width: 100%;">
                      <span class="lab mut" style="font-size: 11px; font-weight: 800; text-transform: uppercase;">Day 1: Friday, 13 Nov 2026 (Cricket)</span>
                      ${nov13Matches.map(f => renderSchoolMatchRow(f, currentSchool, schools, feed)).join('')}
                    </div>
                  ` : ''}

                  ${nov14Matches.length > 0 ? `
                    <div class="col" style="gap: 8px; width: 100%;">
                      <span class="lab mut" style="font-size: 11px; font-weight: 800; text-transform: uppercase;">Day 2: Saturday, 14 Nov 2026 (Fiesta Sports)</span>
                      ${nov14Matches.map(f => renderSchoolMatchRow(f, currentSchool, schools, feed)).join('')}
                    </div>
                  ` : ''}
                `}
              </div>
            ` : activeTab === 'medals' ? `
              <div class="col" style="gap: 10px; width: 100%;">
                ${medalsWonList.length === 0 ? `
                  <div class="card" style="text-align: center; padding: 24px 16px;">
                    <div class="lab mut">Medals will appear here after results are approved.</div>
                  </div>
                ` : medalsWonList.map(m => `
                  <a href="#game?event=${m.eventId}&cat=${encodeURIComponent(m.category)}&gender=${encodeURIComponent(m.gender)}" class="card col ${m.rank === 1 ? 'gold-shine' : ''}" style="gap: 6px; border-left: 4px solid ${m.rank === 1 ? 'var(--gold)' : m.rank === 2 ? 'var(--silver)' : 'var(--bronze)'}; text-decoration: none; color: inherit;">
                    <div class="row sb">
                      <span class="ttab">${m.rank === 1 ? '🥇 Gold Medal' : m.rank === 2 ? '🥈 Silver Medal' : '🥉 Bronze Medal'}</span>
                      <span class="pts num" style="font-size: 16px;">+${m.points} pts</span>
                    </div>
                    <div style="font-weight: 800; font-size: 15px; color: var(--tx);">${escapeHtml(m.name)}</div>
                    <div class="lab mut" style="font-size: 12px;">
                      ${m.athlete ? `<b>${escapeHtml(m.athlete)}</b>` : 'Student'}${m.studentClass ? ` (Class ${escapeHtml(m.studentClass)})` : ''} · ${escapeHtml(m.category)} ${escapeHtml(m.gender)}
                    </div>
                  </a>
                `).join('')}
              </div>
            ` : `
              <div class="col" style="gap: 10px; width: 100%;">
                ${rank === 1 ? `
                  <div class="card col gold-shine" style="gap: 8px; border: 1px solid var(--gold); text-align: center; padding: 20px 16px;">
                    <div style="font-size: 32px;">🏆</div>
                    <div style="font-weight: 800; font-size: 18px; color: var(--tx);">Overall Tournament Leader</div>
                    <div class="lab mut" style="font-size: 13px;">Currently leading the LFGOS Fiesta Standings with ${currentSchool.points || 0} total points.</div>
                  </div>
                ` : ''}
                <div class="card col" style="gap: 8px; text-align: center; padding: 20px 16px;">
                  <div style="font-size: 28px;">🎖️</div>
                  <div style="font-weight: 700; font-size: 15px; color: var(--tx);">Championship Trophies</div>
                  <div class="lab mut" style="font-size: 12.5px; line-height: 1.5;">
                    Overall Championship, Runners-Up, and Best March-Past trophies will be officially presented during the Grand Valedictory Ceremony on 14 Nov 2026.
                  </div>
                </div>
              </div>
            `}
          </section>

          <!-- (e) Highlights Strip (Approved Photos) -->
          ${approvedPhotos.length > 0 ? `
            <section class="col" style="gap: 8px; width: 100%;">
              <span class="ttab">School Moments</span>
              <div style="display: flex; gap: 10px; overflow-x: auto; scroll-snap-type: x mandatory; padding-bottom: 6px;">
                ${approvedPhotos.map(p => `
                  <div style="flex: 0 0 200px; scroll-snap-align: start; border-radius: 14px; overflow: hidden; background: var(--alt); border: 1px solid var(--ln);">
                    <img src="${p.file_url || p.url}" alt="${escapeHtml(p.caption || 'School highlight')}" loading="lazy" style="width: 100%; aspect-ratio: 16/10; object-fit: cover;">
                  </div>
                `).join('')}
              </div>
            </section>
          ` : ''}

          <!-- (f) Campus & Contact Block -->
          ${(contact && (contact.photo || contact.address || contact.website)) ? `
          <section class="card col" style="gap: 14px; width: 100%;">
            <span class="ttab" style="align-self: flex-start; margin-left: -16px; margin-top: -4px;">Campus & Location</span>
            
            ${contact.photo ? `
              <div style="width: 100%; height: 160px; border-radius: 14px; overflow: hidden; background: var(--alt);">
                <img src="${contact.photo}" alt="${escapeHtml(currentSchool.name)} campus" loading="lazy" decoding="async" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.style.display='none'">
              </div>
            ` : ''}

            ${contact.address ? `
              <div class="row" style="align-items: flex-start; gap: 8px;">
                ${renderIcon('info', 'lucide-ic')}
                <div class="fl" style="min-width: 0;">
                  <div style="font-weight: 700; font-size: 14px;">${escapeHtml(contact.address)}</div>
                  <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(contact.address)}" target="_blank" rel="noopener noreferrer" class="link-accent lab" style="display: inline-block; margin-top: 4px;">Open in Google Maps &nearr;</a>
                </div>
              </div>
            ` : ''}

            ${contact.website ? `
              <div class="row sb" style="border-top: 1px solid var(--ln); padding-top: 10px; align-items: center;">
                <span class="lab mut">Official Website</span>
                <a href="${contact.website}" target="_blank" rel="noopener noreferrer" class="link-accent lab">${contact.website.replace(/^https?:\/\//, '').replace(/\/$/, '')} &nearr;</a>
              </div>
            ` : ''}
          </section>
          ` : ''}
        </div>

        ${renderTabBar()}
      </div>
    `;
  }

  function renderSchoolMatchRow(f, currentSchool, schools, feed) {
    const isSchoolA = f.school_a_id === currentSchool.id;
    const oppId = isSchoolA ? f.school_b_id : f.school_a_id;
    const oppSchool = schools.find(s => s.id === oppId);
    const comp = feed.competitions?.find(c => c.id === f.competition_id);
    const isWon = f.status === 'Completed' && f.winner_school_id === currentSchool.id;
    const isLost = f.status === 'Completed' && f.winner_school_id && f.winner_school_id !== currentSchool.id;

    return `
      <div class="card col" style="gap: 8px;">
        <div class="row sb">
          <a href="#team?comp=${comp?.id}&tab=fixtures" class="ttab link-accent" style="text-decoration: none;">${escapeHtml(comp?.name || 'Match')} · ${escapeHtml(f.round || '')}</a>
          <div>
            ${isWon ? '<span class="chip-win">WIN</span>' : isLost ? '<span class="chip-loss">LOSS</span>' : f.status === 'Live' ? '<span class="badge-live-pulse"><i></i> LIVE</span>' : `<span class="st">${escapeHtml(f.status || 'Scheduled')}</span>`}
          </div>
        </div>
        <a href="#match?id=${f.id}" class="row sb" style="align-items: center; padding: 4px 0; text-decoration: none; color: inherit;">
          <div class="row" style="gap: 8px; min-width: 0; flex: 1;">
            ${renderSchoolCrest(currentSchool, 'c32')}
            <span style="font-weight: 800; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${currentSchool.short_name}</span>
          </div>
          <span class="lab mut" style="font-weight: 800; padding: 0 8px;">VS</span>
          <div class="row" style="gap: 8px; min-width: 0; flex: 1; justify-content: flex-end;">
            <span style="font-weight: 600; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${oppSchool?.short_name || 'Opponent'}</span>
            ${renderSchoolCrest(oppSchool, 'c32')}
          </div>
        </a>
        <div class="row sb" style="border-top: 1px solid var(--ln); padding-top: 6px; font-size: 12px;">
          <span class="lab mut">${escapeHtml(f.time || '')} · ${escapeHtml(f.ground || EVENT_CONFIG.venue)}</span>
          <a href="#match?id=${f.id}" class="link-accent lab">Details &rarr;</a>
        </div>
      </div>
    `;
  }

  // --- SCREEN 9: EVENT INFO (MANDATORY 3-LINE FOOTER ONLY HERE) ---
  function renderEventInfoScreen() {
    return `
      <div class="app" style="padding-bottom: 96px;">
        ${renderAppBar('Event Information')}
        ${renderOfflineBanner()}
        <div class="main">
          <section class="card col" style="gap: 10px;">
            <div class="dsp h-title" style="margin: 0; color: var(--pri); font-size: 26px;">${EVENT_CONFIG.title}</div>
            <div class="lab" style="font-size: 15px;">Hosted by ${EVENT_CONFIG.hostedBy}</div>
            <div class="lab mut">Official tournament and live scoring app for Little Flower Group of Schools.</div>
          </section>

          <section class="card col" style="gap: 10px;">
            <span class="ttab" style="align-self: flex-start; margin-left: -16px; margin-top: -4px;">Match Days</span>
            <div class="col" style="gap: 8px;">
              <div class="row sb" style="padding: 6px 0; border-bottom: 1px solid var(--ln);">
                <div>
                  <div style="font-weight: 700; font-size: 15px;">Friday 13 Nov 2026</div>
                  <div class="lab mut">Opening Day</div>
                </div>
                <span class="st" style="background: var(--alt);">Cricket Only</span>
              </div>
              <div class="row sb" style="padding: 6px 0;">
                <div>
                  <div style="font-weight: 700; font-size: 15px; color: var(--pri);">Saturday 14 Nov 2026</div>
                  <div class="lab mut">Finals Day</div>
                </div>
                <span class="st lv" style="font-size: 11px;">All Games & Live Stream</span>
              </div>
            </div>
          </section>

          <section class="card col" style="gap: 10px;">
            <span class="ttab" style="align-self: flex-start; margin-left: -16px; margin-top: -4px;">Official Venue</span>
            <div style="font-weight: 700; font-size: 16px;">${EVENT_CONFIG.venue}</div>
            <a href="${EVENT_CONFIG.venueMapsUrl}" target="_blank" rel="noopener noreferrer" class="link-accent lab">Open in Google Maps &nearr;</a>
          </section>

          <section class="card col" style="gap: 10px;">
            <span class="ttab" style="align-self: flex-start; margin-left: -16px; margin-top: -4px;">Contact</span>
            <div>For circulars and official information, visit the school group portal:</div>
            <a href="${EVENT_CONFIG.officialWebsite}" target="_blank" rel="noopener noreferrer" class="link-accent lab" style="font-size: 15px;">
              ${EVENT_CONFIG.contactLabel} &nearr;
            </a>
          </section>

          <!-- Exact 3-line mandatory footer strictly on Event Info -->
          <footer class="credits-footer" style="margin-top: 24px; text-align: center; color: var(--mut); font-size: 12px; line-height: 1.6; padding-bottom: 16px;">
            <div>© 2026 LFGOS Group. All rights reserved.</div>
            <div>App, score management and live stream powered by LFIS Mau.</div>
            <div>Developed by Cyber Club, LFIS Mau.</div>
          </footer>
        </div>
        ${renderTabBar()}
      </div>
    `;
  }

  // --- SCREEN 10: SETTINGS (SOUND, HAPTICS, MOTION, NOTIFICATIONS) ---
  function renderSettingsScreen() {
    const feed = State.data || {};
    const schools = feed.schools || [];
    const followedSchool = State.followedSchoolId ? schools.find(s => s.id === State.followedSchoolId) : null;

    return `
      <div class="app" style="padding-bottom: 84px;">
        ${renderAppBar('Settings')}
        <div class="main col" style="gap: 14px;">
          <!-- Appearance -->
          <section class="card col" style="gap: 12px;">
            <span class="ttab" style="align-self: flex-start; margin-left: -16px; margin-top: -4px;">Appearance</span>
            <div class="seg-48" role="group" aria-label="Theme selection">
              <button type="button" class="${State.theme === 'light' ? 'on' : ''}" onclick="window.App.setTheme('light')">Light</button>
              <button type="button" class="${State.theme === 'dark' ? 'on' : ''}" onclick="window.App.setTheme('dark')">Dark</button>
              <button type="button" class="${State.theme === 'auto' ? 'on' : ''}" onclick="window.App.setTheme('auto')">Auto</button>
            </div>
          </section>

          <!-- Followed School -->
          <section class="card col" style="gap: 10px;">
            <span class="ttab" style="align-self: flex-start; margin-left: -16px; margin-top: -4px;">My Followed School</span>
            ${followedSchool ? `
              <a href="#school?id=${followedSchool.id}" class="row sb" style="align-items: center; text-decoration: none; color: inherit; padding: 6px 0;">
                <div class="row" style="gap: 10px; align-items: center;">
                  ${renderSchoolCrest(followedSchool, 'c40')}
                  <div>
                    <div style="font-weight: 800; font-size: 15px; color: var(--tx);">${escapeHtml(followedSchool.name)}</div>
                    <div class="lab mut" style="font-size: 12px;">${followedSchool.points || 0} pts · Following ★</div>
                  </div>
                </div>
                <span class="link-accent lab">View &rarr;</span>
              </a>
              <button type="button" class="btn ghost" onclick="window.App.toggleFollow('${followedSchool.id}')" style="min-height: 38px; font-size: 12.5px; align-self: flex-start;">
                Unfollow School
              </button>
            ` : `
              <div class="lab mut" style="font-size: 13px;">No school followed yet. Tap "Follow" on any school's page to track its points and fixtures.</div>
              <a href="#scores" class="link-accent lab" style="align-self: flex-start; margin-top: 4px;">Choose School from Standings &rarr;</a>
            `}
          </section>

          <!-- Sound & Audio Controls (OFF by Default) -->
          <section class="card col" style="gap: 12px;">
            <div class="row sb">
              <div>
                <div style="font-weight: 700; font-size: 15px;">Sound Effects</div>
                <div class="lab mut" style="font-size: 12px;">Match chimes and score alerts</div>
              </div>
              <button 
                type="button"
                class="chip ${State.soundEnabled ? 'on' : ''}" 
                onclick="window.App.toggleSound()"
                style="min-height: 36px; padding: 0 14px;"
              >
                ${State.soundEnabled ? 'ON' : 'OFF'}
              </button>
            </div>

            ${State.soundEnabled ? `
              <div style="margin-top: 4px;">
                <div class="row sb" style="margin-bottom: 6px;">
                  <span class="lab mut" style="font-size: 12px;">Volume</span>
                  <span class="lab" style="font-weight: 700; font-size: 12px;">${Math.round(State.soundVolume * 100)}%</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.05" 
                  value="${State.soundVolume}" 
                  onchange="window.App.setSoundVolume(parseFloat(this.value))"
                  aria-label="Sound effects volume"
                  style="width: 100%; accent-color: var(--royal);"
                >
                <button type="button" class="chip" onclick="window.App.testSound()" style="margin-top: 8px; font-size: 12px; align-self: flex-start;">
                  🔊 Test Sound Chime
                </button>
              </div>
            ` : ''}

            <!-- Haptics Toggle -->
            <div class="row sb" style="border-top: 1px solid var(--ln); padding-top: 10px;">
              <div>
                <div style="font-weight: 700; font-size: 15px;">Haptic Feedback</div>
                <div class="lab mut" style="font-size: 12px;">Gentle vibration on alerts (Android)</div>
              </div>
              <button 
                type="button"
                class="chip ${State.hapticsEnabled ? 'on' : ''}" 
                onclick="window.App.toggleHaptics()"
                style="min-height: 36px; padding: 0 14px;"
              >
                ${State.hapticsEnabled ? 'ON' : 'OFF'}
              </button>
            </div>
          </section>

          <!-- Motion & Animation Controls -->
          <section class="card col" style="gap: 12px;">
            <span class="ttab" style="align-self: flex-start; margin-left: -16px; margin-top: -4px;">Motion & Effects</span>
            <div class="seg-48" role="group" aria-label="Motion preference">
              <button type="button" class="${State.motionPreference === 'auto' ? 'on' : ''}" onclick="window.App.setMotion('auto')">Auto</button>
              <button type="button" class="${State.motionPreference === 'full' ? 'on' : ''}" onclick="window.App.setMotion('full')">Full</button>
              <button type="button" class="${State.motionPreference === 'reduced' ? 'on' : ''}" onclick="window.App.setMotion('reduced')">Reduced</button>
            </div>
            <div class="lab mut" style="font-size: 12px;">Respects your operating system reduced-motion settings by default.</div>
          </section>

          <!-- In-App Notification Preferences -->
          <section class="card col" style="gap: 12px;">
            <span class="ttab" style="align-self: flex-start; margin-left: -16px; margin-top: -4px;">Notification Categories</span>
            <div class="col" style="gap: 8px;">
              <label class="row sb" style="padding: 6px 0; border-bottom: 1px solid var(--ln); cursor: pointer;">
                <div>
                  <div style="font-weight: 600; font-size: 14px;">Followed School Only</div>
                  <div class="lab mut" style="font-size: 11px;">Filter alerts to only your followed school</div>
                </div>
                <input type="checkbox" aria-label="Followed school only alerts" ${State.notifPrefs.followedOnly ? 'checked' : ''} onchange="window.App.setNotifPref('followedOnly', this.checked)">
              </label>
              <label class="row sb" style="padding: 6px 0; border-bottom: 1px solid var(--ln); cursor: pointer;">
                <span>Approved Results</span>
                <input type="checkbox" aria-label="Approved Results notifications" ${State.notifPrefs.results ? 'checked' : ''} onchange="window.App.setNotifPref('results', this.checked)">
              </label>
              <label class="row sb" style="padding: 6px 0; border-bottom: 1px solid var(--ln); cursor: pointer;">
                <span>Live Stream Alerts</span>
                <input type="checkbox" aria-label="Live Stream alerts" ${State.notifPrefs.live ? 'checked' : ''} onchange="window.App.setNotifPref('live', this.checked)">
              </label>
              <label class="row sb" style="padding: 6px 0; border-bottom: 1px solid var(--ln); cursor: pointer;">
                <span>Official Announcements</span>
                <input type="checkbox" aria-label="Official Announcements" ${State.notifPrefs.announcements ? 'checked' : ''} onchange="window.App.setNotifPref('announcements', this.checked)">
              </label>
              <label class="row sb" style="padding: 6px 0; border-bottom: 1px solid var(--ln); cursor: pointer;">
                <span>Match Live / Finished</span>
                <input type="checkbox" aria-label="Match Live or Finished notifications" ${State.notifPrefs.matches ? 'checked' : ''} onchange="window.App.setNotifPref('matches', this.checked)">
              </label>
              <label class="row sb" style="padding: 6px 0; cursor: pointer;">
                <span>Leaderboard Shifts</span>
                <input type="checkbox" aria-label="Leaderboard Shifts notifications" ${State.notifPrefs.ranks ? 'checked' : ''} onchange="window.App.setNotifPref('ranks', this.checked)">
              </label>
            </div>
          </section>

          <!-- Layer 2 Web Push Information (Read-Only Status) -->
          <section class="card col" style="gap: 8px;">
            <span class="ttab" style="align-self: flex-start; margin-left: -16px; margin-top: -4px;">Web Push Status</span>
            <div class="lab" style="font-size: 13.5px; font-weight: 700;">In-App Alerts: Active (Layer 1)</div>
            <div class="lab mut" style="font-size: 12px; line-height: 1.5;">
              Alerts and reminders work while the application is open. Web Push (Layer 2) requires server endpoint approval and home screen installation on iOS 16.4+.
            </div>
          </section>
        </div>
        ${renderTabBar()}
      </div>
    `;
  }

  // --- NOTIFICATION CENTRE MODAL BOTTOM SHEET (ROOT LEVEL) ---
  function renderNotificationDrawer() {
    const unreadCount = State.notifications.filter(n => n.unread).length;
    const now = Date.now();
    const ONE_DAY = 24 * 60 * 60 * 1000;
    const todayNotifs = State.notifications.filter(n => (now - (n.timestamp || now)) < ONE_DAY);
    const earlierNotifs = State.notifications.filter(n => (now - (n.timestamp || now)) >= ONE_DAY);

    const renderItem = (n) => `
      <div 
        class="notif-item ${n.unread ? 'unread' : ''}" 
        onclick="window.App.handleNotificationClick('${n.id}', '${n.link || ''}')"
        role="button"
        tabindex="0"
        aria-label="${escapeHtml(n.title)}. ${escapeHtml(n.body || '')}"
      >
        <div class="notif-icon-box">
          ${renderIcon(n.icon || 'trophy')}
        </div>
        <div class="fl" style="min-width: 0;">
          <div class="row sb">
            <span style="font-weight: 800; font-size: 13.5px; color: var(--tx); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(n.title)}</span>
            <span class="lab mut" style="font-size: 11px; flex-shrink: 0; margin-left: 8px;">${escapeHtml(n.time || '')}</span>
          </div>
          <div class="lab mut" style="font-size: 12px; margin-top: 2px; line-height: 1.4;">${escapeHtml(n.body || '')}</div>
        </div>
      </div>
    `;

    return `
      <div 
        id="notif-sheet-backdrop"
        class="modal-bottom-sheet-backdrop ${State.notifSheetOpen ? 'open' : ''}" 
        onclick="window.App.toggleNotifSheet(false)"
        ${State.notifSheetOpen ? '' : 'style="display: none;" aria-hidden="true"'}
      ></div>
      <div 
        id="notif-sheet"
        class="modal-bottom-sheet ${State.notifSheetOpen ? 'open' : ''}"
        role="dialog"
        aria-modal="true"
        aria-label="Notification Center"
        ${State.notifSheetOpen ? '' : 'style="display: none;" aria-hidden="true" inert'}
      >
        <div class="sheet-drag-handle" aria-hidden="true"></div>
        <div class="row sb" style="margin-bottom: 12px; align-items: center;">
          <h2 class="dsp h-title" style="margin: 0; font-size: 20px;">
            Notifications ${unreadCount > 0 ? `(${unreadCount})` : ''}
          </h2>
          <button 
            type="button"
            onclick="window.App.toggleNotifSheet(false)" 
            aria-label="Close Notifications" 
            style="min-width: 48px; min-height: 48px; display: grid; place-items: center; background: none; border: 0; cursor: pointer; color: var(--tx); border-radius: 50%;"
          >
            ${renderIcon('x')}
          </button>
        </div>

        ${State.notifications.length > 0 ? `
          <div class="row sb" style="margin-bottom: 12px;">
            <button class="chip" onclick="window.App.markAllNotificationsRead()" style="min-height: 36px; padding: 0 14px; font-size: 12px; font-weight: 700;">
              Mark all read
            </button>
            <button class="chip" onclick="window.App.clearAllNotifications()" style="min-height: 36px; padding: 0 14px; font-size: 12px; background: none; border: 1px solid var(--ln); color: var(--mut);">
              Clear all
            </button>
          </div>
        ` : ''}

        ${State.notifications.length === 0 ? `
          <div class="notif-empty-box">
            <div class="notif-bell-illustration" aria-hidden="true">
              ${renderIcon('bell')}
            </div>
            <div style="font-weight: 800; font-size: 16px; color: var(--tx);">No notifications yet</div>
            <div class="lab mut" style="font-size: 13px; max-width: 280px; line-height: 1.5;">
              Results, live alerts and announcements will appear here.
            </div>
          </div>
        ` : `
          <div class="notif-list">
            ${todayNotifs.length > 0 ? `
              <div class="col" style="gap: 8px;">
                <span class="lab mut" style="font-size: 11px; font-weight: 800; text-transform: uppercase;">Today</span>
                ${todayNotifs.map(renderItem).join('')}
              </div>
            ` : ''}

            ${earlierNotifs.length > 0 ? `
              <div class="col" style="gap: 8px; margin-top: 8px;">
                <span class="lab mut" style="font-size: 11px; font-weight: 800; text-transform: uppercase;">Earlier</span>
                ${earlierNotifs.map(renderItem).join('')}
              </div>
            ` : ''}
          </div>
        `}
      </div>
    `;
  }

  // --- SCREEN: SEARCH FIESTA ---
  function renderSearchScreen() {
    const feed = State.data || {};
    const q = (State.searchQuery || '').trim().toLowerCase();
    const schools = feed.schools || [];
    const events = feed.events || [];
    const competitions = feed.competitions || [];

    const matchedSchools = q ? schools.filter(s => 
      (s.name && s.name.toLowerCase().includes(q)) || 
      (s.short_name && s.short_name.toLowerCase().includes(q)) || 
      (s.code && s.code.toLowerCase().includes(q))
    ) : [];

    const matchedEvents = q ? events.filter(e => 
      (e.name && e.name.toLowerCase().includes(q)) || 
      (e.category && e.category.toLowerCase().includes(q))
    ) : [];

    const matchedComps = q ? competitions.filter(c => 
      (c.name && c.name.toLowerCase().includes(q)) || 
      (c.gender && c.gender.toLowerCase().includes(q))
    ) : [];

    return `
      <div class="app" style="padding-bottom: 84px;">
        ${renderAppBar('Search Fiesta')}
        ${renderOfflineBanner()}
        <div class="main col" style="gap: 16px;">
          <!-- Search Input Box (48px Touch Target) -->
          <section class="card col" style="gap: 10px; width: 100%;">
            <div class="search-input-wrap" style="position: relative; display: flex; align-items: center; width: 100%;">
              <span style="position: absolute; left: 14px; pointer-events: none; color: var(--mut); display: flex;">
                ${renderIcon('search')}
              </span>
              <input 
                type="search" 
                id="fiesta-search-input" 
                placeholder="Search schools, games, athletes..." 
                value="${escapeHtml(State.searchQuery || '')}"
                oninput="window.App.handleSearchInput(this.value)"
                aria-label="Search schools and events"
                style="width: 100%; min-height: 48px; border-radius: 12px; background: var(--alt); border: 1px solid var(--ln); color: var(--tx); padding: 0 42px 0 44px; font-size: 15px; outline: none;"
              >
              ${State.searchQuery ? `
                <button 
                  type="button" 
                  onclick="window.App.handleSearchInput('')" 
                  aria-label="Clear search" 
                  style="position: absolute; right: 8px; width: 36px; height: 36px; border: 0; background: none; color: var(--mut); cursor: pointer; display: grid; place-items: center;"
                >
                  ${renderIcon('x')}
                </button>
              ` : ''}
            </div>

            <!-- Suggested / Quick Search Chips -->
            <div class="row" style="gap: 6px; flex-wrap: wrap; align-items: center; margin-top: 4px;">
              <span class="lab mut" style="font-size: 11px; font-weight: 700;">SUGGESTIONS:</span>
              ${['Sikatiya', 'Ghosi', '100m', 'Cricket', 'Kabaddi', 'Relay'].map(term => `
                <button 
                  type="button" 
                  class="chip" 
                  onclick="window.App.handleSearchInput('${term}')" 
                  style="min-height: 32px; padding: 0 12px; font-size: 12px;"
                >
                  ${term}
                </button>
              `).join('')}
            </div>
          </section>

          <!-- Search Results -->
          ${!q ? `
            <div class="card col" style="text-align: center; padding: 32px 16px; gap: 8px;">
              <div style="font-size: 28px;">🔍</div>
              <div style="font-weight: 700; font-size: 15px; color: var(--tx);">Search the Sports Fiesta</div>
              <div class="lab mut" style="font-size: 13px; max-width: 260px; margin: 0 auto; line-height: 1.4;">
                Type a school name, sport event, or track race to quickly jump to its live results.
              </div>
            </div>
          ` : (matchedSchools.length === 0 && matchedEvents.length === 0 && matchedComps.length === 0) ? `
            <div class="card col" style="text-align: center; padding: 32px 16px; gap: 8px;">
              <div style="font-size: 28px;">📂</div>
              <div style="font-weight: 700; font-size: 15px; color: var(--tx);">No matching results found</div>
              <div class="lab mut" style="font-size: 13px;">No schools or events found matching "${escapeHtml(q)}".</div>
            </div>
          ` : `
            <div class="col" style="gap: 14px; width: 100%;">
              ${matchedSchools.length > 0 ? `
                <section class="col" style="gap: 8px; width: 100%;">
                  <span class="ttab">Schools (${matchedSchools.length})</span>
                  <div class="col" style="gap: 6px; width: 100%;">
                    ${matchedSchools.map(s => `
                      <a href="#school?id=${s.id}" class="card row sb" style="align-items: center; padding: 12px 16px; text-decoration: none; color: inherit; min-height: 48px;">
                        <div class="row" style="gap: 12px; align-items: center; min-width: 0; flex: 1;">
                          ${renderSchoolCrest(s, 'c36')}
                          <div class="fl" style="min-width: 0;">
                            <div style="font-weight: 800; font-size: 14px; color: var(--tx);">${escapeHtml(s.name)}</div>
                            <div class="lab mut" style="font-size: 12px;">Rank #${schools.findIndex(x => x.id === s.id) + 1} · ${s.points || 0} pts</div>
                          </div>
                        </div>
                        <span class="link-accent lab">View &rarr;</span>
                      </a>
                    `).join('')}
                  </div>
                </section>
              ` : ''}

              ${matchedEvents.length > 0 ? `
                <section class="col" style="gap: 8px; width: 100%;">
                  <span class="ttab">Track & Field Events (${matchedEvents.length})</span>
                  <div class="col" style="gap: 6px; width: 100%;">
                    ${matchedEvents.map(e => `
                      <a href="#game?event=${e.id}&cat=${encodeURIComponent(e.category || '')}&gender=${encodeURIComponent(e.gender || '')}" class="card row sb" style="align-items: center; padding: 12px 16px; text-decoration: none; color: inherit; min-height: 48px;">
                        <div class="fl" style="min-width: 0;">
                          <div style="font-weight: 800; font-size: 14px; color: var(--tx);">${escapeHtml(e.name)}</div>
                          <div class="lab mut" style="font-size: 12px;">${escapeHtml(e.category)} · ${escapeHtml(e.gender)}</div>
                        </div>
                        <span class="link-accent lab">View &rarr;</span>
                      </a>
                    `).join('')}
                  </div>
                </section>
              ` : ''}

              ${matchedComps.length > 0 ? `
                <section class="col" style="gap: 8px; width: 100%;">
                  <span class="ttab">Team Competitions (${matchedComps.length})</span>
                  <div class="col" style="gap: 6px; width: 100%;">
                    ${matchedComps.map(c => `
                      <a href="#team?comp=${c.id}&tab=fixtures" class="card row sb" style="align-items: center; padding: 12px 16px; text-decoration: none; color: inherit; min-height: 48px;">
                        <div class="fl" style="min-width: 0;">
                          <div style="font-weight: 800; font-size: 14px; color: var(--tx);">${escapeHtml(c.name)}</div>
                          <div class="lab mut" style="font-size: 12px;">${escapeHtml(c.gender)} · Team Sport</div>
                        </div>
                        <span class="link-accent lab">View &rarr;</span>
                      </a>
                    `).join('')}
                  </div>
                </section>
              ` : ''}
            </div>
          `}
        </div>
        ${renderTabBar()}
      </div>
    `;
  }

  // --- SCREEN 11: 404 NOT FOUND ---
  function render404Screen(message = 'The requested screen, school, or fixture does not exist.') {
    return `
      <div class="app" style="padding-bottom: 84px;">
        ${renderAppBar('Page Not Found')}
        <div class="main" style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 50vh; text-align: center; gap: 12px; padding: 24px 16px;">
          <div class="dsp" style="font-size: 64px; color: var(--mut); line-height: 1;">404</div>
          <div class="dsp h-sec" style="margin: 0; font-size: 20px;">Resource Not Found</div>
          <div class="lab mut" style="font-size: 14px; max-width: 300px; line-height: 1.5;">${escapeHtml(message)}</div>
          <div class="row" style="gap: 12px; margin-top: 8px;">
            <button type="button" class="btn" onclick="window.App.navigate('home')" style="min-height: 48px; padding: 0 20px; display: inline-flex; align-items: center; cursor: pointer;">Return to Home</button>
            <button type="button" class="btn ghost" onclick="history.back()" style="min-height: 48px; padding: 0 20px;">Go Back</button>
          </div>
        </div>
        ${renderTabBar()}
      </div>
    `;
  }

  // --- COLD START / WARMING UP SKELETON SCREEN ---
  function renderWarmingUpSkeleton() {
    const dark = isDarkMode();
    const logoSrc = dark ? './assets/logo-dark.png' : './assets/logo.png';
    return `
      <div class="fullscreen-loader" role="status" aria-label="Loading LFGOS Sports Fiesta 2026">
        <div class="loader-logo-ring">
          <svg class="loader-ring-svg" viewBox="0 0 120 120" aria-hidden="true">
            <circle class="loader-ring-circle" cx="60" cy="60" r="54" />
          </svg>
          <div class="loader-logo-circle">
            <img src="${logoSrc}" alt="Fiesta" style="width: 100%; height: 100%; object-fit: contain;" onerror="this.src='./fiesta.png'">
          </div>
        </div>
        <div class="dsp" style="font-size: 20px; font-weight: 800; color: var(--tx); margin-top: 8px;">Connecting to Live Feed...</div>
        <div class="lab mut" style="font-size: 13px; text-align: center; max-width: 280px;">Sports Fiesta 2026</div>
      </div>
    `;
  }

  // --- APP RENDER ROOT ---
  function renderApp() {
    const root = document.getElementById('app-root');
    if (!root) return;

    if (State.isWarmingUp && !State.data) {
      root.innerHTML = getLucideSpriteSvg() + renderWarmingUpSkeleton() + renderNotificationDrawer();
      return;
    }

    let screenHtml = '';
    try {
      switch (State.currentRoute) {
        case 'home':
          screenHtml = renderHomeScreen();
          break;
        case 'scores':
        case 'schools':
          screenHtml = renderScoresScreen();
          break;
        case 'school':
        case 'schoolDetail':
          screenHtml = renderSchoolDetailScreen();
          break;
        case 'games':
          screenHtml = renderGamesScreen();
          break;
        case 'game':
        case 'gameIndividual':
          screenHtml = renderGameIndividualScreen();
          break;
        case 'team':
        case 'gameTeam':
          screenHtml = renderGameTeamScreen();
          break;
        case 'live':
          screenHtml = renderLiveScreen();
          break;
        case 'photos':
        case 'photo':
        case 'photoViewer':
          screenHtml = renderPhotosScreen();
          break;
        case 'fixtures':
          screenHtml = renderFixturesScreen();
          break;
        case 'match':
        case 'matchDetail':
          screenHtml = renderMatchDetailScreen();
          break;
        case 'search':
          screenHtml = renderSearchScreen();
          break;
        case 'info':
        case 'eventInfo':
          screenHtml = renderEventInfoScreen();
          break;
        case 'settings':
          screenHtml = renderSettingsScreen();
          break;
        case 'notifications':
          State.notifSheetOpen = true;
          screenHtml = renderHomeScreen();
          break;
        default:
          screenHtml = render404Screen();
          break;
      }
    } catch (err) {
      console.error('[Fiesta Screen Render Error]', err);
      screenHtml = `
        <div class="app" style="padding-bottom: 84px;">
          ${renderAppBar('LFGOS Sports Fiesta 2026')}
          <div class="main" style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 50vh; text-align: center; gap: 12px;">
            <div style="font-weight: 800; font-size: 18px; color: var(--tx);">Screen Display Error</div>
            <div class="lab mut" style="font-size: 13px; max-width: 280px; line-height: 1.5;">An error occurred while loading this view.</div>
            <button class="btn btn-secondary" onclick="window.App.retrySection()" style="margin-top: 8px; padding: 10px 20px;">Retry</button>
          </div>
          ${renderTabBar()}
        </div>
      `;
    }

    root.innerHTML = getLucideSpriteSvg() + screenHtml + renderNotificationDrawer();
    renderToasts();
  }

  // --- SPLASH SCREEN LIFECYCLE ---
  function dismissSplash() {
    const splash = document.getElementById('splash-screen');
    if (!splash || splash.classList.contains('fade-out')) return;
    try {
      sessionStorage.setItem('fiesta_splash_done', 'true');
    } catch(e) {}
    splash.classList.add('fade-out');
    setTimeout(() => {
      try {
        if (splash.parentNode) splash.parentNode.removeChild(splash);
      } catch(e) {}
      document.body.classList.add('no-splash');
    }, 350);
  }
  window.dismissSplash = dismissSplash;

  // --- INITIALIZATION ---
  async function init() {
    // Session-scoped splash bypass
    let splashDone = false;
    try {
      splashDone = !!sessionStorage.getItem('fiesta_splash_done');
    } catch(e) {}

    const splash = document.getElementById('splash-screen');
    if (splashDone && splash) {
      if (splash.parentNode) splash.parentNode.removeChild(splash);
      document.body.classList.add('no-splash');
    } else if (splash) {
      // Normal splash duration: max 1.8s
      setTimeout(() => {
        dismissSplash();
      }, 1500);
    }

    const cached = await getCachedFeed();
    if (cached && cached.data) {
      State.data = cached.data;
      State.etag = cached.etag;
      State.lastSavedTime = cached.savedAt;
    }

    const { route, params } = parseHashRoute();
    State.currentRoute = route;
    State.routeParams = params;

    // Apply saved theme immediately
    applyTheme(State.theme);

    // ESC key listener for modal sheets
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (State.notifSheetOpen) {
          window.App.toggleNotifSheet(false);
        }
        if (State.filterSheetOpen) {
          window.App.toggleFilterSheet(false);
        }
      }
    });

    // Single URL mode: parse initial route from hash if present (e.g. #fixtures) then clean URL
    if (location.hash) {
      const { route: initialRoute, params: initialParams } = parseHashRoute();
      State.currentRoute = initialRoute;
      State.routeParams = initialParams;
      if (window.history && window.history.replaceState) {
        window.history.replaceState({ route: initialRoute, params: initialParams }, '', window.location.pathname || '/');
      }
    }

    renderApp();
    fetchPublicFeed();

    // Global link interceptor: Prevent #hash slugging in browser address bar (single URL only)
    document.addEventListener('click', (e) => {
      const anchor = e.target.closest('a[href^="#"]');
      if (anchor) {
        const href = anchor.getAttribute('href');
        if (href && href.startsWith('#')) {
          e.preventDefault();
          const raw = href.slice(1);
          const [pathPart, queryPart] = raw.split('?');
          const params = {};
          if (queryPart) {
            queryPart.split('&').forEach(pair => {
              const [k, v] = pair.split('=');
              if (k) params[decodeURIComponent(k)] = decodeURIComponent(v || '');
            });
          }
          navigate(pathPart || 'home', params);
        }
      }
    });

    window.addEventListener('hashchange', () => {
      const { route: newRoute, params: newParams } = parseHashRoute();
      navigate(newRoute, newParams);
    });

    window.addEventListener('popstate', (e) => {
      if (e.state && e.state.route) {
        State.currentRoute = e.state.route;
        State.routeParams = e.state.params || {};
        transitionView(() => renderApp());
      }
    });
  }

  // --- PUBLIC API FOR INLINE DOM HANDLERS ---
  window.State = State;
  window.SoundEngine = SoundEngine;
  window.App = {
    renderApp: () => renderApp(),
    navigate,
    setTheme(theme) {
      applyTheme(theme);
      transitionView(() => renderApp());
    },
    cycleTheme,
    retrySection() {
      fetchPublicFeed();
      renderApp();
    },
    setSchoolAchievementsTab(tab) {
      State.schoolAchievementsTab = tab;
      renderApp();
    },
    setLiveSubTab(tab) {
      State.liveSubTab = tab;
      transitionView(() => renderApp());
    },
    openAlbum(albumId) {
      State.selectedAlbumId = albumId;
      transitionView(() => renderApp());
    },
    openPhotoSwipe(index) {
      openPhotoSwipe(index);
    },
    downloadPhoto(url, filename) {
      downloadPhoto(url, filename);
    },
    setFixtureDay(day) {
      State.fixtureDay = day;
      transitionView(() => renderApp());
    },
    setFixtureFilter(key, val) {
      State.fixtureFilters[key] = val;
      renderApp();
    },
    clearFixtureFilters() {
      State.fixtureFilters = { game: 'all', school: 'all', status: 'all' };
      renderApp();
    },
    toggleFilterSheet(open) {
      State.filterSheetOpen = open;
      renderApp();
    },
    handleSearchInput(query) {
      State.searchQuery = query;
      renderApp();
      const input = document.getElementById('fiesta-search-input');
      if (input) {
        input.focus();
        try {
          input.setSelectionRange(input.value.length, input.value.length);
        } catch (_) {}
      }
    },
    toggleNotifSheet(open) {
      State.notifSheetOpen = open;
      if (open) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
      }
      renderApp();
      if (open) {
        requestAnimationFrame(() => {
          const closeBtn = document.querySelector('#notif-sheet button[aria-label="Close Notifications"]');
          if (closeBtn) closeBtn.focus();
        });
      }
    },
    markAllNotificationsRead() {
      State.notifications.forEach(n => { n.unread = false; });
      saveNotifications();
      renderApp();
    },
    clearAllNotifications() {
      State.notifications = [];
      saveNotifications();
      renderApp();
    },
    handleNotificationClick(id, link) {
      const notif = State.notifications.find(n => n.id === id);
      if (notif) notif.unread = false;
      saveNotifications();
      State.notifSheetOpen = false;
      if (link) {
        navigate(link.replace('#', ''));
      } else {
        renderApp();
      }
    },
    dismissToast(id) {
      dismissToast(id);
    },
    toggleSound() {
      State.soundEnabled = !State.soundEnabled;
      localStorage.setItem('fiesta_sound_enabled', State.soundEnabled ? 'true' : 'false');
      if (State.soundEnabled) {
        SoundEngine.unlock();
        SoundEngine.loadHowler();
        SoundEngine.play('alert');
      }
      renderApp();
    },
    setSoundVolume(vol) {
      State.soundVolume = vol;
      localStorage.setItem('fiesta_sound_volume', vol.toString());
      renderApp();
    },
    testSound() {
      SoundEngine.unlock();
      SoundEngine.play('win_chime');
    },
    toggleHaptics() {
      State.hapticsEnabled = !State.hapticsEnabled;
      localStorage.setItem('fiesta_haptics_enabled', State.hapticsEnabled ? 'true' : 'false');
      if (State.hapticsEnabled) triggerHaptic('tap');
      renderApp();
    },
    setMotion(pref) {
      State.motionPreference = pref;
      localStorage.setItem('fiesta_motion', pref);
      renderApp();
    },
    setNotifPref(key, val) {
      State.notifPrefs[key] = val;
      localStorage.setItem('fiesta_notif_prefs', JSON.stringify(State.notifPrefs));
      renderApp();
    },
    toggleFollow(schoolId) {
      if (State.followedSchoolId === schoolId) {
        State.followedSchoolId = null;
        localStorage.removeItem('fiesta_followed_school');
      } else {
        State.followedSchoolId = schoolId;
        localStorage.setItem('fiesta_followed_school', schoolId);
      }
      renderApp();
    },
    toggleReminder(id) {
      const idx = State.reminders.indexOf(id);
      if (idx > -1) State.reminders.splice(idx, 1);
      else State.reminders.push(id);
      localStorage.setItem('fiesta_reminders', JSON.stringify(State.reminders));
      triggerHaptic('tap');
      showToast('Reminder Updated', 'We will alert you when this match is about to begin.');
      renderApp();
    },
    triggerConfetti() {
      triggerConfetti();
    }
  };

  // Register Service Worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
