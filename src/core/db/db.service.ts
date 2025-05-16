import { Injectable, Logger } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { ChainName } from '../../chains/constants';
import { ProviderType } from '../../providers/constants/blockchain-types';
import { PortfolioSnapshot } from './schemas/portfolio-snapshot.schema';
import { PortfolioHistory, PortfolioHistoryMeta } from './schemas/portfolio-history.schema';
import { TxHistory } from './schemas/tx-history.schema';
import { NftOwner } from './schemas/nft-owner.schema';
import { NftMeta } from './schemas/nft-meta.schema';
import { PriceCache } from './schemas/price-cache.schema';
import { WebhookEvent } from './schemas/webhook-event.schema';

/**
 * MongoDB服務
 * 提供操作MongoDB的統一介面
 */
@Injectable()
export class DbService {
  private readonly logger = new Logger(DbService.name);

  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(PortfolioSnapshot.name)
    private readonly portfolioSnapshotModel: Model<PortfolioSnapshot>,
    @InjectModel(PortfolioHistory.name)
    private readonly portfolioHistoryModel: Model<PortfolioHistory>,
    @InjectModel(TxHistory.name) private readonly txHistoryModel: Model<TxHistory>,
    @InjectModel(NftOwner.name) private readonly nftOwnerModel: Model<NftOwner>,
    @InjectModel(NftMeta.name) private readonly nftMetaModel: Model<NftMeta>,
    @InjectModel(PriceCache.name) private readonly priceCacheModel: Model<PriceCache>,
    @InjectModel(WebhookEvent.name) private readonly webhookEventModel: Model<WebhookEvent>,
  ) {
    this.logger.log('DbService initialized with Mongoose connection');
  }

  /**
   * 獲取原始Mongoose連接
   */
  getConnection(): Connection {
    return this.connection;
  }

  /**
   * Portfolio操作
   */

  /**
   * 獲取地址餘額快照
   * 只返回未過期的數據
   */
  async getPortfolioSnapshot(
    chainId: number,
    address: string,
    provider?: ProviderType,
  ): Promise<PortfolioSnapshot | null> {
    // 添加對 expiresAt 的檢查，只返回未過期的數據
    const now = new Date();
    return this.portfolioSnapshotModel
      .findOne({
        chainId,
        address,
        ...(provider ? { provider } : {}),
        $or: [
          { expiresAt: { $exists: false } }, // 沒有 expiresAt 字段的數據
          { expiresAt: { $gt: now } }, // expiresAt 大於當前時間的數據
        ],
      })
      .exec();
  }

  /**
   * 將輸入數據轉換為符合 MongoDB 模型的格式
   */
  private transformPortfolioData(data: any): any {
    // 如果數據已經是正確格式，則直接返回
    if (data.native && !data.nativeBalance) {
      return data;
    }

    const transformed = { ...data };

    // 如果存在 nativeBalance 字段但沒有 native 字段，進行轉換
    if (data.nativeBalance && !data.native) {
      transformed.native = { ...data.nativeBalance };
      delete transformed.nativeBalance;
    }

    // 確保 blockNumber 字段存在
    if (!transformed.blockNumber) {
      transformed.blockNumber = 0;
    }

    // 如果有 tokens 字段但沒有 fungibles 字段，進行轉換
    if (data.tokens && !data.fungibles) {
      transformed.fungibles = data.tokens;
      delete transformed.tokens;
    }

    return transformed;
  }

  /**
   * 保存/更新地址餘額快照
   * @param chain 鏈名稱
   * @param chainId 鏈ID
   * @param address 地址
   * @param data 數據
   * @param provider 提供者 (可選)
   * @param ttlSeconds 過期時間 (秒)，默認為 schema 設定的 30 分鐘
   */
  async savePortfolioSnapshot(
    chain: ChainName,
    chainId: number,
    address: string,
    data: Partial<PortfolioSnapshot>,
    provider?: ProviderType,
    ttlSeconds?: number,
  ): Promise<PortfolioSnapshot> {
    // 轉換數據格式
    const transformedData = this.transformPortfolioData(data);

    // 如果提供了 ttlSeconds，則計算過期時間
    if (ttlSeconds !== undefined) {
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + ttlSeconds);
      transformedData.expiresAt = expiresAt;
      this.logger.debug(`Setting MongoDB TTL to ${ttlSeconds} seconds for portfolio snapshot`);
    }

    const filter = {
      chainId,
      address,
      ...(provider ? { provider } : {}),
    };

    const update = {
      chain,
      ...transformedData,
      ...(provider ? { provider } : {}),
    };

    const options = {
      new: true, // 返回更新後的文檔
      upsert: true, // 如果不存在則創建
    };

    const snapshot = await this.portfolioSnapshotModel
      .findOneAndUpdate(filter, update, options)
      .exec();

    if (!snapshot) {
      throw new Error(
        `Failed to save portfolio snapshot for chainId=${chainId}, address=${address}`,
      );
    }

    // 同時添加一筆歷史記錄 (Time Series)
    try {
      // 確保所有必填字段都存在
      if (!snapshot.native) {
        this.logger.warn(
          `Missing required fields for PortfolioHistory, skip history creation for ${chain}:${chainId}:${address}`,
        );
        return snapshot;
      }

      const historyData = {
        updatedAt: new Date(),
        meta: {
          chainId,
          address,
          ...(provider ? { provider } : {}),
        } as PortfolioHistoryMeta,
        chain,
        native: snapshot.native,
        fungibles: snapshot.fungibles || [],
        nfts: snapshot.nfts || [],
        blockNumber: snapshot.blockNumber || 0, // 使用預設值 0
        schemaVer: snapshot.schemaVer || 1,
      };

      await this.portfolioHistoryModel.create(historyData);
      this.logger.debug(`Successfully created history record for ${chain}:${chainId}:${address}`);
    } catch (error) {
      this.logger.error(`Failed to create history record: ${error.message}`, error.stack);
      // 繼續執行，不因為歷史記錄失敗而中斷整個流程
    }

    return snapshot;
  }

  /**
   * 獲取地址餘額歷史
   */
  async getPortfolioHistory(
    chainId: number,
    address: string,
    provider?: ProviderType,
    limit = 100,
    startTime?: Date,
    endTime?: Date,
  ): Promise<PortfolioHistory[]> {
    const query: any = {
      'meta.chainId': chainId,
      'meta.address': address,
    };

    if (provider) {
      query['meta.provider'] = provider;
    }

    if (startTime || endTime) {
      query.updatedAt = {};
      if (startTime) query.updatedAt.$gte = startTime;
      if (endTime) query.updatedAt.$lte = endTime;
    }

    return this.portfolioHistoryModel.find(query).sort({ updatedAt: -1 }).limit(limit).exec();
  }

  /**
   * Transaction操作
   */

  /**
   * 保存交易歷史
   */
  async saveTxHistory(txData: Partial<TxHistory>): Promise<TxHistory> {
    const filter = {
      txHash: txData.txHash,
    };

    const options = {
      new: true,
      upsert: true,
    };

    const result = await this.txHistoryModel.findOneAndUpdate(filter, txData, options).exec();

    if (!result) {
      throw new Error(`Failed to save transaction history for txHash=${txData.txHash}`);
    }

    return result;
  }

  /**
   * 獲取地址交易歷史
   */
  async getAddressTxHistory(
    chainId: number,
    address: string,
    limit = 20,
    offset = 0,
  ): Promise<TxHistory[]> {
    return this.txHistoryModel
      .find({ chainId, address })
      .sort({ blockTime: -1 })
      .skip(offset)
      .limit(limit)
      .exec();
  }

  /**
   * NFT操作
   */

  /**
   * 保存NFT擁有者信息
   */
  async saveNftOwner(nftOwnerData: Partial<NftOwner>): Promise<NftOwner> {
    const filter = {
      chainId: nftOwnerData.chainId,
      contract: nftOwnerData.contract,
      tokenId: nftOwnerData.tokenId,
    };

    const options = {
      new: true,
      upsert: true,
    };

    const result = await this.nftOwnerModel.findOneAndUpdate(filter, nftOwnerData, options).exec();

    if (!result) {
      throw new Error(
        `Failed to save NFT owner for contract=${nftOwnerData.contract}, tokenId=${nftOwnerData.tokenId}`,
      );
    }

    return result;
  }

  /**
   * 保存NFT元數據信息
   */
  async saveNftMeta(nftMetaData: Partial<NftMeta>): Promise<NftMeta> {
    const filter = {
      chainId: nftMetaData.chainId,
      contract: nftMetaData.contract,
      tokenId: nftMetaData.tokenId,
    };

    const options = {
      new: true,
      upsert: true,
    };

    const result = await this.nftMetaModel.findOneAndUpdate(filter, nftMetaData, options).exec();

    if (!result) {
      throw new Error(
        `Failed to save NFT metadata for contract=${nftMetaData.contract}, tokenId=${nftMetaData.tokenId}`,
      );
    }

    return result;
  }

  /**
   * 獲取地址擁有的所有NFT
   */
  async getAddressNfts(
    chainId: number,
    address: string,
    limit = 50,
    offset = 0,
  ): Promise<NftOwner[]> {
    return this.nftOwnerModel
      .find({ chainId, owner: address })
      .sort({ updatedAt: -1 })
      .skip(offset)
      .limit(limit)
      .exec();
  }

  /**
   * 獲取NFT元數據
   */
  async getNftMeta(chainId: number, contract: string, tokenId: string): Promise<NftMeta | null> {
    return this.nftMetaModel.findOne({ chainId, contract, tokenId }).exec();
  }

  /**
   * Price操作
   */

  /**
   * 獲取代幣價格
   */
  async getTokenPrice(symbol: string, chainId: number): Promise<PriceCache | null> {
    return this.priceCacheModel.findOne({ symbol, chainId }).exec();
  }

  /**
   * 保存代幣價格
   */
  async saveTokenPrice(
    symbol: string,
    chainId: number,
    priceUsd: number,
    metadata?: Partial<PriceCache['metadata']>,
  ): Promise<PriceCache> {
    const filter = { symbol, chainId };

    const update = {
      priceUsd,
      ...(metadata ? { metadata } : {}),
      updatedAt: new Date(),
    };

    const options = {
      new: true,
      upsert: true,
    };

    const result = await this.priceCacheModel.findOneAndUpdate(filter, update, options).exec();

    if (!result) {
      throw new Error(`Failed to save price for symbol=${symbol}, chainId=${chainId}`);
    }

    return result;
  }

  /**
   * Webhook操作
   */

  /**
   * 保存Webhook事件
   */
  async saveWebhookEvent(eventData: Partial<WebhookEvent>): Promise<WebhookEvent> {
    return this.webhookEventModel.create(eventData);
  }

  /**
   * 根據日期範圍獲取Webhook事件
   */
  async getWebhookEvents(startTime: Date, endTime: Date, limit = 100): Promise<WebhookEvent[]> {
    return this.webhookEventModel
      .find({
        receivedAt: {
          $gte: startTime,
          $lte: endTime,
        },
      })
      .sort({ receivedAt: -1 })
      .limit(limit)
      .exec();
  }

  /**
   * 使地址餘額快照緩存失效
   * 通過設置 expiresAt 為當前時間，讓 MongoDB TTL 索引自動刪除這些記錄
   * @param chain 鏈名稱
   * @param chainId 鏈ID
   * @param address 地址
   * @returns 更新的文檔數量
   */
  async invalidateAddressSnapshot(
    chain: ChainName,
    chainId: number,
    address: string,
    provider?: ProviderType,
  ): Promise<number> {
    try {
      this.logger.debug(`Invalidating MongoDB cache for ${chain}:${chainId}:${address}`);

      // 設置查詢條件
      const filter = {
        chain,
        chainId,
        address,
        ...(provider ? { provider } : {}),
      };

      // 設置 expiresAt 為當前時間，使 MongoDB TTL 索引立即失效該記錄
      const now = new Date();
      const result = await this.portfolioSnapshotModel.updateMany(filter, {
        $set: { expiresAt: now },
      });

      this.logger.debug(
        `Set MongoDB expiresAt to current time for ${result.modifiedCount} records of ${chain}:${chainId}:${address}`,
      );

      return result.modifiedCount;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to invalidate MongoDB cache for ${chain}:${chainId}:${address}: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }
}
