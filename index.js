import { Address, toNano, TonClient4 } from "@ton/ton";
import { mnemonicToPrivateKey } from "@ton/crypto";
import { WalletContracts, Addresses } from './data/index.js';
import { FORWARD_FEE, FULL_FEE } from "./config/index.js";

import {
  Asset,
  Factory,
  JettonRoot,
  MAINNET_FACTORY_ADDR,
  Pool,
  PoolType,
  VaultNative,
  JettonWallet,
  VaultJetton,
  ReadinessStatus,
} from "@dedust/sdk";

class DedustEasySDK {
  constructor(mnemonic, endpoint = "https://mainnet-v4.tonhubapi.com") {
    if (!mnemonic) {
      throw new Error("Mnemonic phrase is required.");
    }

    this.mnemonic = mnemonic.split(" ");
    this.tonClient = new TonClient4({ endpoint });
  }

  async initWallet(version="V3R2") {
    const keys = await mnemonicToPrivateKey(this.mnemonic);
    const contract = WalletContracts[version.toUpperCase()];
    if (!contract) {
        throw new Error(`Contract not found. Value have to be in [${Object.keys(WalletContracts)}].`);
    }
    this.wallet = this.tonClient.open(
      contract.create({
        workchain: 0,
        publicKey: keys.publicKey,
      })
    );
    this.sender = this.wallet.sender(keys.secretKey);
  }


  async swap(amountIn, amountOut, slippage, jettonInAddress, jettonOutAddress) {
    // address1 or address2 can be ton, use "ton" or "native"
    const minExpectedAmount = amountOut * (1 - slippage);
    
    if (jettonInAddress.toLowerCase() == 'ton' || jettonInAddress.toLowerCase() == 'native') {
        const factory = this.tonClient.open(
            Factory.createFromAddress(MAINNET_FACTORY_ADDR),
        );
        const jettonOutRoot = this.tonClient.open(JettonRoot.createFromAddress(Address.parse(jettonOutAddress)));
        const pool = this.tonClient.open(
            Pool.createFromAddress(
              await factory.getPoolAddress({
                poolType: PoolType.VOLATILE,
                assets: [Asset.native(), Asset.jetton(jettonOutRoot.address)],
              }),
            ),
        );
        const nativeVault = this.tonClient.open(
            VaultNative.createFromAddress(
              await factory.getVaultAddress(Asset.native()),
            ),
          );
        const lastBlock = await this.tonClient.getLastBlock();
        const poolState = await this.tonClient.getAccountLite(
            lastBlock.last.seqno,
            pool.address,
        );
        if (poolState.account.state.type !== "active") {
            throw new Error("Pool is not exist.");
        }
        const vaultState = await this.tonClient.getAccountLite(
            lastBlock.last.seqno,
            nativeVault.address,
        );
        
        if (vaultState.account.state.type !== "active") {
            throw new Error("Native Vault is not exist.");
        }
        await nativeVault.sendSwap(
            this.sender,
            {
              poolAddress: pool.address,
              amount: amountIn,
              limit: minExpectedAmount,
              gasAmount: FORWARD_FEE,
            },
          );
        
    } else {
        const factory = this.tonClient.open(
            Factory.createFromAddress(MAINNET_FACTORY_ADDR),
          );
        const jettonInVault = this.tonClient.open(await factory.getJettonVault(Address.parse(jettonInAddress)));
        if ((await jettonInVault.getReadinessStatus()) !== ReadinessStatus.READY) {
            throw new Error('Vault jettonVault does not exist.');
          }
    
        const jettonInRoot = this.tonClient.open(JettonRoot.createFromAddress(Address.parse(jettonInAddress)));
        const jettonInWallet = this.tonClient.open(await jettonInRoot.getWallet(this.wallet.address));
    
        const jetton1 = Asset.jetton(Address.parse(jettonInAddress));
        let jetton2 = ['ton', 'native'].includes(jettonOutAddress.toLowerCase()) 
            ? Asset.native() 
            : Asset.jetton(Address.parse(jettonOutAddress));
    
        const pool = this.tonClient.open(await factory.getPool(PoolType.VOLATILE, [jetton1, jetton2]));
        if ((await pool.getReadinessStatus()) !== ReadinessStatus.READY) {
            throw new Error('Pool does not exist.');
          }
        
        await jettonInWallet.sendTransfer(this.sender, FULL_FEE, {
            amount: amountIn,
            destination: jettonInVault.address,
            responseAddress: this.wallet.address, // return gas to user
            forwardAmount: FORWARD_FEE,
            forwardPayload: VaultJetton.createSwapPayload({ poolAddress: pool.address, limit: minExpectedAmount }),
        });
    }
  }
}

export { DedustEasySDK, Addresses }