
---

# 🛒 Carrefour Pro Analytics V10

<p align="center">
  <b>Engine avançada de inteligência de preços e scraping automatizado</b><br>
  Descubra o <i>desconto real</i> escondido nas promoções do Carrefour
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-20.x-green?style=for-the-badge&logo=node.js">
  <img src="https://img.shields.io/badge/Puppeteer-Automation-blue?style=for-the-badge&logo=google-chrome">
  <img src="https://img.shields.io/badge/Status-Production-success?style=for-the-badge">
  <img src="https://img.shields.io/badge/License-Free-lightgrey?style=for-the-badge">
</p>

---

## 📌 Sobre o Projeto

O **Carrefour Pro Analytics** é uma engine de inteligência de preços e extração de dados automatizada. Ele utiliza **Node.js** e **Puppeteer** para varrer o e-commerce do Carrefour, injetando regionalização por CEP e identificando não apenas o preço de prateleira, mas o desconto real escondido em mecânicas complexas como:

* 🏷️ "Leve X Pague Y"
* 🛍️ "Desconto na 2ª Unidade"

---

## 🧠 Como o Robô Funciona

O script opera em **quatro camadas principais**:

### 📍 Regionalização Forçada

O robô injeta uma requisição **POST diretamente na API do Carrefour** para setar o CEP de destino.
Isso garante que os preços e o estoque sejam exatamente os da loja que atende a sua região.

### 🔍 Varredura de Duplo Gatilho

Faz uma busca completa em ordem **alfabética (A-Z)** e **invertida (Z-A)** para burlar a paginação e caçar produtos ocultos.

### 🧮 Engine de Cálculo

Identifica a queda de preço direto e lê **"badges" promocionais** para calcular o desconto efetivo de verdade.

### 📊 Relatório Interativo

Gera um arquivo `.html` autossuficiente com filtros em **JavaScript puro**, perfeito para análise offline.

---

## 🏗️ Arquitetura do Projeto

Este repositório possui **duas versões do motor de extração**, criadas para cenários diferentes:

```
📦 carrefour-pro-analytics
 ┣ 📜 index.js
 ┣ 📜 index_nuvem.js
 ┣ 📂 backup/
 ┗ 📂 .github/workflows/
```

---

### 💻 `index.js` (Robô Local)

* Executa na sua máquina
* Abre o navegador (`headless: false`)
* Permite visualizar a extração ao vivo

✅ Ideal para:

* Testes
* Manutenção
* Execuções manuais

---

### ☁️ `index_nuvem.js` (Robô da Nuvem)

* Executa no **GitHub Actions**
* Modo invisível (`headless: true`)
* User-Agent disfarçado
* Bloqueia imagens e mídias

✅ Otimizado para:

* Performance
* Economia de recursos

---

## 💻 Instalação Rápida (Windows 11)

### 1️⃣ Instalar Node.js

```powershell
winget install OpenJS.NodeJS.LTS
```

Depois reinicie o terminal e verifique:

```powershell
node -v
```

---

### 2️⃣ Configurar o Projeto

```powershell
cd caminho/da/sua/pasta
npm install puppeteer
```

---

## 🚀 Uso Local

1. Abra `index.js`
2. Defina o CEP em `TARGET_CEP`

Execute:

```bash
node index.js
```

📄 Saída:

```
Carrefour_DATA.html
```

---

## ☁️ Automação com GitHub Actions

Arquivo responsável:

```
.github/workflows/manual.yml
```

---

### ⏰ Agendamento (Cron)

```yaml
on:
  schedule:
    - cron: '30 16 * * *'  # 13:30 Brasília
```

#### Sintaxe:

```
Minuto | Hora | Dia do Mês | Mês | Dia da Semana
```

> ⚠️ GitHub usa UTC
> 🇧🇷 Brasília = UTC-3 → somar +3h

---

## 📲 Integração com Telegram

Configure em:

```
Settings → Secrets and variables → Actions
```

Variáveis:

```env
TELEGRAM_TO=seu_chat_id
TELEGRAM_TOKEN=seu_token
```

---

## 📁 Sistema de Backups

### 📌 Raiz

* Mantém apenas o relatório atual

### 🗂️ `/backup`

* Armazena históricos automaticamente
* Organização limpa e contínua

---

## ✨ Diferenciais

* 🔥 Descobre descontos ocultos reais
* ⚡ Alta performance em scraping
* 🧠 Inteligência de cálculo promocional
* 📊 Relatório offline interativo
* ☁️ Execução automatizada na nuvem

---

## 🧪 Possíveis Melhorias Futuras

* Dashboard web em tempo real
* Integração com banco de dados
* Alertas inteligentes de preço
* API pública de consulta

---

## 👨‍💻 Autor

Projeto desenvolvido para uso avançado de análise de preços e automação.

---

## ⭐ Contribuição

Sinta-se livre para:

* Abrir issues
* Sugerir melhorias
* Criar forks

---

## 📜 Licença

Uso livre para fins educacionais e pessoais.

---

Se quiser, posso dar o próximo nível ainda:

* colocar **GIF do robô rodando**
* gerar **logo do projeto**
* adicionar **dark README style + animação**
* criar **landing page do projeto**

Só falar 👍
