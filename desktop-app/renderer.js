const screens = {
  intro: document.getElementById('intro-screen'),
  signin: document.getElementById('signin-screen'),
  choosePlayer: document.getElementById('choose-player-screen'),
  tnc: document.getElementById('tnc-screen'),
  exam: document.getElementById('exam-screen'),
  choice: document.getElementById('choice-screen'),
  apology: document.getElementById('apology-screen'),
  choice: document.getElementById('choice-screen'),
  dare: document.getElementById('dare-screen'),
  satisfied: document.getElementById('satisfied-screen'),
  leaderboard: document.getElementById('leaderboard-screen'),
  result: document.getElementById('result-screen'),
  admin: document.getElementById('admin-screen')
};

function showScreen(name) {
  Object.values(screens).forEach(s => {
    if (s) s.classList.remove('active');
  });
  if (screens[name]) screens[name].classList.add('active');
}

let playerName = '';
let stream = null;
let violations = [];
let leaderboard = [];
let allViolations = [];

async function loadMongoData() {
  try {
    const res = await fetch('http://localhost:8000/api/results');
    leaderboard = await res.json();
    const res2 = await fetch('http://localhost:8000/api/violations');
    allViolations = await res2.json();
  } catch(e) { console.error(e); }
}
loadMongoData();

document.getElementById('btn-show-signin').addEventListener('click', () => showScreen('signin'));
document.getElementById('btn-show-players').addEventListener('click', () => {
  populatePlayerList();
  showScreen('choosePlayer');
});
document.getElementById('btn-back-intro-1').addEventListener('click', () => showScreen('intro'));
document.getElementById('btn-back-intro-2').addEventListener('click', () => showScreen('intro'));

document.getElementById('btn-login-next').addEventListener('click', () => {
  const name = document.getElementById('player-name').value.trim();
  if (!name) return alert('Enter name');
  playerName = name;
  showScreen('tnc');
});

function populatePlayerList() {
  const container = document.getElementById('player-list-container');
  container.innerHTML = '';
  // Extract unique players
  const players = [...new Set(leaderboard.map(e => e.player))];
  if (players.length === 0) {
    container.innerHTML = '<p>No players yet. Sign in first!</p>';
    return;
  }
  players.forEach(p => {
    const btn = document.createElement('button');
    btn.textContent = p;
    btn.style.padding = '10px';
    btn.style.background = 'white';
    btn.style.color = '#333';
    btn.style.border = '2px solid #333';
    btn.style.borderRadius = '8px';
    btn.style.cursor = 'pointer';
    btn.addEventListener('click', () => {
      playerName = p;
      startExamFromPlayerSelect();
    });
    container.appendChild(btn);
  });
}

async function startExamFromPlayerSelect() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: true });
    
    ['exam-video', 'exam-video-choice', 'exam-video-2', 'exam-video-3'].forEach(id => {
      const v = document.getElementById(id);
      if(v) {
        v.srcObject = stream;
        v.play().catch(e => console.error(e));
      }
    });
startLockdown();
    startExam();
  } catch (err) {
    alert("Camera permission is required to proceed.");
  }
}

const tncCheckbox = document.getElementById('tnc-checkbox');
const btnStartExam = document.getElementById('btn-start-exam');
const btnTncBack = document.getElementById('btn-tnc-back');

if (btnTncBack) {
  btnTncBack.addEventListener('click', () => showScreen('intro'));
}

tncCheckbox.addEventListener('change', (e) => {
  if (e.target.checked) {
    btnStartExam.disabled = false;
    btnStartExam.style.opacity = '1';
  } else {
    btnStartExam.disabled = true;
    btnStartExam.style.opacity = '0.5';
  }
});

btnStartExam.addEventListener('click', async () => {
  btnStartExam.textContent = "Starting...";
  btnStartExam.disabled = true;
  
  try {
    // Start background capturing
    stream = await navigator.mediaDevices.getUserMedia({ video: true });
    
    ['exam-video', 'exam-video-choice', 'exam-video-2', 'exam-video-3'].forEach(id => {
      const v = document.getElementById(id);
      if(v) {
        v.srcObject = stream;
        v.play().catch(e => console.error(e));
      }
    });

    startLockdown();
    startExam();
  } catch (err) {
    alert("Camera permission is required to proceed.");
    btnStartExam.textContent = "Accept & Continue";
    btnStartExam.disabled = false;
    console.error(err);
  }
});

function startLockdown() {
  if (window.electronAPI) {
    window.electronAPI.startLockdown();
  }
}

function stopLockdown() {
  if (window.electronAPI) {
    window.electronAPI.stopLockdown();
  reactionCapture.stop();
  }
}

// IPC Lockdown listeners
if (window.electronAPI) {
  window.electronAPI.onWindowBlur(() => recordViolation('WINDOW_BLUR (Lost Focus)', 'MEDIUM'));
  window.electronAPI.onLeaveFullscreen(() => recordViolation('FULLSCREEN_EXIT', 'HIGH'));
  window.electronAPI.onWindowMinimize(() => recordViolation('WINDOW_MINIMIZE', 'HIGH'));
}

function recordViolation(type, severity) {
  if (!isExamActive) return;
  const v = {
    player: playerName,
    type,
    severity,
    timestamp: new Date().toISOString()
  };
  violations.push(v);
  allViolations.push(v);
  fetch('http://localhost:8000/api/violations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(v)
  }).catch(e => console.error(e));
  
  const warn = document.getElementById('lockdown-warning');
  warn.textContent = `Proctoring Violation: ${type}`;
  warn.classList.remove('hidden');
  setTimeout(() => warn.classList.add('hidden'), 3000);
}

const wordList = ["the", "be", "to", "of", "and", "a", "in", "that", "have", "i", "it", "for", "not", "on", "with", "he", "as", "you", "do", "at", "this", "but", "his", "by", "from", "they", "we", "say", "her", "she", "or", "an", "will", "my", "one", "all", "would", "there", "their", "what", "so", "up", "out", "if", "about", "who", "get", "which", "go", "me"];
let words = [];
let currentWordIndex = 0;
let currentWordInput = "";
let timer = 60; // Increased to 60s since apologizing takes time
let timerInterval;
let isExamActive = false;
let isApologizing = false;
let currentWordHadIncident = false;
let wrongSpaceCount = 0;

class ReactionCapture {
    constructor(videoEl) {
        this.video = videoEl;
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
        this.buffer = [];
        this.captureInterval = null;
        this.isRecordingEvent = false;
        this.currentEventName = null;
        this.postEventFrames = 0;
        this.maxPreFrames = 8;
        this.maxPostFrames = 8;
        this.allCapturedReactions = [];
        this.lastFrameData = null;
        this.currentMovement = 0;
    }
    reset() {
        this.allCapturedReactions = [];
        this.buffer = [];
        this.isRecordingEvent = false;
        this.postEventFrames = 0;
        this.lastFrameData = null;
        this.currentMovement = 0;
    }
    start() {
        if (this.captureInterval) clearInterval(this.captureInterval);
        this.captureInterval = setInterval(() => this.grabFrame(), 250);
    }
    stop() {
        if (this.captureInterval) clearInterval(this.captureInterval);
    }
    grabFrame() {
        if (!this.video || !this.video.videoWidth) return;
        this.canvas.width = this.video.videoWidth;
        this.canvas.height = this.video.videoHeight;
        this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
        
        const frameData = {
            imageData: this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height),
            dataUrl: this.canvas.toDataURL('image/jpeg', 0.5)
        };

        // Continuous monitoring delta calculation
        if (this.lastFrameData) {
            let delta = 0;
            const curr = frameData.imageData.data;
            for (let j = 0; j < curr.length; j += 128) {
                delta += Math.abs(curr[j] - this.lastFrameData[j]);
            }
            this.currentMovement = delta;
        }
        this.lastFrameData = frameData.imageData.data;

        if (this.isRecordingEvent) {
            this.buffer.push(frameData);
            this.postEventFrames++;
            if (this.postEventFrames >= this.maxPostFrames) {
                this.analyzeClipAndExtract();
                this.isRecordingEvent = false;
            }
        } else {
            this.buffer.push(frameData);
            if (this.buffer.length > this.maxPreFrames) {
                this.buffer.shift();
            }
        }
    }
    triggerEvent(eventName) {
        if (this.isRecordingEvent) return;
        this.isRecordingEvent = true;
        this.currentEventName = eventName;
        this.postEventFrames = 0;
    }
    analyzeClipAndExtract() {
        let maxDelta = -1;
        let bestFrame = null;
        for (let i = 1; i < this.buffer.length; i++) {
            const prev = this.buffer[i-1].imageData.data;
            const curr = this.buffer[i].imageData.data;
            let delta = 0;
            for (let j = 0; j < curr.length; j += 64) {
                delta += Math.abs(curr[j] - prev[j]);
            }
            if (delta > maxDelta) {
                maxDelta = delta;
                bestFrame = this.buffer[i];
            }
        }
        if (bestFrame) {
            this.allCapturedReactions.push({
                caption: this.currentEventName,
                score: maxDelta,
                src: bestFrame.dataUrl
            });
        }
        this.buffer = this.buffer.slice(-this.maxPreFrames);
    }
    getTopThree() {
        this.allCapturedReactions.sort((a, b) => b.score - a.score);
        return this.allCapturedReactions.slice(0, 3);
    }
}
const reactionCapture = new ReactionCapture(document.getElementById('exam-video'));

let correctCharsCount = 0;
let totalTypedChars = 0;
  wrongSpaceCount = 0;


// ==========================================
// AI COMMENTARY ENGINE
// ==========================================
let commentaryActive = false;
let commentaryTimeout = null;

const highMovementPhrases = ["You're sweating aren't you!", "Deep breaths...", "Calm down!", "Getting nervous?", "Whoa, don't break the keyboard!"];
const highMistakePhrases = ["Don't fumble up", "Keyboard acting up?", "Sloppy...", "Focus!", "You can do better."];
const fastTypingPhrases = ["Machine-like precision.", "In the zone...", "Look at those fingers fly!", "Unstoppable.", "Is that you, Flash?"];

function showCommentary(text) {
    if (commentaryActive) return;
    const box = document.getElementById('ai-commentary-box');
    const span = document.getElementById('ai-commentary-text');
    
    if (!box || !span) return;
    
    if (!box || !span) return;
    
    box.classList.remove('hidden');
    commentaryActive = true;
    span.textContent = '';
    
    let i = 0;
    function typeWriter() {
        if (i < text.length) {
            span.textContent += text.charAt(i);
            i++;
            setTimeout(typeWriter, 50); // 50ms per character
        } else {
            if (Math.random() > 0.4) {
                reactionCapture.triggerEvent(text);
            }
            clearTimeout(commentaryTimeout);
            commentaryTimeout = setTimeout(() => {
                box.classList.add('hidden');
                setTimeout(() => { commentaryActive = false; }, 500);
            }, 7000);
        }
    }
    typeWriter();
}

setInterval(() => {
    if (!isExamActive || isApologizing || commentaryActive) return;
    
    const activeSeconds = 60 - timer;
    if (activeSeconds < 3) return;
    
    const currentWpm = Math.round((correctCharsCount / 5) / (activeSeconds / 60));
    const movement = reactionCapture.currentMovement || 0;
    const accuracy = Math.round((correctCharsCount / Math.max(1, totalTypedChars)) * 100);
    
    if (movement > 5000 && Math.random() > 0.2) { 
        showCommentary(highMovementPhrases[Math.floor(Math.random() * highMovementPhrases.length)]);
    } else if (accuracy < 85 && totalTypedChars > 25 && Math.random() > 0.3) {
        showCommentary(highMistakePhrases[Math.floor(Math.random() * highMistakePhrases.length)]);
    } else if (currentWpm > 75 && accuracy > 95 && Math.random() > 0.5) {
        showCommentary(fastTypingPhrases[Math.floor(Math.random() * fastTypingPhrases.length)]);
    }
}, 2000);

function startExam() {
  if (timerInterval) clearInterval(timerInterval);
  violations = [];
  words = Array.from({length: 500}, () => wordList[Math.floor(Math.random() * wordList.length)]);
  currentWordIndex = 0;
  currentWordInput = "";
  correctCharsCount = 0;
  totalTypedChars = 0;
  wrongSpaceCount = 0;
  timer = 60;
  isExamActive = true;
  reactionCapture.reset();
  reactionCapture.start();

  if (!stream) {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(s => {
        stream = s;
        ['exam-video', 'exam-video-choice', 'exam-video-2', 'exam-video-3'].forEach(id => {
          const v = document.getElementById(id);
          if (v) {
            v.srcObject = stream;
            v.play().catch(e => console.error(e));
          }
        });
      })
      .catch(e => console.error("Re-acquire stream failed:", e));
  } else {
    ['exam-video', 'exam-video-choice', 'exam-video-2', 'exam-video-3'].forEach(id => {
      const v = document.getElementById(id);
      if (v) {
        v.srcObject = stream;
        v.play().catch(e => console.error(e));
      }
    });
  }

  isApologizing = false;
  
  document.getElementById('timer').textContent = `${timer}s`;
  document.getElementById('global-exam-header').classList.remove('hidden');
  initTypeAndAtone();
  showScreen('exam');
  renderWords();

  timerInterval = setInterval(() => {
    timer--;
    document.getElementById('timer').textContent = `${timer}s`;
    if (timer <= 0) endExam();
  }, 1000);
}

function renderWords() {
  const display = document.getElementById('words-display');
  display.innerHTML = '';
  
  // Show only a window of words around the current word
  const startIdx = Math.max(0, currentWordIndex - 10);
  const endIdx = Math.min(words.length, currentWordIndex + 20);
  
  for (let wIdx = startIdx; wIdx < endIdx; wIdx++) {
    const w = words[wIdx];
    const wordEl = document.createElement('div');
    wordEl.className = 'word';
    
    for (let i = 0; i < w.length; i++) {
      const charEl = document.createElement('span');
      charEl.className = 'char';
      charEl.textContent = w[i];
      
      if (wIdx < currentWordIndex) {
        charEl.classList.add('correct');
      } else if (wIdx === currentWordIndex) {
        if (i < currentWordInput.length) {
          if (currentWordInput[i] === w[i]) {
            charEl.classList.add('correct');
          } else {
            charEl.classList.add('incorrect');
          }
        }
        if (i === currentWordInput.length) {
          charEl.classList.add('cursor');
        }
      }
      
      wordEl.appendChild(charEl);
    }
    
    // Extra typed chars
    if (wIdx === currentWordIndex && currentWordInput.length > w.length) {
      for (let i = w.length; i < currentWordInput.length; i++) {
        const extraCharEl = document.createElement('span');
        extraCharEl.className = 'char incorrect';
        extraCharEl.textContent = currentWordInput[i];
        wordEl.appendChild(extraCharEl);
      }
    }
    
    // Cursor at the end of word
    if (wIdx === currentWordIndex && currentWordInput.length >= w.length) {
       const spaceEl = document.createElement('span');
       spaceEl.className = 'char cursor';
       spaceEl.textContent = ' ';
       wordEl.appendChild(spaceEl);
    } else {
       const spaceEl = document.createElement('span');
       spaceEl.className = 'char';
       spaceEl.textContent = ' ';
       wordEl.appendChild(spaceEl);
    }
    
    display.appendChild(wordEl);
  }
}

document.addEventListener('keydown', (e) => {
  if (!isExamActive) return;
  if (isApologizing) return; 
  
  if (e.ctrlKey || e.altKey || e.metaKey) return;
  
  const targetWord = words[currentWordIndex];
  
  if (e.key === 'Backspace') {
    if (currentWordInput.length > 0) {
      const deletedChar = currentWordInput.slice(-1);
      const expectedChar = targetWord[currentWordInput.length - 1];
      
      currentWordInput = currentWordInput.slice(0, -1);
      
      if (deletedChar !== expectedChar) {
        // If the expected char is a valid letter, make it angry
        if (expectedChar && /^[a-zA-Z]$/.test(expectedChar)) {
          reactionCapture.triggerEvent('Mistyped ' + deletedChar.toUpperCase());
          triggerIncident(expectedChar, deletedChar);
        } else if (/^[a-zA-Z]$/.test(deletedChar)) {
          // Fallback if they typed past the end of the word
          reactionCapture.triggerEvent('Mistyped ' + deletedChar.toUpperCase());
          triggerIncident(deletedChar, deletedChar);
        }
      }
    }
  } else if (e.key === ' ') {
    e.preventDefault();
    if (currentWordInput.length > 0) {
      if (currentWordInput !== targetWord) {
        wrongSpaceCount++;
        if (wrongSpaceCount > 7) {
          wrongSpaceCount = 0;
          reactionCapture.triggerEvent('Too Many Skips');
          const lastTypedKey = currentWordInput.slice(-1);
          const apologyKey = /^[a-zA-Z]$/.test(lastTypedKey) ? lastTypedKey : 'Z';
          triggerIncident(apologyKey, apologyKey);
          return;
        }
        reactionCapture.triggerEvent('Mistyped Space');
        triggerCatAnimation(); // The cat animation handles the crickets audio automatically!
      } else if (currentWordHadIncident) {
        triggerCatAnimation();
      }
      currentWordHadIncident = false;
      
      // count correct chars for WPM
      for(let i=0; i<Math.min(currentWordInput.length, targetWord.length); i++) {
        if(currentWordInput[i] === targetWord[i]) correctCharsCount++;
      }
      correctCharsCount++; // Count the space itself as a correct keystroke!
      totalTypedChars++;
      currentWordIndex++;
      currentWordInput = "";
    }
  } else if (e.key.length === 1) {
    e.preventDefault();
    totalTypedChars++;
    currentWordInput += e.key;
  }
  
  if (!isApologizing) {
    renderWords();
  }
});

let currentIncidentExpected = null;
let currentIncidentTyped = null;
const incidentAudio = new Audio('./assets/audio/fahhhhh.mp3');


async function triggerIncident(expectedLetter, typedLetter) {
  currentWordHadIncident = true;
  incidentAudio.currentTime = 0;
  incidentAudio.play().catch(e => console.error(e));
  
  isApologizing = true;
  clearInterval(timerInterval); // Pause the timer!
  
  const upperTyped = typedLetter.toUpperCase();
  const lowerTyped = typedLetter.toLowerCase();
  
  // Store for later use by choice handlers
  window._currentTypedLetter = typedLetter;
  window._currentUpperTyped = upperTyped;
  window._currentLowerTyped = lowerTyped;
  
  // Set up the choice screen
  document.getElementById('choice-character').src = `./assets/alphabets/${upperTyped}-angry.png`;
  document.getElementById('choice-error-letter').textContent = lowerTyped;
  document.getElementById('choice-letter-name').textContent = upperTyped;
  
  showScreen('choice');
  
  // Report backspace to backend
  try {
    const res = await fetch(`${API_BASE}/session/${taSessionId}/backspace`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ letter: lowerTyped, position: 0 })
    });
    const data = await res.json();
    taIncidentId = data.incident_id;
  } catch(e) { console.error(e); }
}

// ==========================================
// TRUTH OR DARE CHOICE HANDLERS
// ==========================================

document.getElementById('btn-choose-truth').addEventListener('click', async () => {
  const upperTyped = window._currentUpperTyped;
  const lowerTyped = window._currentLowerTyped;
  
  // Set up the apology screen
  document.getElementById('apology-character').src = `./assets/alphabets/${upperTyped}-angry.png`;
  document.getElementById('apology-error-letter').textContent = lowerTyped;
  document.getElementById('apology-letter-name').textContent = upperTyped;
  document.getElementById('apology-letter-name-2').textContent = upperTyped;
  document.getElementById('apology-feedback-cloud').classList.add('hidden');
  document.getElementById('apology-feedback-text').textContent = '';
  
  const apologyInput = document.getElementById('apology-input');
  apologyInput.value = '';
  
  const btn = document.getElementById('btn-submit-apology');
  btn.textContent = 'TYPE APOLOGY';
  btn.style.backgroundColor = '';
  btn.disabled = false;
  
  showScreen('apology');
  apologyInput.focus();
  
  // Tell backend: truth
  try {
    await fetch(`${API_BASE}/incident/${taIncidentId}/choice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ choice: 'truth' })
    });
  } catch(e) { console.error(e); }
});

document.getElementById('btn-choose-dare').addEventListener('click', async () => {
  const upperTyped = window._currentUpperTyped;
  const lowerTyped = window._currentLowerTyped;
  
  // Set up the dare screen
  document.getElementById('dare-character').src = `./assets/alphabets/${upperTyped}-angry.png`;
  document.getElementById('dare-error-letter').textContent = lowerTyped;
  document.getElementById('dare-letter-name').textContent = upperTyped;
  document.getElementById('dare-rpm-value').textContent = '0';
  document.getElementById('dare-progress-current').textContent = '0';
  document.getElementById('dare-progress-bar').style.width = '0%';
  document.getElementById('dare-status').textContent = 'Waiting for crank input...';
  
  showScreen('dare');
  
  // Tell backend: dare
  try {
    const res = await fetch(`${API_BASE}/incident/${taIncidentId}/choice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ choice: 'dare' })
    });
    const data = await res.json();
    if (data.crank_required) {
      document.getElementById('dare-progress-required').textContent = data.crank_required;
    }
    if (data.hardware_connected === false) {
      document.getElementById('dare-status').textContent = '⚠️ Hardware Disconnected - Cranking Unavailable';
      document.getElementById('dare-status').style.color = '#ca4754';
      document.getElementById('dare-status').style.fontWeight = 'bold';
    } else {
      document.getElementById('dare-status').style.color = '#999';
      document.getElementById('dare-status').style.fontWeight = 'normal';
    }
  } catch(e) { console.error(e); }
  
  connectRpmWebSocket();
});

// ==========================================
// RPM WEBSOCKET (for live RPM meter on Dare screen)
// ==========================================
let rpmWs = null;

function connectRpmWebSocket() {
  // Close existing connection if any
  if (rpmWs) {
    try { rpmWs.close(); } catch(e) {}
  }
  
  rpmWs = new WebSocket('ws://localhost:8000/ws/rpm');
  rpmWs.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data);
      const rpmEl = document.getElementById('dare-rpm-value');
      if (rpmEl && data.rpm !== undefined) {
        rpmEl.textContent = data.rpm;
        // Subtle scale effect based on RPM
        const scale = 1 + (data.rpm / 500);
        rpmEl.style.transform = `scale(${Math.min(scale, 1.5)})`;
      }
    } catch(err) {}
  };
  rpmWs.onclose = () => {
    // Only reconnect if we're still on the dare screen
    if (screens.dare && screens.dare.classList.contains('active')) {
      setTimeout(connectRpmWebSocket, 1000);
    }
  };
}

function disconnectRpmWebSocket() {
  if (rpmWs) {
    try { rpmWs.close(); } catch(e) {}
    rpmWs = null;
  }
}

document.getElementById('btn-submit-apology').addEventListener('click', finishApology);
document.getElementById('apology-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    finishApology();
  }
});

async function finishApology() {
  const btn = document.getElementById('btn-submit-apology');
  if (btn.disabled) return;
  
  const val = document.getElementById('apology-input').value.trim();
  if (val.length === 0) return; 
  
  reactionCapture.triggerEvent('Submitted Apology');
  btn.textContent = 'WAITING FOR AI JUDGE...';
  btn.disabled = true;
  document.getElementById('apology-feedback-cloud').classList.add('hidden');
  document.getElementById('apology-feedback-text').textContent = '';
  
  try {
    await fetch(`${API_BASE}/incident/${taIncidentId}/apology`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: val })
    });
  } catch(e) { console.error(e); }
}

function endExam() {
  if (!isExamActive) return;
  isExamActive = false;
  isApologizing = false;
  clearInterval(timerInterval);
  document.getElementById('global-exam-header').classList.add('hidden');
  stopLockdown();
  
  // Tally correct chars in the currently active word
  const targetWord = words[currentWordIndex];
  if (targetWord && currentWordInput.length > 0) {
    for(let i=0; i<Math.min(currentWordInput.length, targetWord.length); i++) {
      if(currentWordInput[i] === targetWord[i]) correctCharsCount++;
    }
  }
  
  // Calculate WPM dynamically based on actual active time
  const activeSeconds = 60 - timer;
  const activeMinutes = activeSeconds > 0 ? (activeSeconds / 60) : (1/60);
  const wpm = Math.round((correctCharsCount / 5) / activeMinutes);
  
  leaderboard.push({ player: playerName, wpm });
  fetch('http://localhost:8000/api/results', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ player: playerName, wpm: wpm })
  }).catch(e => console.error(e));
  

  const accuracy = Math.round((correctCharsCount / Math.max(1, totalTypedChars)) * 100);


  // Aggregate stats per player
  const playerStats = {};
  leaderboard.forEach(entry => {
    if (!playerStats[entry.player]) {
      playerStats[entry.player] = { games: 0, totalScore: 0, topScore: 0 };
    }
    playerStats[entry.player].games += 1;
    playerStats[entry.player].totalScore += entry.wpm;
    if (entry.wpm > playerStats[entry.player].topScore) {
      playerStats[entry.player].topScore = entry.wpm;
    }
  });

  const tbody = document.getElementById('leaderboard-tbody');
  tbody.innerHTML = '';
  
  // Convert to array and sort by Top Score (or Average)
  const sortedPlayers = Object.keys(playerStats).map(p => ({
    name: p,
    games: playerStats[p].games,
    avg: (playerStats[p].totalScore / playerStats[p].games).toFixed(1),
    top: playerStats[p].topScore
  })).sort((a, b) => b.top - a.top);

  sortedPlayers.forEach((p, idx) => {
    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid #ddd';
    if (idx % 2 === 0) tr.style.background = '#f9f9f9';
    tr.innerHTML = `
      <td style="padding: 15px; text-align: left;">${p.name}</td>
      <td style="padding: 15px;">${p.games}</td>
      <td style="padding: 15px;">${p.avg}</td>
      <td style="padding: 15px; font-weight: bold;">${p.top}</td>
    `;
    tbody.appendChild(tr);
  });

  
  if (window.renderResults) {
    window.renderResults({
      wpm: wpm,
      accuracy: accuracy,
      apologiesWritten: violations.length,
      mascotName: document.getElementById('apology-letter-name')?.textContent || 'Z',
      photos: reactionCapture.getTopThree().map(r => ({ src: r.src, caption: r.caption || 'Reaction!' }))
    });
    showScreen('result');
  } else {
    showScreen('leaderboard');
  }

  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }
}

document.getElementById('btn-home-from-leaderboard').addEventListener('click', () => {
  showScreen('intro');
});


function updateAdminView() {
  const lb = document.getElementById('leaderboard-list');
  if (lb) {
    lb.innerHTML = '';
    leaderboard.forEach(entry => {
      lb.innerHTML += `<li>${entry.player} - ${entry.wpm} WPM</li>`;
    });
  }
  
  const vl = document.getElementById('violation-list');
  if (vl) {
    vl.innerHTML = '';
    allViolations.slice().reverse().forEach(v => {
      vl.innerHTML += `<li>[${new Date(v.timestamp).toLocaleTimeString()}] <strong>${v.player}</strong>: <span style="color:var(--error)">${v.type} (${v.severity})</span></li>`;
    });
  }
  
  const pl = document.getElementById('admin-player-list');
  if (pl) {
    pl.innerHTML = '';
    const players = [...new Set(leaderboard.map(e => e.player))];
    if (players.length === 0) {
      pl.innerHTML = '<li>No players found</li>';
    } else {
      players.forEach(p => {
        const li = document.createElement('li');
        li.style.display = 'flex';
        li.style.justifyContent = 'space-between';
        li.style.alignItems = 'center';
        li.style.marginBottom = '12px';
        li.style.padding = '10px 15px';
        li.style.background = '#f5f0e6';
        li.style.border = '3px solid #272923';
        li.style.borderRadius = '10px';
        li.innerHTML = `<span style="font-weight: bold; font-size: 1.3rem; color: #272923;">${p}</span>`;
        
        const btn = document.createElement('button');
        btn.textContent = 'Remove';
        btn.style.background = '#ca4754';
        btn.style.color = '#fcf9e7';
        btn.style.border = '3px solid #272923';
        btn.style.padding = '5px 15px';
        btn.style.fontSize = '1.1rem';
        btn.style.fontWeight = 'bold';
        btn.style.cursor = 'pointer';
        btn.style.borderRadius = '8px';
        
        btn.addEventListener('click', () => {
          if(confirm(`Remove all data for player: ${p}?`)) {
            leaderboard = leaderboard.filter(e => e.player !== p);
            allViolations = allViolations.filter(e => e.player !== p);
            fetch(`http://localhost:8000/api/player/${encodeURIComponent(p)}`, { method: 'DELETE' }).catch(e => console.error(e));
            updateAdminView();
          }
        });
        li.appendChild(btn);
        pl.appendChild(li);
      });
    }
  }
}


// ==========================================
// TYPE & ATONE: BACKEND INTEGRATION
// ==========================================
const API_BASE = 'http://localhost:8000/api';
let taSessionId = null;
let taIncidentId = null;
let taWs = null;

async function initTypeAndAtone() {
  try {
    const res = await fetch(`${API_BASE}/session/start`, { method: 'POST' });
    const data = await res.json();
    taSessionId = data.session_id;
    console.log("Type & Atone Session Started:", taSessionId);
    
    function connectTaWs() {
      taWs = new WebSocket(`ws://localhost:8000/ws/session/${taSessionId}`);
      taWs.onmessage = (e) => handleTaWsEvent(JSON.parse(e.data));
      taWs.onclose = () => {
        setTimeout(() => {
          if (taSessionId) connectTaWs();
        }, 1000);
      };
    }
    connectTaWs();
  } catch (err) {
    console.error("Failed to initialize Type & Atone backend:", err);
  }
}

function handleTaWsEvent(msg) {
  if (msg.event === 'apology_verdict') {
    const btn = document.getElementById('btn-submit-apology');
    const cloud = document.getElementById('apology-feedback-cloud');
    const cloudText = document.getElementById('apology-feedback-text');
    
    if (msg.data.verdict === 'fail') {
      reactionCapture.triggerEvent('Apology Rejected');
      if (msg.data.attempts_remaining > 0) {
        
        const apologyText = document.getElementById('apology-input').value;
        const wordCount = apologyText.split(/\s+/).filter(w => w.length > 0).length;
        
        if (wordCount >= 30) {
          cloudText.textContent = msg.data.feedback;
          cloud.classList.remove('hidden');
          
          btn.textContent = `REJECTED! (${msg.data.attempts_remaining} tries left)`;
          btn.disabled = false;
          btn.style.backgroundColor = 'red';
          
          setTimeout(() => {
            if (btn.style.backgroundColor === 'red') {
              btn.textContent = 'TYPE APOLOGY';
              btn.style.backgroundColor = '';
            }
          }, 8000); 
        } else {
          btn.textContent = `REJECTED! ${msg.data.feedback} (${msg.data.attempts_remaining} tries left)`;
          btn.disabled = false;
          btn.style.backgroundColor = 'red';
          
          setTimeout(() => {
            if (btn.style.backgroundColor === 'red') {
              btn.textContent = 'TYPE APOLOGY';
              btn.style.backgroundColor = '';
            }
          }, 3000);
        }
      } else {
        // FORCED DARE: Truth attempts exhausted, transition to dare screen
        btn.textContent = "MAX ATTEMPTS EXHAUSTED → FORCED DARE";
        btn.disabled = true;
        
        setTimeout(async () => {
          const upperTyped = window._currentUpperTyped || 'Z';
          const lowerTyped = window._currentLowerTyped || 'z';
          
          document.getElementById('dare-character').src = `./assets/alphabets/${upperTyped}-angry.png`;
          document.getElementById('dare-error-letter').textContent = lowerTyped;
          document.getElementById('dare-letter-name').textContent = upperTyped;
          document.getElementById('dare-rpm-value').textContent = '0';
          document.getElementById('dare-progress-current').textContent = '0';
          document.getElementById('dare-progress-bar').style.width = '0%';
          document.getElementById('dare-status').textContent = 'Forced DARE! Crank the wheel!';
          
          showScreen('dare');
          
          // The backend should have already transitioned to DARE_PENDING with forced_dare
          // We need to choose dare for the incident
          try {
            const res = await fetch(`${API_BASE}/incident/${taIncidentId}/choice`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ choice: 'dare' })
            });
            const data = await res.json();
            if (data.crank_required) {
              document.getElementById('dare-progress-required').textContent = data.crank_required;
            }
            if (data.hardware_connected === false) {
              document.getElementById('dare-status').textContent = '⚠️ Hardware Disconnected - Cranking Unavailable';
              document.getElementById('dare-status').style.color = '#ca4754';
              document.getElementById('dare-status').style.fontWeight = 'bold';
            } else {
              document.getElementById('dare-status').style.color = '#999';
              document.getElementById('dare-status').style.fontWeight = 'normal';
            }
          } catch(e) { console.error(e); }
          
          connectRpmWebSocket();
        }, 1500);
      }
    } else {
      reactionCapture.triggerEvent('Apology Accepted');
      btn.textContent = `ACCEPTED! Score: ${msg.data.sincerity_score}`;
      const upperLetter = document.getElementById('apology-letter-name').textContent;
      document.getElementById('satisfied-character').src = `./assets/alphabets/${upperLetter}-satisfied.png`;
      showScreen('satisfied');
      setTimeout(() => {
        if (timer > 0 && isExamActive) {
          isApologizing = false;
          showScreen('exam');
          renderWords();
          
          timerInterval = setInterval(() => {
            timer--;
            document.getElementById('timer').textContent = `${timer}s`;
            if (timer <= 0) endExam();
          }, 1000);
        }
      }, 2000);
    }
  } else if (msg.event === 'error') {
     document.getElementById('btn-submit-apology').textContent = `SYSTEM ERROR: ${msg.data.message}`;
     document.getElementById('btn-submit-apology').disabled = false;
  } else if (msg.event === 'crank_progress') {
    // Update dare screen progress
    const current = msg.data.current;
    const required = msg.data.required;
    document.getElementById('dare-progress-current').textContent = current;
    document.getElementById('dare-progress-required').textContent = required;
    const pct = Math.min(100, (current / required) * 100);
    document.getElementById('dare-progress-bar').style.width = pct + '%';
    document.getElementById('dare-status').textContent = `Cranking... ${current}/${required}`;
  } else if (msg.event === 'dare_complete' || msg.event === 'incident_resolved') {
    // Only handle if we're on the dare screen
    if (screens.dare && screens.dare.classList.contains('active')) {
      document.getElementById('dare-status').textContent = 'DARE COMPLETE! 🎉';
      document.getElementById('dare-progress-bar').style.width = '100%';
      disconnectRpmWebSocket();
      
      // Show satisfied character then resume typing
      const upperLetter = document.getElementById('dare-letter-name').textContent;
      document.getElementById('satisfied-character').src = `./assets/alphabets/${upperLetter}-satisfied.png`;
      setTimeout(() => {
        showScreen('satisfied');
        setTimeout(() => {
          if (timer > 0 && isExamActive) {
            isApologizing = false;
            showScreen('exam');
            renderWords();
            
            timerInterval = setInterval(() => {
              timer--;
              document.getElementById('timer').textContent = `${timer}s`;
              if (timer <= 0) endExam();
            }, 1000);
          }
        }, 2000);
      }, 1000);
    }
  }
}

document.addEventListener("results:play-again", () => { 
    startExam(); 
    showScreen('exam'); 
});
document.addEventListener("results:home", () => { 
    showScreen('signin'); 
});
document.addEventListener("results:keep-typing", () => { 
    startExam(); 
    showScreen('exam'); 
});


function triggerCatAnimation() {
    const catNum = Math.floor(Math.random() * 8) + 1;
    const catImg = document.createElement('img');
    catImg.src = `./assets/cats/cat${catNum}.png`;
    catImg.style.position = 'fixed';
    catImg.style.zIndex = '10000';
    catImg.style.transition = 'transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
    
    // Avoid middle (40-60%)
    const isLeft = Math.random() > 0.5;
    const offsetPercent = isLeft ? (Math.random() * 30 + 5) : (Math.random() * 30 + 65);
    catImg.style.left = `${offsetPercent}%`;
    catImg.style.width = '250px';

    const isTop = Math.random() > 0.5;
    if (isTop) {
        catImg.style.top = '0px';
        catImg.style.transform = 'translateY(-100%) rotate(180deg)';
    } else {
        catImg.style.bottom = '0px';
        catImg.style.transform = 'translateY(100%)';
    }

    document.body.appendChild(catImg);
    
    void catImg.offsetWidth; // Reflow

    if (isTop) {
        catImg.style.transform = 'translateY(0) rotate(180deg)';
    } else {
        catImg.style.transform = 'translateY(0)';
    }

    const crickets = new Audio('./assets/audio/crickets.mp3');
    crickets.play().catch(e => console.error(e));
    
    crickets.onended = () => {
        if (isTop) {
            catImg.style.transform = 'translateY(-100%) rotate(180deg)';
        } else {
            catImg.style.transform = 'translateY(100%)';
        }
        setTimeout(() => {
            catImg.remove();
        }, 500);
    };
}


document.getElementById('btn-admin-view').addEventListener('click', async () => {
  await loadMongoData();
  updateAdminView();
  showScreen('admin');
});
document.getElementById('btn-admin-back').addEventListener('click', () => showScreen('intro'));

const adminTabs = ['leaderboard', 'violations', 'players'];
adminTabs.forEach(tab => {
  const btn = document.getElementById(`tab-${tab}`);
  if (btn) {
    btn.addEventListener('click', () => {
      adminTabs.forEach(t => {
        document.getElementById(`tab-${t}`).style.background = 'transparent';
        document.getElementById(`content-${t}`).style.display = 'none';
      });
      btn.style.background = '#e2b714';
      document.getElementById(`content-${tab}`).style.display = 'block';
    });
  }
});
