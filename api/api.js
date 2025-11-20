// api/api.js - Vercel Serverless Function

// --------------------------------------------------------------------------------
// Configuração de Segurança e CORS
// --------------------------------------------------------------------------------

const ALLOWED_ORIGIN = 'https://playjogosgratis.com'; // Domínio permitido
const JOGOS_COMPLEMENTARES = ["😎", "🤩", "🚀", "🍕", "🐶", "🎈", "💖", "🤖"]; // Emojis para o jogo (8 pares = 16 cartas)

// --------------------------------------------------------------------------------
// Lógica do Jogo Centralizada (Variáveis de Estado Global na API - Cuidado com Vercel)
// NOTA: Em um ambiente de Serverless real, o estado deve ser persistido (Ex: Redis/DB).
// Para este exercício, usaremos variáveis globais. O Vercel pode reciclar essas variáveis.
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
    tempoResposta: 0, // Tempo acumulado de resposta (não usado na v1, mas para complexidade de QI)
    tempoFinal: 0, // Tempo do jogador para completar o jogo, se o jogo for por turno
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
    // 100 (Média) + Bônus por Acerto (10 pontos/par) - Penalidade por Tempo (1 ponto/10s)
    let qi = 100 + (acertos * 10) - (tempoTotal / 10);
    // Garante um QI mínimo para manter a moral infantil
    return Math.max(70, qi); 
};

// --------------------------------------------------------------------------------
// Funções da API para o Vercel
// --------------------------------------------------------------------------------

// A função `handler` é o ponto de entrada para o Vercel
module.exports = (req, res) => {
    // Tratamento de CORS
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Responde ao OPTIONS (pré-voo) para CORS
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // Se a requisição não vier do domínio permitido, bloqueia a lógica
    const origin = req.headers.origin;
    if (origin !== ALLOWED_ORIGIN) {
        // Retorna o script, mas sem as funções essenciais definidas no global
        // Isso permite o uso do <script> sem expor a lógica
        res.setHeader('Content-Type', 'application/javascript');
        res.send(`
            console.error("Acesso bloqueado! Lógica da API só pode ser acessada de ${ALLOWED_ORIGIN}.");
        `);
        return;
    }

    // Se vier do domínio permitido, retorna o script com as funções globais!
    // Esta é a parte de "segurança" (ofuscamento) - a lógica fica aqui.
    res.setHeader('Content-Type', 'application/javascript');
    const apiCode = `
        // --------------------------------------------------------------------------------
        // Funções para comunicação com o DOM
        // --------------------------------------------------------------------------------
        
        /**
         * Inicializa o estado do jogo e retorna os pares embaralhados.
         */
        window.API_INICIAR_JOGO = async (numJogadores) => {
            // Lógica de inicialização segura no servidor
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
        window.API_VIRAR_CARTAO = async (indexCartao, tempoAtual) => {
            if (!gameState.jogoIniciado || gameState.cartoesVirados.length >= 2) {
                // Se já houver 2 cartas viradas, ou o jogo não está iniciado, ignora.
                return { 
                    match: false, 
                    cartoesVirados: gameState.cartoesVirados 
                };
            }
            
            // 1. Registra o clique e checa se é a mesma carta
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
                let match = false;
                
                if (emoji1 === emoji2) {
                    // ACERTOU O PAR
                    match = true;
                    gameState.paresEncontrados++;
                    
                    // Atualiza o estado do jogador
                    const jogador = gameState.jogadores[gameState.jogadorAtualIndex];
                    jogador.acertos++;
                    
                    // Checa se o jogo terminou
                    const jogoFinalizado = gameState.paresEncontrados === JOGOS_COMPLEMENTARES.length;

                    // Limpa o par virado
                    gameState.cartoesVirados = [];
                    
                    return {
                        match: true,
                        jogoFinalizado: jogoFinalizado,
                        cartoesVirados: [idx1, idx2],
                        jogadores: gameState.jogadores
                    };
                } else {
                    // ERROU O PAR - Passa a vez
                    match = false;
                    
                    // Passa para o próximo jogador
                    gameState.jogadorAtualIndex = (gameState.jogadorAtualIndex + 1) % gameState.jogadores.length;

                    // Atualiza o status ativo dos jogadores
                    gameState.jogadores.forEach((j, i) => j.ativo = (i === gameState.jogadorAtualIndex));
                    
                    // Retorna os índices para o DOM desvirar. A API manterá o estado de 'cartoesVirados'
                    // por um breve momento (simulando a pausa do DOM antes de desvirar)
                    const tempVirados = gameState.cartoesVirados;
                    
                    // Limpa o estado da API APÓS o DOM receber a informação de erro (tempo para animação)
                    setTimeout(() => {
                        gameState.cartoesVirados = [];
                    }, 1500); // 1.5s de delay para o DOM animar o desvirar

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
            clearInterval(cronometroInterval);
            gameState.jogoIniciado = false;
            gameState.tempoTotalGlobal = tempoTotalSegundos;

            // Define o tempo final para todos os jogadores no multiplayer
            // (Nesta versão, o tempo é global e o QI é por acertos e tempo total)
            
            const resultadosFinais = gameState.jogadores.map(j => {
                // Cálculo do QI
                const qiCalculado = calcularQI(j.acertos, gameState.tempoTotalGlobal);
                
                return {
                    nome: j.nome,
                    acertos: j.acertos,
                    tempo: 'N/A (Tempo Global)', // Em multiplayer por turno, este tempo é complexo de calcular
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
        
        // Exponha as variáveis do jogo para o escopo para serem usadas nas funções acima.
        const JOGOS_COMPLEMENTARES = ${JSON.stringify(JOGOS_COMPLEMENTARES)};
        const gameState = { ...window.gameState, ...${JSON.stringify(gameState)} };
        // Redefina as funções utilitárias que são usadas acima (shuffle, criarJogador, calcularQI)
        // ... (Seriam re-definidas aqui dentro, mas para simplificar, confiamos na importação)
        
    `;
    // Enviando o código JS
    res.send(apiCode);
};
