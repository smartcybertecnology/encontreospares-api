// api.js (Hospedado em https://encontreospares-api.vercel.app/api/api.js)

// Emojis e Pares (A API define a lógica)
const emojis = ["🚀", "🍕", "🐶", "🎈", "😀", "😎", "🤩", "💖"]; 
const NUM_PARES = emojis.length;

// Estado Simulado do Jogo (Em um ambiente real, você usaria um banco de dados ou sessão)
// Para esta simulação Vercel/Serverless, o estado é simples, pois cada requisição é nova.
// Vamos simular a geração do tabuleiro em cada "start" e a verificação.
let tabuleiroAtual = [];
let cardIdCounter = 0;

/**
 * Função para configurar o CORS.
 */
function setCorsHeaders(res, origin) {
    const ALLOWED_ORIGIN = 'https://playjogosgratis.com';
    const localhostPattern = /http:\/\/localhost:\d+/; // Permite localhost para testes

    if (origin === ALLOWED_ORIGIN || localhostPattern.test(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
        // Para domínios não permitidos, retorna o padrão seguro, impedindo o acesso.
        res.setHeader('Access-Control-Allow-Origin', 'null');
    }

    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
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

    // 2. Extrai ação e dados
    const { action } = req.query;

    if (action === 'start') {
        // Reinicia e embaralha o tabuleiro na API
        tabuleiroAtual = [];
        cardIdCounter = 0;
        let todosEmojis = [...emojis, ...emojis];
        
        // Embaralha
        todosEmojis.sort(() => Math.random() - 0.5); 

        // Cria a estrutura de cartas
        for (let i = 0; i < todosEmojis.length; i++) {
            const pairId = Math.floor(i / 2) + 1; // 1, 1, 2, 2, 3, 3...
            tabuleiroAtual.push({
                id: ++cardIdCounter, // ID único para o elemento HTML
                pairId: pairId,      // ID do par
                emoji: todosEmojis[i],
                matched: false
            });
        }
        
        // Em um ambiente real, o tabuleiroAtual seria salvo na sessão/BD aqui
        return res.status(200).json({ cartas: tabuleiroAtual });

    } else if (action === 'check' && req.method === 'POST') {
        // Verifica a jogada
        const { cardId1, cardId2, tempoResposta } = req.body;
        
        // Busca os objetos das cartas no estado
        const carta1 = tabuleiroAtual.find(c => c.id === parseInt(cardId1));
        const carta2 = tabuleiroAtual.find(c => c.id === parseInt(cardId2));

        if (!carta1 || !carta2) {
             return res.status(400).json({ error: "Cartas inválidas" });
        }

        const match = carta1.pairId === carta2.pairId;

        // Se fosse 'Encontre as Palavras', a lógica de fim de jogo por erro entraria aqui:
        // if (!match) { 
        //     return res.status(200).json({ match: false, gameOver: true, /* dados de resumo */ });
        // }

        if (match) {
            // Marca como encontrado (importante para evitar pares repetidos)
            carta1.matched = true;
            carta2.matched = true;
        }

        const paresEncontrados = tabuleiroAtual.filter(c => c.matched).length / 2;
        const jogoFinalizado = paresEncontrados === NUM_PARES;

        if (jogoFinalizado) {
            // Lógica final, envia os dados para o cálculo de QI
            // ATENÇÃO: Os dados (totalErros, tempoFinal) DEVEM vir do cliente 
            // ou serem persistidos no backend em um ambiente real.
            // Para esta simulação, vamos supor que o frontend envia os dados finais
            // ou a API guarda o estado completo. Usaremos um exemplo genérico:
            
            const totalErros = req.body.totalErros || 5; // Exemplo - o frontend deve enviar
            const tempoFinalSegundos = req.body.tempoFinal || 120; // Exemplo - o frontend deve enviar
            const sequenciasCorretas = NUM_PARES;

            // FÓRMULA DE CÁLCULO DE QI SIMPLIFICADA PARA JOGOS
            // QI = (sequenciasCorretas * 100) / (tempoFinalSegundos + totalErros)
            const qi = (sequenciasCorretas * 5000) / (tempoFinalSegundos + (totalErros * 10));

            return res.status(200).json({ 
                match, 
                jogoFinalizado: true,
                sequenciasCorretas,
                tempoFinalSegundos,
                qi
            });
        }

        return res.status(200).json({ match, jogoFinalizado: false });
    }

    // Se a ação não for reconhecida ou o método for inválido
    return res.status(404).json({ error: "Ação não encontrada ou método inválido." });
}
