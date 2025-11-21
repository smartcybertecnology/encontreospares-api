// api/api.js

const DOMAIN_PERMITIDO = 'https://playjogosgratis.com';
const TAMANHO_TABULEIRO = 16; // 4x4
const QUANTIDADE_PALAVRAS = 10; // Número máximo da sequência correta (1 a 10)

/**
 * Mapeia o estado da sequência do jogo para uma sessão em memória simples.
 * Em um ambiente de produção real, você usaria um banco de dados ou Redis.
 * Para Serverless/Vercel, usamos uma variável global que **não é confiável** * entre invocações, mas para este exemplo, simularemos o estado.
 * Se o jogo requer persistência de estado entre requisições, você precisará 
 * de um banco de dados ou solução de cache externa.
 */
let estadoGlobalSequencia = null; // { sequenciaCorreta: [1, 5, 3, ...], ultimoPassoCorreto: 0, palavras: [{id: 1, texto: '1'}, ...] }

// --- LÓGICA DE JOGO ---

/**
 * Gera uma sequência numérica aleatória e as palavras para o tabuleiro.
 */
function gerarNovaSequencia() {
    // 1. Gera a sequência correta (1 a N, embaralhada)
    let sequenciaBase = Array.from({ length: QUANTIDADE_PALAVRAS }, (_, i) => i + 1);
    // Embaralha a ordem da sequência para o desafio
    const sequenciaCorreta = sequenciaBase.sort(() => Math.random() - 0.5);

    // 2. Cria todos os blocos do tabuleiro (16 blocos)
    // Os números da sequência estarão misturados com números aleatórios (distratores)
    const todosBlocos = [];
    const idsUsados = new Set();
    
    // Adiciona os blocos da sequência
    sequenciaCorreta.forEach(num => {
        todosBlocos.push({ id: num, texto: String(num) });
        idsUsados.add(num);
    });

    // Adiciona blocos distratores até completar o tamanho do tabuleiro
    while (todosBlocos.length < TAMANHO_TABULEIRO) {
        // Encontra um ID não utilizado
        let novoId;
        do {
            novoId = Math.floor(Math.random() * 100) + 1; // ID aleatório
        } while (idsUsados.has(novoId));
        
        idsUsados.add(novoId);
        // Os distratores são apenas placeholders, usando um ID diferente do 1-10
        // e um texto visualmente diferente para não confundir com a sequência
        const textoAleatorio = String.fromCharCode(65 + Math.floor(Math.random() * 26)); // Letra aleatória A-Z
        todosBlocos.push({ id: novoId, texto: textoAleatorio }); 
    }

    // 3. Embaralha o tabuleiro final para exibição
    const palavrasExibicao = todosBlocos.sort(() => Math.random() - 0.5);
    
    return {
        sequenciaCorreta: sequenciaCorreta,
        palavras: palavrasExibicao,
        ultimoPassoCorreto: 0 // Indica que o próximo clique deve ser o 1º item da sequenciaCorreta
    };
}

/**
 * Calcula um QI simples baseado no desempenho do jogo.
 * @param {number} sequenciasCorretas - Número de cliques corretos na sequência.
 * @param {number} tempoFinalSegundos - Tempo total gasto.
 * @returns {number} QI calculado.
 */
function calcularQI(sequenciasCorretas, tempoFinalSegundos) {
    if (tempoFinalSegundos === 0 || sequenciasCorretas === 0) return 0;
    
    // Fórmula simples: (Acertos² / Tempo) * Fator_Base
    const fatorBase = 150; 
    let qi = (Math.pow(sequenciasCorretas, 2) / tempoFinalSegundos) * fatorBase;
    
    // Limita o QI máximo e mínimo para manter a sanidade
    qi = Math.max(1, Math.min(250, qi));
    return qi;
}


// --- LÓGICA DA API (Vercel Serverless Function) ---

module.exports = async (req, res) => {
    // Verifica o domínio de origem
    const origin = req.headers.origin;

    // --- Tratamento CORS (Cross-Origin Resource Sharing) ---
    // Permite apenas o domínio oficial (ou desenvolvimento local se necessário)
    if (origin === DOMAIN_PERMITIDO || origin.includes('localhost') || origin.includes('127.0.0.1')) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.setHeader('Access-Control-Max-Age', '86400'); // Cache do preflight por 24h
    } else {
        // Bloqueia outros domínios não permitidos
        res.setHeader('Access-Control-Allow-Origin', 'null'); // Ou não define o header
        res.status(403).json({ error: 'Acesso Proibido. Domínio não autorizado.' });
        return;
    }

    // --- Tratamento de Requisição OPTIONS (Preflight) ---
    // Necessário para requisições POST
    if (req.method === 'OPTIONS') {
        res.statusCode = 200;
        res.end();
        return;
    }

    // --- Lógica Principal da API ---

    const { action } = req.query;

    if (action === 'start' && req.method === 'GET') {
        // 1. Ação: Iniciar o Jogo
        estadoGlobalSequencia = gerarNovaSequencia();
        
        res.status(200).json({
            status: 'ok',
            palavras: estadoGlobalSequencia.palavras, // Retorna o tabuleiro embaralhado
            mensagem: 'Jogo iniciado. Encontre a sequência correta de 1 a ' + QUANTIDADE_PALAVRAS
        });
        return;

    } else if (action === 'check' && req.method === 'POST') {
        // 2. Ação: Verificar a Jogada (Lógica Central)
        
        // Verifica se o jogo foi iniciado
        if (!estadoGlobalSequencia || estadoGlobalSequencia.ultimoPassoCorreto >= QUANTIDADE_PALAVRAS) {
            res.status(400).json({ error: 'Jogo não iniciado ou já finalizado. Chame /api/api?action=start' });
            return;
        }

        const { wordId, tempoFinal } = req.body;
        
        const proximoValorEsperado = estadoGlobalSequencia.sequenciaCorreta[estadoGlobalSequencia.ultimoPassoCorreto];
        
        let resultado = {
            correto: false,
            jogoFinalizado: false,
            sequenciasCorretas: estadoGlobalSequencia.ultimoPassoCorreto,
            qi: 0,
            tempoFinalSegundos: tempoFinal
        };

        if (wordId == proximoValorEsperado) {
            // ACERTOU!
            estadoGlobalSequencia.ultimoPassoCorreto++;
            resultado.correto = true;
            resultado.sequenciasCorretas = estadoGlobalSequencia.ultimoPassoCorreto;

            // Verifica se a sequência terminou
            if (estadoGlobalSequencia.ultimoPassoCorreto === QUANTIDADE_PALAVRAS) {
                resultado.jogoFinalizado = true;
                resultado.qi = calcularQI(resultado.sequenciasCorretas, tempoFinal);
                // Limpa o estado após a vitória
                estadoGlobalSequencia = null; 
            }
            
        } else {
            // ERRO! -> FIM DE JOGO
            resultado.jogoFinalizado = true;
            resultado.qi = calcularQI(estadoGlobalSequencia.ultimoPassoCorreto, tempoFinal); // QI baseado nas corretas *antes* do erro
            // Limpa o estado após o erro
            estadoGlobalSequencia = null; 
        }

        res.status(200).json(resultado);
        return;

    }

    // Ação ou Método Inválido
    res.status(404).json({ error: 'Ação ou Método não encontrado.' });
};
