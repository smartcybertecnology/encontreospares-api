// Este é um arquivo de função serverless para o Vercel (Node.js).
// Ele centraliza toda a lógica do jogo "Encontre as Palavras" e trata a segurança CORS.

module.exports = (req, res) => {
    // Domínio permitido para acesso à API
    const ALLOWED_ORIGIN = 'https://playjogosgratis.com';
    const requestOrigin = req.headers.origin;

    // --- Controle de CORS e Segurança ---
    const setCorsHeaders = () => {
        if (requestOrigin === ALLOWED_ORIGIN) {
            res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
        } else {
            // Se a origem não for a permitida, nega o acesso (embora o browser possa bloquear antes)
            // Em produção, você pode remover esta linha para não dar dicas ao invasor.
            res.setHeader('Access-Control-Allow-Origin', 'null');
        }
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    };

    setCorsHeaders();

    // Tratamento da requisição OPTIONS (pré-voo CORS)
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // --- Configurações e Estado Centralizado do Jogo ---

    // Estado do jogo (usando escopo global para simular um estado, em produção precisaria de DB/Redis)
    let gameState = {
        status: 'INITIAL', // INITIAL, CONFIG, PLAYING, FINISHED
        players: [],
        board: [],
        currentPlayerIndex: 0,
        startTime: null,
        gameDuration: 0,
        gameId: Math.random().toString(36).substring(2, 9), // ID único para a sessão
        pairsFound: 0,
        maxPairs: 8, // Exemplo: 8 pares
        emojis: ["🍎", "🍉", "🍇", "🍓", "🍍", "🥭", "🥝", "🥥", "🍋", "🍒", "🍊", "🌶️", "🍄", "🥕", "🥑", "🥦"], // 8 pares = 16 itens
    };

    // Reseta o estado do jogo
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

    // Lógica para embaralhar a matriz do tabuleiro
    const shuffleArray = (array) => {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    };

    // Cria o tabuleiro com pares de emojis
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

    // Função de Cálculo de QI (QI = (Acertos / Tempo Médio de Resposta) * Coeficiente)
    const calculateIQ = (playerStats, totalTime) => {
        const { correctAttempts, totalAttempts, responseTimes } = playerStats;
        
        if (correctAttempts === 0) return 0;

        const totalResponseTime = responseTimes.reduce((sum, time) => sum + time, 0);
        const averageResponseTime = totalResponseTime / totalAttempts; // Tempo médio por tentativa

        // Coeficiente de Acerto: Prioriza acerto e velocidade
        const accuracyFactor = correctAttempts / gameState.maxPairs; // Acertos pelo máximo possível

        // Fator de Velocidade: Inverso do tempo médio. Quanto menor o tempo, maior o QI.
        // Adiciona 1 para evitar divisão por zero.
        const speedFactor = 1000 / (averageResponseTime + 1); 

        // QI Base = (Acertos x 1000) / (Tempo Total do Jogador)
        // Uma fórmula simples e divertida para crianças:
        let qi = Math.round((correctAttempts * 10000) / (totalTime * 0.1 + 1)); // Fator de tempo menor
        
        return Math.min(150, Math.max(50, qi)); // Mantém o QI em um intervalo razoável (50-150)
    };


    // --- Rotas da API ---

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
                
                // Inicializa jogadores
                for (let i = 1; i <= playersCount; i++) {
                    gameState.players.push({
                        id: i,
                        name: `Jogador ${i}`,
                        score: 0,
                        pairsFound: 0,
                        totalTimeMs: 0,
                        correctAttempts: 0, // Tentativas que resultaram em acerto
                        totalAttempts: 0, // Total de cliques (para QI)
                        responseTimes: [], // Tempo de resposta de cada jogada
                        currentTurnStartTime: Date.now(),
                    });
                }

                // Cria o tabuleiro e inicia o jogo
                gameState.board = createBoard();
                gameState.startTime = Date.now();
                gameState.status = 'PLAYING';
                
                // Retorna o estado inicial do jogo e tabuleiro
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

                // --- Lógica de Acerto ou Erro ---
                let match = false;
                let isGameOver = false;
                let sound = 'click';

                if (flippedTiles.length === 2) {
                    const [tile1, tile2] = flippedTiles;
                    
                    // Calcula o tempo de resposta da jogada
                    const responseTime = Date.now() - player.currentTurnStartTime;
                    player.responseTimes.push(responseTime);
                    player.totalTimeMs += (Date.now() - player.currentTurnStartTime);
                    
                    if (tile1.emoji === tile2.emoji) {
                        // Acerto
                        tile1.isMatched = true;
                        tile2.isMatched = true;
                        tile1.isFlipped = true; // Mantém virada, mas agora casada
                        tile2.isFlipped = true; // Mantém virada, mas agora casada

                        player.score += 10;
                        player.pairsFound++;
                        player.correctAttempts++;
                        gameState.pairsFound++;
                        match = true;
                        sound = 'acerto';

                        // Verifica fim de jogo
                        if (gameState.pairsFound === gameState.maxPairs) {
                            gameState.status = 'FINISHED';
                            gameState.gameDuration = Date.now() - gameState.startTime;
                            isGameOver = true;
                        }

                        // O jogador que acertou joga novamente
                        player.currentTurnStartTime = Date.now();

                    } else {
                        // Erro: Vira as peças de volta após um pequeno atraso (simulado no cliente)
                        sound = 'erro';
                        
                        // Passa para o próximo jogador, atualiza o tempo total do turno
                        const numPlayers = gameState.players.length;
                        gameState.currentPlayerIndex = (gameState.currentPlayerIndex + 1) % numPlayers;
                        gameState.players[gameState.currentPlayerIndex].currentTurnStartTime = Date.now();
                    }
                } else {
                    // Primeiro clique, atualiza o tempo de início do turno
                    player.currentTurnStartTime = Date.now();
                }

                // Retorna o estado atualizado do jogo
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

                // Prepara os resultados finais e calcula o QI
                const finalResults = gameState.players.map(p => {
                    const totalTime = p.totalTimeMs || (Date.now() - gameState.startTime);
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
                
                // Ordena por QI e depois por acertos
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
                // Rota para o cliente obter o estado atual (útil para reconexão ou debugging)
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
