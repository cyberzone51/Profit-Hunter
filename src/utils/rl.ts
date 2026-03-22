
/**
 * Simple Reinforcement Learning Agent for Signal Optimization
 * Tracks the performance of different indicator combinations and adjusts weights.
 */

interface PerformanceRecord {
  success: number;
  total: number;
}

interface SymbolWeights {
  [indicator: string]: number;
}

class SignalOptimizer {
  private static instance: SignalOptimizer;
  private static readonly STORAGE_VERSION = '3';
  private static readonly GLOBAL_SYMBOL = '__global__';
  private weights: Record<string, SymbolWeights> = {};
  private performance: Record<string, Record<string, PerformanceRecord>> = {};

  private constructor() {
    this.loadFromStorage();
  }

  public static getInstance(): SignalOptimizer {
    if (!SignalOptimizer.instance) {
      SignalOptimizer.instance = new SignalOptimizer();
    }
    return SignalOptimizer.instance;
  }

  private loadFromStorage() {
    try {
      const version = localStorage.getItem('rl_signal_version');
      if (version !== SignalOptimizer.STORAGE_VERSION) {
        this.weights = {};
        this.performance = {};
        localStorage.setItem('rl_signal_version', SignalOptimizer.STORAGE_VERSION);
        this.saveToStorage();
        return;
      }

      const saved = localStorage.getItem('rl_signal_weights');
      if (saved) {
        this.weights = JSON.parse(saved);
      }
      const perf = localStorage.getItem('rl_signal_performance');
      if (perf) {
        this.performance = JSON.parse(perf);
      }
    } catch (e) {
      console.error('Failed to load RL weights', e);
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem('rl_signal_version', SignalOptimizer.STORAGE_VERSION);
      localStorage.setItem('rl_signal_weights', JSON.stringify(this.weights));
      localStorage.setItem('rl_signal_performance', JSON.stringify(this.performance));
    } catch (e) {
      console.error('Failed to save RL weights', e);
    }
  }

  public getWeight(symbol: string, indicator: string): number {
    const localWeight = this.weights[symbol]?.[indicator];
    const globalWeight = this.weights[SignalOptimizer.GLOBAL_SYMBOL]?.[indicator];

    if (typeof localWeight === 'number' && typeof globalWeight === 'number') {
      return (localWeight * 0.7) + (globalWeight * 0.3);
    }

    if (typeof localWeight === 'number') return localWeight;
    if (typeof globalWeight === 'number') return globalWeight;

    if (!this.weights[symbol]) this.weights[symbol] = {};
    return this.weights[symbol][indicator] ?? 1.0;
  }

  /**
   * Update performance based on historical backtest or live result
   */
  public recordResult(symbol: string, indicator: string, success: boolean) {
    if (!this.performance[symbol]) this.performance[symbol] = {};
    if (!this.performance[symbol][indicator]) {
      this.performance[symbol][indicator] = { success: 0, total: 0 };
    }

    const record = this.performance[symbol][indicator];
    record.total++;
    if (success) record.success++;

    // Adjust weight based on win rate
    const winRate = record.success / record.total;
    if (!this.weights[symbol]) this.weights[symbol] = {};
    
    // Simple reinforcement: increase weight if win rate > 50%, decrease if < 50%
    // Using a learning rate of 0.05
    const learningRate = 0.05;
    const targetWeight = winRate * 2; // 50% win rate = 1.0 weight
    this.weights[symbol][indicator] = (this.weights[symbol][indicator] ?? 1.0) * (1 - learningRate) + targetWeight * learningRate;
    
    // Clamp weight between 0.5 and 2.0
    this.weights[symbol][indicator] = Math.max(0.5, Math.min(2.0, this.weights[symbol][indicator]));

    this.saveToStorage();
  }

  /**
   * Get detailed performance stats for a symbol
   */
  public getStats(symbol: string): { wins: number; losses: number; total: number; winRate: number } {
    if (!this.performance[symbol]) return { wins: 0, losses: 0, total: 0, winRate: 0 };
    
    let wins = 0;
    let total = 0;
    
    // Use 'overall' as the primary source of truth for trade count if available
    if (this.performance[symbol]['overall']) {
      wins = this.performance[symbol]['overall'].success;
      total = this.performance[symbol]['overall'].total;
    } else {
      // Fallback to summing up (though might double count if multiple indicators per trade)
      for (const key in this.performance[symbol]) {
        wins += this.performance[symbol][key].success;
        total += this.performance[symbol][key].total;
      }
    }
    
    const losses = total - wins;
    const winRate = total > 0 ? wins / total : 0;
    
    return { wins, losses, total, winRate };
  }

  /**
   * Calculate a simulated win rate for a symbol based on recent history
   */
  public getWinRate(symbol: string): number {
    return this.getStats(symbol).winRate;
  }

  public getIndicatorStats(symbol: string, indicator: string): { wins: number; losses: number; total: number; winRate: number; score: number } {
    const localRecord = this.performance[symbol]?.[indicator];
    const globalRecord = this.performance[SignalOptimizer.GLOBAL_SYMBOL]?.[indicator];

    const wins = (localRecord?.success || 0) + (globalRecord?.success || 0);
    const total = (localRecord?.total || 0) + (globalRecord?.total || 0);
    const losses = total - wins;

    return {
      wins,
      losses,
      total,
      winRate: total > 0 ? wins / total : 0,
      score: wins - losses
    };
  }

  public getScore(symbol: string, indicator = 'overall'): number {
    if (indicator === 'overall') {
      const stats = this.getStats(symbol);
      return stats.wins - stats.losses;
    }

    return this.getIndicatorStats(symbol, indicator).score;
  }
}

export const rlOptimizer = SignalOptimizer.getInstance();
