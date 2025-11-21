// api/api.js - CÓDIGO CORRIGIDO

const DOMAIN_PERMITIDO = 'https://playjogosgratis.com';
const QUANTIDADE_PALAVRAS = 10;
let estadoGlobalSequencia = null; // Variável para simular o estado (ATENÇÃO: Não é confiável em Serverless real)

// (Mantenha as funções gerarNovaSequencia e calcularQI aqui)

// Função para parsear o body da requisição POST
async function parseBody(req) {
    if (req.method !== 'POST' || req.body) {
        return req.body;
    }
    
    // Serverless Functions não parseiam JSON automaticamente
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString(); 
        });
        req.on('end', () => {
            try {
                if (body) {
                    resolve(JSON.parse(body));
                } else {
                    resolve({});
                }
            } catch (error) {
                reject(error);
            }
        });
        req.on('error', reject);
    });
}

module.exports = async (req, res) => {
    const origin = req.headers.origin;

    // --- Tratamento CORS (Permitido) ---
    if (origin === DOMAIN_PERMITIDO || origin.includes('localhost') || origin.includes('127.0.0.1')) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.setHeader('Access-Control-Max-Age', '86400');
    } else {
        res.status(403).json({ error: 'Acesso Proibido. Domínio não autorizado.' });
        return;
    }

    // --- Tratamento de Requisição OPTIONS ---
    if (req.method === 'OPTIONS') {
        res.statusCode = 200;
        res.end();
        return;
    }

    const { action } = req.query;
    let bodyData = {};
    
    // Parseia o corpo da requisição POST antes de continuar
    if (req.method === 'POST') {
        try {
            bodyData = await parseBody(req);
        } catch (error) {
            // Se o JSON estiver mal formatado, retorna 400 Bad Request
            res.status(400).json({ error: 'Erro ao analisar o JSON da requisição (Body mal formatado).' });
            return;
        }
    }

    if (action === 'start' && req.method === 'GET') {
        // ... (Sua lógica de 'start' aqui) ...
        estadoGlobalSequencia = gerarNovaSequencia();
        
        res.status(200).json({
            status: 'ok',
            palavras: estadoGlobalSequencia.palavras,
            mensagem: 'Jogo iniciado. Encontre a sequência correta de 1 a ' + QUANTIDADE_PALAVRAS
        });
        return;

    } else if (action === 'check' && req.method === 'POST') {
        
        // Agora bodyData contém os dados do JSON
        const { wordId, tempoFinal } = bodyData; 

        // 1. Verificação de Estado Crítica
        if (!estadoGlobalSequencia) {
            res.status(400).json({ 
                error: 'Estado do jogo perdido. Tente iniciar o jogo novamente.',
                sequenciasCorretas: 0,
                qi: 0
            });
            return;
        }
        
        // 2. Verificação de Dados
        if (wordId === undefined || tempoFinal === undefined) {
             res.status(400).json({ error: 'Dados incompletos na requisição POST. wordId ou tempoFinal ausentes.' });
             return;
        }
        
        // ... (O restante da sua lógica de 'check' permanece inalterado) ...
        const proximoValorEsperado = estadoGlobalSequencia.sequenciaCorreta[estadoGlobalSequencia.ultimoPassoCorreto];
        
        let resultado = {
            correto: false,
            jogoFinalizado: false,
            sequenciasCorretas: estadoGlobalSequencia.ultimoPassoCorreto,
            qi: 0,
            tempoFinalSegundos: tempoFinal
        };
        
        // Lógica de Acerto/Erro...
        if (wordId == proximoValorEsperado) {
            estadoGlobalSequencia.ultimoPassoCorreto++;
            resultado.correto = true;
            resultado.sequenciasCorretas = estadoGlobalSequencia.ultimoPassoCorreto;

            if (estadoGlobalSequencia.ultimoPassoCorreto === QUANTIDADE_PALAVRAS) {
                resultado.jogoFinalizado = true;
                resultado.qi = calcularQI(resultado.sequenciasCorretas, tempoFinal);
                estadoGlobalSequencia = null; 
            }
            
        } else {
            resultado.jogoFinalizado = true;
            resultado.qi = calcularQI(estadoGlobalSequencia.ultimoPassoCorreto, tempoFinal);
            estadoGlobalSequencia = null; 
        }

        res.status(200).json(resultado);
        return;

    }

    res.status(404).json({ error: 'Ação ou Método não encontrado.' });
};
