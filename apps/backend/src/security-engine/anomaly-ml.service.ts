import { Injectable } from '@nestjs/common';

/** Placeholder para clusterização — pontuação simples por distância ao centróide fictício. */
@Injectable()
export class AnomalyMlService {
  scoreFromFeatures(_feat: Record<string, number>): number {
    return 0;
  }
}
