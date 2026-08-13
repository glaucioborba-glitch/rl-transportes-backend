import { Injectable } from '@nestjs/common';

@Injectable()
export class EventCorrelatorService {
  mergeWindows<T extends { createdAt?: Date }>(_events: T[]): T[][] {
    return [];
  }
}
