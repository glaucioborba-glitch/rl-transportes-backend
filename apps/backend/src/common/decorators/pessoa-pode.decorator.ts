import { SetMetadata } from '@nestjs/common';
import type { PessoaPermissaoKey } from '../../pessoas-permissoes/pessoa-permissoes.types';

export const PESSOA_PODE_KEY = 'pessoa_pode';

/** Exige permissão RBAC da pessoa autorizada selecionada (portal cliente). Staff ignora. */
export const PessoaPode = (...permissoes: PessoaPermissaoKey[]) =>
  SetMetadata(PESSOA_PODE_KEY, permissoes);
