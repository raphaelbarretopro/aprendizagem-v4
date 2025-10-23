/**
 * DataModel - Model para gerenciamento dos dados do arquivo CSV
 * Responsável por: carregar, processar, filtrar e preparar dados
 */
class DataModel {
    constructor() {
        this.rawData = [];
        // Map por CNPJ normalizado -> { cnpj, nome (escolhido), aliases: Set<string> }
        this.empresasAPR = new Map();
        this.turmasPorEmpresa = new Map(); // Map para armazenar turmas por empresa
        this.datasDisponiveis = new Set(); // Set para armazenar datas únicas
    }

    /**
     * Normaliza CNPJ: mantém apenas dígitos (14 caracteres quando válido)
     */
    normalizeCNPJ(cnpj) {
        if (cnpj === null || cnpj === undefined) return '';
        return String(cnpj).replace(/\D/g, '');
    }

    /**
     * Normaliza nome removendo espaços extras e padronizando capitalização básica
     */
    normalizeName(nome) {
        if (!nome) return '';
        // Remove múltiplos espaços e trim
        const cleaned = String(nome).replace(/\s+/g, ' ').trim();
        return cleaned;
    }

    /**
     * Escolhe o melhor nome dentre aliases: regra simples pega o mais longo
     */
    chooseBestName(aliasesSet) {
        let best = '';
        aliasesSet.forEach(n => {
            if (n && n.length > best.length) best = n;
        });
        return best;
    }

    /**
     * Carrega e processa o arquivo CSV
     * @param {File} file - Arquivo CSV selecionado
     * @returns {Promise} - Promise com os dados processados
     */
    async loadCSV(file) {
        try {
            // Decodificar com fallback de encoding para evitar problemas de acentuação (�)
            const csvText = await this.decodeCSVFile(file);

            const results = Papa.parse(csvText, {
                header: true,
                skipEmptyLines: true
            });

            if (results.errors && results.errors.length > 0) {
                throw new Error('Erro ao processar o arquivo CSV: ' + results.errors[0].message);
            }

            this.rawData = results.data;
            this.processData();
            return {
                totalRegistros: this.rawData.length,
                empresasAPR: this.empresasAPR.size,
                turmas: this.turmasPorEmpresa.size
            };
        } catch (error) {
            throw new Error('Erro ao ler o arquivo: ' + error.message);
        }
    }

    /**
     * Lê arquivo como ArrayBuffer
     */
    readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error || new Error('Falha ao ler arquivo'));
            reader.readAsArrayBuffer(file);
        });
    }

    /**
     * Decodifica texto CSV com fallback para windows-1252 quando necessário
     */
    async decodeCSVFile(file) {
        const buffer = await this.readFileAsArrayBuffer(file);

        // Tentar UTF-8 primeiro
        let text = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
        if (!this.looksMojibaked(text)) {
            return text;
        }

        // Fallback para Windows-1252 (ISO-8859-1 ampliado)
        try {
            const text1252 = new TextDecoder('windows-1252', { fatal: false }).decode(buffer);
            return text1252;
        } catch (e) {
            // Como fallback adicional, tentar ISO-8859-1
            try {
                const textIso = new TextDecoder('iso-8859-1', { fatal: false }).decode(buffer);
                return textIso;
            } catch (_) {
                // Se nada funcionar, retorna UTF-8 mesmo
                return text;
            }
        }
    }

    /**
     * Heurística simples para detectar mojibake (acentos quebrados)
     */
    looksMojibaked(str) {
        if (!str) return false;
        // U+FFFD (�) ou sequências típicas de mojibake como Ã©, Ã£, Ã³, Â
        if (str.indexOf('\uFFFD') !== -1 || str.includes('�')) return true;
        return /Ã.|Â/.test(str);
    }

    /**
     * Processa os dados brutos e organiza em estruturas otimizadas
     */
    processData() {
        this.empresasAPR.clear();
        this.turmasPorEmpresa.clear();
        this.datasDisponiveis.clear();

        this.rawData.forEach(row => {
            const turma = this.normalizeName(row.TURMA || '');
            const cnpjRaw = row.CNPJ_EMPRESA || '';
            const cnpj = this.normalizeCNPJ(cnpjRaw);
            const empresa = this.normalizeName(row.EMPRESA || '');
            const data = this.normalizeName(row.DATA || '');

            // Filtrar apenas empresas do Projeto Jovem Aprendiz (turma começa com APR)
            if (turma.toUpperCase().startsWith('APR') && cnpj && empresa) {
                // Registrar empresa por CNPJ com aliases de nomes
                if (!this.empresasAPR.has(cnpj)) {
                    this.empresasAPR.set(cnpj, {
                        cnpj,
                        nome: empresa,
                        aliases: new Set([empresa])
                    });
                } else {
                    const entry = this.empresasAPR.get(cnpj);
                    entry.aliases.add(empresa);
                    // Escolher melhor nome (o mais completo/mais longo)
                    const best = this.chooseBestName(entry.aliases);
                    entry.nome = best || entry.nome;
                }

                // Organizar turmas por CNPJ da empresa (agrupadas por CNPJ normalizado)
                if (!this.turmasPorEmpresa.has(cnpj)) {
                    this.turmasPorEmpresa.set(cnpj, new Set());
                }
                this.turmasPorEmpresa.get(cnpj).add(turma);

                // Adicionar data ao conjunto de datas disponíveis
                if (data) {
                    this.datasDisponiveis.add(data);
                }
            }
        });
    }

    /**
     * Retorna array de empresas do Projeto Jovem Aprendiz
     * @returns {Array} - Array de objetos com cnpj e nome
     */
    getEmpresasAPR() {
        // Retornar uma entrada por CNPJ com nome escolhido e todas aliases (para busca)
        const list = Array.from(this.empresasAPR.values()).map(e => ({
            cnpj: e.cnpj,
            nome: e.nome || this.chooseBestName(e.aliases),
            aliases: Array.from(e.aliases || [])
        }));
        return list.sort((a, b) => a.nome.localeCompare(b.nome));
    }

    /**
     * Busca empresas por termo (CNPJ ou nome)
     * @param {string} termo - Termo de busca
     * @returns {Array} - Array de empresas filtradas
     */
    buscarEmpresas(termo) {
        const todas = this.getEmpresasAPR();
        if (!termo || termo.trim() === '') {
            return todas;
        }

        const termoLower = termo.toLowerCase().trim();
        const termoDigits = termo.replace(/\D/g, '');

        return todas.filter(empresa => {
            // Match por nome principal ou aliases
            const nomeMatch = empresa.nome.toLowerCase().includes(termoLower) ||
                (empresa.aliases || []).some(alias => alias.toLowerCase().includes(termoLower));
            // Match por CNPJ (apenas dígitos)
            const cnpjMatch = termoDigits ? empresa.cnpj.includes(termoDigits) : false;
            return nomeMatch || cnpjMatch;
        });
    }

    /**
     * Retorna as turmas de uma empresa específica
     * @param {string} cnpj - CNPJ da empresa
     * @returns {Array} - Array de códigos de turma
     */
    getTurmasPorEmpresa(cnpj) {
        const key = this.normalizeCNPJ(cnpj);
        const turmas = this.turmasPorEmpresa.get(key);
        if (!turmas) return [];
        return Array.from(turmas).sort();
    }

    /**
     * Retorna as datas disponíveis no dataset
     * @returns {Array} - Array de datas ordenadas
     */
    getDatasDisponiveis() {
        return Array.from(this.datasDisponiveis).sort((a, b) => {
            const dateA = this.parseDate(a);
            const dateB = this.parseDate(b);
            return dateA - dateB;
        });
    }

    /**
     * Converte string de data para objeto Date
     * @param {string} dataStr - Data no formato DD/MM/YYYY
     * @returns {Date} - Objeto Date
     */
    parseDate(dataStr) {
        if (!dataStr) return null;
        const parts = dataStr.split('/');
        if (parts.length !== 3) return null;
        // formato: DD/MM/YYYY -> new Date(year, month-1, day)
        return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    }

    /**
     * Formata Date para string DD/MM/YYYY
     * @param {Date} date - Objeto Date
     * @returns {string} - Data formatada
     */
    formatDate(date) {
        if (!date) return '';
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    }

    /**
     * Obtém o primeiro valor definido entre várias possíveis chaves de coluna
     * Útil para lidar com variações como FALTAS/FALTA/FALT e FREQUENCIA/FREQUENC
     * @param {Object} row - Linha do CSV
     * @param {Array<string>} candidates - Lista de nomes de coluna candidatos
     * @returns {*} - Valor encontrado (ou undefined se nenhum)
     */
    getFirstField(row, candidates = []) {
        for (const key of candidates) {
            if (Object.prototype.hasOwnProperty.call(row, key) && row[key] !== undefined && row[key] !== null) {
                return row[key];
            }
        }
        return undefined;
    }

    /**
     * Filtra dados com base nos critérios selecionados
     * @param {Object} filtros - Objeto com filtros {cnpj, turma, dataInicio, dataFim, statusList}
     * @returns {Array} - Array de registros filtrados
     */
    filtrarDados(filtros) {
        const { cnpj, turma, dataInicio, dataFim, statusList } = filtros;

        // Preparar conjunto de status normalizados para comparação, se houver filtro
        let statusSet = null;
        if (Array.isArray(statusList)) {
            statusSet = new Set(statusList.map(s => this.normalizeStatus(s)));
            if (statusSet.size === 0) {
                // Nenhum status selecionado -> retornar lista vazia
                return [];
            }
        }

        return this.rawData.filter(row => {
            // Filtro por CNPJ
            if (cnpj) {
                const rowCnpj = this.normalizeCNPJ(row.CNPJ_EMPRESA || '');
                const filtroCnpj = this.normalizeCNPJ(cnpj);
                if (rowCnpj !== filtroCnpj) {
                    return false;
                }
            }

            // Filtro por Turma
            if (turma && row.TURMA !== turma) {
                return false;
            }

            // Filtro por período de datas
            if (dataInicio && dataFim && row.DATA) {
                const dataRegistro = this.parseDate(row.DATA);
                if (!dataRegistro) return false;

                const inicio = this.parseDate(dataInicio);
                const fim = this.parseDate(dataFim);

                if (dataRegistro < inicio || dataRegistro > fim) {
                    return false;
                }
            }

            // Filtro por Status (DESCRICAO)
            if (statusSet) {
                const rowStatus = this.normalizeStatus(row.DESCRICAO || '');
                if (!statusSet.has(rowStatus)) {
                    return false;
                }
            }

            return true;
        });
    }

    /**
     * Normaliza status removendo diacríticos e colocando em maiúsculas
     */
    normalizeStatus(status) {
        return String(status)
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toUpperCase()
            .trim();
    }

    /**
     * Gera relatório consolidado dos dados filtrados
     * @param {Array} dadosFiltrados - Array de dados já filtrados
     * @returns {Object} - Objeto com estatísticas e relatório
     */
    gerarRelatorio(dadosFiltrados) {
        const alunosPorRA = new Map();

        // Consolidar dados por aluno
        dadosFiltrados.forEach(row => {
            const ra = row.RA;
            if (!ra) return;

            if (!alunosPorRA.has(ra)) {
                alunosPorRA.set(ra, {
                    RA: ra,
                    ALUNO: row.ALUNO,
                    EMPRESA: row.EMPRESA,
                    CURSO: row.CURSO,
                    TURMA: row.TURMA,
                    faltasJustificadas: [], // Array de objetos {dia, valor}
                    faltasNaoJustificadas: [], // Array de objetos {dia, valor}
                    atrasosDias: [], // Array de dias (string) com atraso
                    horasAtraso: 0, // Total de horas de atraso
                    totalHorasAusencia: 0, // Total de horas de ausência (implementação futura)
                    statusCounts: new Map() // contagem por DESCRICAO
                });
            }

            const aluno = alunosPorRA.get(ra);
            // Aceitar variações de nomes de colunas (algumas planilhas vêm truncadas)
            const faltasRaw = this.getFirstField(row, ['FALTAS', 'FALTA', 'FALT', 'FALT.']);
            const frequenciaRaw = this.getFirstField(row, ['FREQUENCIA', 'FREQUENC', 'FREQ']);
            const justificadaRaw = this.getFirstField(row, ['JUSTIFICADA', 'JUSTIF', 'JUSTIFIC']);

            const faltasValor = parseInt(faltasRaw) || 0;
            const frequenciaValor = parseInt(frequenciaRaw) || 0;
            const justificadaStr = (justificadaRaw || '').toString().trim().toUpperCase();
            const dataStr = row.DATA || '';
            const statusRowRaw = (row.DESCRICAO || '').toString().trim();
            const statusKey = this.normalizeStatus(statusRowRaw);

            // Contabilizar status
            if (statusKey) {
                const prev = aluno.statusCounts.get(statusRowRaw) || 0;
                aluno.statusCounts.set(statusRowRaw, prev + 1);
            }

            // Extrair apenas o dia da data (DD/MM/YYYY -> DD)
            const dia = dataStr.split('/')[0] || '';

            // Verificar se FALTAS está entre 1 e 4
            if (faltasValor >= 1 && faltasValor <= 4) {
                // Verificar se é FALTA JUSTIFICADA
                if (justificadaStr === 'FALTA JUSTIFICADA') {
                    // Regra atualizada:
                    // - "Nº FALTAS JUSTIFICADAS": somar 1 SOMENTE quando FALTAS == 4 e JUSTIFICADA == 'FALTA JUSTIFICADA'.
                    // - "FALTAS JUSTIFICADAS (DIAS)": listar apenas os dias que atendem a FALTAS == 4 e JUSTIFICADA.
                    if (faltasValor === 4) {
                        aluno.faltasJustificadas.push({
                            dia: dia,
                            valor: 1
                        });
                    }
                    // Se JUSTIFICADA mas FALTAS != 4, não contamos e não listamos o dia
                } else {
                    // FALTAS NÃO JUSTIFICADAS
                    // Nova regra:
                    // - Contabilizar e listar SOMENTE quando FALTAS == 4 E o campo JUSTIFICADA estiver vazio (sem informação).
                    // - Nesse caso, somar valor 1 por dia e listar o dia em "FALTAS NÃO JUSTIFICADAS (DIAS)".
                    // - Caso haja qualquer informação diferente de vazio em JUSTIFICADA, não contar como não justificada aqui.
                    if (faltasValor === 4 && justificadaStr === '') {
                        aluno.faltasNaoJustificadas.push({
                            dia: dia,
                            valor: 1
                        });
                    }
                }
            }

            // Lógica de atrasos: FREQUENCIA = 1, 2 ou 3
            if (frequenciaValor === 1 || frequenciaValor === 2 || frequenciaValor === 3) {
                if (dia) aluno.atrasosDias.push(dia);
                if (frequenciaValor === 1) aluno.horasAtraso += 3;
                else if (frequenciaValor === 2) aluno.horasAtraso += 2;
                else if (frequenciaValor === 3) aluno.horasAtraso += 1;
            }
        });

        // Processar e formatar os dados consolidados
        const relatorio = Array.from(alunosPorRA.values()).map(aluno => {
            // Formatar FALTAS JUSTIFICADAS (DIAS) - dias separados por vírgula e espaço
            const diasFaltasJustificadas = aluno.faltasJustificadas
                .map(f => f.dia)
                .filter(dia => dia) // Remover dias vazios
                .join(', ');

            // Calcular Nº FALTAS JUSTIFICADAS - soma dos valores
            const numFaltasJustificadas = aluno.faltasJustificadas
                .reduce((sum, f) => sum + f.valor, 0);

            // Formatar FALTAS NÃO JUSTIFICADAS (DIAS) - dias separados por vírgula e espaço
            const diasFaltasNaoJustificadas = aluno.faltasNaoJustificadas
                .map(f => f.dia)
                .filter(dia => dia) // Remover dias vazios
                .join(', ');

            // Calcular Nº FALTAS NÃO JUSTIFICADAS - soma dos valores
            const numFaltasNaoJustificadas = aluno.faltasNaoJustificadas
                .reduce((sum, f) => sum + f.valor, 0);

            // Determinar STATUS mais frequente (modo). Se empate, pega o primeiro inserido.
            let statusFinal = '';
            let maxCount = -1;
            aluno.statusCounts.forEach((count, label) => {
                if (count > maxCount) {
                    maxCount = count;
                    statusFinal = label;
                }
            });

            // Formatar ATRASOS (DIAS) - dias separados por vírgula e espaço
            const atrasosDiasStr = aluno.atrasosDias.filter(d => d).join(', ');

            // Nº HORAS DE ATRASO - soma total
            const numHorasAtraso = aluno.horasAtraso;

            // TOTAL HORAS DE AUSÊNCIA NO CURSO = (Nº FALTAS JUSTIFICADAS x 4) + (Nº FALTAS NÃO JUSTIFICADAS x 4) + (Nº HORAS DE ATRASO)
            const totalHorasAusencia = (numFaltasJustificadas * 4) + (numFaltasNaoJustificadas * 4) + (numHorasAtraso || 0);

            return {
                TURMA: aluno.TURMA,
                ALUNO: aluno.ALUNO,
                STATUS: statusFinal,
                EMPRESA: aluno.EMPRESA,
                CURSO: aluno.CURSO,
                FALTAS_JUSTIFICADAS_DIAS: diasFaltasJustificadas,
                NUM_FALTAS_JUSTIFICADAS: numFaltasJustificadas,
                FALTAS_NAO_JUSTIFICADAS_DIAS: diasFaltasNaoJustificadas,
                NUM_FALTAS_NAO_JUSTIFICADAS: numFaltasNaoJustificadas,
                ATRASOS_DIAS: atrasosDiasStr,
                NUM_HORAS_ATRASO: numHorasAtraso,
                TOTAL_HORAS_AUSENCIA: totalHorasAusencia
            };
        });

        return {
            totalAlunos: relatorio.length,
            totalRegistros: dadosFiltrados.length,
            relatorio: relatorio.sort((a, b) => a.ALUNO.localeCompare(b.ALUNO))
        };
    }

    /**
     * Retorna intervalo de datas min e max do dataset
     * @returns {Object} - {min: Date, max: Date}
     */
    getIntervaloDataset() {
        const datas = this.getDatasDisponiveis();
        if (datas.length === 0) return { min: null, max: null };

        return {
            min: this.parseDate(datas[0]),
            max: this.parseDate(datas[datas.length - 1])
        };
    }

    /**
     * Valida se os dados foram carregados
     * @returns {boolean}
     */
    isDataLoaded() {
        return this.rawData.length > 0;
    }

    /**
     * Limpa todos os dados do model
     */
    clear() {
        this.rawData = [];
        this.empresasAPR.clear();
        this.turmasPorEmpresa.clear();
        this.datasDisponiveis.clear();
    }
}
