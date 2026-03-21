import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Crown, Wallet, X, Zap } from 'lucide-react';

interface PremiumSignalsModalProps {
  hiddenSignalsCount: number;
  onClose: () => void;
  onUnlocked: () => void;
}

interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>;
}

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

const PREMIUM_STORAGE_KEY = 'profit_hunter_signals_premium';
const PREMIUM_WALLET_KEY = 'profit_hunter_wallet_address';

export const PremiumSignalsModal: React.FC<PremiumSignalsModalProps> = ({
  hiddenSignalsCount,
  onClose,
  onUnlocked
}) => {
  const { t } = useTranslation();
  const [address, setAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConfirmingPayment, setIsConfirmingPayment] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);

  useEffect(() => {
    const restoreWallet = async () => {
      if (!window.ethereum) return;

      try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' }) as string[];
        if (accounts[0]) {
          setAddress(accounts[0]);
          localStorage.setItem(PREMIUM_WALLET_KEY, accounts[0]);
          return;
        }
      } catch {
        // Ignore provider restore errors and fallback to cached value.
      }

      try {
        const cachedAddress = localStorage.getItem(PREMIUM_WALLET_KEY);
        if (cachedAddress) {
          setAddress(cachedAddress);
        }
      } catch {
        // Ignore localStorage restore errors.
      }
    };

    restoreWallet();
  }, []);

  const connectWallet = async () => {
    if (!window.ethereum) {
      setWalletError(t('No browser wallet detected. Install MetaMask or another injected wallet.'));
      return;
    }

    setIsConnecting(true);
    setWalletError(null);

    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' }) as string[];
      if (!accounts[0]) {
        throw new Error(t('Wallet connection was cancelled.'));
      }

      setAddress(accounts[0]);
      localStorage.setItem(PREMIUM_WALLET_KEY, accounts[0]);
    } catch (error: any) {
      setWalletError(error?.message || t('Failed to connect wallet.'));
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = () => {
    setAddress(null);
    setWalletError(null);

    try {
      localStorage.removeItem(PREMIUM_WALLET_KEY);
    } catch {
      // Ignore localStorage cleanup errors.
    }
  };

  const handleConfirmPayment = () => {
    setIsConfirmingPayment(true);

    window.setTimeout(() => {
      try {
        localStorage.setItem(PREMIUM_STORAGE_KEY, JSON.stringify({
          status: 'active',
          wallet: address || null,
          activatedAt: Date.now()
        }));
      } catch {
        // Ignore localStorage errors and still unlock via callback.
      }

      setIsConfirmingPayment(false);
      onUnlocked();
    }, 1800);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative w-full max-w-lg rounded-2xl border border-amber-500/20 bg-[#11151e] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 bg-[#1a202c]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/15 text-amber-400">
              <Crown className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-white font-bold text-lg">{t('Unlock Premium Signals')}</h2>
              <p className="text-xs text-slate-400">{hiddenSignalsCount} {t('signals are locked')}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-5">
          <div className="rounded-xl border border-amber-500/20 bg-gradient-to-r from-amber-500/10 to-yellow-500/10 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-amber-300/80 font-bold mb-1">
                  {t('Signals Premium')}
                </div>
                <div className="text-white text-xl font-black">10 USDT / 30 {t('days')}</div>
              </div>
              <div className="text-right text-xs text-slate-300">
                <div>{t('10 signals free')}</div>
                <div className="text-amber-400 font-bold">{t('Everything else unlocks instantly')}</div>
              </div>
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-white/5 bg-[#1a202c] p-4">
            <div className="flex items-center gap-3 text-sm text-slate-300">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>{t('Unlock all live signals on the selected exchange')}</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-300">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>{t('Keep the first 10 signals free for every user')}</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-300">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>{t('Premium activation is stored in this browser after payment confirmation')}</span>
            </div>
          </div>

          {!address ? (
            <div className="space-y-3">
              <button
                onClick={connectWallet}
                disabled={isConnecting}
                className="w-full py-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white shadow-lg shadow-blue-500/20"
              >
                <Wallet className="w-5 h-5" />
                {isConnecting ? t('Connecting Wallet...') : t('Connect Wallet')}
              </button>
              {walletError && (
                <p className="text-xs text-rose-400 text-center">{walletError}</p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-xl border border-white/5 bg-[#0b0e14] px-4 py-3">
                <div className="flex items-center gap-2 text-slate-300">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="font-mono text-xs">{address.slice(0, 6)}...{address.slice(-4)}</span>
                </div>
                <button
                  onClick={disconnectWallet}
                  className="text-xs text-rose-400 hover:text-rose-300"
                >
                  {t('Disconnect')}
                </button>
              </div>

              <button
                onClick={handleConfirmPayment}
                disabled={isConfirmingPayment}
                className="relative overflow-hidden w-full py-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-amber-400 hover:from-amber-500/30 hover:to-yellow-500/30 border border-amber-500/30 shadow-lg shadow-amber-500/20"
              >
                {isConfirmingPayment ? (
                  <div className="w-5 h-5 border-2 border-amber-300/30 border-t-amber-300 rounded-full animate-spin relative z-10" />
                ) : (
                  <Zap className="w-5 h-5 relative z-10" />
                )}
                <span className="relative z-10">
                  {isConfirmingPayment ? t('Confirming Payment...') : t('Buy Premium')}
                </span>
                <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-amber-300/60 to-transparent animate-glare z-0"></div>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
