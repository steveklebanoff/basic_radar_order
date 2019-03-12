import { PrivateKeyWalletSubprovider } from "@0x/subproviders";
import {
  assetDataUtils,
  BigNumber,
  ContractWrappers,
  Order,
  orderHashUtils,
  signatureUtils
} from "0x.js";
import { Web3Wrapper } from "@0x/web3-wrapper";
import { getContractAddressesForNetworkOrThrow } from "@0x/contract-addresses";
import { HttpClient } from "@0x/connect";
import { createInterface } from "readline";

import { RPCSubprovider, Web3ProviderEngine } from "0x.js";
import { ExchangeContract } from "@0x/abi-gen-wrappers";

// Vars from env
const MAKER_ADDRESS = (process.env.MAKER_ADDRESS as string).toLowerCase(); // Address of your wallet
const PRIVATE_KEY = process.env.PRIVATE_KEY as string; // Private key
const ETH_NODE_URL = process.env.ETH_NODE_URL as string; // URL of eth node, i.e. https://kovan.infura.io/v3/xyz

const SELL_ETH_AMOUNT = new BigNumber(0.002);
const BUY_ZRX_AMOUNT = new BigNumber(10);

const NULL_ADDRESS = "0x0000000000000000000000000000000000000000";
const ZERO = new BigNumber(0);
const DECIMALS = 18;
const NETWORK_ID = 42; // Kovan
const SRA_URL = "https://api.kovan.radarrelay.com/0x/v2";
const FEE_RECIPIENT = "0xa258b39954cef5cb142fd567a46cddb31a670124"; // Radar
const EXPIRATION_SECONDS = 360;

/**
 * Creates and submits an order to buy ZRX with WETH.
 * Assumes wallet already has WETH and allowances set on it.
 */
const go = async () => {
  const privateKeyWallet = new PrivateKeyWalletSubprovider(
    PRIVATE_KEY as string
  );
  const providerEngine = new Web3ProviderEngine();
  const rpcProvider = new RPCSubprovider(ETH_NODE_URL);
  providerEngine.addProvider(privateKeyWallet);
  providerEngine.addProvider(rpcProvider);
  providerEngine.start();

  const contractAddresses = getContractAddressesForNetworkOrThrow(NETWORK_ID);
  const zrxTokenAddress = contractAddresses.zrxToken;
  const etherTokenAddress = contractAddresses.etherToken;

  const makerAssetData = assetDataUtils.encodeERC20AssetData(etherTokenAddress);
  const makerAssetAmount = Web3Wrapper.toBaseUnitAmount(
    SELL_ETH_AMOUNT,
    DECIMALS
  );

  const takerAssetData = assetDataUtils.encodeERC20AssetData(zrxTokenAddress);
  const takerAssetAmount = Web3Wrapper.toBaseUnitAmount(
    BUY_ZRX_AMOUNT,
    DECIMALS
  );

  const exchangeAddress = contractAddresses.exchange;

  // Create the order
  const curTime = Math.floor(new Date().getTime() / 1000);
  const expirationTime = new BigNumber(curTime + EXPIRATION_SECONDS);
  const salt = new BigNumber(new Date().getTime());
  const order: Order = {
    exchangeAddress,
    makerAddress: MAKER_ADDRESS,
    takerAddress: NULL_ADDRESS,
    senderAddress: NULL_ADDRESS,
    expirationTimeSeconds: expirationTime,
    salt,
    makerAssetAmount,
    takerAssetAmount,
    makerAssetData,
    takerAssetData,
    makerFee: ZERO,
    takerFee: ZERO,
    feeRecipientAddress: FEE_RECIPIENT
  };
  console.log(order);
  const orderHashHex = orderHashUtils.getOrderHashHex(order);
  const signature = await signatureUtils.ecSignHashAsync(
    providerEngine,
    orderHashHex,
    MAKER_ADDRESS
  );
  const signedOrder = { ...order, signature };

  const contractWrappers = new ContractWrappers(providerEngine, {
    networkId: NETWORK_ID
  });
  console.log("Validating order...");
  await contractWrappers.exchange.validateOrderFillableOrThrowAsync(
    signedOrder
  );
  console.log("Order is valid.");

  const readline = createInterface({
    input: process.stdin,
    output: process.stdout
  });
  readline.question(
    "Would you like to submit the order? Press y to continue:",
    async resp => {
      if (resp !== "y") {
        console.log("Ending");
        process.exit();
        return;
      }
      const relayerClient = new HttpClient(SRA_URL);

      await relayerClient.submitOrderAsync(signedOrder, {
        networkId: 1
      });

      console.log("Order submitted.");

      readline.question(
        "You should now see your order on Radar.  Would you like to cancel the order now? Press y to continue:",
        async cancelResp => {
          if (cancelResp !== "y") {
            console.log("Ending");
            process.exit();
            return;
          }

          console.log("Cancelling order");

          const nonceResult = await rpcProvider.emitPayloadAsync({
            method: "eth_getTransactionCount",
            params: [MAKER_ADDRESS, "pending"]
          });
          console.log({ nonceResult });

          // Note that we just need the order here, not the signed order
          const cancelTxn = await contractWrappers.exchange.cancelOrderAsync(
            order
          );
          console.log("Submitted cancellation. Transaction hash:", cancelTxn);
          process.exit();
        }
      );
    }
  );
};

go();
