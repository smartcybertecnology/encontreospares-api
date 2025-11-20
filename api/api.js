// api/api.js - Vercel Serverless Function

// --------------------------------------------------------------------------------
// Configuração de Segurança e CORS
// --------------------------------------------------------------------------------

const ALLOWED_ORIGIN = 'https://playjogosgratis.com'; // Domínio permitido
const JOGOS_COMPLEMENTARES = ["😎", "🤩", "🚀", "🍕", "🐶", "🎈", "💖", "🤖"]; // Emojis para o jogo (8 pares = 16 cartas)

// --------------------------------------------------------------------------------
// Lógica do Jogo Centralizada (Variáveis e Funções Utilitárias no Servidor)
// --------------------------------------------------------------------------------
let gameState = {
    jogadores: [],
    pares: [],
    cartoesVirados: [], // Array de índices
    paresEncontrados: 0,
    jogadorAtualIndex: 0,
    tempoTotalGlobal: 0, // Acumulado de segundos
    jogoIniciado: false,
    tempoInicio: 0,
};

/**
 * Função utilitária para embaralhar um array (Algoritmo de Fisher-Yates).
 * @param {Array} array
 */
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

/**
 * Gera um objeto de jogador.
 * @param {number} id
 * @returns {object}
 */
const criarJogador = (id) => ({
    id: id,
    nome: `Jogador ${id}`,
    acertos: 0,
    tempoResposta: 0, 
    tempoFinal: 0, 
    ativo: id === 1,
});

/**
 * Função para calcular o QI baseado no desempenho.
 * QI = 100 + (acertos * 10) - (tempoTotal / 10). (Fórmula infantil simplificada)
 * @param {number} acertos
 * @param {number} tempoTotal (em segundos)
 * @returns {number} QI calculado.
 */
const calcularQI = (acertos, tempoTotal) => {
    let qi = 100 + (acertos * 10) - (tempoTotal / 10);
    return Math.max(70, qi); 
};

// --------------------------------------------------------------------------------
// Funções da API para o Vercel
// --------------------------------------------------------------------------------

// A função `handler` é o ponto de entrada para o Vercel
module.exports = (req, res) => {
    const origin = req.headers.origin;

    // 1. TRATAMENTO DE CORS E BLOQUEIO DE ORIGEM
    
    // Responde ao OPTIONS (pré-voo) para CORS 
    if (req.method === 'OPTIONS') {
        if (origin === ALLOWED_ORIGIN) {
            // Permite o pré-voo (preflight) se a origem for correta
            res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
            res.writeHead(204);
            res.end();
            return;
        } else {
             // Bloqueia OPTIONS de outras origens
             res.writeHead(403);
             res.end();
             return;
        }
    }

    // BLOQUEIO PARA MÉTODOS GET/POST
    if (origin !== ALLOWED_ORIGIN) {
        // Bloqueia: Não define o cabeçalho 'Access-Control-Allow-Origin'
        // e retorna um script de erro que não contém a lógica do jogo
        res.setHeader('Content-Type', 'application/javascript');
        res.send(`
            console.error("Acesso bloqueado! Lógica da API só pode ser acessada de ${ALLOWED_ORIGIN}.");
            // Define as funções como nulas para evitar erros no navegador
            window.API_INICIAR_JOGO = () => { console.error("Acesso negado."); return Promise.resolve({}); };
            window.API_VIRAR_CARTAO = () => { console.error("Acesso negado."); return Promise.resolve({}); };
            window.API_FINALIZAR_JOGO = () => { console.error("Acesso negado."); return Promise.resolve({}); };
        `);
        return; // Termina a execução
    }

    // 2. ORIGEM PERMITIDA: Retorna o Script Completo
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
    res.setHeader('Content-Type', 'application/javascript');
    
    // As funções utilitárias precisam ter seus corpos injetados como strings
    const shuffleString = shuffle.toString();
    const criarJogadorString = criarJogador.toString();
    const calcularQIString = calcularQI.toString();

    const apiCode = `
        // --------------------------------------------------------------------------------
        // Lógica do Jogo (Injetada no Navegador)
        // --------------------------------------------------------------------------------
        
        // Variáveis de Jogo
        const JOGOS_COMPLEMENTARES = ${JSON.stringify(JOGOS_COMPLEMENTARES)};
        let gameState = ${JSON.stringify(gameState)}; 

        // Funções Utilitárias (Injetadas)
        const shuffle = ${shuffleString};
        const criarJogador = ${criarJogadorString};
        const calcularQI = ${calcularQIString};

        /**
         * Inicializa o estado do jogo e retorna os pares embaralhados.
         */
        window.API_INICIAR_JOGO = async (numJogadores) => {
            const todosPares = [...JOGOS_COMPLEMENTARES, ...JOGOS_COMPLEMENTARES];
            gameState.pares = shuffle(todosPares);
            gameState.jogadores = Array.from({ length: numJogadores }, (_, i) => criarJogador(i + 1));
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

        /**
         * Tenta virar um cartão e checa o par.
         */
        window.API_VIRAR_CARTAO = async (indexCartao) => {
             if (!gameState.jogoIniciado || gameState.cartoesVirados.length >= 2) {
                return { 
                    match: false, 
                    cartoesVirados: gameState.cartoesVirados 
                };
            }
            
            if (gameState.cartoesVirados.includes(indexCartao)) {
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
                
                if (emoji1 === emoji2) {
                    // ACERTOU O PAR
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
                    // ERROU O PAR - Passa a vez
                    gameState.jogadorAtualIndex = (gameState.jogadorAtualIndex + 1) % gameState.jogadores.length;
                    gameState.jogadores.forEach((j, i) => j.ativo = (i === gameState.jogadorAtualIndex));
                    
                    const tempVirados = gameState.cartoesVirados;
                    gameState.cartoesVirados = []; 

                    return {
                        match: false,
                        jogoFinalizado: false,
                        cartoesVirados: tempVirados,
                        jogadores: gameState.jogadores
                    };
                }
            } else {
                // Primeiro cartão virado
                return { 
                    match: false, 
                    cartoesVirados: gameState.cartoesVirados 
                };
            }
        };

        /**
         * Calcula os resultados finais, o QI, e finaliza o jogo.
         */
        window.API_FINALIZAR_JOGO = async (tempoTotalSegundos) => {
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

    res.send(apiCode);
};
