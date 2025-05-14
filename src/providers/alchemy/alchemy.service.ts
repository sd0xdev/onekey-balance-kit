import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Alchemy, Network } from 'alchemy-sdk';

@Injectable()
export class AlchemyService {
  private ethereumMainnetClient: Alchemy;
  private ethereumTestnetClient: Alchemy;
  private solanaMainnetClient: Alchemy;
  private solanaTestnetClient: Alchemy;
  private readonly logger = new Logger(AlchemyService.name);

  constructor(private readonly configService: ConfigService) {
    this.initializeClients();
  }

  private initializeClients() {
    // 初始化以太坊主網客戶端
    const ethMainnetApiKey =
      this.configService.get<string>('ALCHEMY_API_KEY_ETH_MAINNET') ||
      this.configService.get<string>('ALCHEMY_API_KEY_ETH');
    if (ethMainnetApiKey) {
      this.ethereumMainnetClient = new Alchemy({
        apiKey: ethMainnetApiKey,
        network: Network.ETH_MAINNET,
      });
      this.logger.log('Ethereum mainnet client initialized');
    } else {
      this.logger.warn('Ethereum mainnet API key is not configured');
    }

    // 初始化以太坊測試網客戶端 (Sepolia)
    const ethTestnetApiKey =
      this.configService.get<string>('ALCHEMY_API_KEY_ETH_TESTNET') ||
      this.configService.get<string>('ALCHEMY_API_KEY_ETH');
    if (ethTestnetApiKey) {
      this.ethereumTestnetClient = new Alchemy({
        apiKey: ethTestnetApiKey,
        network: Network.ETH_SEPOLIA,
      });
      this.logger.log('Ethereum testnet client initialized');
    } else {
      this.logger.warn('Ethereum testnet API key is not configured');
    }

    // 初始化 Solana 主網客戶端
    const solMainnetApiKey =
      this.configService.get<string>('ALCHEMY_API_KEY_SOL_MAINNET') ||
      this.configService.get<string>('ALCHEMY_API_KEY_SOL');
    if (solMainnetApiKey) {
      this.solanaMainnetClient = new Alchemy({
        apiKey: solMainnetApiKey,
        network: Network.SOLANA_MAINNET,
      });
      this.logger.log('Solana mainnet client initialized');
    } else {
      this.logger.warn('Solana mainnet API key is not configured');
    }

    // 初始化 Solana 測試網客戶端 (Devnet)
    const solTestnetApiKey =
      this.configService.get<string>('ALCHEMY_API_KEY_SOL_TESTNET') ||
      this.configService.get<string>('ALCHEMY_API_KEY_SOL');
    if (solTestnetApiKey) {
      this.solanaTestnetClient = new Alchemy({
        apiKey: solTestnetApiKey,
        network: Network.SOLANA_DEVNET,
      });
      this.logger.log('Solana testnet client initialized');
    } else {
      this.logger.warn('Solana testnet API key is not configured');
    }
  }

  getEthereumClient(useTestnet = false): Alchemy {
    const isTestMode = useTestnet || this.configService.get<string>('NODE_ENV') === 'development';

    if (isTestMode) {
      if (!this.ethereumTestnetClient) {
        this.logger.warn('Ethereum testnet client not initialized, falling back to mainnet client');
        return this.ethereumMainnetClient;
      }
      return this.ethereumTestnetClient;
    }

    return this.ethereumMainnetClient;
  }

  getSolanaClient(useTestnet = false): Alchemy {
    const isTestMode = useTestnet || this.configService.get<string>('NODE_ENV') === 'development';

    if (isTestMode) {
      if (!this.solanaTestnetClient) {
        this.logger.warn('Solana testnet client not initialized, falling back to mainnet client');
        return this.solanaMainnetClient;
      }
      return this.solanaTestnetClient;
    }

    return this.solanaMainnetClient;
  }
}
