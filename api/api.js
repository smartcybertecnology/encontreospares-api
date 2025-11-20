// api/api.js (Hospedado em https://encontreospares-api.vercel.app/api/api)

// Palavras/Emojis usados e a SEQUÊNCIA CORRETA (ID = Posição na sequência)
const SEQUENCIA_CORRETA = [
    { id: 1, texto: "⭐ Cachorro" },
    { id: 2, texto: "🍎 Maçã" },
    { id: 3, texto: "🚀 Foguete" },
    { id: 4, texto: "💖 Coração" },
    { id: 5, texto: "🍕 Pizza" },
    { id: 6, texto: "🎈 Balão" },
];
const NUM_PASSOS = SEQUENCIA_CORRETA.length; // Total de 6 passos.

// Variável para armazenar as palavras do jogo (embaralhadas visualmente)
let palavrasDoJogo = []; 

/**
 * Função para configurar o CORS (Segurança).
 */
function setCorsHeaders(res, origin) {
    const ALLOWED_ORIGIN = 'https://playjogosgratis.com';
    const localhostPattern = /http:\/\/localhost:\d+/; 

    if (origin === ALLOWED_ORIGIN || localhostPattern.test(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
        res.setHeader('Access-Control-Allow-Origin', 'null');
    }

    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

/**
 * Embaralha a lista de palavras para a exibição no tabuleiro.
 */
function gerarPalavrasEmbaralhadas() {
    // Adiciona palavras 'distratoras' para um tabuleiro maior (ex: 4x4)
    const distratores = [
        { id: 90, texto: "🌳 Árvore" },
        { id: 91, texto: "🚗 Carro" },
        { id: 92, texto: "🏠 Casa" },
        { id: 93, texto: "🌙 Lua" },
        { id: 94, texto: "💻 PC" },
        { id: 95, texto: "⚽ Bola" },
    ];
    
    // Total de 12 blocos (6 da sequência + 6 distratores)
    let todasPalavras = [...SEQUENCIA_CORRETA, ...distratores];
    
    // Embaralha
    todasPalavras.sort(() => Math.random() - 0.5); 
    
    return todasPalavras;
}

/**
 * Fórmula de cálculo de QI (Quociente de Inteligência) baseado em gamificação.
 * Valor alto de QI se acertos for alto e tempo for baixo.
 */
function calcularQI(sequenciasCorretas, tempoFinalSegundos, totalErros) {
    // Quanto maior o QI, melhor. Erro e Tempo diminuem o QI.
    const CONSTANTE_BONUS = 10000;
    const TEMPO_MINIMO = 1; // Para evitar divisão por zero
    
    // Penalidade por erro é maior (10x o tempo)
    const penalidade = (totalErros * 10) + TEMPO_MINIMO;
    
    // QI = (Acertos * Bônus) / (Tempo + Penalidade)
    const qi = (sequenciasCorretas * CONSTANTE_BONUS) / (tempoFinalSegundos + penalidade);
    
    return qi;
}


/**
 * Função principal para Vercel Serverless.
 */
export default (req, res) => {
    // 1. Configura o CORS
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
        // Gera o tabuleiro embaralhado e o salva no estado simulado
        palavrasDoJogo = gerarPalavrasEmbaralhadas();
        
        return res.status(200).json({ palavras: palavrasDoJogo, totalPassos: NUM_PASSOS });

    } else if (action === 'check' && req.method === 'POST') {
        // Verifica o clique na sequência
        const { wordId, passoAtual, totalErros, tempoFinal } = req.body;
        
        const idClicado = parseInt(wordId);
        
        // O ID correto deve ser igual ao passo atual na sequência (1, 2, 3...)
        const correto = idClicado === passoAtual;

        // Se errou, calcula o QI imediatamente e finaliza o jogo
        if (!correto) {
            const sequenciasCorretas = passoAtual - 1; // O passo anterior foi o último acerto
            const qi = calcularQI(sequenciasCorretas, tempoFinal, totalErros + 1); // +1 erro atual
            
            return res.status(200).json({ 
                correto: false, 
                jogoFinalizado: true,
                sequenciasCorretas: sequenciasCorretas,
                tempoFinalSegundos: tempoFinal,
                qi: qi
            });
        }
        
        // Se acertou, verifica se a sequência terminou
        const jogoFinalizado = passoAtual === NUM_PASSOS;

        if (jogoFinalizado) {
            const sequenciasCorretas = NUM_PASSOS;
            // Cálculo de QI (0 erros, tempo baixo = QI alto)
            const qi = calcularQI(sequenciasCorretas, tempoFinal, totalErros); 
            
            return res.status(200).json({ 
                correto: true, 
                jogoFinalizado: true,
                sequenciasCorretas: sequenciasCorretas,
                tempoFinalSegundos: tempoFinal,
                qi: qi
            });
        }
        
        // Se acertou mas não finalizou
        return res.status(200).json({ correto: true, jogoFinalizado: false });
    }

    return res.status(404).json({ error: "Ação não encontrada ou método inválido." });
};
