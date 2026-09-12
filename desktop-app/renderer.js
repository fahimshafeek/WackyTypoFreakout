const screens = {
  login: document.getElementById('login-screen'),
  deviceCheck: document.getElementById('device-check-screen'),
  exam: document.getElementById('exam-screen'),
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
  showScreen('exam');
  document.getElementById('exam-video').srcObject = stream;
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
let currentCharIndex = 0;
let timer = 30;
let timerInterval;
let isExamActive = false;
let correctChars = 0;

function startExam() {
  violations = [];
  words = Array.from({length: 50}, () => wordList[Math.floor(Math.random() * wordList.length)]);
  currentWordIndex = 0;
  currentCharIndex = 0;
  correctChars = 0;
  timer = 30;
  isExamActive = true;
  document.getElementById('timer').textContent = `${timer}s`;
  renderWords();
  
  const input = document.getElementById('typing-input');
  input.value = '';
  input.focus();
  input.addEventListener('blur', keepFocus); 

  timerInterval = setInterval(() => {
    timer--;
    document.getElementById('timer').textContent = `${timer}s`;
    if (timer <= 0) endExam();
  }, 1000);
}

function keepFocus() {
  if (isExamActive) {
    document.getElementById('typing-input').focus();
  }
}

function renderWords() {
  const display = document.getElementById('words-display');
  display.innerHTML = '';
  words.forEach((w, wIdx) => {
    const wordEl = document.createElement('div');
    wordEl.className = 'word';
    for (let i = 0; i < w.length; i++) {
      const charEl = document.createElement('span');
      charEl.className = 'char';
      charEl.textContent = w[i];
      if (wIdx === currentWordIndex && i === currentCharIndex) {
        charEl.classList.add('cursor');
      }
      wordEl.appendChild(charEl);
    }
    const spaceEl = document.createElement('span');
    spaceEl.className = 'char';
    spaceEl.textContent = ' ';
    if (wIdx === currentWordIndex && currentCharIndex === w.length) {
      spaceEl.classList.add('cursor');
    }
    wordEl.appendChild(spaceEl);
    display.appendChild(wordEl);
  });
}

document.getElementById('typing-input').addEventListener('input', (e) => {
  if (!isExamActive) return;
  const val = e.target.value;
  const currentWord = words[currentWordIndex];
  const lastChar = val.slice(-1);
  
  if (lastChar === ' ') {
    currentWordIndex++;
    currentCharIndex = 0;
    e.target.value = '';
  } else {
    const expectedChar = currentWord[val.length - 1];
    if (lastChar === expectedChar) {
      correctChars++;
    }
    currentCharIndex = val.length;
  }
  
  renderWords();
});

function endExam() {
  isExamActive = false;
  clearInterval(timerInterval);
  document.getElementById('typing-input').removeEventListener('blur', keepFocus);
  stopLockdown();
  
  const wpm = Math.round((correctChars / 5) / (30 / 60));
  
  document.getElementById('final-wpm').textContent = wpm;
  document.getElementById('final-violations').textContent = violations.length;
  
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
