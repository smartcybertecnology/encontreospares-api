// api/api.js (Hospedado em https://encontreospares-api.vercel.app/api/api)

const emojis = ["🚀", "🍕", "🐶", "🎈", "😀", "😎", "🤩", "💖"]; 
const NUM_PARES = emojis.length;

// Variável global (NÃO PERSISTENTE) para simulação de estado do jogo.
// Em produção real, o estado seria salvo em um Redis/DB usando o ID da sessão.
let tabuleiroAtual = [];
let cardIdCounter = 0;

/**
 * Função para configurar o CORS (Cross-Origin Resource Sharing).
 * Permite apenas o domínio 'https://playjogosgratis.com' e localhost.
 */
function setCorsHeaders(res, origin) {
    const ALLOWED_ORIGIN = 'https://playjogosgratis.com';
    // Permite localhost para testes de desenvolvimento
    const localhostPattern = /http:\/\/localhost:\d+/; 

    if (origin === ALLOWED_ORIGIN || localhostPattern.test(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
        // Se a origem não for permitida, o navegador não terá acesso aos dados
        res.setHeader('Access-Control-Allow-Origin', 'null');
    }

    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

/**
 * Função para gerar um novo tabuleiro embaralhado.
 */
function gerarNovoTabuleiro() {
    tabuleiroAtual = [];
    cardIdCounter = 0;
    let todosEmojis = [...emojis, ...emojis];
    
    todosEmojis.sort(() => Math.random() - 0.5); 

    for (let i = 0; i < todosEmojis.length; i++) {
        const pairId = Math.floor(i / 2) + 1; 
        tabuleiroAtual.push({
            id: ++cardIdCounter, 
            pairId: pairId,      
            emoji: todosEmojis[i],
            matched: false
        });
    }
    return tabuleiroAtual;
}

/**
 * Fórmula de cálculo de QI (Quociente de Inteligência) baseado em gamificação.
 * QI = (Sequências Corretas * Constante de Bônus) / (Tempo em Segundos + Penalidade de Erros)
 * A constante 5000 e o peso do erro (10) são arbitrários para criar uma métrica.
 */
function calcularQI(sequenciasCorretas, tempoFinalSegundos, totalErros) {
    // Evita divisão por zero se tempo for 0 e erros for 0
    const divisor = tempoFinalSegundos + (totalErros * 10) + 1; 
    const qi = (sequenciasCorretas * 5000) / divisor;
    
    return qi;
}


/**
 * Função principal para Vercel Serverless.
 */
export default (req, res) => {
    // 1. Configura o CORS e trata OPTIONS
    const origin = req.headers.origin;
    setCorsHeaders(res, origin);

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // 2. Extrai a ação da query
    const { action } = req.query;

    if (action === 'start') {
        // Reinicia e embaralha o tabuleiro na API
        const cartas = gerarNovoTabuleiro();
        
        // Em um ambiente real, o tabuleiroAtual seria salvo na sessão/BD aqui.
        return res.status(200).json({ cartas: cartas });

    } else if (action === 'check' && req.method === 'POST') {
        // Verifica a jogada
        const { cardId1, cardId2, totalErros, tempoFinal } = req.body;
        
        if (!cardId1 || !cardId2) {
             return res.status(400).json({ error: "IDs de cartas ausentes." });
        }

        // Simulação de busca no estado (usando o estado global não persistente)
        // Em um ambiente real, essa busca falharia se o estado não fosse persistido.
        const cartasJogadas = tabuleiroAtual.filter(c => c.id === parseInt(cardId1) || c.id === parseInt(cardId2));
        
        if (cartasJogadas.length !== 2) {
            // Isso indica que o estado da API foi perdido (problema em Serverless)
            // Ou o frontend está enviando IDs inválidos.
             return res.status(400).json({ error: "Cartas não encontradas no estado atual do jogo." });
        }

        const match = cartasJogadas[0].pairId === cartasJogadas[1].pairId;

        if (match) {
            // Marca como encontrado
            cartasJogadas.forEach(c => c.matched = true);
        }

        const paresEncontrados = tabuleiroAtual.filter(c => c.matched).length / 2;
        const jogoFinalizado = paresEncontrados === NUM_PARES;

        if (jogoFinalizado) {
            const sequenciasCorretas = NUM_PARES;
            const qi = calcularQI(sequenciasCorretas, tempoFinal, totalErros);

            return res.status(200).json({ 
                match, 
                jogoFinalizado: true,
                sequenciasCorretas,
                tempoFinalSegundos: tempoFinal,
                qi
            });
        }
        
        // Se não for um match e for Jogo da Memória, apenas retorna o resultado
        // Se fosse o "Encontre as Palavras" e o erro finalizasse, a lógica de QI viria aqui.
        return res.status(200).json({ match, jogoFinalizado: false });
    }

    // Se a ação não for reconhecida ou o método for inválido
    return res.status(404).json({ error: "Ação não encontrada ou método inválido." });
};
