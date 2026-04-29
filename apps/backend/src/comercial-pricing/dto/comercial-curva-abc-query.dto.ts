import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { ComercialPeriodQueryDto } from './comercial-period-query.dto';

/** Curva ABC: modo `lucro` (peso no resultado absoluto) ou `margem` (prioriza rentabilidade relativa antes do Pareto). */
export class ComercialCurvaAbcQueryDto extends ComercialPeriodQueryDto {
  @ApiPropertyOptional({
    enum: ['lucro', 'margem'],
    description:
      '`lucro`: ordena por lucro absoluto (default). `margem`: ordena por margem % descendente, depois aplica o mesmo critério cumulativo de contribuição ao lucro.',
  })
  @IsOptional()
  @IsIn(['lucro', 'margem'])
  modo?: 'lucro' | 'margem';
}
