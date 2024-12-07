import { DedustEasySDK } from "../index.js"

async function main() {
    const MNEMONIC = process.env.MNEMONIC
    const SCALE_ADDRESS = 'EQBlqsm144Dq6SjbPI4jjZvA1hqTIP3CvHovbIfW_t-SCALE';
    const USDT_ADDRESS = 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs'
    const sdk = new DedustEasySDK(MNEMONIC)
    await sdk.initWallet()
    await sdk.swap(100000000n, 10000000, 0.01, SCALE_ADDRESS, USDT_ADDRESS)
}

main().catch(console.dir);