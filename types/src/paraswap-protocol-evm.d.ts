/** @typedef {import('@wdk/wallet/protocols').SwapOptions} SwapOptions */
/** @typedef {import('@wdk/wallet/protocols').SwapProtocolConfig} SwapProtocolConfig */
/** @typedef {import('@wdk/wallet/protocols').SwapResult} SwapResult */
/** @typedef {import('@wdk/wallet-evm-erc-4337').EvmErc4337WalletConfig} EvmErc4337WalletConfig */
/**
 * @template {WalletAccountEvm | WalletAccountEvmErc4337} T
 * @typedef {Pick<SwapProtocolConfig, 'swapMaxFee'> & (T extends WalletAccountEvmErc4337 ? Pick<EvmErc4337WalletConfig, 'paymasterToken'> : {})} SwapConfigOverride
 */
/**
 * @template {WalletAccountEvm | WalletAccountEvmErc4337} T
 * @typedef {(T extends WalletAccountEvmErc4337 ? Pick<EvmErc4337WalletConfig, 'paymasterToken'> : {})} QuoteSwapConfigOverride
 */
/**
 * @template {WalletAccountEvm | WalletAccountEvmErc4337} T
 */
export default class ParaSwapProtocolEVM<T extends WalletAccountEvm | WalletAccountEvmErc4337> extends SwapProtocol {
    /**
     * Creates a new interface to the paraswap protocol for evm blockchains.`
     *
     * @param {T} account - The wallet account to use to interact with the protocol.
     * @param {SwapProtocolConfig} [config] - The swap protocol configuration.
     */
    constructor(account: T, config?: SwapProtocolConfig);
    _provider: JsonRpcProvider | BrowserProvider;
    /**
     * @private
     * @type {Promise<import('@velora-dex/sdk').SimpleFetchSDK>}
     */
    private _veloraSdkPromise;
    /** @private */
    private _getSwapTransactions;
    /**
     * Swaps a pair of tokens.
     *
     * @abstract
     * @param {SwapOptions} options - The swap's options.
     * @param {SwapConfigOverride<T>} [config] - If set, overrides the 'swapMaxFee' and 'paymasterToken' options defined in the manager configuration.
     * @returns {Promise<SwapResult>} The swap's result.
     */
    swap(options: SwapOptions, config?: SwapConfigOverride<T>): Promise<SwapResult>;
}
export type SwapOptions = import("@wdk/wallet/protocols").SwapOptions;
export type SwapProtocolConfig = import("@wdk/wallet/protocols").SwapProtocolConfig;
export type SwapResult = import("@wdk/wallet/protocols").SwapResult;
export type EvmErc4337WalletConfig = import("@wdk/wallet-evm-erc-4337").EvmErc4337WalletConfig;
export type SwapConfigOverride<T extends WalletAccountEvm | WalletAccountEvmErc4337> = Pick<SwapProtocolConfig, "swapMaxFee"> & (T extends WalletAccountEvmErc4337 ? Pick<EvmErc4337WalletConfig, "paymasterToken"> : {});
export type QuoteSwapConfigOverride<T extends WalletAccountEvm | WalletAccountEvmErc4337> = (T extends WalletAccountEvmErc4337 ? Pick<EvmErc4337WalletConfig, "paymasterToken"> : {});
import { WalletAccountEvm } from '@wdk/wallet-evm';
import { WalletAccountEvmErc4337 } from '@wdk/wallet-evm-erc-4337';
import { SwapProtocol } from '@wdk/wallet/protocols';
import { BrowserProvider, JsonRpcProvider} from 'ethers';
