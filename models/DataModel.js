/**
 * DataModel - Model para gerenciamento dos dados do arquivo CSV
 * Responsável por: carregar, processar, filtrar e preparar dados
 */
class DataModel {
    constructor() {
        this.rawData = [];
        this.empresasAPR = new Map(); // Map para armazenar empresas únicas do projeto APR
        this.turmasPorEmpresa = new Map(); // Map para armazenar turmas por empresa
        this.datasDisponiveis = new Set(); // Set para armazenar datas únicas
    }

    /**
     * Carrega e processa o arquivo CSV
     * @param {File} file - Arquivo CSV selecionado
     * @returns {Promise} - Promise com os dados processados
     */
    loadCSV(file) {
        return new Promise((resolve, reject) => {
            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                encoding: 'UTF-8',
                complete: (results) => {
                    if (results.errors.length > 0) {
                        reject(new Error('Erro ao processar o arquivo CSV: ' + results.errors[0].message));
                        return;
                    }

                    this.rawData = results.data;
                    this.processData();
                    resolve({
                        totalRegistros: this.rawData.length,
                        empresasAPR: this.empresasAPR.size,
                        turmas: this.turmasPorEmpresa.size
                    });
                },
                error: (error) => {
                    reject(new Error('Erro ao ler o arquivo: ' + error.message));
                }
            });
        });
    }

    /**
     * Processa os dados brutos e organiza em estruturas otimizadas
     */
    processData() {
        this.empresasAPR.clear();
        this.turmasPorEmpresa.clear();
        this.datasDisponiveis.clear();

        this.rawData.forEach(row => {
            const turma = (row.TURMA || '').trim();
            const cnpj = (row.CNPJ_EMPRESA || '').trim();
            const empresa = (row.EMPRESA || '').trim();
            const data = (row.DATA || '').trim();

            // Filtrar apenas empresas do Projeto Jovem Aprendiz (turma começa com APR)
            if (turma.startsWith('APR') && cnpj && empresa) {
                // Adicionar empresa ao Map (evita duplicatas)
                if (!this.empresasAPR.has(cnpj)) {
                    this.empresasAPR.set(cnpj, {
                        cnpj: cnpj,
                        nome: empresa
                    });
                }

                // Organizar turmas por CNPJ da empresa
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
        return Array.from(this.empresasAPR.values()).sort((a, b) => 
            a.nome.localeCompare(b.nome)
        );
    }

    /**
     * Busca empresas por termo (CNPJ ou nome)
     * @param {string} termo - Termo de busca
     * @returns {Array} - Array de empresas filtradas
     */
    buscarEmpresas(termo) {
        if (!termo || termo.trim() === '') {
            return this.getEmpresasAPR();
        }

        const termoLower = termo.toLowerCase().trim();
        return this.getEmpresasAPR().filter(empresa => {
            const nomeMatch = empresa.nome.toLowerCase().includes(termoLower);
            const cnpjMatch = empresa.cnpj.includes(termoLower);
            return nomeMatch || cnpjMatch;
        });
    }

    /**
     * Retorna as turmas de uma empresa específica
     * @param {string} cnpj - CNPJ da empresa
     * @returns {Array} - Array de códigos de turma
     */
    getTurmasPorEmpresa(cnpj) {
        const turmas = this.turmasPorEmpresa.get(cnpj);
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
     * Filtra dados com base nos critérios selecionados
     * @param {Object} filtros - Objeto com filtros {cnpj, turma, dataInicio, dataFim}
     * @returns {Array} - Array de registros filtrados
     */
    filtrarDados(filtros) {
        const { cnpj, turma, dataInicio, dataFim } = filtros;

        return this.rawData.filter(row => {
            // Filtro por CNPJ
            if (cnpj && row.CNPJ_EMPRESA !== cnpj) {
                return false;
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

            return true;
        });
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
                    CURSO: row.CURSO,
                    TURMA: row.TURMA,
                    EMPRESA: row.EMPRESA,
                    CNPJ_EMPRESA: row.CNPJ_EMPRESA,
                    DESCRICAO: row.DESCRICAO,
                    DTINICIO_TURMA: row.DTINICIO_TURMA,
                    totalFaltas: 0,
                    totalPresencas: 0,
                    totalJustificadas: 0,
                    aulas: []
                });
            }

            const aluno = alunosPorRA.get(ra);
            const faltas = parseInt(row.FALTAS) || 0;
            const frequencia = parseInt(row.FREQUENCIA) || 0;
            const justificadas = parseInt(row.JUSTIFICADA) || 0;

            aluno.totalFaltas += faltas;
            aluno.totalPresencas += frequencia;
            aluno.totalJustificadas += justificadas;

            aluno.aulas.push({
                DATA: row.DATA,
                MES: row.MES,
                FALTAS: faltas,
                FREQUENCIA: frequencia,
                JUSTIFICADA: justificadas
            });
        });

        // Calcular percentual de frequência
        const relatorio = Array.from(alunosPorRA.values()).map(aluno => {
            const totalAulas = aluno.aulas.length;
            const percentualFrequencia = totalAulas > 0 
                ? ((aluno.totalPresencas / totalAulas) * 100).toFixed(2) 
                : '0.00';

            return {
                ...aluno,
                totalAulas,
                percentualFrequencia: `${percentualFrequencia}%`
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
