import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Alchemy, Network, WebhookType } from 'alchemy-sdk';
import { lastValueFrom } from 'rxjs';
import { ChainName } from '../chains/constants';
import { AppConfigService } from '../config/config.service';
import { AlchemyNetworkUtils } from './utils/alchemy-network.utils';
import { DEFAULT_MONITORED_ADDRESS } from './constants/webhook.constants';
import { CacheService } from '../core/cache/cache.service';

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
    private readonly cacheService: CacheService,
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
        const network = AlchemyNetworkUtils.getAlchemyNetworkForChain(chain);
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
    return AlchemyNetworkUtils.getAlchemyNetworkForChain(chain);
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
      this.logger.debug(
        `緩存中未找到 ${chain} 的 webhook ID，嘗試從 Alchemy API 獲取現有 webhooks`,
      );

      // 獲取當前所有 webhook
      const webhooks = await this.getExistingWebhooks();
      if (!webhooks) {
        this.logger.warn(`無法獲取現有 webhooks 列表，將嘗試創建新的 webhook`);
        return await this.createNewWebhook(chain);
      }

      if (webhooks.length === 0) {
        this.logger.log(`未發現現有 webhooks，將為 ${chain} 創建新的 webhook`);
        return await this.createNewWebhook(chain);
      }

      this.logger.debug(`獲取到 ${webhooks.length} 個現有 webhooks，尋找匹配 ${chain} 的 webhook`);

      // 地址活動 webhook 的網絡名稱
      const networkId = this.getNetworkIdForChain(chain);

      // 記錄所有 webhook 用於診斷
      for (const webhook of webhooks) {
        this.logger.debug(
          `找到 webhook: ID=${webhook.id}, URL=${webhook.webhook_url}, 網絡=${webhook.network}, 類型=${webhook.webhook_type}, 活躍=${webhook.is_active}`,
        );
      }

      // 尋找匹配的 webhook
      for (const webhook of webhooks) {
        if (
          webhook.network === networkId &&
          webhook.webhook_type === 'ADDRESS_ACTIVITY' &&
          webhook.is_active &&
          webhook.webhook_url === this.webhookUrl // 確保 webhook URL 匹配當前環境
        ) {
          this.logger.log(
            `找到匹配的 webhook: ${webhook.id} 用於鏈 ${chain} (網絡ID: ${networkId})`,
          );
          // 儲存到緩存
          return webhook.id;
        }
      }

      this.logger.log(
        `未找到匹配的 webhook (鏈=${chain}, 網絡ID=${networkId}, URL=${this.webhookUrl})，將創建新的`,
      );

      // 如果沒有找到匹配的 webhook，創建一個新的
      return await this.createNewWebhook(chain);
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
  public async getExistingWebhooks(): Promise<AlchemyWebhookResponse[] | null> {
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
   * @param chain 區塊鏈名稱（可選）
   * @param forceRefresh 是否強制刷新快取
   * @returns signing_key 或 null (如果找不到對應的 webhook)
   */
  public async getSigningKeyByUrl(
    webhookUrl: string,
    chain: ChainName,
    forceRefresh = false,
  ): Promise<string | null> {
    try {
      // 生成緩存鍵，由 URL 和鏈組成
      const cacheKey = `${webhookUrl}:${chain}`;

      // 檢查緩存是否存在且有效，如果不是強制刷新的話
      if (!forceRefresh) {
        const cachedData = this.signingKeyCache.get(cacheKey);
        const now = Date.now();

        if (cachedData && cachedData.expiresAt > now) {
          this.logger.debug(`使用緩存的 signing_key, webhookUrl: ${webhookUrl}, chain: ${chain}`);
          return cachedData.key;
        }
      }

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

      // 緩存找到的 signing_key
      const signingKey = webhook.signing_key;
      if (signingKey) {
        const expiresAt = Date.now() + this.cacheTTL;
        this.signingKeyCache.set(cacheKey, { key: signingKey, expiresAt });
        this.logger.debug(`已更新 signing_key 緩存，webhookUrl: ${webhookUrl}, chain: ${chain}`);
      }

      return signingKey;
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
  private async createNewWebhook(chain: ChainName): Promise<string | null> {
    // 使用簡單鎖防止同時創建
    const lockKey = `webhook:create:${chain}`;

    try {
      // 先檢查鎖是否存在
      const existingLock = await this.cacheService.get<string>(lockKey);
      if (existingLock) {
        this.logger.warn(`另一個進程正在創建 ${chain} webhook，跳過此次操作`);
        return null;
      }

      // 設置鎖，有效期為 30 秒
      await this.cacheService.set(lockKey, Date.now().toString(), 30);

      try {
        this.logger.log(`嘗試為 ${chain} 創建新的 webhook...`);

        if (!this.alchemyApiKey) {
          this.logger.error('創建 webhook 失敗: Alchemy API key 未配置');
          return null;
        }

        // 使用已保存的 webhookUrl
        if (!this.webhookUrl) {
          this.logger.error('創建 webhook 失敗: webhook URL 未配置');
          return null;
        }

        const client = this.alchemySDKClients.get(chain);
        if (!client) {
          this.logger.error(`創建 webhook 失敗: 找不到 ${chain} 的 Alchemy SDK 客戶端`);
          return null;
        }

        // 獲取網絡 ID 並打印日誌
        const networkId = this.getNetworkIdForChain(chain);
        this.logger.log(
          `準備為 ${chain} (網絡 ID: ${networkId}) 創建 webhook，URL: ${this.webhookUrl}`,
        );

        // 檢查參數是否完整
        this.logger.debug(`創建 webhook 參數檢查:
          - API Key: ${this.alchemyApiKey ? '已設置' : '未設置'}
          - Webhook URL: ${this.webhookUrl}
          - Network: ${Network[chain] ? Network[chain] : '未識別'}
          - 默認監控地址: ${DEFAULT_MONITORED_ADDRESS}`);

        // 再次檢查是否已經有此鏈的webhook (防止在加鎖期間其他進程已創建)
        const existingId = await this.getExistingWebhookIdForChain(chain);
        if (existingId) {
          this.logger.log(`在創建前發現 ${chain} 已有 webhook ID: ${existingId}，將使用現有的`);
          return existingId;
        }

        try {
          this.logger.debug(`正在調用 Alchemy API 創建 webhook...`);

          // 打印請求內容以便診斷
          const requestParams = {
            url: this.webhookUrl,
            type: WebhookType.ADDRESS_ACTIVITY,
            options: {
              addresses: [DEFAULT_MONITORED_ADDRESS],
              network: Network[chain],
            },
          };
          this.logger.debug(`Alchemy 請求參數: ${JSON.stringify(requestParams)}`);

          const result = await client.notify.createWebhook(
            this.webhookUrl,
            WebhookType.ADDRESS_ACTIVITY,
            {
              addresses: [DEFAULT_MONITORED_ADDRESS], // 使用預設監控地址
              network: Network[chain],
            },
          );

          if (result && result.id) {
            const newWebhookId = result.id;
            this.logger.log(`成功為 ${chain} 創建了新的 webhook，ID: ${newWebhookId}`);
            return newWebhookId;
          } else {
            this.logger.error(
              `創建 webhook 失敗: Alchemy API 沒有返回有效的 webhook ID (${JSON.stringify(result)})`,
            );
            return null;
          }
        } catch (apiError: unknown) {
          const apiErrorMessage = apiError instanceof Error ? apiError.message : String(apiError);
          // 檢查是否為常見錯誤類型並提供更具體的處理建議
          if (apiErrorMessage.includes('rate limit') || apiErrorMessage.includes('429')) {
            this.logger.error(`調用 Alchemy API 創建 webhook 時被限流: ${apiErrorMessage}`);
          } else if (apiErrorMessage.includes('auth') || apiErrorMessage.includes('401')) {
            this.logger.error(`調用 Alchemy API 創建 webhook 時認證失敗: ${apiErrorMessage}`);
          } else if (apiErrorMessage.includes('timeout') || apiErrorMessage.includes('timed out')) {
            this.logger.error(`調用 Alchemy API 創建 webhook 時請求超時: ${apiErrorMessage}`);
          } else {
            this.logger.error(
              `調用 Alchemy API 創建 webhook 時出錯: ${apiErrorMessage}`,
              apiError instanceof Error ? apiError.stack : undefined,
            );
          }
          return null;
        }
      } finally {
        // 無論成功或失敗，都釋放鎖
        await this.cacheService.delete(lockKey);
        this.logger.debug(`已釋放 ${chain} webhook 創建鎖`);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `為 ${chain} 創建 webhook 時發生錯誤: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );

      // 嘗試釋放鎖
      try {
        await this.cacheService.delete(lockKey);
      } catch (e) {
        // 忽略釋放鎖時的錯誤
      }

      return null;
    }
  }

  /**
   * 查找已存在的 webhook ID (不創建新的)
   * 僅用於 createNewWebhook 方法內部二次確認
   */
  private async getExistingWebhookIdForChain(chain: ChainName): Promise<string | null> {
    try {
      // 獲取當前所有 webhook
      const webhooks = await this.getExistingWebhooks();
      if (!webhooks || webhooks.length === 0) {
        return null;
      }

      // 地址活動 webhook 的網絡名稱
      const networkId = this.getNetworkIdForChain(chain);

      // 尋找匹配的 webhook
      for (const webhook of webhooks) {
        if (
          webhook.network === networkId &&
          webhook.webhook_type === 'ADDRESS_ACTIVITY' &&
          webhook.is_active &&
          webhook.webhook_url === this.webhookUrl
        ) {
          return webhook.id;
        }
      }

      return null;
    } catch (error) {
      this.logger.warn(`檢查現有 webhook 時出錯: ${error}`);
      return null;
    }
  }

  /**
   * 根據鏈名獲取 Alchemy 網絡 ID
   * @param chain 區塊鏈名稱
   * @returns Alchemy 網絡 ID
   */
  private getNetworkIdForChain(chain: ChainName): string {
    const networkId = AlchemyNetworkUtils.getNetworkIdForChain(chain);
    if (!networkId) {
      this.logger.warn(`未知的鏈: ${chain}，預設使用 ETH_MAINNET`);
      return 'ETH_MAINNET';
    }
    return networkId;
  }

  /**
   * 獲取當前 webhook 上訂閱的地址列表
   * @param chain 區塊鏈名稱
   * @returns 訂閱地址列表
   */
  async getMonitoredAddresses(chain: ChainName): Promise<string[]> {
    try {
      if (!this.alchemyToken) {
        this.logger.error('Cannot get monitored addresses: Alchemy token is not configured');
        return [];
      }

      // 獲取該鏈的 webhook ID
      const webhookId = await this.getWebhookIdForChain(chain);
      if (!webhookId) {
        this.logger.error(`No webhook found for chain: ${chain}`);
        return [];
      }

      // 使用 HTTP API 獲取 webhook 詳細信息
      try {
        const response = await lastValueFrom(
          this.httpService.get(`${this.alchemyApiUrl}/team-webhooks/${webhookId}`, {
            headers: {
              'X-Alchemy-Token': this.alchemyToken,
            },
          }),
        );

        if (response.status === 200 && response.data?.data) {
          const webhookDetails = response.data.data;
          return webhookDetails.addresses || [];
        } else {
          this.logger.warn(`無法獲取 webhook ${webhookId} 的詳細信息: ${response.status}`);
          return [];
        }
      } catch (apiError: unknown) {
        const errorMessage = apiError instanceof Error ? apiError.message : String(apiError);
        this.logger.error(`API 請求獲取 webhook 詳情時發生錯誤: ${errorMessage}`);
        return [];
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `獲取 ${chain} 的已監控地址時發生錯誤: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );
      return [];
    }
  }

  /**
   * 獲取webhook底下的地址列表
   * @param chain 區塊鏈名稱
   * @param webhookId webhook ID
   * @returns webhook下的地址列表
   */
  public async getWebhookDetailsWithSdk(chain: ChainName, webhookId: string): Promise<string[]> {
    try {
      if (!this.alchemyToken) {
        this.logger.error('Alchemy token is not configured');
        return [];
      }

      // 使用 Alchemy SDK 獲取 webhook 底下的地址列表
      const client = this.alchemySDKClients.get(chain);
      if (!client) {
        this.logger.error(`No Alchemy SDK client for chain: ${chain}`);
        return [];
      }

      try {
        // 使用 SDK 的 notify.getAddresses 方法獲取地址列表
        const addressesResponse = await client.notify.getAddresses(webhookId);
        return addressesResponse.addresses || [];
      } catch (httpError: unknown) {
        const httpErrorMessage = httpError instanceof Error ? httpError.message : String(httpError);
        this.logger.error(`獲取webhook地址列表時發生錯誤: ${httpErrorMessage}`);
        return [];
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `獲取webhook地址列表時發生錯誤: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );
      return [];
    }
  }
}
