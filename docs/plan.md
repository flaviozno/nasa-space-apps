# Plano do hackathon — Astronaut Health Hub

**Prazo:** 1,5 dia. **Entrega:** pitch escrito + vídeo de 30 s.
**Equipe:** Flávio, Guilherme, Miguel, Matheus, Wallace.

## 1. O que vamos demonstrar

Um hub de saúde para uma tripulação de 4 astronautas, sem login (o tripulante é escolhido numa lista).

- Dados de wearable (emulador) e de outras fontes chegam a um serviço de bordo.
- O astronauta vê níveis atuais, tendências e desvios em relação à própria linha de base.
- O astronauta responde questionários e registra dados manuais.
- Regras locais geram alertas a bordo.
- Os dados sincronizam com a Terra, que tem um dashboard para o médico de voo.
- Quando o link com a Terra cai, nada para a bordo; ao voltar, a fila é drenada.

**O vídeo de 30 s define o escopo.** Só construímos o que aparece nele ou no pitch:

| Cena | ~Duração | O que precisa funcionar |
| --- | --- | --- |
| 1. Hub do astronauta: métricas e tendências vs. linha de base | 8 s | Ingestão + Crew API + dashboard |
| 2. Astronauta responde o check-in diário | 6 s | Questionários + entrada manual |
| 3. Cenário de febre/hipóxia dispara alerta a bordo | 6 s | Cenário no emulador + regra de alerta |
| 4. Link cai, fila cresce; link volta, Terra recebe | 10 s | Outbox + Earth service + Earth dashboard |

## 2. Decisão de arquitetura: tudo vira `observation`

Para o sistema ser modular, toda fonte de dados (wearable, questionário, entrada manual, integrações futuras) grava no mesmo formato.
O dashboard só lê `observations`, então uma fonte nova é só um adaptador novo.

```text
observation {
  id            uuid
  crewId        "crew-1" .. "crew-4"
  metric        id do catálogo (ex.: "heart_rate", "mood")
  value         number | null      # null = leitura inválida, nunca 0
  unit          string             # do catálogo
  source        "wearable" | "manual" | "questionnaire" | <futuro>
  sourceRef     id original (sampleId, responseId…)
  takenAt       epoch ms
}
```

```mermaid
flowchart LR
    ING["onboard/ingest (Miguel)"] -->|"SyncRequest / ReceiptAck"| SIM["Emulador na Vercel (Flávio)"]
    SIM -->|TelemetryBatch| ING
    WEB["web: Crew Hub (Wallace)"] -->|questionários, manual| CREW["onboard/crew (Matheus)"]
    ING --> OBS[("observations + alerts")]
    CREW --> OBS
    OBS --> CREW
    CREW -->|leitura| WEB
    OBS --> OUT["outbox worker (Guilherme)"]
    OUT -->|link on/off| EARTH["earth (Guilherme)"]
    EARTH --> WEB2["web: Earth view (Wallace)"]
```

### Elementos da arquitetura

O diagrama tem dois lados: **a bordo** e **na Terra**. Tudo o que importa para a saúde do astronauta acontece a bordo, sem depender da Terra. A Terra recebe uma cópia quando o link permite.

#### A bordo

**Emulador na Vercel (Flávio).** Faz o papel do wearable, já que não há dispositivo físico. Gera leituras sintéticas (FC, SpO₂, temperatura etc.) para os 4 astronautas. É determinístico: os mesmos parâmetros geram os mesmos valores. Tem cenários que forçam anomalias para a demo, como febre e hipóxia. É passivo e só responde quando é chamado.

**onboard/ingest (Miguel).** Porta de entrada dos dados do wearable. A cada minuto:

1. envia um `SyncRequest` ao emulador ("me mande as leituras a partir da posição X");
2. recebe o `TelemetryBatch` com o lote de leituras;
3. grava tudo numa única transação e avança o cursor, que marca até onde já recebeu;
4. responde com um `ReceiptAck` ("recebi e gravei").

Quem pede é o bordo, como aconteceria com um wearable real via Bluetooth. O cursor fica no banco de bordo, então nada se perde nem se duplica se uma chamada falhar. Na mesma transação, o ingest converte as leituras em observações, roda as regras de alerta e grava os eventos no outbox.

**onboard/crew (Matheus).** API usada pelo astronauta, com duas funções:

- **Escrita:** recebe questionários (humor, estresse, sintomas, PHQ-4) e medidas manuais (peso, pressão, água) e os grava como observações.
- **Leitura:** entrega ao frontend os valores atuais, as tendências e o desvio de cada métrica em relação à linha de base do astronauta (z-score).

As setas `CREW --> OBS` e `OBS --> CREW` representam isso: ela grava e lê o mesmo banco.

**observations + alerts (banco de bordo, SQLite).** Coração da modularidade. Todo dado, venha de onde vier, vira o mesmo registro: tripulante, métrica, valor, unidade, origem e horário. O dashboard não precisa saber se um valor veio do wearable ou de um formulário; uma fonte nova só precisa de um adaptador que grave observações. Os `alerts` são os resultados das regras, como "SpO₂ abaixo de 90%" ou "FC muito acima da linha de base".

**web: Crew Hub (Wallace).** Tela do astronauta, em React + shadcn. Ele escolhe o próprio nome na lista (sem login), vê seus níveis, gráficos de tendência e alertas, e preenche o check-in diário e as medidas manuais. Fala apenas com a API do Matheus.

#### A ponte

**outbox worker (Guilherme).** Fila de saída para a Terra. Os eventos (leituras e alertas) entram no outbox junto com a gravação, e um loop a cada poucos segundos tenta enviá-los. A chave "link on/off" simula a perda de comunicação:

- **Link desligado:** nada é enviado e a fila cresce, mas tudo a bordo continua funcionando.
- **Link ligado:** a fila é drenada.

Um evento só é marcado como sincronizado depois que a Terra confirma que gravou. Se a confirmação se perder, o worker reenvia, e a Terra ignora a duplicata.

#### Na Terra

**earth (Guilherme).** Serviço da Terra, com banco próprio, separado do de bordo. Recebe os lotes do outbox, descarta duplicatas pelo `eventId`, grava os eventos e devolve o ACK. Também oferece endpoints de leitura para a Earth view.

**web: Earth view (Wallace).** Tela do médico de voo, no mesmo app web, em outra rota. Mostra os dados de toda a tripulação que já chegaram à Terra, os alertas e o estado da sincronização: link ativo ou não, eventos pendentes e horário da última recepção. Na demo, é ela que mostra os dados atrasados chegando quando o link volta.

#### Resumo

| Elemento | Papel | Lado |
| --- | --- | --- |
| Emulador | Finge ser o wearable | Fonte |
| ingest | Busca e grava os dados do wearable, gera alertas | Bordo |
| crew | API do astronauta: questionários, medidas manuais, tendências | Bordo |
| observations + alerts | Banco único com todos os dados | Bordo |
| Crew Hub | Tela do astronauta | Bordo |
| outbox worker | Envia à Terra quando há link | Ponte |
| earth | Recebe, deduplica e guarda | Terra |
| Earth view | Tela do médico de voo | Terra |

O diagrama simplifica um ponto: o outbox recebe os eventos na mesma transação em que o ingest grava as leituras, e não lendo o banco depois. Isso garante que nenhum dado gravado fique sem ser enviado.

## 3. Donos e fronteiras

Cada pessoa é dona de uma pasta. Mudanças na pasta de outra pessoa só com PR revisado pelo dono.

| Pessoa | Frente | Pasta | Entregas |
| --- | --- | --- | --- |
| Flávio | Emulador de wearable | `simulator/` | 4 dispositivos (1 por tripulante); métricas do catálogo; cenários `NORMAL`, `FEVER`, `HYPOXIA`, `POOR_SLEEP` trocáveis por config |
| Miguel | Ingestão de bordo | `onboard/app/ingest/` | Agendador de bordo que envia `SyncRequest` ao simulador a cada minuto, grava o `TelemetryBatch` com cursor durável e responde com `ReceiptAck` (contrato do Flávio); converte samples em `observations`; regras de alerta (limite absoluto + desvio da linha de base); grava eventos no `outbox` |
| Matheus | Crew API | `onboard/app/crew/`, `onboard/app/observations/` | Modelo `observation` (dono do schema); tripulação e linha de base (seed fixo); endpoints de leitura, tendência e z-score; questionários e entrada manual; `POST /v1/observations` genérico |
| Wallace | Frontend | `web/` | React + Vite + shadcn; rotas `/crew/:id` (hub) e `/earth` (médico de voo); funciona com mock até a API existir |
| Guilherme | Terra, sync e infra | `earth/`, `onboard/app/sync/`, `infra/` | VPS, docker-compose, proxy HTTPS; outbox worker + alternância do link; Earth service (ingestão idempotente + leitura); coordena pitch e vídeo |

Arquivos compartilhados, todos com dono:

| Arquivo | Dono | Regra |
| --- | --- | --- |
| `contracts/metrics.json` (catálogo de métricas) | Matheus | Congelado ao fim da Fase 0; mudanças só por PR avisado no grupo |
| `contracts/crew.json` (4 tripulantes + linha de base fixa) | Matheus | Idem |
| OpenAPI do onboard (gerado pelo FastAPI) | Matheus | Wallace gera os tipos TS a partir dele |
| Contrato de sincronização bordo ↔ simulador (`SyncRequest`, `TelemetryBatch`, `ReceiptAck`) | Flávio | Miguel valida |
| Contrato bordo → Terra | Guilherme | Miguel grava no outbox nesse formato |
| `onboard/app/main.py`, `db.py` (montagem dos routers, conexão) | Guilherme | Criados na Fase 0; depois quase não mudam |
| Migrações SQL | Cada um no próprio arquivo | `001_observations.sql` (Matheus), `002_ingest.sql` (Miguel), `003_sync.sql` (Guilherme) |

## 4. Fluxo de trabalho

### Fase 0 — contratos (primeiras ~2 h, todos juntos)
1. Fechar o catálogo de métricas (subconjunto do doc de linha de base):
   - Wearable: `heart_rate`, `hrv_rmssd`, `spo2`, `resp_rate`, `skin_temp`, `sleep_duration`, `steps/activity`.
   - Manual: `body_mass`, `blood_pressure_sys/dia`, `water_intake`, `grip_strength`.
   - Questionário diário: `mood`, `stress`, `fatigue`, `sleepiness`, sintomas 0–10.
   - Questionário semanal: `phq4`, `team_climate`.
2. Fixar a linha de base dos 4 tripulantes (mediana e dispersão por métrica) em `contracts/crew.json`.
3. Guilherme sobe o esqueleto do repo: `docker-compose` com `onboard`, `earth`, `web`; FastAPI com routers vazios; README atualizado.
4. Matheus publica os modelos Pydantic e endpoints *stub* que devolvem fixtures. O OpenAPI sai automaticamente.
5. Wallace gera tipos (`openapi-typescript`) e mocks (MSW) a partir dele.

**Saída da Fase 0:** todos conseguem trabalhar sem esperar ninguém.

### Fase 1 — construção em paralelo (resto do dia 1)
Cada um na sua pasta, contra mocks e fixtures. PRs pequenos e frequentes na `main`.

**Checkpoint no fim do dia 1 (fatia fina ponta a ponta):** emulador → ingestão → `observations` → Crew API → um gráfico de FC no hub, rodando na VPS.

### Fase 2 — integração (manhã do dia 2)
- Trocar mocks por API real no front.
- Cenário de febre gera alerta, que aparece no hub.
- Outbox → Terra → Earth view; botão de link on/off.

### Fase 3 — congelamento e entrega (últimas ~5 h)
- **Code freeze** 5 h antes do prazo: só correções do que aparece no vídeo.
- Gravar o vídeo seguindo as 4 cenas acima. Gravar cedo, regravar se sobrar tempo.
- Pitch escrito: problema (riscos da NASA HRP) → solução → modularidade → próximos passos.

## 5. Regras da equipe

- Branch por pessoa/tarefa, PR curto, merge na `main` assim que funciona. Nada de branch longa.
- Contrato mudou → PR avisado no grupo antes do merge.
- Cada serviço sobe com `docker compose up`; quem quebrar a `main` conserta primeiro.
- Dados são sempre `SIMULATED`; nenhuma afirmação de validade clínica.

## 6. Diferenças em relação ao `readme.md` atual (atualizar na Fase 0)

- Backend em **Python/FastAPI**, não Node.js (o simulador na Vercel continua em TS).
- **4 dispositivos**, um por tripulante, em vez de 3.
- Frontend **entra** no escopo (hub + Earth view).
- Novo modelo genérico `observations` e endpoints de questionário e entrada manual.
- Fora do escopo, como já estava: BLE, MQTT, Protobuf, DELTA, PostgreSQL, login.
