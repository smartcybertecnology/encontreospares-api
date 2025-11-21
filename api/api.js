// api/api.js (Código de servidor - Serverless Vercel)

// Variáveis de Lógica do Jogo
const SEQUENCIA_CORRETA = [
    { id: 1, texto: "⭐ Cachorro" },
    { id: 2, texto: "🍎 Maçã" },
    { id: 3, texto: "🚀 Foguete" },
    { id: 4, texto: "💖 Coração" },
    { id: 5, texto: "🍕 Pizza" },
    { id: 6, texto: "🎈 Balão" },
];
const NUM_PASSOS = SEQUENCIA_CORRETA.length; 

/**
 * Palavras/Emojis usados para o tabuleiro de exibição
 * (Inclui os itens da sequência e distratores)
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
    // Embaralha para que a posição no tabuleiro seja aleatória
    todasPalavras.sort(() => Math.random() - 0.5); 
    
    return todasPalavras;
}

/**
 * Fórmula de cálculo de QI (Lógica do Jogo)
 * @param {number} sequenciasCorretas - Número de acertos.
 * @param {number} tempoFinalSegundos - Tempo total gasto no desafio.
 * @param {number} totalErros - Número total de cliques incorretos.
 * @returns {number} O valor do QI calculado.
 */
function calcularQI(sequenciasCorretas, tempoFinalSegundos, totalErros) {
    const CONSTANTE_BONUS = 10000;
    const TEMPO_MINIMO = 1; 
    
    // Penalidade é baseada em erros e garante um tempo mínimo para evitar divisão por zero
    const penalidade = (totalErros * 15) + TEMPO_MINIMO;
    // O QI é maior para mais acertos e menor para mais tempo/erros
    const qi = (sequenciasCorretas * CONSTANTE_BONUS) / (tempoFinalSegundos + penalidade);
    
    return qi;
}


/**
 * Função para configurar o CORS (Segurança).
 * Permite acesso SOMENTE do seu domínio oficial e de ambientes locais de teste.
 */
function setCorsHeaders(res, origin) {
    // DOMÍNIOS PERMITIDOS (REGRA DE SEGURANÇA)
    const ALLOWED_ORIGIN_MAIN = 'https://www.playjogosgratis.com';
    const ALLOWED_ORIGIN_ALIAS = 'https://playjogosgratis.com';

    // Padrão para permitir localhost (para testes de desenvolvimento)
    const localhostPattern = /http:\/\/localhost:\d+/; 

    let allowed = false;

    if (origin === ALLOWED_ORIGIN_MAIN || origin === ALLOWED_ORIGIN_ALIAS || localhostPattern.test(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        allowed = true;
    } else {
        // Para requisições de origens não autorizadas, a API não deve responder
        // (Ou você pode definir um valor default, mas é mais seguro não definir 'Origin')
        // Neste caso, se não for permitido, o navegador bloqueará a resposta.
    }

    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return allowed;
}

/**
 * Função principal para Vercel Serverless.
 * Exportada como default para ser o handler da requisição.
 */
export default async (req, res) => {
    // 1. Controle CORS e Opções
    const origin = req.headers.origin || req.headers.host;
    const isAllowed = setCorsHeaders(res, origin);

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // Bloqueia se a origem não for permitida após o OPTIONS
    if (!isAllowed && !origin.startsWith('localhost')) { 
        return res.status(403).json({ error: "Acesso Proibido. Origem não autorizada." });
    }

    const { action } = req.query;

    // 2. Lógica de Início de Jogo
    if (action === 'start') {
        const palavrasDoJogo = gerarPalavrasEmbaralhadas();
        
        return res.status(200).json({ palavras: palavrasDoJogo, totalPassos: NUM_PASSOS });

    // 3. Lógica de Checagem de Passo
    } else if (action === 'check' && req.method === 'POST') {
        // Garante que o corpo da requisição é lido corretamente para Vercel
        let body;
        try {
            // Em Vercel, o corpo JSON é geralmente parseado automaticamente, 
            // mas adicionamos esta lógica de fallback para garantir
            if (req.body) {
                body = req.body;
            } else {
                let data = '';
                await new Promise(resolve => {
                    req.on('data', chunk => data += chunk);
                    req.on('end', () => resolve());
                });
                body = JSON.parse(data);
            }
        } catch (e) {
            return res.status(400).json({ error: "Corpo da requisição JSON inválido." });
        }
        
        const { wordId, passoAtual, totalErros, tempoFinal } = body;
        
        const idClicado = parseInt(wordId);
        // Verifica se o ID clicado corresponde ao passo atual da sequência correta
        const correto = idClicado === passoAtual;

        // Atualiza contadores com base no acerto/erro
        const sequenciasCorretas = correto ? passoAtual : passoAtual - 1;
        const finalErrors = correto ? totalErros : totalErros + 1;
        
        // O jogo finaliza se: 1) o jogador errou OU 2) o jogador acertou o último passo
        const jogoFinalizado = !correto || passoAtual === NUM_PASSOS;
        
        // Recalcula o QI com os dados atualizados
        const qi = calcularQI(sequenciasCorretas, tempoFinal, finalErrors);

        return res.status(200).json({ 
            correto: correto, 
            jogoFinalizado: jogoFinalizado,
            sequenciasCorretas: sequenciasCorretas,
            tempoFinalSegundos: tempoFinal,
            qi: qi 
        });
    }

    // 4. Tratamento de Requisições Não Mapeadas
    return res.status(404).json({ error: "Ação não encontrada ou método inválido." });
};
