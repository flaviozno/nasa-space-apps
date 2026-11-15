# Prompt de ação — Mission Readiness Copilot

## Papel e objetivo

Você é a pessoa responsável por evoluir o MVP **Astronaut Health Hub** sem substituir sua arquitetura nem inflar o escopo. Implemente uma camada chamada **Mission Readiness Copilot**: uma avaliação operacional, explicável e local que relaciona a linha de base do astronauta, seu check-in e um contexto ambiental histórico da missão.

O produto não deve parecer um relógio que apenas mostra métricas. A demonstração deve responder: **“diante deste contexto de missão, esta pessoa está pronta para uma tarefa crítica?”**

O resultado esperado é uma recomendação operacional simples e auditável, por exemplo:

> `REVIEW_BEFORE_CRITICAL_TASK` — frequência cardíaca 18% acima da linha de base, fadiga 8/10 e janela histórica de radiação elevada; revisão recomendada antes de uma atividade crítica.

Esta recomendação **não é diagnóstico, prognóstico nem prescrição médica**. Ela organiza uma revisão operacional a bordo e pode ser visualizada pela equipe em Terra após a sincronização.

## Contexto existente que deve ser preservado

- O sistema possui emulador de wearable, serviço de bordo, PostgreSQL de bordo, Outbox, serviço de Terra, PostgreSQL de Terra e frontend React.
- O emulador já usa dados históricos do ISS DosTel/RadLab como referência para o canal de radiação. Esses dados são ambientais e históricos; não representam dose pessoal, nem feed ao vivo da ISS.
- Cada fonte de saúde do tripulante é normalizada como `observation`. Não quebre nem reinterprete os contratos existentes de observações, telemetria, ACK, cursor ou Outbox.
- O processamento, a persistência e os alertas devem continuar funcionando quando o link com a Terra estiver desligado. A Terra recebe uma cópia posterior e idempotente.
- O escopo de produto continua sendo um MVP demonstrável para quatro pessoas fictícias e dados `SIMULATED`.

Antes de alterar qualquer código, leia `AGENTS.md`, `.codex/instructions.md`, `readme.md`, `docs/plan.md`, `docs/telemetry-architecture.md`, `infra/telemetry-mvp.drawio` e os módulos que forem afetados. Valide a documentação contra o código; ela é guia, não fonte de verdade.

## Limites de escopo

### Fazer

1. Adicionar contexto ambiental de missão com proveniência explícita.
2. Criar uma regra local, determinística, versionada e explicável de prontidão operacional.
3. Mostrar a recomendação e sua cadeia de evidências no Crew Hub e na Earth view.
4. Sincronizar a recomendação usando o fluxo de alertas/Outbox já existente, sem quebrar reenvio, deduplicação ou ACK.
5. Atualizar documentação e ambos os diagramas Draw.io em `infra/`.
6. Cobrir o fluxo novo com testes de regra, API/UI quando houver padrões existentes e sincronização idempotente.

### Não fazer

- Não criar diagnóstico, recomendação de tratamento, score clínico, IA generativa, modelo preditivo ou alegação de validação médica.
- Não chamar APIs externas em cada carregamento da tela. O MVP deve usar o snapshot/fallback histórico já adotado pelo emulador ou uma importação delimitada e resiliente.
- Não apresentar radiação histórica como exposição individual, leitura em tempo real ou medição pessoal.
- Não criar MQTT, BLE, filas novas, login, um terceiro banco ou uma nova classe de evento de sincronização se o payload de alerta atual puder transportar a informação.
- Não processar nem inferir dados ômicos do OSDR no MVP. O OSDR pode aparecer como referência/proveniência de pesquisa, não como motor de decisão clínica.

## Desenho de domínio proposto

### 1. Separar contexto de missão de dados pessoais

Não force um dado ambiental compartilhado a virar uma `observation` de um tripulante. Preserve `observation` para dados vinculados à pessoa e adicione um registro de contexto de missão, com nomenclatura compatível com o projeto, como `mission_context_snapshot`.

Campos mínimos sugeridos:

| Campo | Exemplo / regra |
| --- | --- |
| `id` | UUID estável |
| `kind` | `radiation_dose_rate` |
| `value` e `unit` | dose-rate histórico e sua unidade original |
| `observed_at` | instante da janela contextual |
| `source` | `nasa_osdr_radlab` ou `nasa_dostel_snapshot` |
| `source_ref` | identificador de query, linha ou snapshot |
| `provenance_url` | fonte pública consultável |
| `is_historical` | sempre `true` neste MVP |
| `quality` | `reference` / `fallback` / equivalente já usado |

Reutilize a leitura de DosTel que o emulador já obtém. Não duplique requisições externas nem crie uma segunda verdade para o mesmo ponto de radiação. Se o contrato do emulador já entrega valor, tempo e referência suficientes, o ingest de bordo deve derivar e persistir o snapshot contextual a partir dele, de maneira idempotente.

### 2. Criar uma recomendação operacional, não um alerta médico novo

Modele a recomendação como uma especialização dos alertas persistidos, ou como entidade relacionada a um alerta, conforme as abstrações atuais. Ela deve conter:

| Campo | Regra |
| --- | --- |
| `crew_id` | pessoa a quem a decisão se refere |
| `status` | `READY`, `MONITOR` ou `REVIEW_BEFORE_CRITICAL_TASK` |
| `rule_id` e `rule_version` | estáveis e versionados |
| `created_at` | horário de processamento local |
| `evidence` | IDs e valores das observações/contextos que participaram da decisão |
| `message` | frase curta, factual e não clínica |
| `disclaimer` | “Historical environmental reference; not a personal radiation dose or medical diagnosis.” |

Não use um “score” numérico opaco. O estado deve decorrer diretamente da regra e as evidências devem ficar disponíveis ao astronauta e à Terra.

### 3. Regra mínima para a demo

Implemente **uma única regra** configurável, com limiares centralizados e cobertos por teste. Exemplo de comportamento:

```text
IF historical_radiation_window = ELEVATED
AND heart_rate deviation exceeds the astronaut's personal threshold
AND latest fatigue check-in >= 7/10
THEN REVIEW_BEFORE_CRITICAL_TASK
ELSE IF one of these signals is present
THEN MONITOR
ELSE READY
```

Regras importantes:

- O desvio de frequência cardíaca deve reutilizar o cálculo de baseline/z-score existente, em vez de criar uma segunda fórmula.
- O dado de fadiga deve ser o último check-in válido dentro de uma janela explícita e documentada.
- A janela ambiental deve ser explicitamente histórica/de referência.
- Dados ausentes não podem ser tratados como zero nem produzir uma conclusão forte. Sem evidência suficiente, apresente `MONITOR` ou “insufficient context”, conforme o padrão de UX definido.
- A mesma combinação de evidências não pode criar recomendações duplicadas em reprocessamentos, retransmissões ou novas tentativas de sync.

## Experiência do usuário

### Crew Hub

Adicionar ao overview do astronauta um cartão compacto **Mission Readiness** com:

- estado atual (`READY`, `MONITOR` ou `REVIEW BEFORE CRITICAL TASK`);
- horário local da avaliação;
- uma frase operacional curta;
- ação visual “Why am I seeing this?” que revela três evidências no máximo: baseline pessoal, check-in e contexto ambiental;
- rótulo visível `Historical NASA environmental reference — not personal dose` quando houver dado de radiação;
- link/identificador de proveniência, se isso couber sem poluir a tela.

Na linha do tempo, sinalizar a janela contextual e a recomendação; não crie um novo dashboard complexo. A tela precisa ser compreensível em poucos segundos no vídeo.

### Earth view

Exibir recomendações recebidas por ordem de prioridade, junto de:

- tripulante, estado e evidências resumidas;
- quando a decisão foi gerada a bordo;
- quando chegou à Terra e, se aplicável, o atraso causado pelo link;
- dados claramente marcados como históricos/de demonstração.

Ao desligar o link, a recomendação deve continuar disponível no Crew Hub e ficar pendente na Outbox. Ao religar, ela deve aparecer uma vez na Earth view.

## Contratos, persistência e sincronização

1. Faça migrations Alembic somente se um novo armazenamento for realmente necessário; preserve as regras de branches de migration do repositório.
2. Inclua na evidência somente IDs, valores, unidades, horários, regra e proveniência necessários para explicar a decisão. Não copie tabelas inteiras para o evento.
3. Reutilize o evento `ALERT`/payload correspondente para levar a recomendação, adicionando um campo compatível e versionado somente se a validação de contratos exigir. Atualize o contrato compartilhado e seus testes se ele mudar.
4. A transação local que materializa a recomendação deve também enfileirar seu evento no Outbox. Sem commit local, não pode haver evento; sem ACK da Terra, o evento não pode ser marcado como sincronizado.
5. Mantenha a deduplicação por `eventId` e uma chave de idempotência da recomendação baseada em regra, versão e evidências relevantes.

## Atualização obrigatória da documentação

Atualize a documentação em inglês já usada pelo produto, preservando o estilo existente.

### `readme.md`

Atualize, no mínimo:

- **Goal:** caracterizar o produto como suporte de prontidão operacional local, não um monitor de relógio.
- **Wearable emulator / NASA sources:** explicar que o contexto de radiação histórico é referência ambiental, tem proveniência e não é dose pessoal ou dado ao vivo.
- **Onboard processing:** descrever a correlação determinística entre baseline, check-in e contexto ambiental e a criação de recomendação explicável.
- **Outbox / Earth:** indicar que recomendações operacionais usam a mesma entrega durável e idempotente de alertas.
- **Views e demo:** incluir o cartão Mission Readiness, “Why am I seeing this?” e a cena offline → sincronizado.
- **Limitations:** declarar explicitamente que não há diagnóstico, predição clínica ou validação médica.

Inclua um link para este documento ou para a documentação final equivalente, caso ele permaneça como registro de decisão.

### `docs/plan.md` e/ou `docs/telemetry-architecture.md`

Atualize apenas as partes que descrevem a demo e o fluxo de processamento para que não contradigam o README. Diferencie claramente a arquitetura de visão futura da implementação HTTP/PostgreSQL do MVP.

### Diagramas `infra/`

Edite os arquivos Draw.io como XML válido e abra/renderize-os para inspeção visual antes de finalizar.

1. **`infra/telemetry-mvp.drawio` — obrigatório e fiel ao MVP atual**
   - Renomear/expandir o bloco de dados NASA para informar `OSDR RadLab / ISS DosTel historical environmental reference` e que existe fallback/snapshot.
   - No processamento de bordo, mostrar a entrada de `mission context snapshot` e a regra `baseline + fatigue check-in + historical radiation window → operational readiness recommendation`.
   - No banco de bordo, listar `mission-context snapshots` e `operational recommendations` ou o nome adotado na implementação.
   - No Crew Hub, destacar `Mission Readiness` e `Why this recommendation`.
   - No caminho para a Terra e na Earth view, deixar visível que a recomendação segue como alerta priorizado, fica pendente offline e exibe o atraso de entrega após reconexão.
   - Não desenhar a fonte NASA como dado pessoal, em tempo real, nem comunicação direta com o usuário.

2. **`infra/telemetry.drawio` — arquitetura de referência/futuro**
   - Não reescrever a arquitetura MQTT/BLE nem tentar fazê-la parecer o MVP.
   - Ampliar o `Local worker` para mencionar regras explicáveis de prontidão e evidências de contexto de missão.
   - Ampliar os dashboards de bordo e Terra para incluir estado de prontidão, proveniência e motivo da recomendação.
   - Manter os fluxos, prioridades e garantias de entrega existentes; a recomendação deve ser representada como alerta/evento priorizado, não como canal paralelo.

Após editar, valide que textos não se sobrepõem, setas continuam conectadas e o diagrama é legível em 100% de zoom.

## Roteiro de demonstração atualizado (30–40 segundos)

1. Crew Hub: astronauta vê métricas e cartão `READY`/`MONITOR`.
2. Aplicar cenário determinístico: janela histórica de radiação de referência + FC fora da baseline + fadiga 8/10.
3. O cartão muda para `REVIEW BEFORE CRITICAL TASK`; abrir “Why am I seeing this?” e mostrar as três evidências e o aviso de dados históricos.
4. Desligar link com a Terra: a recomendação permanece utilizável a bordo e a Outbox cresce.
5. Religá-lo: Earth view recebe uma recomendação, evidências, horário de criação e atraso de entrega — sem duplicata.

Mensagem de pitch:

> Not another astronaut smartwatch: a local-first mission-readiness system that combines personal baselines, crew input and traceable historical environmental context, even when Earth is out of reach.

## Critérios de aceite

- [ ] Um cenário reproduzível produz `REVIEW_BEFORE_CRITICAL_TASK` somente quando as três condições configuradas estão presentes.
- [ ] Cenários com sinais ausentes ou apenas parciais não produzem falsa certeza nem recomendação duplicada.
- [ ] A UI apresenta estado, motivo, proveniência e o disclaimer de dado histórico sem linguagem diagnóstica.
- [ ] A recomendação existe e pode ser explicada com dados locais quando o link com a Terra está desligado.
- [ ] Ao retornar o link, uma única recomendação é persistida na Terra com seus horários e evidências; repetição do envio não cria duplicata.
- [ ] Testes existentes continuam passando e novos testes cobrem regra, idempotência e o caminho offline → online.
- [ ] `readme.md`, documentação de apoio, `infra/telemetry-mvp.drawio` e `infra/telemetry.drawio` descrevem o mesmo comportamento e preservam a distinção entre dado histórico ambiental e dose pessoal.
- [ ] O escopo final não contém IA generativa, ingestão ômica, alegação de dado ao vivo, diagnóstico ou novo serviço desnecessário.

## Entrega esperada

Entregue alterações pequenas e coesas, uma lista dos arquivos modificados, os comandos de validação executados e qualquer hipótese assumida. Caso a implementação real revele uma divergência com este prompt, preserve a arquitetura e os contratos existentes, documente a divergência e escolha a alternativa mais simples compatível com os critérios de aceite.
