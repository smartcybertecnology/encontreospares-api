// api/api.js - Vercel Serverless Function (Node.js)

// --------------------------------------------------------------------------------
// Configuração de Segurança e CORS
// --------------------------------------------------------------------------------

// Domínio ÚNICO PERMITIDO para acesso à lógica do jogo
const ALLOWED_ORIGIN = 'https://playjogosgratis.com'; 
const JOGOS_COMPLEMENTARES = ["😎", "🤩", "🚀", "🍕", "🐶", "🎈", "💖", "🤖"]; // Emojis para o jogo (8 pares)

// --------------------------------------------------------------------------------
// Lógica do Jogo Centralizada (Variáveis e Funções Utilitárias no Servidor)
// --------------------------------------------------------------------------------

// Esta cópia serve apenas para ser injetada como estado inicial.
let initialGameState = { 
    jogadores: [],
    pares: [],
    cartoesVirados: [], 
    paresEncontrados: 0,
    jogadorAtualIndex: 0,
    tempoTotalGlobal: 0,
    jogoIniciado: false,
    tempoInicio: 0,
};

/** Função utilitária para embaralhar um array (Fisher-Yates). */
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

/** Gera um objeto de jogador. */
const criarJogador = (id) => ({
    id: id,
    nome: `Jogador ${id}`,
    acertos: 0,
    tempoResposta: 0, 
    tempoFinal: 0, 
    ativo: id === 1,
});

/** Função para calcular o QI baseado no desempenho. */
const calcularQI = (acertos, tempoTotal) => {
    // Fórmula infantil simplificada
    let qi = 100 + (acertos * 10) - (tempoTotal / 10);
    return Math.max(70, qi); 
};

// --------------------------------------------------------------------------------
// Handler da Função Serverless
// --------------------------------------------------------------------------------

module.exports = (req, res) => {
    const origin = req.headers.origin;

    // --- 1. Tratamento de CORS e Bloqueio ---
    const isOriginAllowed = origin === ALLOWED_ORIGIN;
    
    if (req.method === 'OPTIONS') {
        if (isOriginAllowed) {
            res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
            res.writeHead(204);
        } else {
             res.writeHead(403);
        }
        res.end();
        return;
    }

    if (!isOriginAllowed) {
        // Bloqueia e retorna um script vazio/de erro para origens não permitidas.
        res.setHeader('Content-Type', 'application/javascript');
        res.send(`
            console.error("Acesso bloqueado! Lógica da API só pode ser acessada de ${ALLOWED_ORIGIN}.");
            window.API_INICIAR_JOGO = window.API_VIRAR_CARTAO = window.API_FINALIZAR_JOGO = () => { console.error("Acesso negado."); return Promise.resolve({}); };
        `);
        return;
    }
    // --- Fim do Tratamento de CORS ---

    // 2. ORIGEM PERMITIDA: Retorna o Script Completo (Lógica Injetada)
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN); 
    res.setHeader('Content-Type', 'application/javascript');
    
    // Injeta as funções utilitárias no script para o cliente
    const shuffleString = shuffle.toString();
    const criarJogadorString = criarJogador.toString();
    const calcularQIString = calcularQI.toString();

    const apiCode = `
        // --------------------------------------------------------------------------------
        // Lógica do Jogo Injetada (Executada no Navegador)
        // --------------------------------------------------------------------------------
        
        // Variáveis de Jogo
        const JOGOS_COMPLEMENTARES = ${JSON.stringify(JOGOS_COMPLEMENTARES)};
        // Define o estado do jogo globalmente no navegador, com o estado inicial.
        window.gameState = ${JSON.stringify(initialGameState)}; 

        // Funções Utilitárias (Injetadas)
        const shuffle = ${shuffleString};
        const criarJogador = ${criarJogadorString};
        const calcularQI = ${calcularQIString};

        /**
         * Inicializa o estado do jogo e retorna os pares embaralhados.
         * @param {number} numJogadores
         */
        window.API_INICIAR_JOGO = async (numJogadores) => {
            const todosPares = [...JOGOS_COMPLEMENTARES, ...JOGOS_COMPLEMENTARES];
            window.gameState.pares = shuffle(todosPares);
            window.gameState.jogadores = Array.from({ length: numJogadores }, (_, i) => criarJogador(i + 1));
            window.gameState.cartoesVirados = [];
            window.gameState.paresEncontrados = 0;
            window.gameState.jogadorAtualIndex = 0;
            window.gameState.tempoTotalGlobal = 0;
            window.gameState.jogoIniciado = true;
            window.gameState.tempoInicio = Date.now();

            return {
                pares: window.gameState.pares,
                jogadores: window.gameState.jogadores
            };
        };

        /**
         * Tenta virar um cartão e checa o par.
         * @param {number} indexCartao
         */
        window.API_VIRAR_CARTAO = async (indexCartao) => {
             const gs = window.gameState; 
             
             // Previne cliques se o jogo não estiver iniciado ou já houver 2 cartas viradas
             if (!gs.jogoIniciado || gs.cartoesVirados.length >= 2) {
                return { match: false, cartoesVirados: gs.cartoesVirados };
            }
            
            // Previne clicar na mesma carta duas vezes
            if (gs.cartoesVirados.includes(indexCartao)) {
                return { match: false, cartoesVirados: gs.cartoesVirados };
            }
            
            gs.cartoesVirados.push(indexCartao);

            if (gs.cartoesVirados.length === 2) {
                const [idx1, idx2] = gs.cartoesVirados;
                const emoji1 = gs.pares[idx1];
                const emoji2 = gs.pares[idx2];
                
                if (emoji1 === emoji2) {
                    // ACERTOU O PAR
                    gs.paresEncontrados++;
                    
                    const jogador = gs.jogadores[gs.jogadorAtualIndex];
                    jogador.acertos++;
                    
                    const jogoFinalizado = gs.paresEncontrados === JOGOS_COMPLEMENTARES.length;

                    gs.cartoesVirados = [];
                    
                    return {
                        match: true,
                        jogoFinalizado: jogoFinalizado,
                        cartoesVirados: [idx1, idx2],
                        jogadores: gs.jogadores
                    };
                } else {
                    // ERROU O PAR - Passa a vez
                    gs.jogadorAtualIndex = (gs.jogadorAtualIndex + 1) % gs.jogadores.length;
                    
                    // Atualiza o status 'ativo' no array de jogadores
                    gs.jogadores.forEach((j, i) => j.ativo = (i === gs.jogadorAtualIndex));
                    
                    const tempVirados = gs.cartoesVirados;
                    gs.cartoesVirados = []; 

                    return {
                        match: false,
                        jogoFinalizado: false,
                        cartoesVirados: tempVirados,
                        jogadores: gs.jogadores
                    };
                }
            } else {
                // Primeiro cartão virado
                return { match: false, cartoesVirados: gs.cartoesVirados };
            }
        };

        /**
         * Calcula os resultados finais, o QI, e finaliza o jogo.
         * @param {number} tempoTotalSegundos
         */
        window.API_FINALIZAR_JOGO = async (tempoTotalSegundos) => {
            const gs = window.gameState; 
            gs.jogoIniciado = false;
            gs.tempoTotalGlobal = tempoTotalSegundos;

            const resultadosFinais = gs.jogadores.map(j => {
                const qiCalculado = calcularQI(j.acertos, gs.tempoTotalGlobal);
                
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
