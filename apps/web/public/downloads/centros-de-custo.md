# Centros de Custo — Cadastros Financeiro

**Tela:** Cadastros → Financeiro → Centros de Custo  
**URL:** http://localhost:3000/cadastros/financeiro/centros-custo  
**Data:** 21/09/2026

Este texto descreve o menu **como o sistema está hoje**: o que já funciona, onde o cadastro já é usado, e o que ainda não está ligado.

---

## 1. Para que serve

Centro de custo é o **endereço interno do gasto** (e, no futuro, de parte da receita operacional). Não é conta bancária e não é plano de contas.

| Cadastro | Pergunta que responde |
|---|---|
| Bancos | O dinheiro entra/sai por onde? |
| Plano de contas | Que tipo de receita/despesa é (ex.: armazenagem, folha)? |
| **Centros de custo** | **De qual área da operação veio esse custo?** Gate, pátio, financeiro, RH… |

Exemplo: o salário de um operador de empilhadeira e a própria empilhadeira podem ir para `CC-PATIO`. A folha de um analista financeiro vai para `CC-FIN`. Assim dá para ver **quanto cada área custa**, não só o total da empresa.

É um cadastro **MDM** (lista mestra). A tela em si não lança despesa e não emite fatura.

---

## 2. Como o menu funciona

A lista não é uma tabela plana: é uma **árvore**. Quem tem filhos (sintético) abre com a seta.

No topo da tela aparecem quatro totais:

- **Centros** — quantidade cadastrada
- **Colaboradores** — pessoas com aquele código no cadastro de RH
- **Equipamentos** — máquinas com o mesmo código no cadastro de equipamentos
- **Ativos** — quantos estão marcados como ativos

Cada linha mostra código, nome, tipo (Sintético / Analítico) e, se houver, ícone de pessoas e de equipamentos.

Quem tem permissão de **criar** vê o botão **Novo Centro**. Quem tem permissão de **editar** vê o lápis. No perfil **GERENTE**, o bloco Financeiro é só consulta: dá para ver a árvore, sem cadastrar nem editar. **ADMIN** (e o dono via Super Admin) cadastra e altera.

Não há exclusão nesta tela. Desmarcar “Centro ativo” no formulário, no código de hoje, tira o registro da lista (o sistema marca exclusão lógica). Evite desativar só para “esconder temporariamente” se ainda precisar ver o código.

---

## 3. Os dois tipos (o mais importante)

| Tipo | Função | Recebe pessoa / máquina / lançamento? |
|---|---|---|
| **Sintético** | Pasta. Só agrupa os filhos. | Não. É agrupador. |
| **Analítico** | Folha da árvore. É o centro “de verdade”. | Sim. É o que se escolhe no colaborador. |

Regra do sistema: o **pai só pode ser sintético**. Um analítico não pode ter filhos.

Árvore de exemplo já vinda no ambiente de teste:

```
CC              Centros de Custo          (sintético — raiz)
├── CC-OP       Operacional               (sintético)
│   ├── CC-GATE Gate CPO                  (analítico)
│   └── CC-PATIO Pátio / Movimentação     (analítico)
└── CC-ADM      Administrativo            (sintético)
    ├── CC-FIN  Financeiro                (analítico)
    └── CC-RH   Recursos Humanos          (analítico)
```

Monte sempre de cima para baixo: primeiro a pasta (sintético), depois as folhas (analítico).

---

## 4. Como cadastrar

1. Abra **Cadastros → Financeiro → Centros de Custo**.
2. Clique em **Novo Centro**.
3. Preencha:

   - **Código** (obrigatório) — vira maiúsculo sozinho. Único. Ex.: `CC-GATE`, `CC-TI`.
   - **Nome** (obrigatório) — ex.: `Gate CPO`.
   - **Tipo** — Analítico (recebe lançamentos) ou Sintético (agrupa filhos).
   - **Centro pai** — opcional. Só lista sintéticos. Sem pai = fica na raiz.
   - **Descrição** — opcional.
   - **Centro ativo** — deixa marcado no uso normal.

4. Salve. A árvore volta com o item no lugar certo (abaixo do pai, se houver).

Para alterar: lápis na linha → muda o que precisar → **Atualizar Centro**.

**Não** use um analítico como pai. **Não** escolha o próprio centro como pai.

---

## 5. Onde já é usado hoje

### 5.1 Colaboradores (já ligado na lista)

**Cadastros → Pessoas → Colaboradores**, bloco **Dados Financeiros**.

O campo **Centro de Custo** é uma lista que vem deste cadastro. Só entram centros **ativos e analíticos** (as folhas). Ao salvar, o sistema grava o código e o nome na ficha da pessoa.

A lista de centros de custo mostra, em cada linha, quantos colaboradores estão naquele código.

Uso prático: cada colaborador CLT/operacional deve apontar para o **analítico** da área em que trabalha (`CC-GATE`, `CC-PATIO`, `CC-FIN`…), não para a pasta `CC-OP`.

### 5.2 Equipamentos (campo solto, pelo código)

**Cadastros → Operacional → Equipamentos**, campo **Centro de Custo**.

Aqui ainda é **texto livre** (não é o mesmo dropdown do colaborador). O vínculo com o menu de centros de custo é pelo **código digitado**. Se escrever `CC-OP`, a linha `CC-OP` na árvore conta essa máquina.

Uso prático: copie o código exatamente como está na árvore (`CC-PATIO`, não “Pátio”). O seed de teste coloca as empilhadeiras em `CC-OP`.

### 5.3 O que a própria tela mostra

Os cards **Colaboradores** e **Equipamentos** no topo existem só para conferir se o cadastro está sendo usado. Não geram relatório contábil.

---

## 6. Onde ainda não entra (e para onde vai)

O catálogo existe para ser a **fonte única**. Vários módulos ainda não lêem esta tabela.

| Onde | Situação hoje |
|---|---|
| **Plano de contas** | Cadastro irmão, separado. Não há vínculo conta × centro. |
| **Fatura / NFS-e / boleto / PIX** | Cobra o cliente. Não rateia receita por centro de custo. |
| **Tesouraria / contas a pagar** | Não escolhe centro de custo na baixa. |
| **Folha / RH** | Há menção a “centro de custo por turno” na folha, ainda em memória, **sem** usar este MDM. |
| **Tipos de operação** | Tinha campo de centro padrão; o menu foi retirado. Não usar por aí. |
| **DRE / BI por área** | Ainda não há relatório “custo do Gate vs. pátio” em cima desta árvore. |

**Uso futuro natural** (quando for a hora de implementar, não está na tela hoje):

1. **Folha** — cada colaborador já tem centro; a folha precisa somar salário/encargos **por código analítico**.
2. **Manutenção / combustível / hora de máquina** — o equipamento já tem código; a despesa da oficina deveria cair no mesmo centro.
3. **Contas a pagar** — rateio de aluguel, energia, EPI, terceiros por centro analítico.
4. **Receita operacional** — handling/estadia poderiam, no futuro, apontar para `CC-GATE` / `CC-PATIO` para confrontar custo × receita da área.
5. **Equipamentos** — o campo texto deveria virar a **mesma lista** do colaborador (só analítico ativo), para não digitarem código errado.

Até isso existir, o menu continua válido: é o **mapa da empresa**. Quanto mais cedo a árvore estiver certa, menos retrabalho depois.

---

## 7. Como usar no dia a dia (roteiro)

1. **Não invente código na hora do colaborador.** Primeiro cadastre o centro analítico nesta tela, depois escolha na ficha da pessoa.
2. **Só lance em analítico.** Sintético (`CC`, `CC-OP`, `CC-ADM`) é pasta de relatório, não “setor” da pessoa.
3. **Espelhe a operação real**, se quiser ir além do seed:
   - Gate / Portaria  
   - Pátio / movimentação  
   - Manutenção de equipamentos (quando existir)  
   - Administrativo, Financeiro, RH, SSMA, TI, Comercial
4. **Um colaborador, um centro** (o que está no cadastro hoje). Quem divide tempo entre Gate e pátio: escolha o principal; rateio por turno ainda não existe neste MDM.
5. **Equipamento:** o mesmo código da área que “paga” a máquina.
6. **Não desative** um centro que ainda tem gente ou máquina ligada — some da lista e o código some da escolha do colaborador.

---

## 8. Permissões (resumo)

| Perfil | Ver a árvore | Criar / editar |
|---|---|---|
| ADMIN / Super Admin na intranet do terminal | Sim | Sim |
| GERENTE | Sim | Não (Financeiro = só leitura) |
| FINANCEIRO (com cadastros habilitado) | Sim | Sim neste bloco |

---

## 9. O que este menu não é

- Não substitui **Plano de contas**.
- Não é **banco** nem conta corrente.
- Não é o **ID de pátio** nem o **ID de aluguel** da caixa.
- Não é o faturamento do cliente (`FAT-…`).
- Não é o app do operador: o mapa de posição de pátio é outro assunto.

É só o **dicionário de áreas de custo** da RL / do terminal, para o restante do sistema (RH já, operação de máquina pelo código, e financeiro/folha quando forem ligados) apontar para o mesmo código.
