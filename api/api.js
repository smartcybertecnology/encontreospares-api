// Este é um arquivo de função serverless para o Vercel (Node.js).
// Ele centraliza toda a lógica do jogo "Encontre as Palavras" e trata a segurança CORS.

// ATENÇÃO: Em um ambiente Serverless real, o 'gameState' não persiste entre chamadas.
// Ele é mantido aqui APENAS para simulação. Em produção, você usaria um banco de dados (como Redis ou Firestore).

let gameState = {
    status: 'INITIAL', // INITIAL, CONFIG, PLAYING, FINISHED
    players: [],
    board: [],
    currentPlayerIndex: 0,
    startTime: null,
    gameDuration: 0,
    gameId: Math.random().toString(36).substring(2, 9),
    pairsFound: 0,
    maxPairs: 8, 
    emojis: ["🍎", "🍉", "🍇", "🍓", "🍍", "🥭", "🥝", "🥥", "🍋", "🍒", "🍊", "🌶️", "🍄", "🥕", "🥑", "🥦"],
};

module.exports = (req, res) => {
    // Domínio permitido para acesso à API
    const ALLOWED_ORIGIN = 'https://playjogosgratis.com';
    const requestOrigin = req.headers.origin;

    // --- Controle de CORS e Segurança ---
    const setCorsHeaders = (allow) => {
        if (allow) {
            res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
        } else {
            // Se a origem não for a permitida, não define o header, forçando o bloqueio pelo browser
            // para requisições que não sejam GET/POST simples.
            // Para GET/POST simples, o bloqueio deve ser feito pela lógica abaixo.
            res.setHeader('Access-Control-Allow-Origin', 'null'); 
        }
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    };

    // Tratamento da requisição OPTIONS (pré-voo CORS)
    if (req.method === 'OPTIONS') {
        setCorsHeaders(requestOrigin === ALLOWED_ORIGIN);
        res.writeHead(204);
        res.end();
        return;
    }

    // --- Bloqueio de Acesso Imediato para Origens Não Permitidas ---
    if (requestOrigin !== ALLOWED_ORIGIN) {
        setCorsHeaders(false);
        console.error(`Acesso bloqueado. Origem não permitida: ${requestOrigin}`);
        return res.status(403).json({ 
            error: `Acesso negado. A lógica da API só pode ser acessada de ${ALLOWED_ORIGIN}.` 
        });
    }

    // Se chegou aqui, a origem é permitida
    setCorsHeaders(true);


    // --- Funções de Lógica (Centralizadas e Protegidas) ---
    const resetState = () => {
        gameState = {
            status: 'INITIAL',
            players: [],
            board: [],
            currentPlayerIndex: 0,
            startTime: null,
            gameDuration: 0,
            gameId: Math.random().toString(36).substring(2, 9),
            pairsFound: 0,
            maxPairs: gameState.maxPairs,
            emojis: gameState.emojis,
        };
    };

    const shuffleArray = (array) => {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    };

    const createBoard = () => {
        const selectedEmojis = shuffleArray(gameState.emojis).slice(0, gameState.maxPairs);
        let tiles = [...selectedEmojis, ...selectedEmojis];
        tiles = shuffleArray(tiles);
        
        return tiles.map((emoji, index) => ({
            id: index,
            emoji: emoji,
            isFlipped: false,
            isMatched: false,
        }));
    };

    const calculateIQ = (playerStats, totalTime) => {
        const { correctAttempts, totalAttempts, responseTimes } = playerStats;
        
        if (correctAttempts === 0) return 0;

        const totalResponseTime = responseTimes.reduce((sum, time) => sum + time, 0);
        const averageResponseTime = totalResponseTime / (totalAttempts || 1); // Evita divisão por zero

        // QI Base = (Acertos * 10000) / (Tempo Total do Jogador + 1)
        let qi = Math.round((correctAttempts * 10000) / (totalTime * 0.1 + 1)); 
        
        return Math.min(150, Math.max(50, qi)); 
    };


    // --- Rotas da API (Processamento) ---
    const { url } = req;
    const action = new URL(url, `http://${req.headers.host}`).searchParams.get('action');

    try {
        switch (action) {
            case 'start': {
                const playersCount = parseInt(new URL(url, `http://${req.headers.host}`).searchParams.get('players'), 10);
                if (isNaN(playersCount) || playersCount < 1 || playersCount > 4) {
                    return res.status(400).json({ error: 'Número de jogadores inválido.' });
                }

                resetState();
                
                for (let i = 1; i <= playersCount; i++) {
                    gameState.players.push({
                        id: i,
                        name: `Jogador ${i}`,
                        score: 0,
                        pairsFound: 0,
                        totalTimeMs: 0,
                        correctAttempts: 0,
                        totalAttempts: 0,
                        responseTimes: [],
                        currentTurnStartTime: Date.now(),
                    });
                }

                gameState.board = createBoard();
                gameState.startTime = Date.now();
                gameState.status = 'PLAYING';
                
                return res.status(200).json({ 
                    success: true, 
                    gameState: {
                        status: gameState.status,
                        players: gameState.players.map(p => ({
                            id: p.id,
                            name: p.name,
                            score: p.score,
                            pairsFound: p.pairsFound,
                            totalTimeMs: p.totalTimeMs,
                        })),
                        currentPlayerId: gameState.players[0].id,
                        board: gameState.board.map(tile => ({ id: tile.id, isFlipped: tile.isFlipped, isMatched: tile.isMatched })),
                        maxPairs: gameState.maxPairs,
                    }
                });
            }

            case 'move': {
                if (gameState.status !== 'PLAYING') {
                    return res.status(403).json({ error: 'O jogo não está em andamento.' });
                }

                const playerId = parseInt(new URL(url, `http://${req.headers.host}`).searchParams.get('playerId'), 10);
                const tileId = parseInt(new URL(url, `http://${req.headers.host}`).searchParams.get('tileId'), 10);
                
                const player = gameState.players.find(p => p.id === playerId);
                if (!player || player.id !== gameState.players[gameState.currentPlayerIndex].id) {
                    return res.status(403).json({ error: 'Não é a vez deste jogador ou ID inválido.' });
                }

                const tile = gameState.board.find(t => t.id === tileId);
                if (!tile || tile.isFlipped || tile.isMatched) {
                    return res.status(400).json({ error: 'Movimento inválido: peça já virada ou casada.' });
                }

                tile.isFlipped = true;
                player.totalAttempts++;

                const flippedTiles = gameState.board.filter(t => t.isFlipped && !t.isMatched);

                let match = false;
                let isGameOver = false;
                let sound = 'click';

                if (flippedTiles.length === 2) {
                    const [tile1, tile2] = flippedTiles;
                    
                    const responseTime = Date.now() - player.currentTurnStartTime;
                    player.responseTimes.push(responseTime);
                    player.totalTimeMs += responseTime;
                    
                    if (tile1.emoji === tile2.emoji) {
                        tile1.isMatched = true;
                        tile2.isMatched = true;
                        tile1.isFlipped = true;
                        tile2.isFlipped = true;

                        player.score += 10;
                        player.pairsFound++;
                        player.correctAttempts++;
                        gameState.pairsFound++;
                        match = true;
                        sound = 'acerto';

                        if (gameState.pairsFound === gameState.maxPairs) {
                            gameState.status = 'FINISHED';
                            gameState.gameDuration = Date.now() - gameState.startTime;
                            isGameOver = true;
                        }

                        player.currentTurnStartTime = Date.now();

                    } else {
                        sound = 'erro';
                        
                        // Passa para o próximo jogador
                        const numPlayers = gameState.players.length;
                        gameState.currentPlayerIndex = (gameState.currentPlayerIndex + 1) % numPlayers;
                        gameState.players[gameState.currentPlayerIndex].currentTurnStartTime = Date.now();
                    }
                } else {
                    player.currentTurnStartTime = Date.now();
                }

                return res.status(200).json({ 
                    success: true, 
                    match: match, 
                    sound: sound,
                    isGameOver: isGameOver,
                    gameState: {
                        status: gameState.status,
                        players: gameState.players.map(p => ({
                            id: p.id,
                            name: p.name,
                            score: p.score,
                            pairsFound: p.pairsFound,
                            totalTimeMs: p.totalTimeMs,
                        })),
                        currentPlayerId: gameState.players[gameState.currentPlayerIndex].id,
                        board: gameState.board.map(tile => ({ id: tile.id, isFlipped: tile.isFlipped, isMatched: tile.isMatched, emoji: tile.isFlipped || tile.isMatched ? tile.emoji : null })),
                        pairsFound: gameState.pairsFound,
                        maxPairs: gameState.maxPairs,
                    }
                });
            }

            case 'finish': {
                if (gameState.status !== 'PLAYING' && gameState.status !== 'FINISHED') {
                    return res.status(403).json({ error: 'O jogo não está pronto para ser finalizado.' });
                }

                gameState.status = 'FINISHED';
                gameState.gameDuration = Date.now() - gameState.startTime;

                const finalResults = gameState.players.map(p => {
                    // O tempo total é a soma dos tempos de resposta para todas as tentativas
                    const totalTime = p.totalTimeMs; 
                    const qi = calculateIQ(p, totalTime);
                    
                    return {
                        id: p.id,
                        name: p.name,
                        pairsFound: p.pairsFound,
                        totalTimeMs: totalTime,
                        totalTimeFormatted: (totalTime / 1000).toFixed(2),
                        qi: qi,
                        score: p.score,
                    };
                });
                
                finalResults.sort((a, b) => {
                    if (b.qi !== a.qi) return b.qi - a.qi;
                    return b.pairsFound - a.pairsFound;
                });


                return res.status(200).json({ 
                    success: true, 
                    results: finalResults,
                    gameDuration: gameState.gameDuration,
                });
            }

            case 'restart': {
                resetState();
                return res.status(200).json({ success: true, message: 'Jogo reiniciado. Voltando ao menu de configuração.' });
            }

            case 'state': {
                return res.status(200).json({ 
                    success: true, 
                    gameState: {
                        status: gameState.status,
                        players: gameState.players.map(p => ({ id: p.id, name: p.name, score: p.score, pairsFound: p.pairsFound, totalTimeMs: p.totalTimeMs })),
                        currentPlayerId: gameState.players[gameState.currentPlayerIndex]?.id,
                        board: gameState.board.map(tile => ({ id: tile.id, isFlipped: tile.isFlipped, isMatched: tile.isMatched, emoji: tile.isFlipped || tile.isMatched ? tile.emoji : null })),
                        pairsFound: gameState.pairsFound,
                        maxPairs: gameState.maxPairs,
                    }
                });
            }

            default: {
                return res.status(404).json({ error: 'Ação não encontrada.' });
            }
        }
    } catch (e) {
        console.error('API Error:', e);
        return res.status(500).json({ error: 'Erro interno do servidor: ' + e.message });
    }
};
