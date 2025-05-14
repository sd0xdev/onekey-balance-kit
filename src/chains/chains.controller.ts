import { Controller, Get } from '@nestjs/common';
import { SUPPORTED_CHAINS } from './constants';

@Controller('chains')
export class ChainsController {
  @Get()
  getSupportedChains() {
    return SUPPORTED_CHAINS;
  }
}
