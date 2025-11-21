export default function handler(req, res) {
    // 1. Configuração dos domínios permitidos
    // Adicione seus domínios aqui (produção e teste local/vercel)
    const allowedOrigins = [
        'https://playjogosgratis.com',
        'https://www.playjogosgratis.com',
        'http://localhost:5500', // Útil para seus testes locais
        'http://127.0.0.1:5500'
    ];

    const origin = req.headers.origin || req.headers.referer;
    
    // Verifica se a origem da requisição está na lista de permitidos
    let isAllowed = false;
    let allowedOrigin = '';

    if (origin) {
        // Remove a barra final se houver para comparar corretamente
        const cleanOrigin = origin.replace(/\/$/, '');
        // Verifica se alguma das origens permitidas está contida na origem da requisição
        if (allowedOrigins.some(allowed => cleanOrigin.startsWith(allowed))) {
            isAllowed = true;
            allowedOrigin = cleanOrigin; // Usa a origem que fez a requisição
        }
    }

    // 2. Função para configurar cabeçalhos CORS
    // É crucial incluir 'OPTIONS' nos métodos e configurar os headers corretamente
    const setCorsHeaders = () => {
        if (isAllowed) {
            res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
        }
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
        res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
    };

    // 3. TRATAMENTO DO PREFLIGHT (O erro do seu console está aqui)
    // O navegador manda um OPTIONS antes do GET/POST. Se não responder OK, ele bloqueia.
    if (req.method === 'OPTIONS') {
        setCorsHeaders();
        res.status(200).end();
        return;
    }

    // 4. Aplica os headers para a requisição real (GET)
    setCorsHeaders();

    // 5. Bloqueio de Segurança se não for origem permitida
    if (!isAllowed) {
        return res.status(403).json({ 
            error: 'Acesso negado. Origem não autorizada.',
            yourOrigin: origin 
        });
    }

    // 6. Define o tipo de conteúdo como Javascript
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store'); // Evita cache durante desenvolvimento

    // 7. Lógica do Jogo (Servida como String)
    const gameCode = `
        console.log('🔒 API de Jogo Segura Carregada - playjogosgratis.com');

        window.GameLogicClass = class MemoryGame {
            constructor() {
                this.players = 1;
                this.currentPlayer = 1;
                this.playerScores = [0, 0, 0, 0];
                this.playerMoves = [0, 0, 0, 0];
                this.cards = [];
                this.flippedCards = [];
                this.lockBoard = false;
                this.matchesFound = 0;
                this.timer = 0;
                this.timerInterval = null;
                this.emojis = ['🦁', '🐘', '🦒', '🐵', '🐬', '🐼', '🐸', '🐯', '🐙', '🦄', '🦋', '🦕', '🐞', '🐠', '🦩', '🐿️', '🦔', '🦜'];
                this.gameActive = false;
            }

            playSound(type) {
                const sound = document.getElementById(\`sound-\${type}\`);
                if (sound) {
                    sound.currentTime = 0;
                    sound.play().catch(() => {});
                }
            }

            setPlayers(num) {
                this.players = num;
                this.startGame();
            }

            startGame() {
                this.gameActive = true;
                document.getElementById('setup-screen').classList.add('hidden');
                document.getElementById('game-screen').classList.remove('hidden');
                document.getElementById('game-screen').classList.add('flex');
                
                this.playSound('bg');
                const bgAudio = document.getElementById('sound-bg');
                if(bgAudio) { bgAudio.volume = 0.3; bgAudio.play().catch(e => {}); }

                this.generateBoard();
                this.startTimer();
                this.updateTurnDisplay();
            }

            generateBoard() {
                const gameBoard = document.getElementById('game-board');
                gameBoard.innerHTML = '';
                
                const selectedEmojis = this.emojis.sort(() => 0.5 - Math.random()).slice(0, 10);
                const deck = [...selectedEmojis, ...selectedEmojis];
                deck.sort(() => 0.5 - Math.random());
                
                this.cards = deck;
                
                deck.forEach((emoji, index) => {
                    const card = document.createElement('div');
                    card.classList.add('card-container', 'h-24', 'sm:h-32');
                    card.setAttribute('data-emoji', emoji);
                    card.setAttribute('data-index', index);
                    
                    card.innerHTML = \`
                        <div class="card-inner" onclick="window.gameLogic.handleCardClick(\${index})">
                            <div class="card-front">
                                <i class="fas fa-star text-white text-2xl opacity-50"></i>
                            </div>
                            <div class="card-back">
                                \${emoji}
                            </div>
                        </div>
                    \`;
                    gameBoard.appendChild(card);
                });
            }

            handleCardClick(index) {
                if (!this.gameActive || this.lockBoard) return;
                
                const cardElement = document.getElementById('game-board').children[index];
                
                if (cardElement.classList.contains('flipped') || 
                    cardElement.classList.contains('matched')) return;

                this.playSound('click');
                cardElement.classList.add('flipped');
                this.flippedCards.push({ index, emoji: this.cards[index], element: cardElement });

                if (this.flippedCards.length === 2) {
                    this.playerMoves[this.currentPlayer - 1]++;
                    this.checkMatch();
                }
            }

            checkMatch() {
                const [card1, card2] = this.flippedCards;
                const isMatch = card1.emoji === card2.emoji;

                if (isMatch) {
                    this.handleMatch(card1, card2);
                } else {
                    this.handleMismatch(card1, card2);
                }
            }

            handleMatch(card1, card2) {
                this.lockBoard = true;
                
                setTimeout(() => {
                    this.playSound('match');
                    card1.element.classList.add('matched');
                    card2.element.classList.add('matched');
                    
                    card1.element.querySelector('.card-back').style.backgroundColor = '#84fab0';
                    card2.element.querySelector('.card-back').style.backgroundColor = '#84fab0';

                    this.playerScores[this.currentPlayer - 1]++;
                    this.matchesFound++;
                    this.flippedCards = [];
                    this.lockBoard = false;

                    if (this.matchesFound === 10) {
                        this.finishGame();
                    }
                }, 500);
            }

            handleMismatch(card1, card2) {
                this.lockBoard = true;
                
                setTimeout(() => {
                    this.playSound('error');
                    card1.element.classList.remove('flipped');
                    card2.element.classList.remove('flipped');
                    this.flippedCards = [];
                    this.nextPlayer();
                    this.lockBoard = false;
                }, 1000);
            }

            nextPlayer() {
                this.currentPlayer++;
                if (this.currentPlayer > this.players) {
                    this.currentPlayer = 1;
                }
                this.updateTurnDisplay();
            }

            updateTurnDisplay() {
                const display = document.getElementById('current-player-display');
                const indicator = document.getElementById('turn-indicator');
                
                display.innerText = this.currentPlayer;
                const colors = ['text-blue-600', 'text-green-600', 'text-purple-600', 'text-pink-600'];
                const bgColors = ['bg-blue-100', 'bg-green-100', 'bg-purple-100', 'bg-pink-100'];
                
                indicator.className = \`text-2xl font-bold flex items-center gap-2 \${colors[this.currentPlayer-1]}\`;
                display.className = \`\${bgColors[this.currentPlayer-1]} px-3 py-1 rounded-full\`;
            }

            startTimer() {
                this.timerInterval = setInterval(() => {
                    this.timer++;
                    const minutes = Math.floor(this.timer / 60).toString().padStart(2, '0');
                    const seconds = (this.timer % 60).toString().padStart(2, '0');
                    document.getElementById('timer').innerText = \`\${minutes}:\${seconds}\`;
                }, 1000);
            }

            finishGameEarly() {
                if(confirm('Encerrar agora?')) {
                    this.finishGame();
                }
            }

            finishGame() {
                this.gameActive = false;
                clearInterval(this.timerInterval);
                
                const modal = document.getElementById('result-modal');
                const container = document.getElementById('results-container');
                container.innerHTML = '';

                let winner = { id: 0, score: -1 };

                for (let i = 0; i < this.players; i++) {
                    const score = this.playerScores[i];
                    const moves = this.playerMoves[i] || 1;
                    
                    let iq = 0;
                    if (score > 0) {
                        const efficiency = (score / moves) * 100;
                        iq = Math.floor(80 + efficiency + (score * 2));
                    } else {
                        iq = Math.floor(Math.random() * 20) + 70;
                    }
                    
                    if (score > winner.score) {
                        winner = { id: i + 1, score: score };
                    }

                    const div = document.createElement('div');
                    div.className = 'flex justify-between items-center bg-gray-50 p-4 rounded-xl border-b-2 border-gray-200';
                    div.innerHTML = \`
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold">
                                \${i + 1}
                            </div>
                            <div class="text-left">
                                <p class="font-bold text-gray-700">Jogador \${i + 1}</p>
                                <p class="text-xs text-gray-500">QI Lúdico: \${iq}</p>
                            </div>
                        </div>
                        <div class="text-right">
                            <p class="text-2xl font-bold text-green-500">\${score} <span class="text-sm text-gray-400">pares</span></p>
                        </div>
                    \`;
                    container.appendChild(div);
                }

                const winnerDiv = document.createElement('div');
                winnerDiv.className = 'text-center mt-4 p-4 bg-yellow-100 rounded-xl text-yellow-700 font-bold animate-bounce';
                winnerDiv.innerHTML = \`<i class="fas fa-trophy"></i> Vencedor: Jogador \${winner.id}!\`;
                container.prepend(winnerDiv);

                modal.classList.remove('hidden');
                this.playSound('match');
            }
        };

        // Inicializa o jogo apenas quando o script é carregado
        window.gameLogic = new window.GameLogicClass();
    `;

    res.send(gameCode);
}
