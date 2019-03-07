Basic example of submitting an order to Radar Relay on production.

This assumes the wallet you are using already has WETH, allowances are set on WETH and ZRX, and the wallet has ETH to pay for a cancellation.

:warning: Make sure to change SELL_ETH_AMOUNT and BUY_ZRX_AMOUNT in index.ts to desired amounts.

To run:

```
yarn
MAKER_ADDRESS=your_wallets_ethereum_address PRIVATE_KEY=your_wallets_private_key ETH_NODE_URL=your_eth_node_url  yarn dev
```
