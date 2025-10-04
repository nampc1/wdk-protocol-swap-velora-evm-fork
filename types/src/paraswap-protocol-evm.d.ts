export default class ParaSwapProtocolEvm extends SwapProtocol {
    /**
     * Creates a new read-only interface to the paraswap protocol for evm blockchains.
     *
     * @overload
     * @param {WalletAccountReadOnlyEvm | WalletAccountReadOnlyEvmErc4337} account - The wallet account to use to interact with the protocol.
     * @param {SwapProtocolConfig} [config] - The swap protocol configuration.
     */
    constructor(account: WalletAccountReadOnlyEvm | WalletAccountReadOnlyEvmErc4337, config?: SwapProtocolConfig);
    /**
     * Creates a new interface to the paraswap protocol for evm blockchains.
     *
     * @overload
     * @param {WalletAccountEvm | WalletAccountEvmErc4337} account - The wallet account to use to interact with the protocol.
     * @param {SwapProtocolConfig} [config] - The swap protocol configuration.
     */
    constructor(account: WalletAccountEvm | WalletAccountEvmErc4337, config?: SwapProtocolConfig);
    /** @private */
    private _veloraSdk;
    /** @private */
    private _provider: JsonRpcProvider | BrowserProvider;
    /**
     * Swaps a pair of tokens.
     *
     * @param {SwapOptions} options - The swap's options.
     * @param {Pick<EvmErc4337WalletConfig, 'paymasterToken'> & Pick<SwapProtocolConfig, 'swapMaxFee'>} [config] - If the protocol has
     *   been initialized with an erc-4337 wallet account, overrides the 'paymasterToken' option defined in its configuration and the
     *   'swapMaxFee' option defined in the protocol configuration.
     * @returns {Promise<SwapResult>} The swap's result.
     */
    swap(options: SwapOptions, config?: Pick<EvmErc4337WalletConfig, "paymasterToken"> & Pick<SwapProtocolConfig, "swapMaxFee">): Promise<SwapResult>;
    /**
     * Quotes the costs of a swap operation.
     *
     * @param {SwapOptions} options - The swap's options.
     * @param {Pick<EvmErc4337WalletConfig, 'paymasterToken'>} [config] - If the protocol has been initialized with an erc-4337
     *   wallet account, overrides the 'paymasterToken' option defined in its configuration.
     * @returns {Promise<Omit<SwapResult, 'hash'>>} The swap's quotes.
     */
    quoteSwap(options: SwapOptions, config?: Pick<EvmErc4337WalletConfig, "paymasterToken">): Promise<Omit<SwapResult, "hash">>;
    /** @private */
    private _getVeloraSdk;
    /** @private */
    private _getSwapTransactions;
}
export type SwapProtocolConfig = import("@wdk/wallet/protocols").SwapProtocolConfig;
export type SwapOptions = import("@wdk/wallet/protocols").SwapOptions;
export type WalletAccountReadOnlyEvm = import("@wdk/wallet-evm").WalletAccountReadOnlyEvm;
export type EvmErc4337WalletConfig = import("@wdk/wallet-evm-erc-4337").EvmErc4337WalletConfig;
export type SwapResult = {
    /**
     * - The hash of the swap operation.
     */
    hash: string;
    /**
     * - The gas cost.
     */
    fee: bigint;
    /**
     * - The amount of input tokens sold.
     */
    tokenInAmount: bigint;
    /**
     * -  The amount of output tokens bought.
     */
    tokenOutAmount: bigint;
};
import { SwapProtocol } from '@wdk/wallet/protocols';
import { JsonRpcProvider } from 'ethers';
import { BrowserProvider } from 'ethers';
import { WalletAccountReadOnlyEvmErc4337 } from '@wdk/wallet-evm-erc-4337';
import { WalletAccountEvm } from '@wdk/wallet-evm';
import { WalletAccountEvmErc4337 } from '@wdk/wallet-evm-erc-4337';
