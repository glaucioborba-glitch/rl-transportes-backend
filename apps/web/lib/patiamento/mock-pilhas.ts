import type { PilhasResponse } from "./types";

/** Mock inicial — substituível por integração TOS / pátio v2. */
export const MOCK_PILHAS: PilhasResponse = {
  atualizadoEm: new Date().toISOString(),
  pilhas: [
    {
      id: "pilha-a01",
      codigo: "A-01",
      containers: [
        {
          id: "c1",
          numero: "HLXU1234567",
          tipo: "DRY",
          clienteFinal: "Importadora Sul Ltda",
          posicaoNaPilha: 1,
        },
        {
          id: "c2",
          numero: "MSCU7654321",
          tipo: "DRY",
          clienteFinal: "Comércio Exterior ABC",
          posicaoNaPilha: 2,
        },
        {
          id: "c3",
          numero: "TCLU9988776",
          tipo: "REEFER",
          clienteFinal: "Frigorífico Norte S.A.",
          posicaoNaPilha: 3,
        },
      ],
    },
    {
      id: "pilha-b02",
      codigo: "B-02",
      containers: [
        {
          id: "c4",
          numero: "GESU5544332",
          tipo: "TANK",
          clienteFinal: "Química Brasil",
          posicaoNaPilha: 1,
        },
        {
          id: "c5",
          numero: "CMAU1122334",
          tipo: "DRY",
          clienteFinal: "Logística Express",
          posicaoNaPilha: 2,
        },
      ],
    },
    {
      id: "pilha-c03",
      codigo: "C-03",
      containers: [
        {
          id: "c6",
          numero: "OOLU4455667",
          tipo: "REEFER",
          clienteFinal: "Agro Export ME",
          posicaoNaPilha: 1,
        },
      ],
    },
  ],
};
