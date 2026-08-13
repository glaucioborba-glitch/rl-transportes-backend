import { Injectable } from '@nestjs/common';

/** Heurísticas declarativas — podem alimentar `SecurityAlert`. */
@Injectable()
export class RiskRulesService {
  readonly impossibleTravelKm = 300;
  readonly impossibleTravelMin = 20;
}
