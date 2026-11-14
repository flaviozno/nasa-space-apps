# Diretrizes de UI/UX Embarcada para Aplicações de Saúde Espacial (NASA)

Este documento estabelece as especificações de design, fatores humanos e regras de interface para aplicações de monitoramento de saúde e telemetria biomédica para astronautas em missões espaciais, com base nas normas da **NASA-STD-3001** (Space Flight Human-System Standard).

---

## 1. Visão Geral e Contexto de Operação

O ambiente espacial impõe restrições severas ao design de software embarcado. A interface deve ser projetada considerando:

* **Microgravidade:** Flutuação contínua, perda de estabilidade para toques precisos na tela e tremores musculares por esforço de fixação.
* **Fisiologia do Astronauta:** Redistribuição de fluidos corporais em direção à cabeça que pode afetar a acuidade visual (*Síndrome Espacial Associada à Pressão Intracraniana - SANS*).
* **Fadiga e Estresse:** Longos turnos operacionais, privação de sono e sobrecarga cognitiva.
* **Ruído e Iluminação:** Altos níveis de ruído dos sistemas de suporte à vida e variações extremas de luminosidade a cada 90 minutos de órbita.

---

## 2. Prioridades Absolutas de UX

1. **Clareza e Legibilidade Instantânea (*Designed for Scanning*):**
   * Os dados vitais críticos (Frequência Cardíaca, $\text{SpO}_2$, Pressão Arterial) devem ser legíveis em frações de segundo.
   * Hierarquia visual rígida: status crítico em destaque visual superior; métricas secundárias ocultas ou recolhidas.
2. **Resiliência a Falhas de Entrada:**
   * Áreas de clique/toque (*Hit Targets*) expandidas (mínimo de 48px $\times$ 48px).
   * Fluxos de confirmação em dois passos para ações irreversíveis ou críticas.
3. **Redução de Fadiga Cognitiva:**
   * Uso de feedback multissensorial (visual claro + áudio em frequências distintas + feedback háptico).
   * Apresentação limpa de dados sem ruídos decorativos.
4. **Arquitetura Determinística e *Local-First*:**
   * Processamento e renderização 100% locais (*on-device*). A interface não pode depender de rede ou nuvem para monitorar ou alertar o usuário.

---

## 3. Tipografia e Padrões Numéricos

### 3.1 Seleção de Fontes

| Uso | Tipo de Fonte Recomendado | Exemplos de Fontes |
| :--- | :--- | :--- |
| **Rótulos, Menus e Texto Narrativo** | Sans-Serif Limpa de Alta Legibilidade | *Inter*, *Public Sans*, *Helvetica Neue* |
| **Métricas, Leituras e Códigos** | Monospaced (Largura Fixa) | *DM Mono*, *Roboto Mono*, *JetBrains Mono* |

### 3.2 Prevenção de Ambiguidade Visual
* **Glifos Numéricos:** O numeral `0` (zero) deve conter um ponto interno ou risco diagonal cortado para não ser confundido com a letra `O`.
* **Caracteres Ambíguos:** A fonte deve diferenciar claramente `1` (um), `l` (L minúsculo) e `I` (i maiúsculo).
* **Alinhamento Numérico:** Dados numéricos em tabelas e cartões devem utilizar fontes monoespaçadas com alinhamento à direita ou decimal, prevenindo o "balanço" dos elementos ao atualizar dados em tempo real.

---

## 4. Paleta de Cores e Semântica Visual

A cor em interfaces da NASA **é puramente funcional**. A interface deve utilizar um tema escuro (*Dark Mode*) de alto contraste para economizar energia, reduzir a emissão de luz no ambiente espacial e minimizar o ofuscamento visual.

### 4.1 Tabela de Cores Funcionais (Semântica de Alertas)

| Status | Nome / Nível | Hex (Recomendado) | Significado e Ação da UI |
| :--- | :--- | :--- | :--- |
| **Critical / Emergency** | Vermelho Alerta | `#EF4444` | Risco imediato à vida. Alarme visual pulsante + alerta sonoro contínuo. |
| **Warning** | Laranja / Amber | `#F97316` | Anormalidade grave (ex: queda acentuada de $\text{SpO}_2$). Requer intervenção rápida. |
| **Caution** | Amarelo | `#EAB308` | Desvio da faixa ideal (ex: desidratação leve, taxa elevada de esforço). |
| **Advisory** | Azul | `#3B82F6` | Mudança de estado do sistema, notificação informativa ou log de telemetria. |
| **Nominal / OK** | Verde | `#22C55E` | Todos os parâmetros vitais dentro da faixa de normalidade. |
| **Neutro / Fundo** | Preto Absoluto / Azul Escuro | `#020617` / `#000000` | Redução da iluminação e preservação da visão noturna. |

### 4.2 Regra da Dupla Codificação
**Nunca dependa exclusivamente da cor** para indicar status crítico. Cada indicador de alerta deve obrigatoriamente combinar:
1. **Cor de Alerta** (ex: Vermelho `#EF4444`).
2. **Ícone ou Forma Semântica** (ex: Triângulo de advertência $\Delta$).
3. **Rótulo Textual Explícito** (ex: `CRITICAL`).

---

## 5. Diretrizes de Acessibilidade e Ergonomia

* **Razão de Contraste Mínima:** 
  * Texto normal / dados de rotina: Mínimo de **6:1**.
  * Rótulos e valores críticos: Mínimo de **10:1**.
* **Modos de Iluminação Orbitais:**
  * Suporte a ajuste manual e automático de brilho conforme o ciclo dia/noite da órbita.
* **Layout Interativo:**
  * Espaçamento amplo entre botões adjacentes para evitar acionamentos acidentais durante movimentação em microgravidade.