import { Module } from '@nestjs/common';
import { AddressModule } from '../common/address/address.module';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { ClientesModule } from '../clientes/clientes.module';
import { PrismaModule } from '../prisma/prisma.module';
import { CadastrosClientesController } from './cadastros-clientes.controller';
import { CadastrosClientesService } from './cadastros-clientes.service';
import { CadastrosColaboradoresController } from './cadastros-colaboradores.controller';
import { CadastrosColaboradoresService } from './cadastros-colaboradores.service';
import { CadastrosContainerCacheController } from './cadastros-container-cache.controller';
import { CadastrosContainerCacheService } from './cadastros-container-cache.service';
import { CadastrosEquipamentosController } from './cadastros-equipamentos.controller';
import { CadastrosEquipamentosService } from './cadastros-equipamentos.service';
import { CadastrosMotoristasController } from './cadastros-motoristas.controller';
import { CadastrosMotoristasService } from './cadastros-motoristas.service';
import { CadastrosTiposContainerController } from './cadastros-tipos-container.controller';
import { CadastrosTiposContainerService } from './cadastros-tipos-container.service';
import { CadastrosTransportadorasController } from './cadastros-transportadoras.controller';
import { CadastrosTransportadorasService } from './cadastros-transportadoras.service';
import { OperacionalVinculoController } from './operacional-vinculo.controller';
import { OperacionalVinculoService } from './operacional-vinculo.service';

@Module({
  imports: [ClientesModule, AuditoriaModule, AddressModule, PrismaModule],
  controllers: [
    CadastrosClientesController,
    CadastrosColaboradoresController,
    CadastrosTransportadorasController,
    CadastrosMotoristasController,
    CadastrosTiposContainerController,
    CadastrosContainerCacheController,
    CadastrosEquipamentosController,
    OperacionalVinculoController,
  ],
  providers: [
    CadastrosClientesService,
    CadastrosColaboradoresService,
    CadastrosTransportadorasService,
    CadastrosMotoristasService,
    CadastrosTiposContainerService,
    CadastrosContainerCacheService,
    CadastrosEquipamentosService,
    OperacionalVinculoService,
  ],
  exports: [CadastrosContainerCacheService],
})
export class CadastrosModule {}
