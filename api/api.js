// api/api.js (Código de servidor - Serverless Vercel)

// Palavras/Emojis usados e a SEQUÊNCIA CORRETA
const SEQUENCIA_CORRETA = [
    { id: 1, texto: "⭐ Cachorro" },
    { id: 2, texto: "🍎 Maçã" },
    { id: 3, texto: "🚀 Foguete" },
    { id: 4, texto: "💖 Coração" },
    { id: 5, texto: "🍕 Pizza" },
    { id: 6, texto: "🎈 Balão" },
];
const NUM_PASSOS = SEQUENCIA_CORRETA.length; 
let palavrasDoJogo = []; 

/**
 * Função para configurar o CORS (Segurança).
 * Permite acesso do seu domínio oficial e de ambientes de desenvolvimento local.
 */
function setCorsHeaders(res, origin) {
    // SEU DOMÍNIO OFICIAL
    const ALLOWED_ORIGIN = 'https://www.playjogosgratis.com'; 
    const localhostPattern = /http:\/\/localhost:\d+/; 

    if (origin === ALLOWED_ORIGIN || localhostPattern.test(origin) || origin === 'https://playjogosgratis.com') {
        res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
        // Fallback ou null para origens desconhecidas
        res.setHeader('Access-Control-Allow-Origin', '*'); 
    }

    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

/**
 * Embaralha a lista de palavras para a exibição no tabuleiro.
 */
function gerarPalavrasEmbaralhadas() {
    const distratores = [
        { id: 90, texto: "🌳 Árvore" },
        { id: 91, texto: "🚗 Carro" },
        { id: 92, texto: "🏠 Casa" },
        { id: 93, texto: "🌙 Lua" },
        { id: 94, texto: "💻 PC" },
        { id: 95, texto: "⚽ Bola" },
    ];
    
    let todasPalavras = [...SEQUENCIA_CORRETA, ...distratores];
    todasPalavras.sort(() => Math.random() - 0.5); 
    
    return todasPalavras;
}

/**
 * Fórmula de cálculo de QI.
 */
function calcularQI(sequenciasCorretas, tempoFinalSegundos, totalErros) {
    const CONSTANTE_BONUS = 10000;
    const TEMPO_MINIMO = 1; 
    
    const penalidade = (totalErros * 10) + TEMPO_MINIMO;
    const qi = (sequenciasCorretas * CONSTANTE_BONUS) / (tempoFinalSegundos + penalidade);
    
    return qi;
}


/**
 * Função principal para Vercel Serverless.
 */
export default (req, res) => {
    setCorsHeaders(res, req.headers.origin);

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const { action } = req.query;

    if (action === 'start') {
        palavrasDoJogo = gerarPalavrasEmbaralhadas();
        
        return res.status(200).json({ palavras: palavrasDoJogo, totalPassos: NUM_PASSOS });

    } else if (action === 'check' && req.method === 'POST') {
        const { wordId, passoAtual, totalErros, tempoFinal } = req.body;
        
        const idClicado = parseInt(wordId);
        const correto = idClicado === passoAtual;

        const sequenciasCorretas = correto ? passoAtual : passoAtual - 1;
        const finalErrors = correto ? totalErros : totalErros + 1;
        const jogoFinalizado = !correto || passoAtual === NUM_PASSOS;
        
        const qi = calcularQI(sequenciasCorretas, tempoFinal, finalErrors);

        return res.status(200).json({ 
            correto: correto, 
            jogoFinalizado: jogoFinalizado,
            sequenciasCorretas: sequenciasCorretas,
            tempoFinalSegundos: tempoFinal,
            qi: qi
        });
    }

    return res.status(404).json({ error: "Ação não encontrada ou método inválido." });
};
