'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { SafeWalletInfo } from '@/lib/types/order';
import { ethers } from 'ethers';
import { createRelayerClient, deploySafeWallet, getExpectedSafeAddress } from '@/lib/polymarket/relayer-client';

interface ProxyWalletDisplayProps {
  userAddress: string | null;
  signer: ethers.JsonRpcSigner | ethers.Wallet | null;
  onProxyAddressFound?: (address: string) => void;
}

export function ProxyWalletDisplay({ userAddress, signer, onProxyAddressFound }: ProxyWalletDisplayProps) {
  const [safeInfo, setSafeInfo] = useState<SafeWalletInfo | null>(null);
  const [isDeploying, setIsDeploying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [usdcBalance, setUsdcBalance] = useState<string>('0');
  const [approvals, setApprovals] = useState({
    usdc: false,
    ctf: false,
  });
  const [isApproving, setIsApproving] = useState({
    usdc: false,
    ctf: false,
  });

  const USDC_ADDRESS = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';
  const CTF_ADDRESS = '0x4d97dcd97ec945f40cf65f87097ace5ea0476045';
  const CTF_EXCHANGE = '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E';

  useEffect(() => {
    if (userAddress && signer) {
      // Check if Safe already exists for this user
      const checkExistingSafe = async () => {
        try {
          // First check localStorage
          const storedSafeAddress = localStorage.getItem(`safe_${userAddress}`);
          if (storedSafeAddress) {
            await fetchSafeData(storedSafeAddress);
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
              await fetchSafeData(expectedAddress);
              if (onProxyAddressFound) onProxyAddressFound(expectedAddress);
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

  const fetchSafeData = async (safeAddress: string) => {
    if (!signer?.provider) return;

    setIsLoading(true);
    setError(null);

    // Notify parent of proxy address
    if (onProxyAddressFound) onProxyAddressFound(safeAddress);

    try {
      // Fetch MATIC balance
      const balance = await signer.provider.getBalance(safeAddress);

      // Fetch USDC balance
      const usdcContract = new ethers.Contract(
        USDC_ADDRESS,
        ['function balanceOf(address) view returns (uint256)', 'function allowance(address,address) view returns (uint256)'],
        signer.provider
      );
      const usdcBal = await usdcContract.balanceOf(safeAddress);
      const usdcAllowance = await usdcContract.allowance(safeAddress, CTF_ADDRESS);

      // Fetch CTF approval
      const ctfContract = new ethers.Contract(
        CTF_ADDRESS,
        ['function isApprovedForAll(address,address) view returns (bool)'],
        signer.provider
      );
      const ctfApproved = await ctfContract.isApprovedForAll(safeAddress, CTF_EXCHANGE);

      setSafeInfo({
        address: safeAddress,
        balance: ethers.formatEther(balance),
        deployed: true,
      });
      setUsdcBalance(ethers.formatUnits(usdcBal, 6)); // USDC has 6 decimals
      setApprovals({
        usdc: usdcAllowance > 0,
        ctf: ctfApproved,
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch balance';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApproveUSDC = async () => {
    if (!safeInfo?.address || !signer) return;
    setIsApproving(prev => ({ ...prev, usdc: true }));
    setError(null);

    try {
      const relayerClient = await createRelayerClient(signer, undefined);

      const erc20Interface = new ethers.Interface([
        'function approve(address spender, uint256 value) public returns (bool)'
      ]);

      const data = erc20Interface.encodeFunctionData('approve', [
        CTF_ADDRESS,
        ethers.MaxUint256
      ]);

      const tx = {
        to: USDC_ADDRESS,
        data: data,
        value: '0',
        operation: 0, // Call
      };

      const response = await (relayerClient as any).executeSafeTransactions([tx]);
      await response.wait();

      await fetchSafeData(safeInfo.address);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to approve USDC';
      setError(errorMessage);
    } finally {
      setIsApproving(prev => ({ ...prev, usdc: false }));
    }
  };

  const handleApproveTrading = async () => {
    if (!safeInfo?.address || !signer) return;
    setIsApproving(prev => ({ ...prev, ctf: true }));
    setError(null);

    try {
      const relayerClient = await createRelayerClient(signer, undefined);

      const ctfInterface = new ethers.Interface([
        'function setApprovalForAll(address operator, bool approved) public'
      ]);

      const data = ctfInterface.encodeFunctionData('setApprovalForAll', [
        CTF_EXCHANGE,
        true
      ]);

      const tx = {
        to: CTF_ADDRESS,
        data: data,
        value: '0',
        operation: 0, // Call
      };

      const response = await (relayerClient as any).executeSafeTransactions([tx]);
      await response.wait();

      await fetchSafeData(safeInfo.address);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to approve trading';
      setError(errorMessage);
    } finally {
      setIsApproving(prev => ({ ...prev, ctf: false }));
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
        await fetchSafeData(proxyAddress);
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
              await fetchSafeData(expectedAddress);
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
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Address</p>
              <p className="text-sm font-mono break-all">{safeInfo.address}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">MATIC Balance</p>
              <p className="text-lg font-semibold">{parseFloat(safeInfo.balance).toFixed(4)} MATIC</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">USDC Balance</p>
              <p className="text-lg font-semibold">{parseFloat(usdcBalance).toFixed(2)} USDC</p>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t">
            <h4 className="text-sm font-medium">Approvals</h4>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={approvals.usdc ? "secondary" : "primary"}
                onClick={handleApproveUSDC}
                isLoading={isApproving.usdc}
                disabled={approvals.usdc}
                className="w-full text-xs"
              >
                {approvals.usdc ? 'USDC Approved' : 'Approve USDC'}
              </Button>
              <Button
                variant={approvals.ctf ? "secondary" : "primary"}
                onClick={handleApproveTrading}
                isLoading={isApproving.ctf}
                disabled={approvals.ctf}
                className="w-full text-xs"
              >
                {approvals.ctf ? 'Trading Approved' : 'Approve Trading'}
              </Button>
            </div>
          </div>

          <Button
            variant="secondary"
            onClick={() => fetchSafeData(safeInfo.address)}
            isLoading={isLoading}
            className="w-full"
          >
            Refresh Data
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

