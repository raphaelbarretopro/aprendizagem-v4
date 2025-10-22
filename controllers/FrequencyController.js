/**
 * FrequencyController - Controller principal do sistema
 * Responsável por: gerenciar interações da UI, coordenar Model e View
 */
class FrequencyController {
    constructor(dataModel) {
        this.model = dataModel;
        this.selectedEmpresa = null;
        this.selectedTurma = null;
        this.dateRange = null;
        this.flatpickrInstance = null;

        // Elementos DOM
        this.elements = {
            fileInput: document.getElementById('csvFile'),
            fileLabel: document.querySelector('.file-name'),
            fileStatus: document.getElementById('fileStatus'),
            empresaInput: document.getElementById('empresa'),
            empresaDropdown: document.getElementById('empresaDropdown'),
            turmaSelect: document.getElementById('turma'),
            dataRangeInput: document.getElementById('dataRange'),
            btnProcessar: document.getElementById('btnProcessar'),
            statusPanel: document.getElementById('statusPanel'),
            statusMessage: document.getElementById('statusMessage'),
            form: document.getElementById('frequencyForm')
        };

        this.init();
    }

    /**
     * Inicializa o controller e os event listeners
     */
    init() {
        this.setupFileUpload();
        this.setupAutocomplete();
        this.setupTurmaSelect();
        this.setupFormSubmit();
    }

    /**
     * Configura o upload de arquivo CSV
     */
    setupFileUpload() {
        this.elements.fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            // Atualizar nome do arquivo
            this.elements.fileLabel.textContent = file.name;

            // Validar tipo de arquivo (aceita .csv ou .CSV)
            const fileName = file.name.toLowerCase();
            if (!fileName.endsWith('.csv') && file.type !== 'text/csv' && file.type !== 'application/vnd.ms-excel') {
                this.showFileStatus('Erro: Por favor, selecione um arquivo CSV válido.', 'error');
                this.resetForm();
                return;
            }

            // Mostrar status de carregamento
            this.showFileStatus('Carregando arquivo...', 'loading');

            try {
                const result = await this.model.loadCSV(file);
                this.showFileStatus(
                    `✓ Arquivo carregado com sucesso! ${result.totalRegistros} registros, ${result.empresasAPR} empresas APR encontradas.`,
                    'success'
                );

                // Habilitar campo de empresa
                this.elements.empresaInput.disabled = false;
                this.elements.empresaInput.focus();

            } catch (error) {
                this.showFileStatus(`Erro ao carregar arquivo: ${error.message}`, 'error');
                this.resetForm();
            }
        });
    }

    /**
     * Configura o autocomplete do campo empresa
     */
    setupAutocomplete() {
        let currentFocus = -1;

        // Evento de input - busca enquanto digita
        this.elements.empresaInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value;
            this.showAutocompleteResults(searchTerm);
            currentFocus = -1;
        });

        // Evento de focus - mostrar todas as opções
        this.elements.empresaInput.addEventListener('focus', (e) => {
            if (this.model.isDataLoaded()) {
                this.showAutocompleteResults(e.target.value);
            }
        });

        // Fechar dropdown ao clicar fora
        document.addEventListener('click', (e) => {
            if (!this.elements.empresaInput.contains(e.target) && 
                !this.elements.empresaDropdown.contains(e.target)) {
                this.hideAutocomplete();
            }
        });

        // Navegação por teclado
        this.elements.empresaInput.addEventListener('keydown', (e) => {
            const items = this.elements.empresaDropdown.querySelectorAll('.autocomplete-item');
            
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                currentFocus++;
                this.setActiveItem(items, currentFocus);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                currentFocus--;
                this.setActiveItem(items, currentFocus);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (currentFocus > -1 && items[currentFocus]) {
                    items[currentFocus].click();
                }
            } else if (e.key === 'Escape') {
                this.hideAutocomplete();
            }
        });
    }

    /**
     * Mostra resultados do autocomplete
     */
    showAutocompleteResults(searchTerm) {
        const empresas = this.model.buscarEmpresas(searchTerm);
        this.elements.empresaDropdown.innerHTML = '';

        if (empresas.length === 0) {
            this.elements.empresaDropdown.innerHTML = '<div class="autocomplete-item" style="cursor: default;">Nenhuma empresa encontrada</div>';
            this.elements.empresaDropdown.classList.add('active');
            return;
        }

        empresas.forEach(empresa => {
            const item = document.createElement('div');
            item.className = 'autocomplete-item';
            item.dataset.cnpj = empresa.cnpj;
            item.dataset.nome = empresa.nome;

            // Destacar termo de busca
            const nomeHTML = this.highlightMatch(empresa.nome, searchTerm);
            const cnpjHTML = this.highlightMatch(this.formatCNPJ(empresa.cnpj), searchTerm);

            item.innerHTML = `
                <span class="autocomplete-item-name">${nomeHTML}</span>
                <span class="autocomplete-item-cnpj">CNPJ: ${cnpjHTML}</span>
            `;

            item.addEventListener('click', () => {
                this.selectEmpresa(empresa);
            });

            this.elements.empresaDropdown.appendChild(item);
        });

        this.elements.empresaDropdown.classList.add('active');
    }

    /**
     * Destaca termo de busca no texto
     */
    highlightMatch(text, term) {
        if (!term) return text;
        const regex = new RegExp(`(${term})`, 'gi');
        return text.replace(regex, '<mark>$1</mark>');
    }

    /**
     * Formata CNPJ
     */
    formatCNPJ(cnpj) {
        if (!cnpj || cnpj.length !== 14) return cnpj;
        return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
    }

    /**
     * Seleciona uma empresa
     */
    selectEmpresa(empresa) {
        this.selectedEmpresa = empresa;
        this.elements.empresaInput.value = `${empresa.nome} - ${this.formatCNPJ(empresa.cnpj)}`;
        this.hideAutocomplete();

        // Carregar turmas da empresa
        this.loadTurmas(empresa.cnpj);
    }

    /**
     * Esconde autocomplete
     */
    hideAutocomplete() {
        this.elements.empresaDropdown.classList.remove('active');
    }

    /**
     * Define item ativo na navegação por teclado
     */
    setActiveItem(items, currentFocus) {
        if (!items || items.length === 0) return;

        // Remover classe selected de todos
        items.forEach(item => item.classList.remove('selected'));

        // Ajustar índice
        if (currentFocus >= items.length) currentFocus = 0;
        if (currentFocus < 0) currentFocus = items.length - 1;

        // Adicionar classe ao item atual
        items[currentFocus].classList.add('selected');
        items[currentFocus].scrollIntoView({ block: 'nearest' });
    }

    /**
     * Carrega turmas de uma empresa
     */
    loadTurmas(cnpj) {
        const turmas = this.model.getTurmasPorEmpresa(cnpj);
        
        // Limpar select
        this.elements.turmaSelect.innerHTML = '<option value="">Selecione uma turma</option>';

        // Adicionar turmas
        turmas.forEach(turma => {
            const option = document.createElement('option');
            option.value = turma;
            option.textContent = turma;
            this.elements.turmaSelect.appendChild(option);
        });

        // Habilitar select
        this.elements.turmaSelect.disabled = false;
    }

    /**
     * Configura o select de turma
     */
    setupTurmaSelect() {
        this.elements.turmaSelect.addEventListener('change', (e) => {
            this.selectedTurma = e.target.value;

            if (this.selectedTurma) {
                // Inicializar seletor de datas
                this.initDatePicker();
            } else {
                // Desabilitar seletor de datas
                this.destroyDatePicker();
                this.elements.btnProcessar.disabled = true;
            }
        });
    }

    /**
     * Inicializa o seletor de datas
     */
    initDatePicker() {
        const intervalo = this.model.getIntervaloDataset();

        if (this.flatpickrInstance) {
            this.flatpickrInstance.destroy();
        }

        this.flatpickrInstance = flatpickr(this.elements.dataRangeInput, {
            mode: 'range',
            dateFormat: 'd/m/Y',
            locale: 'pt',
            minDate: intervalo.min,
            maxDate: intervalo.max,
            onChange: (selectedDates) => {
                if (selectedDates.length === 2) {
                    this.dateRange = {
                        inicio: this.model.formatDate(selectedDates[0]),
                        fim: this.model.formatDate(selectedDates[1])
                    };
                    this.elements.btnProcessar.disabled = false;
                } else {
                    this.dateRange = null;
                    this.elements.btnProcessar.disabled = true;
                }
            }
        });

        this.elements.dataRangeInput.disabled = false;
    }

    /**
     * Destrói o seletor de datas
     */
    destroyDatePicker() {
        if (this.flatpickrInstance) {
            this.flatpickrInstance.destroy();
            this.flatpickrInstance = null;
        }
        this.elements.dataRangeInput.disabled = true;
        this.elements.dataRangeInput.value = '';
        this.dateRange = null;
    }

    /**
     * Configura o submit do formulário
     */
    setupFormSubmit() {
        this.elements.form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.processarDados();
        });
    }

    /**
     * Processa os dados e gera relatório
     */
    async processarDados() {
        if (!this.selectedEmpresa || !this.selectedTurma || !this.dateRange) {
            alert('Por favor, preencha todos os campos obrigatórios.');
            return;
        }

        // Mostrar painel de status
        this.showStatus('Processando dados...');

        try {
            // Simular delay para UX
            await new Promise(resolve => setTimeout(resolve, 500));

            // Filtrar dados
            const filtros = {
                cnpj: this.selectedEmpresa.cnpj,
                turma: this.selectedTurma,
                dataInicio: this.dateRange.inicio,
                dataFim: this.dateRange.fim
            };

            const dadosFiltrados = this.model.filtrarDados(filtros);
            
            if (dadosFiltrados.length === 0) {
                this.hideStatus();
                alert('Nenhum registro encontrado com os filtros selecionados.');
                return;
            }

            // Gerar relatório
            this.showStatus('Gerando relatório...');
            await new Promise(resolve => setTimeout(resolve, 500));

            const resultado = this.model.gerarRelatorio(dadosFiltrados);

            // Exportar para CSV
            this.showStatus('Exportando arquivo...');
            await new Promise(resolve => setTimeout(resolve, 500));

            this.exportarCSV(resultado.relatorio);

            this.hideStatus();
            alert(`Relatório gerado com sucesso!\n\nTotal de alunos: ${resultado.totalAlunos}\nTotal de registros: ${resultado.totalRegistros}`);

        } catch (error) {
            this.hideStatus();
            alert('Erro ao processar dados: ' + error.message);
            console.error(error);
        }
    }

    /**
     * Exporta dados para arquivo Excel (.xlsx)
     */
    exportarCSV(dados) {
        // Preparar dados para export
        const excelData = dados.map(aluno => ({
            'RA': aluno.RA,
            'Aluno': aluno.ALUNO,
            'Curso': aluno.CURSO,
            'Turma': aluno.TURMA,
            'Empresa': aluno.EMPRESA,
            'CNPJ': aluno.CNPJ_EMPRESA,
            'Status': aluno.DESCRICAO,
            'Data Início Turma': aluno.DTINICIO_TURMA,
            'Total de Aulas': aluno.totalAulas,
            'Total de Presenças': aluno.totalPresencas,
            'Total de Faltas': aluno.totalFaltas,
            'Faltas Justificadas': aluno.totalJustificadas,
            'Percentual de Frequência': aluno.percentualFrequencia
        }));

        // Criar workbook e worksheet
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(excelData);

        // Ajustar largura das colunas
        const colWidths = [
            { wch: 12 },  // RA
            { wch: 35 },  // Aluno
            { wch: 40 },  // Curso
            { wch: 18 },  // Turma
            { wch: 40 },  // Empresa
            { wch: 20 },  // CNPJ
            { wch: 15 },  // Status
            { wch: 18 },  // Data Início Turma
            { wch: 15 },  // Total de Aulas
            { wch: 18 },  // Total de Presenças
            { wch: 15 },  // Total de Faltas
            { wch: 20 },  // Faltas Justificadas
            { wch: 25 }   // Percentual de Frequência
        ];
        ws['!cols'] = colWidths;

        // Adicionar worksheet ao workbook
        XLSX.utils.book_append_sheet(wb, ws, 'Relatório de Frequência');

        // Gerar nome do arquivo
        const filename = `relatorio_frequencia_${this.selectedEmpresa.nome.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.xlsx`;

        // Fazer download do arquivo Excel
        XLSX.writeFile(wb, filename);
    }

    /**
     * Mostra status de arquivo
     */
    showFileStatus(message, type) {
        this.elements.fileStatus.textContent = message;
        this.elements.fileStatus.className = 'file-status';
        
        if (type === 'success') {
            this.elements.fileStatus.classList.add('success');
        } else if (type === 'error') {
            this.elements.fileStatus.classList.add('error');
        }
    }

    /**
     * Mostra painel de status
     */
    showStatus(message) {
        this.elements.statusMessage.textContent = message;
        this.elements.statusPanel.style.display = 'block';
        this.elements.btnProcessar.disabled = true;
    }

    /**
     * Esconde painel de status
     */
    hideStatus() {
        this.elements.statusPanel.style.display = 'none';
        this.elements.btnProcessar.disabled = false;
    }

    /**
     * Reseta o formulário
     */
    resetForm() {
        this.selectedEmpresa = null;
        this.selectedTurma = null;
        this.dateRange = null;

        this.elements.empresaInput.value = '';
        this.elements.empresaInput.disabled = true;
        this.elements.turmaSelect.innerHTML = '<option value="">Selecione uma empresa primeiro</option>';
        this.elements.turmaSelect.disabled = true;
        this.destroyDatePicker();
        this.elements.btnProcessar.disabled = true;
        
        this.model.clear();
    }
}
