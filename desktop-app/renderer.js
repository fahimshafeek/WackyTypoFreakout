const screens = {
  login: document.getElementById('login-screen'),
  deviceCheck: document.getElementById('device-check-screen'),
  exam: document.getElementById('exam-screen'),
  apology: document.getElementById('apology-screen'),
  satisfied: document.getElementById('satisfied-screen'),
  result: document.getElementById('result-screen'),
  admin: document.getElementById('admin-screen')
};

function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
}

let playerName = '';
let stream = null;
let violations = [];
let leaderboard = JSON.parse(localStorage.getItem('leaderboard')) || [];
let allViolations = JSON.parse(localStorage.getItem('allViolations')) || [];

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
        this.maxPreFrames = 8;  // 1.5 seconds at 4fps
        this.maxPostFrames = 8; // 1.5 seconds at 4fps
        
        this.allCapturedReactions = [];
    }

    start() {
        if (this.captureInterval) clearInterval(this.captureInterval);
        this.captureInterval = setInterval(() => this.grabFrame(), 250); // 4 fps
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
            // sample every 16th pixel to be super fast
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


document.getElementById('btn-login').addEventListener('click', () => {
  const name = document.getElementById('player-name').value.trim();
  if (!name) return alert('Enter name');
  playerName = name;
  showScreen('deviceCheck');
  startDeviceCheck();
});

document.getElementById('btn-admin-view').addEventListener('click', () => {
  updateAdminView();
  showScreen('admin');
});
document.getElementById('btn-admin-back').addEventListener('click', () => showScreen('login'));

async function startDeviceCheck() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    document.getElementById('preview-video').srcObject = stream;
    document.getElementById('cam-status').textContent = 'Connected';
    document.getElementById('cam-status').className = 'status-ok';
    document.getElementById('mic-status').textContent = 'Connected';
    document.getElementById('mic-status').className = 'status-ok';
    document.getElementById('btn-start-exam').disabled = false;
  } catch (err) {
    document.getElementById('cam-status').textContent = 'Failed / Denied';
    document.getElementById('cam-status').className = 'status-error';
    document.getElementById('mic-status').textContent = 'Failed / Denied';
    document.getElementById('mic-status').className = 'status-error';
    console.error(err);
  }
}

document.getElementById('btn-start-exam').addEventListener('click', () => {
  document.getElementById('exam-video').srcObject = stream;
  document.getElementById('exam-video-2').srcObject = stream;
  document.getElementById('exam-video-3').srcObject = stream;
  startLockdown();
  startExam();
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
  localStorage.setItem('allViolations', JSON.stringify(allViolations));
  
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
  reactionCapture.start();
let correctCharsCount = 0;

function startExam() {
  violations = [];
  words = Array.from({length: 500}, () => wordList[Math.floor(Math.random() * wordList.length)]);
  currentWordIndex = 0;
  currentWordInput = "";
  correctCharsCount = 0;
  timer = 60;
  isExamActive = true;
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
          triggerApology(expectedChar, deletedChar);
        } else if (/^[a-zA-Z]$/.test(deletedChar)) {
          // Fallback if they typed past the end of the word
          reactionCapture.triggerEvent("Mistyped " + deletedChar.toUpperCase());
          triggerApology(deletedChar, deletedChar);
        }
      }
    }
  } else if (e.key === ' ') {
    e.preventDefault();
    if (currentWordInput.length > 0) {
      // count correct chars for WPM
      for(let i=0; i<Math.min(currentWordInput.length, targetWord.length); i++) {
        if(currentWordInput[i] === targetWord[i]) correctCharsCount++;
      }
      correctCharsCount++; // Count the space itself as a correct keystroke!
      currentWordIndex++;
      currentWordInput = "";
    }
  } else if (e.key.length === 1) {
    e.preventDefault();
    currentWordInput += e.key;
  }
  
  if (!isApologizing) {
    renderWords();
  }
});

async function triggerApology(expectedLetter, typedLetter) {
  isApologizing = true;
  clearInterval(timerInterval); // Pause the timer!
  
  // The user wants to apologize to the RED letter (the one they incorrectly summoned and are now erasing)
  // which corresponds to 'typedLetter'.
  const upperTyped = typedLetter.toUpperCase();
  const lowerTyped = typedLetter.toLowerCase();
  
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
  
  try {
    const res = await fetch(`${API_BASE}/session/${taSessionId}/backspace`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ letter: lowerTyped, position: 0 })
    });
    const data = await res.json();
    taIncidentId = data.incident_id;
    
    // Automatically choose truth
    await fetch(`${API_BASE}/incident/${taIncidentId}/choice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ choice: 'truth' })
    });
  } catch(e) { console.error(e); }
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
  leaderboard.sort((a, b) => b.wpm - a.wpm);
  localStorage.setItem('leaderboard', JSON.stringify(leaderboard));
  
  showScreen('result');
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }
}

document.getElementById('btn-home').addEventListener('click', () => showScreen('login'));

function updateAdminView() {
  const lb = document.getElementById('leaderboard-list');
  lb.innerHTML = '';
  leaderboard.forEach(entry => {
    lb.innerHTML += `<li>${entry.player} - ${entry.wpm} WPM</li>`;
  });
  
  const vl = document.getElementById('violation-list');
  vl.innerHTML = '';
  allViolations.slice().reverse().forEach(v => {
    vl.innerHTML += `<li>[${v.timestamp}] <strong>${v.player}</strong>: <span style="color:var(--error)">${v.type} (${v.severity})</span></li>`;
  });
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
    
    taWs = new WebSocket(`ws://localhost:8000/ws/session/${taSessionId}`);
    taWs.onmessage = (e) => handleTaWsEvent(JSON.parse(e.data));
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
        btn.textContent = "MAX ATTEMPTS EXHAUSTED. FORCED DARE. (GAME OVER)";
        setTimeout(() => {
            alert("DARE PENDING. Hardware not connected. Terminating Exam.");
            endExam();
        }, 2000);
      }
    } else {
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
  }
}


document.addEventListener("results:play-again", () => { 
    startExam(); 
    showScreen('exam'); 
});
document.addEventListener("results:home", () => { 
    showScreen('login'); 
});
document.addEventListener("results:keep-typing", () => { 
    startExam(); 
    showScreen('exam'); 
});
