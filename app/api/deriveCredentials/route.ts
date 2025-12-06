import { NextRequest, NextResponse } from 'next/server';
import { ClobClient } from '@polymarket/clob-client';
import { Wallet as WalletV5, providers as providersV5 } from 'ethers-v5';

export async function GET(request: NextRequest) {
    try {
        // ============================================
        // 1. VALIDATE SERVER WALLET
        // ============================================
        if (!process.env.POLY_WALLET_PRIVATE_KEY) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Server wallet not configured',
                    message: 'POLY_WALLET_PRIVATE_KEY is required in .env'
                },
                { status: 500 }
            );
        }

        // ============================================
        // 2. INITIALIZE WALLET
        // ============================================
        const polygonRpcUrl = process.env.POLY_RPC_URL || 'https://polygon-rpc.com';
        const provider = new providersV5.JsonRpcProvider(polygonRpcUrl);
        const wallet = new WalletV5(process.env.POLY_WALLET_PRIVATE_KEY!, provider);

        console.log(`Deriving CLOB credentials for wallet: ${wallet.address}`);

        // ============================================
        // 3. CREATE CLIENT AND DERIVE CREDENTIALS
        // ============================================
        const clobClient = new ClobClient(
            'https://clob.polymarket.com',
            137,
            wallet as any
        );

        let apiCreds;
        try {
            apiCreds = await clobClient.createOrDeriveApiKey();
        } catch (error: any) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Failed to derive CLOB API credentials',
                    message: error.message,
                    details: {
                        walletAddress: wallet.address,
                        errorType: error.constructor?.name,
                        suggestion: 'Make sure the wallet has been used on Polymarket.com before. Visit Polymarket, connect this wallet, then try again.'
                    }
                },
                { status: 500 }
            );
        }

        // ============================================
        // 4. EXTRACT CREDENTIALS
        // ============================================
        const apiKey = (apiCreds as any).apiKey || (apiCreds as any).key;
        const secret = (apiCreds as any).secret;
        const passphrase = (apiCreds as any).passphrase;

        if (!apiKey || !secret || !passphrase) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Incomplete API credentials',
                    message: 'The derived credentials are missing required fields',
                    details: {
                        hasApiKey: !!apiKey,
                        hasSecret: !!secret,
                        hasPassphrase: !!passphrase,
                    }
                },
                { status: 500 }
            );
        }

        // ============================================
        // 5. RETURN CREDENTIALS
        // ============================================
        return NextResponse.json({
            success: true,
            message: 'CLOB API credentials derived successfully',
            credentials: {
                POLY_CLOB_API_KEY: apiKey,
                POLY_CLOB_SECRET: secret,
                POLY_CLOB_PASSPHRASE: passphrase,
            },
            walletAddress: wallet.address,
            instructions: {
                step1: 'Copy these values',
                step2: 'Add them to your .env file',
                step3: 'Restart your dev server (npm run dev)',
                note: 'Keep these credentials secure and never commit them to version control'
            }
        });

    } catch (error: any) {
        return NextResponse.json(
            {
                success: false,
                error: 'Server error',
                message: error.message,
                details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
            },
            { status: 500 }
        );
    }
}
