<img width="1280" height="640" alt="git (1)" src="https://github.com/user-attachments/assets/8920b256-2ba8-4988-b824-5351134eb4bd" />

# Wacky TypoFreakout 🎯

> **Every action has a consequence. Every typo comes with a price.**

A Monkeytype-inspired typing game where making a mistake doesn't just lower your accuracy — it gets you into trouble.

Press Backspace and the letter you deleted gets its revenge. Choose your punishment: **TRUTH or DARE**. Complete the challenge, and only then can you return to typing.



**Wacky TypoFreakout** is a typing game where every mistake has a consequence.

Inspired by Monkeytype, the game challenges players to type accurately while dealing with unexpected punishments whenever they press Backspace. After making a mistake, the player must face a **TRUTH or DARE** challenge before they are allowed to continue typing.

For **TRUTH**, players must write a sincere apology to the letter they deleted, which is evaluated by a locally running AI system. For **DARE**, players must physically crank a wheel a required number of times to escape their punishment.

The better you type, the fewer consequences you face.

---

## The Problem (that doesn't exist)

People have become far too comfortable pressing **Backspace**.

Why should deleting a typo be free?

In normal typing tests, making a mistake is simple:

> Type → Make mistake → Backspace → Continue.

We decided this was completely unacceptable.

So we created a typing test where **the letters remember what you did to them.**

---

## The Solution (that nobody asked for)

We made every Backspace count.

Whenever a player deletes a letter, that letter gets "hurt" and the game immediately interrupts the typing session.

The player must then choose between:

### 🗣️ TRUTH

Write a meaningful apology of at least 50 words to the letter they deleted.

An AI-powered sincerity checker evaluates the apology and decides whether the letter accepts it.

If the apology is not sincere enough, the player has to try again — or face the consequences of a DARE.

### 🔄 DARE

The player must physically crank a cardboard wheel a specified number of times.

The required number of cranks increases every time the player chooses DARE.

Only after completing the punishment can the player return to the exact point where they stopped typing.

---

# How It Works

```text
                 ┌─────────────────┐
                 │   Start Game    │
                 └────────┬────────┘
                          │
                          ▼
                 ┌─────────────────┐
                 │   Typing Test   │
                 └────────┬────────┘
                          │
                    Backspace?
                          │
                          ▼
                 ┌─────────────────┐
                 │ Letter Gets Hurt│
                 └────────┬────────┘
                          │
                          ▼
                 ┌─────────────────┐
                 │  TRUTH or DARE  │
                 └───────┬─┬───────┘
                         │ │
                TRUTH ───┘ └─── DARE
                  │             │
                  ▼             ▼
          ┌──────────────┐  ┌──────────────┐
          │ Write Apology│  │ Crank Wheel  │
          └──────┬───────┘  └──────┬───────┘
                 │                 │
                 ▼                 ▼
          ┌──────────────┐  ┌──────────────┐
          │ AI Sincerity │  │ Target Reached│
          │    Check     │  └──────┬───────┘
          └──────┬───────┘         │
                 │                 │
           Pass? │                 │
              ┌──┴──┐              │
             YES    NO             │
              │      │             │
              │      └──────┐      │
              │             │      │
              └──────┬──────┘──────┘
                     │
                     ▼
              ┌──────────────┐
              │ Resume Typing│
              └──────┬───────┘
                     │
                     ▼
              ┌──────────────┐
              │ Game Complete│
              └──────────────┘
```
## Technical Details
### Technologies / Components Used
#### Software
- Frontend: HTML, CSS, JavaScript
- Typing Engine: Monkeytype-inspired typing interface
- Backend: Python, FastAPI
- Database: SQLite
- Real-time Communication: WebSockets
- AI Workflow: n8n
- Local AI: Ollama
- HTTP Communication: REST API
- Desktop Environment: Electron
- Testing: Pytest
#### Hardware
- ESP8266
- MAX30102 sensor
- Cardboard wheel
- Connecting wires
- Phone hotspot / local Wi-Fi network
- The physical Dare mechanism uses a rotating cardboard wheel. The sensor detects wheel movement and sends rotation progress to the application.

  
## System Architecture
```
                  ┌─────────────────────────┐
                  │      Typing Frontend    │
                  │   Monkeytype-inspired  │
                  └────────────┬────────────┘
                               │
                         REST / WebSocket
                               │
                               ▼
                  ┌─────────────────────────┐
                  │       FastAPI Backend   │
                  │                         │
                  │  Game State + Scoring   │
                  │  Punishment Management  │
                  └───────┬─────────┬───────┘
                          │         │
                          │         │
                          ▼         ▼
                    ┌─────────┐  ┌──────────┐
                    │  SQLite │  │ Hardware │
                    │ Database│  │  Sensor  │
                    └─────────┘  └──────────┘
                          │
                          ▼
                    ┌─────────┐
                    │   n8n   │
                    │ Workflow│
                    └────┬────┘
                         │
                         ▼
                    ┌─────────┐
                    │ Ollama  │
                    │ Local AI│
                    └─────────┘
```
## Implementation
### Game Flow
The player starts the typing test.
The player types the given text.
The player presses Backspace.
The deleted letter becomes the current "incident".
The game pauses.
The player is presented with TRUTH or DARE.
The selected punishment must be completed.
Once completed, the player returns to the typing test.
The game continues from where the player left off.
The final typing statistics are calculated when the test ends.
TRUTH Mechanism
The Truth challenge is personalized according to the letter that was deleted.
For example:

You hurt E.
The player must write an apology addressed to that letter.
The apology must contain at least 50 words.
The apology is then sent through:
```
Player
   ↓
FastAPI
   ↓
n8n Workflow
   ↓
Ollama
   ↓
Sincerity Evaluation
   ↓
Pass / Fail
``` 
### The AI evaluates:

- Genuine effort
- Coherence
- Relevance
- Whether the apology is actually directed at the letter
- Repeated or meaningless filler
- The project uses a local Ollama model so the apology evaluation can run locally rather than sending the player's text to a cloud AI service.

#### DARE Mechanism
The Dare challenge turns the punishment into a physical interaction.
The player must rotate a cardboard wheel a required number of times.
The number of required rotations increases as the player chooses DARE multiple times during the game.

Example
1st Dare  → 15 rotations
2nd Dare  → 25 rotations
3rd Dare  → 35 rotations
...
The exact values can be tuned depending on the final hardware implementation.
The hardware sends rotation progress to the backend, which updates the game in real time.



Final assembled physical Dare mechanism.
Project Demo
Demo Video
Replace the link below with the final project demonstration video.
▶️ Watch the Wacky TypoFreakout Demo
The video demonstrates the complete experience from starting the typing test to triggering a punishment and returning to the game.
Additional Demos
Demo Video 2 — Hardware
Demo Video 3 — AI Truth Challenge
Project Presentation
Project Documentation
Leaderboard
Wacky TypoFreakout keeps track of player performance across games.
The leaderboard contains:
PlayerGames PlayedAverage ScoreTop ScorePlayer 1578.491Player 2872.688Player 3381.294
Player Statistics
The system records:

Number of games played
Average score
Highest score
Typing performance
The leaderboard allows players to compete beyond a single game and try to beat their previous performance.
Key Features
⌨️ Typing Challenge
A fast-paced typing test inspired by Monkeytype.

💥 Backspace Has Consequences
Backspace isn't just a key anymore. Every deletion can trigger a punishment.

🗣️ AI-Powered Truth
Players have to convince the deleted letter that they're actually sorry.

🤖 Local AI Processing
The sincerity evaluation can run locally using Ollama and n8n.

🔄 Physical Dare
Players can interact with a real cardboard crank mechanism to complete Dare challenges.

📊 Player Leaderboard
Track games played, average scores, and personal bests.

⚡ Real-Time Updates
WebSockets allow the frontend to receive punishment and hardware progress instantly.
API Overview
The backend exposes REST endpoints for communication with the frontend.
MethodEndpointPurposePOST/api/session/startStart a new gamePOST/api/session/{id}/progressSynchronize typing progressPOST/api/session/{id}/backspaceRegister a BackspacePOST/api/incident/{id}/choiceSelect Truth or DarePOST/api/incident/{id}/apologySubmit Truth apologyPOST/api/incident/{id}/crank-progressUpdate Dare progressPOST/api/session/{id}/completeComplete the gameGET/api/letters/{letter}Get letter personality dataGET/api/healthCheck system health
The backend uses a session state machine to prevent multiple punishments from being triggered while another punishment is already active.
## Installation
### Clone the Repository
git clone YOUR_REPOSITORY_URL:
```
cd WackyTypoFreakout
Frontend
cd frontend
npm install
```

Run the frontend:
```
npm start
Backend
```
Create a Python virtual environment:
```
python3 -m venv venv
``` 
Activate it:
```
Linux / macOS
source venv/bin/activate
Windows
venv\Scripts\activate
``` 
Install dependencies:
```
pip install -r backend/requirements.txt
```
Run the backend:
```
uvicorn backend.src.main:app --reload --port 8000
```
### AI Setup
Install and run Ollama locally.
Pull the required model:
```
ollama pull llama3.1:8b
```
Start Ollama and make sure it is available locally.
The backend communicates with the n8n workflow, which handles the sincerity evaluation pipeline.
n8n Setup
Run n8n locally:
```
npx n8n
```

Open:
```
http://localhost:5678
```
Import the sincerity-check workflow and configure the Ollama connection.
Environment Variables
Create a .env file for backend configuration.
Example:
```
HOST=0.0.0.0
PORT=8000

DATABASE_URL=sqlite:///./db/wacky_typofreakout.db

OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1:8b

N8N_SINCERITY_WEBHOOK_URL=http://localhost:5678/webhook/sincerity-check

MIN_APOLOGY_WORDS=50
SINCERITY_PASS_THRESHOLD=70

DARE_BASE_CRANK_COUNT=15
DARE_CRANK_INCREMENT=10
DARE_MAX_CRANK_COUNT=80
```
Do not commit the real .env file to GitHub.


## Project Structure
```
WackyTypoFreakout/
│
├── README.md
│
├── frontend/
│   ├── ...
│   └── desktop-app/
│
├── backend/
│   ├── requirements.txt
│   ├── .env.example
│   │
│   ├── src/
│   │   ├── main.py
│   │   │
│   │   ├── api/
│   │   │   ├── sessions.py
│   │   │   ├── incidents.py
│   │   │   └── letters.py
│   │   │
│   │   ├── ws/
│   │   │   └── connection_manager.py
│   │   │
│   │   ├── services/
│   │   │   ├── n8n_client.py
│   │   │   ├── sincerity_gate.py
│   │   │   ├── difficulty.py
│   │   │   └── hardware/
│   │   │
│   │   ├── models/
│   │   ├── db/
│   │   └── config/
│   │
│   └── tests/
│
├── n8n/
│   └── workflows/
│       └── sincerity-check.json
│
├── hardware/
│   ├── esp8266/
│   └── ...
│
├── images/
│   ├── landing-page.png
│   ├── player-selection.png
│   ├── typing-test.png
│   ├── truth-or-dare.png
│   ├── truth-challenge.png
│   ├── ai-sincerity.png
│   ├── dare-challenge.png
│   ├── leaderboard.png
│   ├── workflow.png
│   ├── architecture.png
│   ├── circuit.png
│   ├── schematic.png
│   ├── components.png
│   ├── build-process.png
│   └── final-build.png
│
└── .gitignore
```
# Future Improvements
- More detailed personalities for all 26 letters
- More Truth and Dare variations
- Additional physical punishment mechanisms
- Advanced player statistics
- Global leaderboard
- Difficulty adjustment based on player performance
- Spectator mode
- Live incident display
- More hardware-based challenges
- Improved AI evaluation and feedback


## Team Contributions
### Fahim Shafeek
- Project concept and game mechanics
- Backend development
- Game/session logic
- API integration
- AI/n8n integration
- Hardware integration

### Athira Adiparambil Anil
- Frontend development
- User interface and experience
- Typing-test interface
- Player and leaderboard screens
- Hardware interface/design

## Why We Built This

Typing tests are usually about one thing:
How fast can you type?
We wanted to ask a much more important question:

How badly do you want to avoid pressing Backspace?
So we built a typing game where mistakes don't disappear.
They come back for you.
Made with ❤️ at TinkerHub Useless Projects

---

## 🎥 Demos, Videos & Gallery

### Project Demo Video
* [▶️ Watch Project Demo](https://drive.google.com/drive/folders/1s0_GdIhSs685IxyQaxE7kOWlp-UlTPHc)

---

### 📸 Visual Gallery

| Screenshot 1 | Screenshot 2 |
| :---: | :---: |
| ![Image 1](frontend/desktop-app/assets/results/images/1.jpeg) | ![Image 2](frontend/desktop-app/assets/results/images/2.jpeg) |

| Screenshot 3 | Screenshot 4 |
| :---: | :---: |
| ![Image 3](frontend/desktop-app/assets/results/images/3.jpeg) | ![Image 4](frontend/desktop-app/assets/results/images/4.jpeg) |

| Screenshot 5 | Untitled |
| :---: | :---: |
| ![Image 5](frontend/desktop-app/assets/results/images/5.jpeg) | ![Untitled](frontend/desktop-app/assets/results/images/Untitled.jpeg) |
