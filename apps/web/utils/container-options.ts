/**
 * @deprecated Preferir catálogo MDM via GET /cliente/portal/catalogo/tipos-container.
 * Mantido só para compatibilidade de imports legados.
 */
export const TAMANHOS_PERMITIDOS = ["20", "40", "45"] as const;

/** @deprecated Preferir catálogo MDM do portal. */
export const TIPOS_CONTAINER_PERMITIDOS = [] as const;

export type TamanhoContainer = (typeof TAMANHOS_PERMITIDOS)[number];
export type TipoContainer = string;
