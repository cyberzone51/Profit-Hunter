import React from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface TermsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isMandatory?: boolean;
}

export function TermsModal({ isOpen, onClose, isMandatory = false }: TermsModalProps) {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#11151e] border border-white/10 rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] max-h-[calc(100dvh-2rem)] animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-[#1a202c]">
          <div className="flex items-center gap-2 text-amber-500">
            <AlertTriangle className="w-5 h-5" />
            <h2 className="font-bold text-lg">{t('Terms of Use & Disclaimer')}</h2>
          </div>
          {!isMandatory && (
            <button 
              onClick={onClose} 
              className="p-1 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-white/5"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
        
        <div className="p-6 overflow-y-auto text-sm text-slate-300 space-y-5 custom-scrollbar">
          <p className="text-slate-400 italic">
            {t('Last updated: March 2026')}
          </p>
          
          <section>
            <h3 className="text-white font-semibold mb-2">{t('1. No Financial Advice')}</h3>
            <p className="leading-relaxed">
              {t('The information, data, signals, and charts provided by Profit Hunter are for informational and educational purposes only. Nothing contained within this application constitutes financial, investment, legal, or trading advice. We are not financial advisors.')}
            </p>
          </section>

          <section>
            <h3 className="text-white font-semibold mb-2">{t('2. Assumption of Risk')}</h3>
            <p className="leading-relaxed">
              {t('Trading cryptocurrencies and derivatives (such as futures and perpetual contracts) involves a high degree of risk and may not be suitable for all investors. The high degree of leverage can work against you as well as for you. You could lose some or all of your initial investment. You should carefully consider your investment objectives, level of experience, and risk appetite.')}
            </p>
          </section>

          <section>
            <h3 className="text-white font-semibold mb-2">{t('3. No Liability')}</h3>
            <p className="leading-relaxed">
              {t('The creators, developers, and operators of Profit Hunter accept absolutely no liability for any financial losses, damages, or missed opportunities incurred as a result of using this application. All trading decisions are made strictly at your own risk. We do not guarantee any profits or protection from losses.')}
            </p>
          </section>

          <section>
            <h3 className="text-white font-semibold mb-2">{t('4. Accuracy of Information')}</h3>
            <p className="leading-relaxed">
              {t('While we strive to provide accurate and real-time data from third-party exchanges (e.g., Bybit), we do not warrant or guarantee the accuracy, completeness, or timeliness of the information presented. Data delays, API errors, pricing anomalies, or system outages may occur without notice.')}
            </p>
          </section>

          <section>
            <h3 className="text-white font-semibold mb-2">{t('5. User Responsibility')}</h3>
            <p className="leading-relaxed">
              {t('By using Profit Hunter, you acknowledge and agree that you are solely responsible for your own trading decisions, account security, and risk management. You agree to hold the creators and affiliates harmless from any and all claims arising from your use of this tool.')}
            </p>
          </section>
        </div>

        <div className="p-4 border-t border-white/10 bg-[#1a202c] flex justify-end shrink-0">
          <button 
            onClick={onClose} 
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-lg shadow-blue-500/20"
          >
            {t('I Understand and Agree')}
          </button>
        </div>
      </div>
    </div>
  );
}
