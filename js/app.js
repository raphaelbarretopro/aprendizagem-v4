/**
 * app.js - Arquivo principal de inicialização da aplicação
 * Inicializa o Model e Controller e conecta todos os componentes
 */

// Aguardar carregamento completo do DOM
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Inicializando Sistema de Processamento de Frequência...');

    // Verificar se as bibliotecas necessárias estão carregadas
    if (typeof Papa === 'undefined') {
        console.error('❌ PapaParse não está carregado!');
        alert('Erro: Biblioteca PapaParse não foi carregada. Verifique sua conexão com a internet.');
        return;
    }

    if (typeof flatpickr === 'undefined') {
        console.error('❌ Flatpickr não está carregado!');
        alert('Erro: Biblioteca Flatpickr não foi carregada. Verifique sua conexão com a internet.');
        return;
    }

    if (typeof XLSX === 'undefined') {
        console.error('❌ SheetJS (XLSX) não está carregado!');
        alert('Erro: Biblioteca SheetJS não foi carregada. Verifique sua conexão com a internet.');
        return;
    }

    // Verificar se as classes Model e Controller estão disponíveis
    if (typeof DataModel === 'undefined') {
        console.error('❌ DataModel não está definido!');
        alert('Erro: Arquivo DataModel.js não foi carregado corretamente.');
        return;
    }

    if (typeof FrequencyController === 'undefined') {
        console.error('❌ FrequencyController não está definido!');
        alert('Erro: Arquivo FrequencyController.js não foi carregado corretamente.');
        return;
    }

    try {
        // Instanciar o Model
        const dataModel = new DataModel();
        console.log('✓ DataModel inicializado');

        // Instanciar o Controller passando o Model
        const controller = new FrequencyController(dataModel);
        console.log('✓ FrequencyController inicializado');

        // Disponibilizar globalmente para debugging (apenas em desenvolvimento)
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            window.app = {
                model: dataModel,
                controller: controller
            };
            console.log('ℹ️ App disponível globalmente via window.app (modo desenvolvimento)');
        }

        console.log('✅ Sistema inicializado com sucesso!');
        console.log('📝 Aguardando upload de arquivo CSV...');

    } catch (error) {
        console.error('❌ Erro ao inicializar aplicação:', error);
        alert('Erro ao inicializar o sistema: ' + error.message);
    }
});

// Tratamento de erros globais
window.addEventListener('error', (event) => {
    console.error('❌ Erro não tratado:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('❌ Promise rejeitada não tratada:', event.reason);
});

// Adicionar informações úteis ao console
console.log('%cSistema de Processamento de Frequência', 'color: #2563eb; font-size: 20px; font-weight: bold;');
console.log('%cProjeto Jovem Aprendiz', 'color: #64748b; font-size: 14px;');
console.log('%c© 2025 - Desenvolvido com JavaScript, HTML e CSS', 'color: #64748b; font-size: 12px;');
