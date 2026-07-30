import { Module } from '@nestjs/common';
import { AddressModule } from '../common/address/address.module';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { ClientesModule } from '../clientes/clientes.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PricingSyncModule } from '../pricing-sync/pricing-sync.module';
import { CadastrosClientesController } from './cadastros-clientes.controller';
import { CadastrosClientesService } from './cadastros-clientes.service';
import { CadastrosColaboradoresController } from './cadastros-colaboradores.controller';
import { CadastrosColaboradoresService } from './cadastros-colaboradores.service';
import { AniversariosService } from './aniversarios.service';
import { CadastrosContainerCacheController } from './cadastros-container-cache.controller';
import { CadastrosContainerCacheService } from './cadastros-container-cache.service';
import { CadastrosEquipamentosController } from './cadastros-equipamentos.controller';
import { CadastrosEquipamentosService } from './cadastros-equipamentos.service';
import { CadastrosMotoristasController } from './cadastros-motoristas.controller';
import { CadastrosMotoristasService } from './cadastros-motoristas.service';
import { CadastrosCapacidadesContainerController } from './cadastros-capacidades-container.controller';
import { CadastrosCapacidadesContainerService } from './cadastros-capacidades-container.service';
import { CadastrosTiposContainerController } from './cadastros-tipos-container.controller';
import { CadastrosTiposContainerService } from './cadastros-tipos-container.service';
import { CadastrosPosicoesPatioController } from './cadastros-posicoes-patio.controller';
import { CadastrosPosicoesPatioService } from './cadastros-posicoes-patio.service';
import { CadastrosTiposOperacaoController } from './cadastros-tipos-operacao.controller';
import { CadastrosTiposOperacaoService } from './cadastros-tipos-operacao.service';
import {
  CadastrosMotivosRejeicaoController,
  CadastrosTurnosController,
} from './cadastros-turnos-motivos.controller';
import {
  CadastrosMotivosRejeicaoService,
  CadastrosTurnosService,
} from './cadastros-turnos-motivos.service';
import { CadastrosTransportadorasController } from './cadastros-transportadoras.controller';
import { CadastrosTransportadorasService } from './cadastros-transportadoras.service';
import { CadastrosBancosController } from './cadastros-bancos.controller';
import { CadastrosBancosService } from './cadastros-bancos.service';
import { CadastrosCentrosCustoController } from './cadastros-centros-custo.controller';
import { CadastrosCentrosCustoService } from './cadastros-centros-custo.service';
import { CadastrosPlanoContasController } from './cadastros-plano-contas.controller';
import { CadastrosPlanoContasService } from './cadastros-plano-contas.service';
import { CadastrosTabelasPrecosController } from './cadastros-tabelas-precos.controller';
import { CadastrosTabelasPrecosService } from './cadastros-tabelas-precos.service';
import { OperacionalVinculoController } from './operacional-vinculo.controller';
import { OperacionalVinculoService } from './operacional-vinculo.service';

@Module({
  imports: [ClientesModule, AuditoriaModule, AddressModule, PrismaModule, PricingSyncModule],
  controllers: [
    CadastrosClientesController,
    CadastrosColaboradoresController,
    CadastrosTransportadorasController,
    CadastrosMotoristasController,
    CadastrosTiposContainerController,
    CadastrosCapacidadesContainerController,
    CadastrosContainerCacheController,
    CadastrosEquipamentosController,
    CadastrosPosicoesPatioController,
    CadastrosTiposOperacaoController,
    CadastrosTurnosController,
    CadastrosMotivosRejeicaoController,
    CadastrosBancosController,
    CadastrosCentrosCustoController,
    CadastrosPlanoContasController,
    CadastrosTabelasPrecosController,
    OperacionalVinculoController,
  ],
  providers: [
    CadastrosClientesService,
    CadastrosColaboradoresService,
    AniversariosService,
    CadastrosTransportadorasService,
    CadastrosMotoristasService,
    CadastrosTiposContainerService,
    CadastrosCapacidadesContainerService,
    CadastrosContainerCacheService,
    CadastrosEquipamentosService,
    CadastrosPosicoesPatioService,
    CadastrosTiposOperacaoService,
    CadastrosTurnosService,
    CadastrosMotivosRejeicaoService,
    CadastrosBancosService,
    CadastrosCentrosCustoService,
    CadastrosPlanoContasService,
    CadastrosTabelasPrecosService,
    OperacionalVinculoService,
  ],
  exports: [CadastrosContainerCacheService],
})
export class CadastrosModule {}
