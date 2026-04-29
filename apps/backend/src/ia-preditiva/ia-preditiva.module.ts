import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { IaPreditivaMlopsStore } from './ia-preditiva-mlops.store';
import { IaPreditivaController } from './ia-preditiva.controller';
import { IaPreditivaService } from './ia-preditiva.service';
import { IaPreditivaDemandaService } from './services/ia-preditiva-demanda.service';
import { IaPreditivaOcupacaoService } from './services/ia-preditiva-ocupacao.service';
import { IaPreditivaProdutividadeService } from './services/ia-preditiva-produtividade.service';
import { IaPreditivaInadimplenciaService } from './services/ia-preditiva-inadimplencia.service';
import { IaPreditivaAnomaliasService } from './services/ia-preditiva-anomalias.service';

@Module({
  imports: [PrismaModule],
  controllers: [IaPreditivaController],
  providers: [
    IaPreditivaMlopsStore,
    IaPreditivaService,
    IaPreditivaDemandaService,
    IaPreditivaOcupacaoService,
    IaPreditivaProdutividadeService,
    IaPreditivaInadimplenciaService,
    IaPreditivaAnomaliasService,
  ],
})
export class IaPreditivaModule {}
