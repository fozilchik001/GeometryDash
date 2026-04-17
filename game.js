const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game State
let gameState = 'MENU'; // MENU, PLAYING, GAMEOVER
let players = [];
let obstacles = [];
let particles = [];
let gameSpeed = 5;
let score = 0;
let frameCount = 0;
let isTwoPlayer = false;
let bestScore = localStorage.getItem('GD_RECORD') || 0;

function updateRecordUI() {
    document.getElementById('best-score').innerText = bestScore + 'm';
}
updateRecordUI();

// Configuration
const GRAVITY = 0.6;
const JUMP_FORCE = -10;
const PLAYER_SIZE = 40;
const COLORS = {
    P1: '#00f2ff',
    P2: '#ff00e6',
    SPIKE: '#ff4444',
    BLOCK: '#ffffff',
    PARTICLE: '#555'
};

// Resize Canvas
function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// Input Handling
const keys = {};
window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (gameState === 'PLAYING') {
        if (e.code === 'Space') players[0].jump();
        if (isTwoPlayer && e.code === 'ArrowUp') players[1].jump();
    }
});
window.addEventListener('keyup', (e) => keys[e.code] = false);
window.addEventListener('mousedown', () => {
    if (gameState === 'PLAYING') players[0].jump();
});

// Player Class
class Player {
    constructor(id, color, x) {
        this.id = id;
        this.color = color;
        this.x = x;
        this.y = canvas.height - 150;
        this.width = PLAYER_SIZE;
        this.height = PLAYER_SIZE;
        this.vy = 0;
        this.rotation = 0;
        this.isGrounded = false;
        this.alive = true;
    }

    update() {
        if (!this.alive) return;

        this.vy += GRAVITY;
        this.y += this.vy;

        // Ground collision (Simple floor)
        const groundY = canvas.height - 100 - this.height;
        if (this.y > groundY) {
            this.y = groundY;
            this.vy = 0;
            this.isGrounded = true;
            // Align rotation to 90deg increments when grounded
            this.rotation = Math.round(this.rotation / 90) * 90;
        } else {
            this.isGrounded = false;
            this.rotation += 5; // Rotate in air
        }
    }

    jump() {
        if (this.isGrounded) {
            this.vy = JUMP_FORCE;
            this.isGrounded = false;
            createParticles(this.x, this.y + this.height, this.color);
        }
    }

    draw() {
        if (!this.alive) return;
        ctx.save();
        ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
        ctx.rotate(this.rotation * Math.PI / 180);

        // Draw square body
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;
        ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);

        // Face/Core
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 4;
        ctx.strokeRect(-this.width / 2 + 5, -this.height / 2 + 5, this.width - 10, this.height - 10);

        ctx.restore();
    }
}

// Obstacle Class (Spike or Block)
class Obstacle {
    constructor(type, x) {
        this.type = type; // 'spike' or 'block'
        this.x = x;
        this.width = 40;
        this.height = type === 'spike' ? 40 : 60;
        this.y = canvas.height - 100 - this.height;
    }

    update() {
        this.x -= gameSpeed;
    }

    draw() {
        ctx.save();
        ctx.shadowBlur = 10;
        if (this.type === 'spike') {
            ctx.fillStyle = COLORS.SPIKE;
            ctx.shadowColor = COLORS.SPIKE;
            ctx.beginPath();
            ctx.moveTo(this.x, this.y + this.height);
            ctx.lineTo(this.x + this.width / 2, this.y);
            ctx.lineTo(this.x + this.width, this.y + this.height);
            ctx.closePath();
            ctx.fill();
        } else {
            ctx.fillStyle = COLORS.BLOCK;
            ctx.shadowColor = COLORS.BLOCK;
            ctx.fillRect(this.x, this.y, this.width, this.height);
        }
        ctx.restore();
    }
}

// Particles System
function createParticles(x, y, color) {
    for (let i = 0; i < 8; i++) {
        particles.push({
            x, y,
            vx: (Math.random() - 0.5) * 5,
            vy: (Math.random() - 0.5) * 5,
            size: Math.random() * 4 + 2,
            life: 1,
            color
        });
    }
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.02;
        if (p.life <= 0) particles.splice(i, 1);
    }
}

function drawParticles() {
    particles.forEach(p => {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
    });
    ctx.globalAlpha = 1;
}

// Collision Logic
function checkCollision(player, obs) {
    if (!player.alive) return false;

    // Simple AABB collision
    const pBox = { x: player.x + 5, y: player.y + 5, w: player.width - 10, h: player.height - 10 };
    const oBox = { x: obs.x + 5, y: obs.y + 5, w: obs.width - 10, h: obs.height - 10 };

    return pBox.x < oBox.x + oBox.w &&
        pBox.x + pBox.w > oBox.x &&
        pBox.y < oBox.y + oBox.h &&
        pBox.y + pBox.h > oBox.y;
}

// Game Loop
function gameLoop() {
    if (gameState !== 'PLAYING') return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw Floor
    const groundOffset = (frameCount * gameSpeed) % 50;
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, canvas.height - 100);
    ctx.lineTo(canvas.width, canvas.height - 100);
    ctx.stroke();

    // Floor design (lines)
    for (let i = -groundOffset; i < canvas.width; i += 50) {
        ctx.beginPath();
        ctx.moveTo(i, canvas.height - 100);
        ctx.lineTo(i - 20, canvas.height);
        ctx.stroke();
    }

    // Spawn Obstacles
    if (frameCount % 100 === 0) {
        const type = Math.random() > 0.3 ? 'spike' : 'block';
        obstacles.push(new Obstacle(type, canvas.width));
    }

    // Update & Draw Players
    players.forEach(p => {
        p.update();
        p.draw();

        // Trail particles
        if (p.isGrounded && frameCount % 5 === 0) {
            createParticles(p.x, p.y + p.height, p.color);
        }
    });

    // Update & Draw Obstacles
    for (let i = obstacles.length - 1; i >= 0; i--) {
        const obs = obstacles[i];
        obs.update();
        obs.draw();

        // Collision Check
        players.forEach(p => {
            if (checkCollision(p, obs)) {
                if (isTwoPlayer) {
                    p.alive = false;
                    createParticles(p.x, p.y, p.color);
                    // Check if both died
                    if (players.every(pl => !pl.alive)) endGame();
                } else {
                    endGame();
                }
            }
        });

        // Cleanup
        if (obs.x + obs.width < 0) {
            obstacles.splice(i, 1);
            score++;
            document.getElementById('score').innerText = score + 'm';
            if (score % 10 === 0) gameSpeed += 0.2; // Increase difficulty
        }
    }

    updateParticles();
    drawParticles();

    frameCount++;
    requestAnimationFrame(gameLoop);
}

// UI Controls
function initGame(multiplayer) {
    gameState = 'PLAYING';
    isTwoPlayer = multiplayer;
    score = 0;
    gameSpeed = 5;
    frameCount = 0;
    obstacles = [];
    particles = [];
    document.getElementById('score').innerText = '0m';

    players = [new Player(1, COLORS.P1, 100)];
    if (multiplayer) {
        players.push(new Player(2, COLORS.P2, 80));
        document.getElementById('p2-score-container').classList.remove('hidden');
    } else {
        document.getElementById('p2-score-container').classList.add('hidden');
    }

    document.getElementById('menu').classList.remove('active');
    document.getElementById('game-over').classList.remove('active');

    gameLoop();
}

function endGame() {
    gameState = 'GAMEOVER';
    document.getElementById('game-over').classList.add('active');
    document.getElementById('final-score').innerText = `Masofa: ${score}m`;

    if (score > bestScore) {
        bestScore = score;
        localStorage.setItem('GD_RECORD', bestScore);
        updateRecordUI();
    }
}

document.getElementById('btn-1p').onclick = () => initGame(false);
document.getElementById('btn-2p').onclick = () => initGame(true);
document.getElementById('btn-restart').onclick = () => initGame(isTwoPlayer);
document.getElementById('btn-home').onclick = () => {
    document.getElementById('game-over').classList.remove('active');
    document.getElementById('menu').classList.add('active');
    updateRecordUI();
};
