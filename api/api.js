// api/api.js - Vercel Serverless Function

// --------------------------------------------------------------------------------
// Configuração de Segurança e CORS
// O domínio enviado pelo navegador é APENAS "https://playjogosgratis.com"
// --------------------------------------------------------------------------------

const ALLOWED_ORIGIN = 'https://playjogosgratis.com'; 
const JOGOS_COMPLEMENTARES = ["😎", "🤩", "🚀", "🍕", "🐶", "🎈", "💖", "🤖"]; 

// Variáveis de estado do jogo (aqui ou importadas)
let gameState = {
    jogadores: [],
    pares: [],
    cartoesVirados: [],
    paresEncontrados: 0,
    jogadorAtualIndex: 0,
    tempoTotalGlobal: 0,
    jogoIniciado: false,
    tempoInicio: 0,
};

// ... Funções utilitárias (shuffle, criarJogador, calcularQI) ...

const shuffle = (array) => {
    let currentIndex = array.length, randomIndex;
    while (currentIndex !== 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [array[currentIndex], array[randomIndex]] = [
            array[randomIndex], array[currentIndex]
        ];
    }
    return array;
};

const criarJogador = (id) => ({
    id: id,
    nome: `Jogador ${id}`,
    acertos: 0,
    tempoResposta: 0,
    tempoFinal: 0,
    ativo: id === 1,
});

const calcularQI = (acertos, tempoTotal) => {
    let qi = 100 + (acertos * 10) - (tempoTotal / 10);
    return Math.max(70, qi); 
};


// --------------------------------------------------------------------------------
// Funções da API para o Vercel
// --------------------------------------------------------------------------------

module.exports = (req, res) => {
    const origin = req.headers.origin;

    // 1. Tratamento de CORS
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Responde ao OPTIONS (pré-voo) para CORS
    if (req.method === 'OPTIONS') {
        if (origin === ALLOWED_ORIGIN) {
             res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
             res.writeHead(204);
             res.end();
        } else {
             // Bloqueia OPTIONS de outras origens
             res.writeHead(403);
             res.end();
        }
        return;
    }
    
    // 2. Verifica a Origem da Requisição
    if (origin !== ALLOWED_ORIGIN) {
        // Bloqueia e retorna uma mensagem de erro simples
        res.setHeader('Content-Type', 'application/javascript');
        res.send(`
            console.error("Acesso bloqueado! Lógica da API só pode ser acessada de ${ALLOWED_ORIGIN}.");
        `);
        return;
    }

    // Se chegou aqui, a origem é a permitida. Define o cabeçalho final.
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
    res.setHeader('Content-Type', 'application/javascript');

    // 3. Define e envia as funções globais (Lógica do Jogo)
    const apiCode = `
        // --------------------------------------------------------------------------------
        // Lógica do Jogo (Protegida)
        // --------------------------------------------------------------------------------
        
        // Define o estado do jogo e as funções utilitárias no escopo do navegador
        const gameState = { ...window.gameState, ...${JSON.stringify(gameState)} };
        const JOGOS_COMPLEMENTARES = ${JSON.stringify(JOGOS_COMPLEMENTARES)};
        
        // As funções shuffle, criarJogador e calcularQI devem ser replicadas aqui, 
        // ou a API deve retornar as strings completas delas. 
        // Para simplificar, vou re-incluir as funções simples aqui dentro.
        
        const criarJogador = ${criarJogador.toString()};
        const shuffle = ${shuffle.toString()};
        const calcularQI = ${calcularQI.toString()};

        // Funções de Comunicação
        window.API_INICIAR_JOGO = async (numJogadores) => {
            // Lógica de inicialização segura
            const todosPares = [...JOGOS_COMPLEMENTARES, ...JOGOS_COMPLEMENTARES];
            gameState.pares = shuffle(todosPares);
            gameState.jogadores = Array.from({ length: numJogadores }, (_, i) => criarJogador(i + 1));
            // ... (restante da lógica de inicialização de estado)
            gameState.cartoesVirados = [];
            gameState.paresEncontrados = 0;
            gameState.jogadorAtualIndex = 0;
            gameState.tempoTotalGlobal = 0;
            gameState.jogoIniciado = true;
            gameState.tempoInicio = Date.now();

            return {
                pares: gameState.pares,
                jogadores: gameState.jogadores
            };
        };

        window.API_VIRAR_CARTAO = async (indexCartao, tempoAtual) => {
            if (!gameState.jogoIniciado || gameState.cartoesVirados.length >= 2 || gameState.cartoesVirados.includes(indexCartao)) {
                return { 
                    match: false, 
                    cartoesVirados: gameState.cartoesVirados 
                };
            }
            
            gameState.cartoesVirados.push(indexCartao);

            if (gameState.cartoesVirados.length === 2) {
                const [idx1, idx2] = gameState.cartoesVirados;
                const emoji1 = gameState.pares[idx1];
                const emoji2 = gameState.pares[idx2];
                let match = false;
                
                if (emoji1 === emoji2) {
                    match = true;
                    gameState.paresEncontrados++;
                    const jogador = gameState.jogadores[gameState.jogadorAtualIndex];
                    jogador.acertos++;
                    
                    const jogoFinalizado = gameState.paresEncontrados === JOGOS_COMPLEMENTARES.length;

                    gameState.cartoesVirados = [];
                    
                    return {
                        match: true,
                        jogoFinalizado: jogoFinalizado,
                        cartoesVirados: [idx1, idx2],
                        jogadores: gameState.jogadores
                    };
                } else {
                    match = false;
                    
                    gameState.jogadorAtualIndex = (gameState.jogadorAtualIndex + 1) % gameState.jogadores.length;
                    gameState.jogadores.forEach((j, i) => j.ativo = (i === gameState.jogadorAtualIndex));
                    
                    const tempVirados = gameState.cartoesVirados;
                    
                    setTimeout(() => {
                        gameState.cartoesVirados = [];
                    }, 1500); 

                    return {
                        match: false,
                        jogoFinalizado: false,
                        cartoesVirados: tempVirados,
                        jogadores: gameState.jogadores
                    };
                }
            } else {
                return { 
                    match: false, 
                    cartoesVirados: gameState.cartoesVirados 
                };
            }
        };

        window.API_FINALIZAR_JOGO = async (tempoTotalSegundos) => {
            // ... (Lógica de Finalização e Cálculo de QI)
            gameState.jogoIniciado = false;
            gameState.tempoTotalGlobal = tempoTotalSegundos;
            
            const resultadosFinais = gameState.jogadores.map(j => {
                const qiCalculado = calcularQI(j.acertos, gameState.tempoTotalGlobal);
                
                return {
                    nome: j.nome,
                    acertos: j.acertos,
                    tempo: 'N/A (Tempo Global)',
                    qiCalculado: qiCalculado
                };
            });
            
            const minutos = Math.floor(tempoTotalSegundos / 60).toString().padStart(2, '0');
            const segundos = (tempoTotalSegundos % 60).toString().padStart(2, '0');

            return {
                resultados: resultadosFinais,
                tempoTotal: \`\${minutos}:\${segundos}\`
            };
        };
        
    `;
    // Enviando o código JS
    res.send(apiCode);
};
