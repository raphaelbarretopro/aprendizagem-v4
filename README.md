# Processador de Frequência - Projeto Jovem Aprendiz

Sistema de gestão e processamento de frequência de alunos do Projeto Jovem Aprendiz.

## 📋 Descrição

Este sistema processa dados de frequência de alunos a partir de arquivos CSV gerados por sistemas de gestão educacional. Ele permite filtrar dados por empresa, turma e período, gerando relatórios consolidados de frequência.

## 🚀 Funcionalidades

- ✅ Upload e processamento de arquivos CSV
- ✅ Filtro automático de empresas do Projeto Jovem Aprendiz (turmas que começam com "APR")
- ✅ Busca inteligente de empresas por CNPJ ou nome
- ✅ Seleção de turmas por empresa
- ✅ Seletor de intervalo de datas com visualização clara
- ✅ Geração de relatório consolidado por aluno
- ✅ Exportação de relatório em formato Excel (.xlsx) com colunas separadas

## 🏗️ Estrutura do Projeto

```
aprendizagem-v4/
│
├── index.html              # Página principal
├── README.md              # Documentação
│
├── css/
│   └── style.css          # Estilos da aplicação
│
├── js/
│   └── app.js            # Inicialização da aplicação
│
├── models/
│   └── DataModel.js      # Modelo de dados (MVC)
│
├── controllers/
│   └── FrequencyController.js  # Controller principal (MVC)
│
├── views/                 # (Futura expansão)
│
└── assets/               # Recursos adicionais
```

## 🎨 Arquitetura

O sistema segue o padrão **MVC (Model-View-Controller)**:

- **Model** (`DataModel.js`): Gerencia os dados, processamento e lógica de negócio
- **View** (`index.html` + `style.css`): Interface do usuário
- **Controller** (`FrequencyController.js`): Coordena Model e View, gerencia eventos

## 📊 Formato do Arquivo CSV

O arquivo CSV deve conter as seguintes colunas:

| Coluna | Descrição |
|--------|-----------|
| CURSO | Nome do curso |
| TURMA | Código da turma (turmas APR começam com "APR") |
| RA | Registro Acadêmico do aluno |
| ALUNO | Nome do aluno |
| DESCRICAO | Status (CANCELADO/DESISTENTE/MATRICULADO/etc) |
| DTINICIO_TURMA | Data de início da turma |
| DATA | Data da aula (formato DD/MM/YYYY) |
| FALTAS | Quantidade de faltas na aula |
| FREQUENCIA | Presença na aula |
| JUSTIFICADA | Quantidade de faltas justificadas |
| MES | Mês referente à aula |
| CNPJ_EMPRESA | CNPJ da empresa (sem máscara) |
| EMPRESA | Nome da empresa |

## 🖥️ Como Usar

1. **Abra o arquivo `index.html`** em um navegador moderno (Chrome, Firefox, Edge, Safari)

2. **Carregue o arquivo CSV**
   - Clique em "Escolher Arquivo"
   - Selecione o arquivo Empresa.CSV

3. **Selecione a Empresa**
   - Digite o nome ou CNPJ da empresa
   - O sistema filtrará automaticamente as empresas do Projeto Jovem Aprendiz
   - Selecione a empresa desejada da lista

4. **Selecione a Turma**
   - Escolha uma das turmas disponíveis para a empresa selecionada

5. **Selecione o Período**
   - Clique no campo de data
   - Selecione a data inicial e final
   - O período selecionado ficará destacado em azul

6. **Processar e Gerar Relatório**
   - Clique no botão "Processar e Gerar Relatório"
   - O sistema gerará um arquivo Excel (.xlsx) com os dados consolidados em colunas separadas
   - O arquivo será baixado automaticamente

## 📦 Dependências

O sistema utiliza as seguintes bibliotecas CDN:

- **PapaParse** (v5.4.1): Processamento de arquivos CSV de entrada
- **Flatpickr** (latest): Seletor de datas avançado
- **Flatpickr PT-BR**: Tradução para português
- **SheetJS (XLSX)** (v0.18.5): Geração de arquivos Excel (.xlsx)

Todas as dependências são carregadas via CDN, não sendo necessária instalação.

## 🎯 Requisitos

- Navegador moderno com JavaScript habilitado
- Conexão com internet (para carregar bibliotecas CDN)
- Arquivo CSV no formato especificado

## 📱 Responsividade

O sistema é totalmente responsivo e funciona em:
- 💻 Desktops
- 📱 Tablets
- 📱 Smartphones

## 🔐 Segurança

- Todo processamento é feito localmente no navegador
- Nenhum dado é enviado para servidores externos
- Os arquivos CSV permanecem no dispositivo do usuário

## 🐛 Debugging

Em ambiente de desenvolvimento (localhost), o sistema disponibiliza objetos globais para debug:

```javascript
// Acessar o modelo de dados
window.app.model

// Acessar o controller
window.app.controller
```

## 📄 Relatório Gerado

O relatório Excel (.xlsx) gerado contém as seguintes colunas separadas:

- RA do aluno
- Nome do aluno
- Curso
- Turma
- Empresa e CNPJ
- Status (Matriculado, Cancelado, etc)
- Data de início da turma
- Total de aulas no período
- Total de presenças
- Total de faltas
- Faltas justificadas
- Percentual de frequência

## 🤝 Suporte

Para questões ou problemas, verifique:
1. Console do navegador (F12) para mensagens de erro
2. Formato do arquivo CSV
3. Conexão com internet (para CDNs)

## 📝 Licença

Este projeto está sob a licença especificada no arquivo LICENSE.

---

**© 2025 Sistema de Gestão de Alunos - Projeto Jovem Aprendiz**
