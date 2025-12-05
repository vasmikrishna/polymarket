'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { WalletState } from '@/lib/wallet/providers';

interface WalletContextType {
  walletState: WalletState;
  setWalletState: (state: WalletState) => void;
}

const WalletContext = createContext<WalletContextType | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [walletState, setWalletState] = useState<WalletState>({
    provider: null,
    address: null,
    signer: null,
    providerInstance: null,
    accounts: [],
    isConnected: false,
  });

  // Load wallet state from localStorage on mount and verify with MetaMask
  useEffect(() => {
    const initWallet = async () => {
      const stored = localStorage.getItem('walletState');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);

          // Check actual MetaMask connection status
          const { checkConnection } = await import('@/lib/wallet/providers');
          const actualState = await checkConnection();

          if (actualState) {
            // If connected in MetaMask, use that state (it might be different account than stored)
            setWalletState(actualState);
          } else {
            // If not connected in MetaMask, clear stored state
            localStorage.removeItem('walletState');
            setWalletState({
              provider: null,
              address: null,
              signer: null,
              providerInstance: null,
              accounts: [],
              isConnected: false,
            });
          }
        } catch (e) {
          console.error('Error restoring wallet state:', e);
        }
      }
    };

    initWallet();
  }, []);

  // Listen for MetaMask events
  useEffect(() => {
    const initEvents = async () => {
      const { getMetaMaskProvider } = await import('@/lib/wallet/providers');
      const ethereum = getMetaMaskProvider();

      if (ethereum) {
        const handleAccountsChanged = async (accounts: string[]) => {
          if (accounts.length === 0) {
            // User disconnected
            setWalletState({
              provider: null,
              address: null,
              signer: null,
              providerInstance: null,
              accounts: [],
              isConnected: false,
            });
          } else {
            // Account changed - re-sync
            const { checkConnection } = await import('@/lib/wallet/providers');
            const newState = await checkConnection();
            if (newState) {
              setWalletState(newState);
            }
          }
        };

        const handleChainChanged = () => {
          // Reload page on chain change as recommended by MetaMask
          window.location.reload();
        };

        ethereum.on('accountsChanged', handleAccountsChanged);
        ethereum.on('chainChanged', handleChainChanged);

        return () => {
          if (ethereum.removeListener) {
            ethereum.removeListener('accountsChanged', handleAccountsChanged);
            ethereum.removeListener('chainChanged', handleChainChanged);
          }
        };
      }
    };

    initEvents();
  }, []);

  // Save wallet state to localStorage
  useEffect(() => {
    if (walletState.isConnected && walletState.address) {
      localStorage.setItem('walletState', JSON.stringify({
        provider: walletState.provider,
        address: walletState.address,
        accounts: walletState.accounts,
        isConnected: walletState.isConnected,
      }));
    } else {
      localStorage.removeItem('walletState');
    }
  }, [walletState]);

  return (
    <WalletContext.Provider value={{ walletState, setWalletState }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within WalletProvider');
  }
  return context;
}

