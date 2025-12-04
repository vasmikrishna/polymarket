# PolyMarket Builder Trading App

A Next.js application for trading on PolyMarket with gasless transactions using the Builder Program.

## Features

- **Multi-Wallet Support**: Connect MetaMask, Phantom, and other EVM wallets
- **Account Switching**: Switch between multiple accounts per wallet
- **Proxy Wallet Management**: Deploy and manage Safe wallets for gasless transactions
- **Market Data**: Fetch market information by slug from PolyMarket Gamma API
- **Gasless Order Placement**: Place orders using builder credentials and relayer

## Prerequisites

- Node.js 18+ and npm
- PolyMarket Builder Program credentials (API key, secret, passphrase)
- MetaMask or compatible wallet

## Setup

1. **Install dependencies**:
```bash
npm install
```

2. **Configure environment variables**:
Create a `.env.local` file in the root directory:
```env
POLY_BUILDER_API_KEY=your_api_key_here
POLY_BUILDER_SECRET=your_secret_here
POLY_BUILDER_PASSPHRASE=your_passphrase_here

POLY_CLOB_API_URL=https://clob.polymarket.com
POLY_RELAYER_URL=https://relayer-v2.polymarket.com
POLY_GAMMA_API_URL=https://gamma-api.polymarket.com

POLYGON_RPC_URL=https://polygon-rpc.com
POLYGON_CHAIN_ID=137
```

3. **Run the development server**:
```bash
npm run dev
```

4. **Open your browser**:
Navigate to [http://localhost:3000](http://localhost:3000)

## Usage

1. **Connect Wallet**: Click "Connect MetaMask" and approve the connection
2. **Deploy Proxy Wallet**: Deploy a Safe wallet for gasless transactions
3. **Fetch Market Data**: Enter a market slug (e.g., `bitcoin-up-or-down-on-december-4`) and click "Fetch Market Data"
4. **Place Order**: Select outcome, side (Buy/Sell), price, and size, then click "Place Order"

## Project Structure

```
polymarket-trading-app/
├── app/
│   ├── api/              # API routes
│   │   ├── builder/      # Builder signing endpoint
│   │   ├── markets/      # Market data proxy
│   │   ├── orders/       # Order placement
│   │   └── safe/         # Safe wallet management
│   ├── layout.tsx        # Root layout with providers
│   └── page.tsx          # Main page
├── components/
│   ├── wallet/           # Wallet connection components
│   ├── market/           # Market data and order components
│   ├── proxy/            # Proxy wallet components
│   └── ui/               # Reusable UI components
└── lib/
    ├── polymarket/       # PolyMarket SDK integrations
    ├── wallet/           # Wallet utilities
    ├── types/            # TypeScript types
    └── utils/            # Utility functions
```

## Important Notes

### Builder Signing
The builder signing implementation in `/app/api/builder/sign/route.ts` uses a simplified HMAC approach. In production, you should:
- Use the official `@polymarket/builder-signing-sdk` package
- Follow PolyMarket's exact signing specification
- Implement proper cryptographic signing as per their documentation

### Safe Wallet Deployment
The Safe wallet deployment returns a transaction hash. In production, you should:
- Extract the deployed Safe address from transaction logs
- Use the Safe SDK to compute the address deterministically
- Store the Safe address mapping for each user

### Order Placement
Orders are signed server-side with builder credentials and then submitted via the CLOB client. The relayer handles gasless execution.

## Development

- **TypeScript**: Full type safety throughout the application
- **Tailwind CSS**: Utility-first CSS framework for styling
- **Next.js App Router**: Modern React framework with server components

## Security Considerations

- Builder credentials are stored server-side only (never exposed to frontend)
- All user inputs are validated
- API routes should implement rate limiting in production
- Use HTTPS in production environments

## License

MIT
