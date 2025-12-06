
import { config as dotenvConfig } from "dotenv";
import { resolve } from "path";
import { Wallet, providers } from "ethers-v5";
import { ClobClient, OrderType } from "@polymarket/clob-client";
import { getContractConfig } from "@polymarket/clob-client/dist/config";
import { buildOrder } from "@polymarket/clob-client/dist/order-builder/helpers";

dotenvConfig({ path: resolve(__dirname, "../.env") });

async function diagnose() {
    console.log("=== Polymarket CLOB Diagnostic ===");

    // 1. Check Env Vars
    const required = [
        "POLY_WALLET_PRIVATE_KEY",
        "POLY_BUILDER_API_KEY",
        "POLY_BUILDER_SECRET",
        "POLY_BUILDER_PASSPHRASE",
    ];
    let missing = false;
    for (const v of required) {
        if (!process.env[v]) {
            console.error(`❌ Missing ${v}`);
            missing = true;
        } else {
            console.log(`✅ ${v} is set`);
        }
    }

    // Check CLOB keys (optional if derived)
    const clobKeys = ["POLY_CLOB_API_KEY", "POLY_CLOB_SECRET", "POLY_CLOB_PASSPHRASE"];
    const hasClobKeys = clobKeys.every(k => process.env[k]);
    if (hasClobKeys) {
        console.log("✅ CLOB API keys are set in env");
    } else {
        console.log("⚠️ CLOB API keys not in env (will attempt derivation)");
    }

    if (missing) return;

    // 2. Setup Wallet
    console.log("\n--- Wallet Setup ---");
    const rpc = process.env.POLY_RPC_URL || "https://polygon-rpc.com";
    const provider = new providers.JsonRpcProvider(rpc);
    const wallet = new Wallet(process.env.POLY_WALLET_PRIVATE_KEY!, provider);
    console.log(`Wallet Address: ${wallet.address}`);

    // 3. Check Contract Config
    console.log("\n--- Contract Config ---");
    const chainId = 137;
    const config = getContractConfig(chainId);
    console.log(`Chain ID: ${chainId}`);
    console.log(`Exchange Address: ${config.exchange}`);

    // 4. API Key Derivation/Check
    console.log("\n--- API Credential Check ---");
    let creds;
    if (hasClobKeys) {
        creds = {
            key: process.env.POLY_CLOB_API_KEY!,
            secret: process.env.POLY_CLOB_SECRET!,
            passphrase: process.env.POLY_CLOB_PASSPHRASE!
        };
        console.log("Using env credentials");
    } else {
        console.log("Attempting to derive credentials...");
        try {
            const client = new ClobClient("https://clob.polymarket.com", chainId, wallet);
            const derived = await client.createOrDeriveApiKey();
            console.log("✅ Credentials derived successfully");
            creds = {
                key: (derived as any).apiKey || (derived as any).key,
                secret: (derived as any).secret,
                passphrase: (derived as any).passphrase
            };
        } catch (e: any) {
            console.error("❌ Failed to derive credentials:", e.message);
            if (e.response) {
                console.error("Response:", e.response.data);
            }
            return;
        }
    }

    if (!creds || !creds.key) {
        console.error("❌ Invalid credentials structure");
        return;
    }
    console.log(`API Key: ${creds.key}`);


    // 5. Test Order Signing
    console.log("\n--- Test Order Signing ---");
    const orderData = {
        maker: wallet.address,
        signer: wallet.address,
        taker: "0x0000000000000000000000000000000000000000",
        tokenId: "112540911653160777059655478391259433595972605218365763034134019729862917878641", // Example token
        makerAmount: "1000000", // 1 USDC
        takerAmount: "1000000",
        side: 0, // BUY
        nonce: "1",
        expiration: Math.floor(Date.now() / 1000 + 300).toString(),
        feeRateBps: "0",
        signatureType: 1 // POLY_PROXY
    };

    try {
        const signedOrder = await buildOrder(wallet, config.exchange, chainId, orderData);
        console.log("✅ Order signed successfully");
        console.log("Signature:", signedOrder.signature);
        console.log("Salt:", signedOrder.salt);

        // Check signature length
        if (signedOrder.signature.length !== 132) {
            console.error(`❌ Invalid signature length: ${signedOrder.signature.length}`);
        } else {
            console.log("✅ Signature length correct (132)");
        }
    } catch (e: any) {
        console.error("❌ Failed to sign order:", e);
    }
}

diagnose().catch(console.error);
