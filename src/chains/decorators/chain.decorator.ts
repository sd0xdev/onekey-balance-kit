import { SetMetadata } from '@nestjs/common';
import { CHAIN_METADATA } from '../constants/index';

export const Chain = (chainName: string): ClassDecorator => {
  return SetMetadata(CHAIN_METADATA, chainName);
};
