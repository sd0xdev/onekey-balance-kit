import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Alchemy, Network, WebhookType } from 'alchemy-sdk';
import { lastValueFrom } from 'rxjs';
import { ChainName } from '../chains/constants';
import { AppConfigService } from '../config/config.service';
import { ConfigKey } from '../config/constants';

/**
 * Alchemy webhook 回應介面
 */
interface AlchemyWebhookResponse {
  id: string;
  name: string;
  network: string;
  webhook_type: string;
  webhook_url: string;
  is_active: boolean;
  time_created: number;
  signing_key: string;
  version: string;
  deactivation_reason: string;
  addresses?: string[];
}

/**
 * 快取的 signing key 信息
 */
interface SigningKeyCache {
  key: string;
  expiresAt: number; // 快取過期時間（毫秒）
}

/**
 * Alchemy Webhook 管理服務
 * 負責管理 Alchemy webhook，包括創建、更新和維護監控地址
 */
@Injectable()
export class WebhookManagementService {
  private readonly logger = new Logger(WebhookManagementService.name);
  private readonly webhookIdMap: Map<string, string> = new Map(); // 使用 network 作為 key，儲存 webhook ID
  private readonly alchemyApiUrl = 'https://dashboard.alchemy.com/api';
  private readonly alchemyToken: string;
  private readonly alchemyApiKey: string;
  private readonly alchemySDKClients: Map<ChainName, Alchemy> = new Map();
  private readonly webhookUrl: string;

  // signing_key 快取，使用 URL 或 URL+鏈 作為 key
  private readonly signingKeyCache: Map<string, SigningKeyCache> = new Map();
  // 地址到 webhook 的映射，方便根據地址快速查找相關 webhook
  private readonly addressToWebhook: Map<string, Set<string>> = new Map();
  // 快取過期時間（30分鐘）
  private readonly cacheTTL = 30 * 60 * 1000;

  constructor(
    private readonly configService: AppConfigService,
    private readonly httpService: HttpService,
  ) {
    // 從 blockchain 配置獲取 alchemyToken
    this.alchemyToken = this.configService.blockchain?.alchemyToken || '';
    this.alchemyApiKey = this.configService.blockchain?.alchemyApiKey || '';

    // 從 webhook 配置獲取 url
    this.webhookUrl = this.configService.webhook?.url || '';

    if (!this.alchemyToken) {
      this.logger.warn('Alchemy token is not configured! Webhook management will not function.');
    } else if (!this.alchemyApiKey) {
      this.logger.warn('Alchemy API key is not configured! Webhook management will not function.');
    } else {
      // 初始化 Alchemy SDK 客戶端
      this.initAlchemySDKClients();
    }
  }

  /**
   * 初始化 Alchemy SDK 客戶端
   * 為每個支援的鏈創建一個 SDK 實例
   */
  private initAlchemySDKClients(): void {
    try {
      // 獲取所有支援的鏈
      const supportedChains = [
        ChainName.ETHEREUM,
        ChainName.ETHEREUM_GOERLI,
        ChainName.ETHEREUM_SEPOLIA,
        ChainName.POLYGON,
        ChainName.POLYGON_MUMBAI,
        ChainName.BSC,
        ChainName.BSC_TESTNET,
        ChainName.SOLANA,
        ChainName.SOLANA_DEVNET,
      ];

      for (const chain of supportedChains) {
        // 獲取對應的 Alchemy 網絡
        const network = this.getAlchemyNetworkForChain(chain);
        if (!network) {
          this.logger.warn(`無法為 ${chain} 建立 Alchemy SDK 客戶端: 不支援的網絡`);
          continue;
        }

        // 創建 Alchemy SDK 客戶端
        const alchemyClient = new Alchemy({
          apiKey: this.alchemyApiKey,
          authToken: this.alchemyToken,
          network,
        });

        // 儲存客戶端
        this.alchemySDKClients.set(chain, alchemyClient);
        this.logger.debug(`成功為 ${chain} 建立 Alchemy SDK 客戶端`);
      }

      this.logger.log(`已初始化 ${this.alchemySDKClients.size} 個 Alchemy SDK 客戶端`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `初始化 Alchemy SDK 客戶端時發生錯誤: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  /**
   * 獲取 Alchemy SDK 網絡
   * @param chain 區塊鏈名稱
   * @returns Alchemy 網絡
   */
  private getAlchemyNetworkForChain(chain: ChainName): Network | null {
    const networkMapping: Partial<Record<ChainName, Network>> = {
      [ChainName.ETHEREUM]: Network.ETH_MAINNET,
      [ChainName.ETHEREUM_GOERLI]: Network.ETH_GOERLI,
      [ChainName.ETHEREUM_SEPOLIA]: Network.ETH_SEPOLIA,
      [ChainName.POLYGON]: Network.MATIC_MAINNET,
      [ChainName.POLYGON_MUMBAI]: Network.MATIC_MUMBAI,
      [ChainName.BSC]: Network.BNB_MAINNET,
      [ChainName.BSC_TESTNET]: Network.BNB_TESTNET,
      [ChainName.SOLANA]: Network.SOLANA_MAINNET,
      [ChainName.SOLANA_DEVNET]: Network.SOLANA_DEVNET,
    };

    return networkMapping[chain] || null;
  }

  /**
   * 更新 webhook 監控地址
   * @param chain 區塊鏈名稱
   * @param addressesToAdd 要添加的地址列表
   * @param addressesToRemove 要移除的地址列表
   * @returns 是否更新成功
   */
  async updateWebhookAddresses(
    chain: ChainName,
    addressesToAdd: string[] = [],
    addressesToRemove: string[] = [],
  ): Promise<boolean> {
    try {
      if (!this.alchemyToken) {
        this.logger.error('Cannot update webhook addresses: Alchemy token is not configured');
        return false;
      }

      // 獲取該鏈的 webhook ID
      const webhookId = await this.getWebhookIdForChain(chain);
      if (!webhookId) {
        this.logger.error(`No webhook found for chain: ${chain}`);
        return false;
      }

      const client = this.alchemySDKClients.get(chain);
      if (!client) {
        this.logger.error(`No Alchemy SDK client for chain: ${chain}`);
        return false;
      }

      // 使用 Alchemy SDK 的 notify API 更新 webhook 地址
      await client.notify.updateWebhook(webhookId, {
        addAddresses: addressesToAdd,
        removeAddresses: addressesToRemove,
      });

      // 更新地址到 webhook 的映射
      for (const address of addressesToAdd) {
        if (!this.addressToWebhook.has(address)) {
          this.addressToWebhook.set(address, new Set());
        }
        this.addressToWebhook.get(address)?.add(webhookId);
      }

      // 從映射中移除不再監控的地址
      for (const address of addressesToRemove) {
        const webhooks = this.addressToWebhook.get(address);
        if (webhooks) {
          webhooks.delete(webhookId);
          if (webhooks.size === 0) {
            this.addressToWebhook.delete(address);
          }
        }
      }

      this.logger.debug(
        `成功更新 ${chain} 的 webhook 地址。添加: ${addressesToAdd.length} 個，移除: ${addressesToRemove.length} 個`,
      );
      return true;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `更新 webhook 地址時發生錯誤: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );
      return false;
    }
  }

  /**
   * 獲取指定鏈的 webhook ID
   * 如果不存在則創建新的 webhook
   * @param chain 區塊鏈名稱
   * @returns webhook ID
   */
  private async getWebhookIdForChain(chain: ChainName): Promise<string | null> {
    try {
      // 檢查緩存中是否已存在
      const cachedId = this.webhookIdMap.get(chain);
      if (cachedId) {
        return cachedId;
      }

      // 獲取當前所有 webhook
      const webhooks = await this.getExistingWebhooks();
      if (!webhooks || webhooks.length === 0) {
        // 如果沒有找到 webhooks，創建一個新的
        const networkId = this.getNetworkIdForChain(chain);
        return await this.createNewWebhook(chain, networkId);
      }

      // 地址活動 webhook 的網絡名稱
      const networkId = this.getNetworkIdForChain(chain);

      // 尋找匹配的 webhook
      for (const webhook of webhooks) {
        if (
          webhook.network === networkId &&
          webhook.webhook_type === 'ADDRESS_ACTIVITY' &&
          webhook.is_active &&
          webhook.webhook_url === this.webhookUrl // 確保 webhook URL 匹配當前環境
        ) {
          // 儲存到緩存
          this.webhookIdMap.set(chain, webhook.id);
          return webhook.id;
        }
      }

      // 如果沒有找到匹配的 webhook，創建一個新的
      return await this.createNewWebhook(chain, networkId);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `獲取 ${chain} 的 webhook ID 時發生錯誤: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );
      return null;
    }
  }

  /**
   * 獲取當前所有 webhook
   * @returns webhook 列表
   */
  private async getExistingWebhooks(): Promise<AlchemyWebhookResponse[] | null> {
    try {
      if (!this.alchemyToken) {
        return null;
      }

      // Alchemy SDK 目前不提供列出 webhooks 的直接 API
      // 使用 HTTP API 獲取 webhook 列表
      const response = await lastValueFrom(
        this.httpService.get(`${this.alchemyApiUrl}/team-webhooks`, {
          headers: {
            'X-Alchemy-Token': this.alchemyToken,
          },
        }),
      );

      if (response.status === 200 && Array.isArray(response.data?.data)) {
        return response.data.data;
      }

      this.logger.warn(`無法透過 HTTP API 獲取 webhook 列表: ${response.status}`);
      return [];
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `獲取現有 webhooks 時發生錯誤: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );
      return null;
    }
  }

  /**
   * 通過 webhook URL 和地址獲取對應的 signing_key
   * @param webhookUrl webhook URL
   * @param address 合約或錢包地址（可選）
   * @param chain 區塊鏈名稱（可選）
   * @param forceRefresh 是否強制刷新快取
   * @returns signing_key 或 null (如果找不到對應的 webhook)
   */
  public async getSigningKeyByUrl(webhookUrl: string, chain: ChainName): Promise<string | null> {
    try {
      // 從 API 獲取最新的 webhook 列表
      const webhooks = await this.getExistingWebhooks();
      if (!webhooks || webhooks.length === 0) {
        this.logger.warn(`無法找到任何 webhook`);
        return null;
      }

      const networkId = this.getNetworkIdForChain(chain);
      // 如果沒有指定鏈或未找到匹配特定鏈的 webhook，查找匹配 URL 的 webhook
      const webhook = webhooks.find(
        (wh) => wh.webhook_url === webhookUrl && wh.network === networkId && wh.is_active,
      );

      if (!webhook) {
        this.logger.warn(`找不到與 URL ${webhookUrl} 匹配的 webhook`);
        return null;
      }

      return webhook.signing_key;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `通過 URL${chain ? '、鏈' : ''} 獲取 signing_key 時發生錯誤: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );
      return null;
    }
  }

  /**
   * 清除 signing_key 快取
   * @param url 特定 webhook URL，如果不提供則清除所有快取
   * @param chain 特定鏈，如果提供，則只清除此鏈相關的快取
   */
  public clearSigningKeyCache(url?: string, chain?: ChainName): void {
    if (url && chain) {
      // 清除特定 URL 和鏈的快取
      const cacheKey = `${url}:${chain}`;
      this.signingKeyCache.delete(cacheKey);
      this.logger.debug(`已清除 URL ${url} 和鏈 ${chain} 的 signing_key 快取`);
    } else if (url) {
      // 清除特定 URL 的所有快取
      for (const key of this.signingKeyCache.keys()) {
        if (key === url || key.startsWith(`${url}:`)) {
          this.signingKeyCache.delete(key);
        }
      }
      this.logger.debug(`已清除 URL ${url} 的所有 signing_key 快取`);
    } else if (chain) {
      // 清除特定鏈的所有快取
      for (const key of this.signingKeyCache.keys()) {
        if (key.includes(`:${chain}`)) {
          this.signingKeyCache.delete(key);
        }
      }
      this.logger.debug(`已清除鏈 ${chain} 的所有 signing_key 快取`);
    } else {
      // 清除所有快取
      this.signingKeyCache.clear();
      this.addressToWebhook.clear(); // 這個可能還會被其他地方使用，所以保留清除邏輯
      this.logger.debug(`已清除所有 signing_key 快取`);
    }
  }

  /**
   * 為指定鏈創建新的 webhook
   * @param chain 區塊鏈名稱
   * @param networkId 網絡 ID
   * @returns 新創建的 webhook ID
   */
  private async createNewWebhook(chain: ChainName, networkId: string): Promise<string | null> {
    try {
      if (!this.alchemyApiKey) {
        return null;
      }

      // 使用已保存的 webhookUrl
      if (!this.webhookUrl) {
        this.logger.error('Webhook URL is not configured in the application');
        return null;
      }

      const client = this.alchemySDKClients.get(chain);
      if (!client) {
        this.logger.error(`No Alchemy SDK client for chain: ${chain}`);
        return null;
      }

      const result = await client.notify.createWebhook(
        this.webhookUrl,
        WebhookType.ADDRESS_ACTIVITY,
        {
          addresses: ['0x710a850ff60aa2f8e9e27ef1e7edef17a2e682d2'], // 初始地址必須 > 0 個
          network: Network[chain],
        },
      );

      if (result && result.id) {
        const newWebhookId = result.id;
        // 儲存到緩存
        this.webhookIdMap.set(chain, newWebhookId);
        this.logger.debug(`為 ${chain} 創建了新的 webhook，ID: ${newWebhookId}`);
        return newWebhookId;
      }

      this.logger.error(`創建 webhook 失敗: 沒有返回有效的 ID`);
      return null;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `為 ${chain} 創建 webhook 時發生錯誤: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );
      return null;
    }
  }

  /**
   * 根據鏈名獲取 Alchemy 網絡 ID
   * @param chain 區塊鏈名稱
   * @returns Alchemy 網絡 ID
   */
  private getNetworkIdForChain(chain: ChainName): string {
    // 這裡需要根據實際情況映射鏈名到 Alchemy 網絡 ID
    switch (chain) {
      case ChainName.ETHEREUM:
        return 'ETH_MAINNET';
      case ChainName.ETHEREUM_GOERLI:
        return 'ETH_GOERLI';
      case ChainName.ETHEREUM_SEPOLIA:
        return 'ETH_SEPOLIA';
      case ChainName.POLYGON:
        return 'MATIC_MAINNET';
      case ChainName.POLYGON_MUMBAI:
        return 'MATIC_MUMBAI';
      case ChainName.BSC:
        return 'BNB_MAINNET';
      case ChainName.BSC_TESTNET:
        return 'BNB_TESTNET';
      case ChainName.SOLANA:
        return 'SOLANA_MAINNET';
      case ChainName.SOLANA_DEVNET:
        return 'SOLANA_DEVNET';
      default:
        this.logger.warn(`未知的鏈: ${chain}，預設使用 ETH_MAINNET`);
        return 'ETH_MAINNET';
    }
  }
}
