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
        this.ALL_TURMAS = '__ALL__';

        // Elementos DOM
        this.elements = {
            fileInput: document.getElementById('csvFile'),
            fileLabel: document.querySelector('.file-name'),
            fileStatus: document.getElementById('fileStatus'),
            empresaInput: document.getElementById('empresa'),
            empresaDropdown: document.getElementById('empresaDropdown'),
            turmaSelect: document.getElementById('turma'),
            statusGroup: document.getElementById('statusGroup'),
            statusCheckboxes: document.getElementById('statusCheckboxes'),
            statusSelectAll: document.getElementById('status-all'),
            statusOptions: null, // será populado no init
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
        this.setupStatusCheckboxes();
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

        // Adicionar opção "Todas as turmas"
        const optAll = document.createElement('option');
        optAll.value = this.ALL_TURMAS;
        optAll.textContent = 'Todas as turmas';
        this.elements.turmaSelect.appendChild(optAll);

        // Adicionar turmas
        turmas.forEach(turma => {
            const option = document.createElement('option');
            option.value = turma;
            option.textContent = turma;
            this.elements.turmaSelect.appendChild(option);
        });

        // Habilitar select
        this.elements.turmaSelect.disabled = false;

        // Habilitar grupo de status
        this.elements.statusGroup.setAttribute('aria-disabled', 'false');
        this.elements.statusCheckboxes.classList.remove('disabled');
    }

    /**
     * Configura o select de turma
     */
    setupTurmaSelect() {
        this.elements.turmaSelect.addEventListener('change', (e) => {
            this.selectedTurma = e.target.value;

            if (this.selectedTurma || this.selectedTurma === this.ALL_TURMAS) {
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
     * Configura checkboxes de Status (Selecionar Tudo + opções)
     */
    setupStatusCheckboxes() {
        // Capturar opções dinâmicas (todas com classe .status-option)
        this.elements.statusOptions = Array.from(document.querySelectorAll('.status-option'));

        // Selecionar Tudo
        this.elements.statusSelectAll.addEventListener('change', (e) => {
            const checked = e.target.checked;
            this.elements.statusOptions.forEach(opt => opt.checked = checked);
        });

        // Desmarcar "Selecionar Tudo" quando alguma opção individual for alterada
        this.elements.statusOptions.forEach(opt => {
            opt.addEventListener('change', () => {
                const allChecked = this.elements.statusOptions.every(o => o.checked);
                this.elements.statusSelectAll.checked = allChecked;
            });
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
                turma: this.selectedTurma === this.ALL_TURMAS ? null : this.selectedTurma,
                dataInicio: this.dateRange.inicio,
                dataFim: this.dateRange.fim,
                statusList: this.getSelectedStatuses()
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
     * Retorna lista de status selecionados; se "Selecionar Tudo" está marcado, retorna null (sem filtro)
     */
    getSelectedStatuses() {
        if (this.elements.statusSelectAll.checked) return null;
        const list = this.elements.statusOptions
            .filter(opt => opt.checked)
            .map(opt => opt.value);
        return list; // pode ser [], o Model tratará como conjunto vazio (sem resultados)
    }

    /**
     * Exporta dados para arquivo Excel (.xlsx)
     */
    exportarCSV(dados) {
        // Utilitário: converte índice de coluna (1-based) para letra Excel
        const colToLetter = (colNum) => {
            let letter = '';
            while (colNum > 0) {
                const mod = (colNum - 1) % 26;
                letter = String.fromCharCode(65 + mod) + letter;
                colNum = Math.floor((colNum - mod) / 26);
            }
            return letter;
        };

        // Preparar dados para export com a nova estrutura
        const excelData = dados.map(aluno => ({
            'TURMA': aluno.TURMA,
            'ALUNO': aluno.ALUNO,
            'STATUS': aluno.STATUS,
            'EMPRESA': aluno.EMPRESA,
            'CURSO': aluno.CURSO,
            'FALTAS JUSTIFICADAS (DIAS)': aluno.FALTAS_JUSTIFICADAS_DIAS,
            'Nº FALTAS JUSTIFICADAS': aluno.NUM_FALTAS_JUSTIFICADAS,
            'FALTAS NÃO JUSTIFICADAS (DIAS)': aluno.FALTAS_NAO_JUSTIFICADAS_DIAS,
            'Nº FALTAS NÃO JUSTIFICADAS': aluno.NUM_FALTAS_NAO_JUSTIFICADAS,
            'ATRASOS (DIAS)': aluno.ATRASOS_DIAS,
            'Nº HORAS DE ATRASO': aluno.NUM_HORAS_ATRASO,
            'TOTAL HORAS DE AUSÊNCIA NO CURSO': aluno.TOTAL_HORAS_AUSENCIA
        }));

        const headers = excelData.length > 0 ? Object.keys(excelData[0]) : [];
        const lastColLetter = colToLetter(headers.length || 12);

        // Criar workbook e worksheet em branco
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([]);

        // Títulos (linhas 1 a 3)
        const titulo1 = 'SENAI - MARACANÃ';
        const titulo2 = 'PROGRAMA DE APRENDIZAGEM INDUSTRIAL';
        // Extrair MÊS/ANO do período selecionado
        let mesAno = '';
        if (this.dateRange && this.dateRange.inicio) {
            const parts = (this.dateRange.inicio || '').split('/'); // DD/MM/YYYY
            if (parts.length === 3) mesAno = `${parts[1]}/${parts[2]}`;
        } else {
            // Fallback: tentar pegar do intervalo do dataset
            const datas = this.model.getDatasDisponiveis();
            if (datas && datas.length > 0) {
                const p = (datas[0] || '').split('/');
                if (p.length === 3) mesAno = `${p[1]}/${p[2]}`;
            }
        }
        const titulo3 = `Relatório de Frequência - Aprendizes - ${mesAno}`;

        // Escrever títulos
        XLSX.utils.sheet_add_aoa(ws, [[titulo1]], { origin: 'A1' });
        XLSX.utils.sheet_add_aoa(ws, [[titulo2]], { origin: 'A2' });
        XLSX.utils.sheet_add_aoa(ws, [[titulo3]], { origin: 'A3' });

        // Adicionar dados a partir da linha 5 (linha 5 = header)
        XLSX.utils.sheet_add_json(ws, excelData, { origin: 'A5', skipHeader: false });

        // Ajustar largura das colunas (balanceadas para caber os títulos sem excesso de espaço)
        ws['!cols'] = [
            { wch: 18 },  // TURMA
            { wch: 38 },  // ALUNO
            { wch: 14 },  // STATUS
            { wch: 36 },  // EMPRESA
            { wch: 32 },  // CURSO
            { wch: 26 },  // FALTAS JUSTIFICADAS (DIAS)
            { wch: 20 },  // Nº FALTAS JUSTIFICADAS
            { wch: 28 },  // FALTAS NÃO JUSTIFICADAS (DIAS)
            { wch: 24 },  // Nº FALTAS NÃO JUSTIFICADAS
            { wch: 18 },  // ATRASOS (DIAS)
            { wch: 18 },  // Nº HORAS DE ATRASO
            { wch: 34 }   // TOTAL HORAS DE AUSÊNCIA NO CURSO
        ];

        // Mesclar células para os títulos (A1:last, A2:last, A3:last)
        ws['!merges'] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } },
            { s: { r: 1, c: 0 }, e: { r: 1, c: headers.length - 1 } },
            { s: { r: 2, c: 0 }, e: { r: 2, c: headers.length - 1 } }
        ];

        // Estilos (requer xlsx-js-style na página)
    const centerBold = { alignment: { horizontal: 'center' }, font: { bold: true, sz: 12 } };
    const centerBoldBig = { alignment: { horizontal: 'center' }, font: { bold: true, sz: 14 } };
        const headerFill = { fill: { patternType: 'solid', fgColor: { rgb: 'FFE6F2FF' } }, font: { bold: true } };
        const altFill = { fill: { patternType: 'solid', fgColor: { rgb: 'FFF5FAFF' } } };
    const whiteFill = { fill: { patternType: 'solid', fgColor: { rgb: 'FFFFFFFF' } } };

        // Aplicar estilos títulos
        ['A1', 'A2', 'A3'].forEach((addr, idx) => {
            if (!ws[addr]) return;
            ws[addr].s = Object.assign({}, idx === 0 ? centerBoldBig : centerBold, whiteFill);
        });

        // Estilizar header (linha 5)
        for (let c = 1; c <= headers.length; c++) {
            const cell = `${colToLetter(c)}5`;
            if (ws[cell]) {
                ws[cell].s = Object.assign({ alignment: { horizontal: 'center', vertical: 'center' } }, headerFill);
            }
        }

        // Listras alternadas nas linhas de dados (a partir da linha 6)
        const firstDataRow = 6;
        const lastDataRow = 5 + excelData.length;
        for (let r = firstDataRow; r <= lastDataRow; r++) {
            const isAlt = (r - firstDataRow) % 2 === 0;
            for (let c = 1; c <= headers.length; c++) {
                const addr = `${colToLetter(c)}${r}`;
                if (ws[addr]) {
                    ws[addr].s = Object.assign({}, ws[addr].s || {}, isAlt ? altFill : whiteFill);
                }
            }
        }

        // Aplicar bordas finas em toda a tabela (header + dados)
        const thinBorder = {
            border: {
                top: { style: 'thin', color: { rgb: 'FFB3B3B3' } },
                bottom: { style: 'thin', color: { rgb: 'FFB3B3B3' } },
                left: { style: 'thin', color: { rgb: 'FFB3B3B3' } },
                right: { style: 'thin', color: { rgb: 'FFB3B3B3' } }
            }
        };
        for (let r = 5; r <= lastDataRow; r++) {
            for (let c = 1; c <= headers.length; c++) {
                const addr = `${colToLetter(c)}${r}`;
                if (ws[addr]) {
                    ws[addr].s = Object.assign({}, ws[addr].s || {}, thinBorder);
                }
            }
        }

        // Desabilitar gridlines (exibição e impressão)
        ws['!gridlines'] = false; // alguns apps respeitam esta flag
        ws['!sheetViews'] = [{ showGridLines: false }]; // tentativa adicional para compatibilidade
        ws['!printOptions'] = Object.assign({}, ws['!printOptions'] || {}, { gridLines: false });

        // Aplicar preenchimento branco em área estendida para ocultar gridlines também fora da tabela
        const extendToCol = 13; // até coluna M
        const extendToRow = Math.max(lastDataRow + 10, 30); // pelo menos 10 linhas após dados
        for (let r = 1; r <= extendToRow; r++) {
            for (let c = 1; c <= extendToCol; c++) {
                const addr = `${colToLetter(c)}${r}`;
                if (!ws[addr]) {
                    ws[addr] = { t: 's', v: '' }; // célula vazia com string
                }
                if (!ws[addr].s) {
                    ws[addr].s = {};
                }
                // Se não tem fill definido, aplicar branco
                if (!ws[addr].s.fill) {
                    ws[addr].s.fill = { patternType: 'solid', fgColor: { rgb: 'FFFFFFFF' } };
                }
            }
        }

        // Adicionar worksheet ao workbook
        XLSX.utils.book_append_sheet(wb, ws, 'Relatório de Frequência');        // Gerar nome do arquivo
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
