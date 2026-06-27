/** Opções fixas de tamanho — futura parametrização via painel admin. */
export const TAMANHOS_PERMITIDOS = ['20"', '40"'] as const;

/** Opções fixas de tipo de contêiner — futura parametrização via painel admin. */
export const TIPOS_CONTAINER_PERMITIDOS = ["HC", "DC", "Reefer", "Opentop", "Flatrack"] as const;

export type TamanhoContainer = (typeof TAMANHOS_PERMITIDOS)[number];
export type TipoContainer = (typeof TIPOS_CONTAINER_PERMITIDOS)[number];
