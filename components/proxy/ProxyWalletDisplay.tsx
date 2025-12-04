'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { SafeWalletInfo } from '@/lib/types/order';
import { ethers } from 'ethers';
import { createRelayerClient, deploySafeWallet, getExpectedSafeAddress } from '@/lib/polymarket/relayer-client';

interface ProxyWalletDisplayProps {
  userAddress: string | null;
  signer: ethers.JsonRpcSigner | ethers.Wallet | null;
}

export function ProxyWalletDisplay({ userAddress, signer }: ProxyWalletDisplayProps) {
  const [safeInfo, setSafeInfo] = useState<SafeWalletInfo | null>(null);
  const [isDeploying, setIsDeploying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (userAddress && signer) {
      // Check if Safe already exists for this user
      const checkExistingSafe = async () => {
        try {
          // First check localStorage
          const storedSafeAddress = localStorage.getItem(`safe_${userAddress}`);
          if (storedSafeAddress) {
            await fetchSafeBalance(storedSafeAddress);
            return;
          }

          // If not in localStorage, try to get the expected Safe address
          const relayerClient = await createRelayerClient(signer, undefined);
          const expectedAddress = await getExpectedSafeAddress(relayerClient, userAddress);
          
          if (expectedAddress) {
            // Check if it's actually deployed
            const isDeployed = await relayerClient.getDeployed(expectedAddress);
            if (isDeployed) {
              localStorage.setItem(`safe_${userAddress}`, expectedAddress);
              await fetchSafeBalance(expectedAddress);
            }
          }
        } catch (error) {
          console.error('Error checking for existing Safe:', error);
          // Silently fail - user can still try to deploy
        }
      };

      checkExistingSafe();
    }
  }, [userAddress, signer]);

  const fetchSafeBalance = async (safeAddress: string) => {
    if (!signer?.provider) return;

    setIsLoading(true);
    setError(null);

    try {
      const balance = await signer.provider.getBalance(safeAddress);
      setSafeInfo({
        address: safeAddress,
        balance: ethers.formatEther(balance),
        deployed: true,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch balance';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeploy = async () => {
    if (!userAddress || !signer) {
      setError('Wallet not connected');
      return;
    }

    setIsDeploying(true);
    setError(null);

    try {
      // Create RelayClient - it now returns a Promise, so we need to await it
      const relayerClient = await createRelayerClient(signer, undefined);
      const result = await deploySafeWallet(relayerClient, {
        owners: [userAddress],
        threshold: 1,
      });

      // Store the Safe address and transaction hash
      const proxyAddress = result.proxyAddress;
      localStorage.setItem(`safe_${userAddress}`, proxyAddress);
      localStorage.setItem(`safe_tx_${userAddress}`, result.transactionHash);

      // Fetch balance for the deployed Safe
      if (proxyAddress && signer?.provider) {
        await fetchSafeBalance(proxyAddress);
      } else {
        // Update state with transaction hash if Safe address not yet available
        setSafeInfo({
          address: proxyAddress,
          balance: '0',
          deployed: true,
          deploymentTxHash: result.transactionHash,
        });
      }
    } catch (err: any) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to deploy Safe wallet';
      
      // Check if the error indicates Safe is already deployed
      if (
        errorMessage.toLowerCase().includes('already deployed') ||
        errorMessage.toLowerCase().includes('safe already exists') ||
        errorMessage.toLowerCase().includes('safe already deployed')
      ) {
        // Try to get the existing Safe address
        try {
          const relayerClient = await createRelayerClient(signer, undefined);
          const expectedAddress = await getExpectedSafeAddress(relayerClient, userAddress);
          
          if (expectedAddress) {
            const isDeployed = await relayerClient.getDeployed(expectedAddress);
            if (isDeployed) {
              // Safe exists, fetch its info
              localStorage.setItem(`safe_${userAddress}`, expectedAddress);
              await fetchSafeBalance(expectedAddress);
              setError(null); // Clear error since we found the Safe
              return;
            }
          }
        } catch (getAddressError) {
          console.error('Error getting existing Safe address:', getAddressError);
        }
        
        setError('Safe already deployed! Please refresh the page to see your Safe wallet.');
      } else {
        setError(errorMessage);
      }
    } finally {
      setIsDeploying(false);
    }
  };

  if (!userAddress || !signer) {
    return (
      <div className="p-4 border rounded-lg bg-gray-50">
        <p className="text-gray-500 text-sm">Connect wallet to manage proxy wallet</p>
      </div>
    );
  }

  return (
    <div className="p-4 border rounded-lg space-y-4">
      <h3 className="text-lg font-semibold">Proxy Wallet (Safe)</h3>

      {safeInfo ? (
        <div className="space-y-2">
          <div>
            <p className="text-sm text-gray-600">Address</p>
            <p className="text-sm font-mono break-all">{safeInfo.address}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Balance</p>
            <p className="text-lg font-semibold">{parseFloat(safeInfo.balance).toFixed(4)} MATIC</p>
          </div>
          <Button
            variant="secondary"
            onClick={() => fetchSafeBalance(safeInfo.address)}
            isLoading={isLoading}
            className="w-full"
          >
            Refresh Balance
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-gray-600">No proxy wallet deployed</p>
          <Button
            onClick={handleDeploy}
            isLoading={isDeploying}
            className="w-full"
          >
            Deploy Proxy Wallet
          </Button>
        </div>
      )}

      {error && (
        <div className="p-2 bg-red-50 text-red-600 text-sm rounded">
          {error}
        </div>
      )}
    </div>
  );
}

