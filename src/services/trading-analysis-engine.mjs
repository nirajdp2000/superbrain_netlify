import { config } from "../config.mjs";
import { fetchJson } from "../utils/http.mjs";
import { TTLCache } from "../utils/ttl-cache.mjs";

// Cache configurations
const marketDataCache = new TTLCache(5_000); // 5 seconds for live data
const analysisCache = new TTLCache(5 * 60_000); // 5 minutes for analysis
const sentimentCache = new TTLCache(30 * 60_000); // 30 minutes for sentiment

class TradingAnalysisEngine {
  constructor() {
    this.riskProfiles = {
      conservative: { max_risk: 0.02, min_rr_ratio: 2.0 },
      moderate: { max_risk: 0.03, min_rr_ratio: 1.5 },
      aggressive: { max_risk: 0.05, min_rr_ratio: 1.0 }
    };
  }

  // Main analysis pipeline
  async analyzeStock(symbol, timeframes = ['intraday', 'swing', 'short_term', 'long_term'], riskProfile = 'moderate') {
    const cacheKey = `analysis:${symbol}:${timeframes.join(',')}:${riskProfile}`;
    const cached = analysisCache.get(cacheKey);
    if (cached) return cached;

    try {
      // Parallel data fetching
      const [marketData, technicalIndicators, fundamentals, sentiment] = await Promise.all([
        this.getMarketData(symbol),
        this.calculateTechnicalIndicators(symbol),
        this.getFundamentals(symbol),
        this.getSentimentAnalysis(symbol)
      ]);

      const analysis = {};
      
      // Generate analysis for each timeframe
      for (const timeframe of timeframes) {
        analysis[timeframe] = await this.analyzeTimeframe(
          symbol, 
          timeframe, 
          marketData, 
          technicalIndicators, 
          fundamentals, 
          sentiment,
          riskProfile
        );
      }

      // Generate AI summary
      const aiSummary = await this.generateAISummary(symbol, analysis, sentiment);

      const result = {
        symbol,
        name: marketData.name,
        current_price: marketData.price,
        change: marketData.change,
        change_percent: marketData.changePercent,
        timestamp: new Date().toISOString(),
        analysis,
        ai_summary: aiSummary,
        risk_factors: this.identifyRiskFactors(analysis, sentiment),
        last_updated: new Date().toISOString()
      };

      return analysisCache.set(cacheKey, result);
    } catch (error) {
      console.error(`Analysis failed for ${symbol}:`, error);
      throw new Error(`Unable to analyze ${symbol}: ${error.message}`);
    }
  }

  // Get real-time market data
  async getMarketData(symbol) {
    const cacheKey = `market:${symbol}`;
    const cached = marketDataCache.get(cacheKey);
    if (cached) return cached;

    try {
      // Try Upstox API first
      let data;
      if (config.upstox.accessToken) {
        data = await this.fetchUpstoxData(symbol);
      }
      
      // Fallback to mock data for demo
      if (!data) {
        data = this.generateMockMarketData(symbol);
      }

      return marketDataCache.set(cacheKey, data);
    } catch (error) {
      console.warn(`Market data fetch failed for ${symbol}, using mock data`);
      return marketDataCache.set(cacheKey, this.generateMockMarketData(symbol));
    }
  }

  // Fetch data from Upstox API
  async fetchUpstoxData(symbol) {
    try {
      const response = await fetchJson(`https://api.upstox.com/v2/historical-candle/${symbol}/1minute/2024-03-26`, {
        headers: {
          'Authorization': `Bearer ${config.upstox.accessToken}`,
          'accept': 'application/json'
        },
        timeoutMs: 3000
      });

      if (response.data && response.data.candles) {
        const candles = response.data.candles;
        const latest = candles[candles.length - 1];
        const previous = candles[candles.length - 2];

        return {
          symbol,
          name: await this.getStockName(symbol),
          price: latest[4], // Close price
          change: latest[4] - previous[4],
          changePercent: ((latest[4] - previous[4]) / previous[4]) * 100,
          volume: latest[5],
          vwap: latest[6] || latest[4],
          high: latest[2],
          low: latest[3],
          open: latest[1],
          timestamp: latest[0]
        };
      }
    } catch (error) {
      console.warn(`Upstox API failed for ${symbol}:`, error.message);
    }
    return null;
  }

  // Generate mock market data for demo
  generateMockMarketData(symbol) {
    const basePrices = {
      'RELIANCE': 2850,
      'TCS': 3750,
      'INFY': 1550,
      'HDFCBANK': 1650,
      'ICICIBANK': 950,
      'SBIN': 750,
      'LT': 3200,
      'WIPRO': 450,
      'AXISBANK': 1100,
      'KOTAKBANK': 1850
    };

    const basePrice = basePrices[symbol] || 1000;
    const change = (Math.random() - 0.5) * basePrice * 0.05; // ±2.5%
    const price = basePrice + change;

    return {
      symbol,
      name: this.getStockNameSync(symbol),
      price: Math.round(price * 100) / 100,
      change: Math.round(change * 100) / 100,
      changePercent: Math.round((change / basePrice) * 10000) / 100,
      volume: Math.floor(Math.random() * 10000000) + 1000000,
      vwap: Math.round((price + (Math.random() - 0.5) * price * 0.02) * 100) / 100,
      high: Math.round((price + Math.random() * price * 0.03) * 100) / 100,
      low: Math.round((price - Math.random() * price * 0.03) * 100) / 100,
      open: Math.round((price + (Math.random() - 0.5) * price * 0.02) * 100) / 100,
      timestamp: Date.now()
    };
  }

  // Calculate technical indicators
  async calculateTechnicalIndicators(symbol) {
    const cacheKey = `indicators:${symbol}`;
    const cached = analysisCache.get(cacheKey);
    if (cached) return cached;

    // Generate mock technical indicators
    const indicators = {
      rsi: Math.random() * 100,
      macd: {
        value: (Math.random() - 0.5) * 10,
        signal: (Math.random() - 0.5) * 8,
        histogram: (Math.random() - 0.5) * 5
      },
      sma_20: Math.random() * 2000 + 1000,
      sma_50: Math.random() * 2000 + 1000,
      sma_200: Math.random() * 2000 + 1000,
      ema_20: Math.random() * 2000 + 1000,
      ema_50: Math.random() * 2000 + 1000,
      bollinger: {
        upper: Math.random() * 2000 + 1500,
        middle: Math.random() * 2000 + 1000,
        lower: Math.random() * 2000 + 500
      },
      stochastic: {
        k: Math.random() * 100,
        d: Math.random() * 100
      },
      atr: Math.random() * 50 + 10,
      volume_sma: Math.random() * 10000000 + 1000000
    };

    return analysisCache.set(cacheKey, indicators);
  }

  // Get fundamental data
  async getFundamentals(symbol) {
    const cacheKey = `fundamentals:${symbol}`;
    const cached = analysisCache.get(cacheKey, 24 * 60 * 60_000); // 24 hours cache
    if (cached) return cached;

    // Mock fundamental data
    const fundamentals = {
      pe_ratio: Math.random() * 40 + 10,
      pb_ratio: Math.random() * 8 + 1,
      roe: Math.random() * 25 + 5,
      roa: Math.random() * 15 + 2,
      debt_equity: Math.random() * 2,
      current_ratio: Math.random() * 2 + 0.5,
      promoter_holding: Math.random() * 60 + 30,
      institutional_holding: Math.random() * 40 + 10,
      revenue_growth: Math.random() * 30 - 5,
      profit_growth: Math.random() * 40 - 10,
      sector: this.getSector(symbol),
      market_cap: Math.random() * 1000000 + 100000 // in crores
    };

    return analysisCache.set(cacheKey, fundamentals, 24 * 60 * 60_000);
  }

  // Get sentiment analysis
  async getSentimentAnalysis(symbol) {
    const cacheKey = `sentiment:${symbol}`;
    const cached = sentimentCache.get(cacheKey);
    if (cached) return cached;

    // Mock sentiment analysis
    const sentiment = {
      overall: Math.random() > 0.5 ? 'bullish' : 'bearish',
      score: Math.random() * 2 - 1, // -1 to 1
      news_volume: Math.floor(Math.random() * 100) + 10,
      social_volume: Math.floor(Math.random() * 1000) + 100,
      analyst_rating: ['buy', 'hold', 'sell'][Math.floor(Math.random() * 3)],
      key_factors: this.generateKeyFactors(symbol),
      recent_headlines: this.generateMockHeadlines(symbol)
    };

    return sentimentCache.set(cacheKey, sentiment);
  }

  // Analyze specific timeframe
  async analyzeTimeframe(symbol, timeframe, marketData, indicators, fundamentals, sentiment, riskProfile) {
    switch (timeframe) {
      case 'intraday':
        return this.analyzeIntraday(symbol, marketData, indicators, sentiment, riskProfile);
      case 'swing':
        return this.analyzeSwing(symbol, marketData, indicators, sentiment, riskProfile);
      case 'short_term':
        return this.analyzeShortTerm(symbol, marketData, indicators, fundamentals, sentiment, riskProfile);
      case 'long_term':
        return this.analyzeLongTerm(symbol, marketData, indicators, fundamentals, sentiment, riskProfile);
      default:
        throw new Error(`Unknown timeframe: ${timeframe}`);
    }
  }

  // Intraday analysis (1-5 minutes)
  analyzeIntraday(symbol, marketData, indicators, sentiment, riskProfile) {
    const trend = this.determineIntradayTrend(indicators, marketData);
    const levels = this.calculateSupportResistance(marketData, indicators);
    const entry = trend === 'bullish' ? levels.support : levels.resistance;
    const target = trend === 'bullish' ? levels.resistance : levels.support;
    const stopLoss = trend === 'bullish' ? levels.support * 0.98 : levels.resistance * 1.02;

    const confidence = this.calculateConfidence(indicators, sentiment, 'intraday');

    return {
      trend,
      entry: Math.round(entry * 100) / 100,
      target: Math.round(target * 100) / 100,
      stop_loss: Math.round(stopLoss * 100) / 100,
      confidence: Math.round(confidence),
      risk_reward: Math.round(Math.abs(target - entry) / Math.abs(entry - stopLoss) * 100) / 100,
      indicators: {
        rsi: Math.round(indicators.rsi * 100) / 100,
        macd: indicators.macd.value > indicators.macd.signal ? 'bullish' : 'bearish',
        vwap_position: marketData.price > marketData.vwap ? 'above' : 'below',
        volume_ratio: Math.round(marketData.volume / indicators.volume_sma * 100) / 100
      },
      time_horizon: '1-5 hours',
      setup: this.identifyIntradaySetup(indicators, marketData)
    };
  }

  // Swing trading analysis (2-10 days)
  analyzeSwing(symbol, marketData, indicators, sentiment, riskProfile) {
    const setup = this.identifySwingSetup(indicators, marketData);
    const levels = this.calculateSwingLevels(marketData, indicators);
    
    let entry, target, stopLoss;
    if (setup.includes('bullish')) {
      entry = levels.breakout_level;
      target = levels.target_high;
      stopLoss = levels.stop_loss;
    } else {
      entry = levels.breakdown_level;
      target = levels.target_low;
      stopLoss = levels.stop_loss_high;
    }

    const confidence = this.calculateConfidence(indicators, sentiment, 'swing');

    return {
      setup,
      entry: Math.round(entry * 100) / 100,
      target: Math.round(target * 100) / 100,
      stop_loss: Math.round(stopLoss * 100) / 100,
      confidence: Math.round(confidence),
      risk_reward: Math.round(Math.abs(target - entry) / Math.abs(entry - stopLoss) * 100) / 100,
      time_horizon: '3-7 days',
      volume_confirmation: marketData.volume > indicators.volume_sma * 1.2,
      pattern_strength: this.calculatePatternStrength(indicators),
      key_levels: levels
    };
  }

  // Short-term analysis (1-4 months)
  analyzeShortTerm(symbol, marketData, indicators, fundamentals, sentiment, riskProfile) {
    const direction = this.determineMediumTermTrend(indicators, fundamentals, sentiment, marketData);
    const expectedMove = this.calculateExpectedMove(indicators, indicators.atr);
    const confidence = this.calculateConfidence(indicators, sentiment, 'short_term');

    return {
      direction,
      expected_move: `${direction === 'bullish' ? '+' : '-'}${Math.round(expectedMove * 100)}%`,
      timeframe: '1-3 months',
      confidence: Math.round(confidence),
      key_factors: this.identifyKeyMediumTermFactors(indicators, fundamentals, sentiment),
      technical_score: this.calculateTechnicalScore(indicators),
      fundamental_score: this.calculateFundamentalScore(fundamentals),
      sentiment_score: Math.round((sentiment.score + 1) * 50), // Convert -1:1 to 0:100
      sector_trend: this.analyzeSectorTrend(fundamentals.sector),
      institutional_activity: this.analyzeInstitutionalActivity(fundamentals)
    };
  }

  // Long-term analysis (6+ months)
  analyzeLongTerm(symbol, marketData, indicators, fundamentals, sentiment, riskProfile) {
    const verdict = this.determineLongTermVerdict(fundamentals, sentiment);
    const strength = this.calculateBusinessStrength(fundamentals);
    const confidence = this.calculateLongTermConfidence(fundamentals, sentiment);

    return {
      verdict,
      strength,
      confidence: Math.round(confidence),
      fundamentals: {
        pe_ratio: Math.round(fundamentals.pe_ratio * 100) / 100,
        pb_ratio: Math.round(fundamentals.pb_ratio * 100) / 100,
        roe: Math.round(fundamentals.roe * 100) / 100,
        debt_equity: Math.round(fundamentals.debt_equity * 100) / 100,
        revenue_growth: Math.round(fundamentals.revenue_growth * 100) / 100,
        profit_growth: Math.round(fundamentals.profit_growth * 100) / 100
      },
      business_quality: this.assessBusinessQuality(fundamentals),
      competitive_advantage: this.assessCompetitiveAdvantage(symbol, fundamentals),
      management_quality: Math.round(Math.random() * 40 + 60), // Mock score 60-100
      future_prospects: this.assessFutureProspects(fundamentals, sentiment),
      dividend_yield: Math.round(Math.random() * 3 * 100) / 100, // Mock 0-3%
      expansion_potential: this.assessExpansionPotential(fundamentals)
    };
  }

  // Helper methods for analysis
  determineIntradayTrend(indicators, marketData) {
    if (indicators.rsi > 60 && marketData.price > marketData.vwap) return 'bullish';
    if (indicators.rsi < 40 && marketData.price < marketData.vwap) return 'bearish';
    return 'sideways';
  }

  calculateSupportResistance(marketData, indicators) {
    const volatility = indicators.atr;
    return {
      support: Math.round((marketData.price - volatility * 0.5) * 100) / 100,
      resistance: Math.round((marketData.price + volatility * 0.5) * 100) / 100
    };
  }

  calculateConfidence(indicators, sentiment, timeframe) {
    let confidence = 50; // Base confidence

    // Technical factors
    if (indicators.rsi > 30 && indicators.rsi < 70) confidence += 10;
    if (Math.abs(indicators.macd.histogram) > 2) confidence += 10;
    
    // Sentiment factors
    confidence += sentiment.score * 20;
    
    // Timeframe adjustments
    if (timeframe === 'intraday') confidence *= 0.8;
    if (timeframe === 'long_term') confidence *= 1.2;

    return Math.min(95, Math.max(25, confidence));
  }

  identifyIntradaySetup(indicators, marketData) {
    if (indicators.rsi > 70) return 'overbought';
    if (indicators.rsi < 30) return 'oversold';
    if (indicators.macd.value > indicators.macd.signal && indicators.rsi > 50) return 'bullish_momentum';
    if (indicators.macd.value < indicators.macd.signal && indicators.rsi < 50) return 'bearish_momentum';
    return 'neutral';
  }

  identifySwingSetup(indicators, marketData) {
    const setups = [];
    if (marketData.price > indicators.sma_20 && indicators.sma_20 > indicators.sma_50) {
      setups.push('bullish_trend');
    }
    if (marketData.price < indicators.sma_20 && indicators.sma_20 < indicators.sma_50) {
      setups.push('bearish_trend');
    }
    if (Math.abs(indicators.rsi - 50) > 20) {
      setups.push(indicators.rsi > 50 ? 'momentum_bullish' : 'momentum_bearish');
    }
    return setups.length > 0 ? setups.join('_') : 'neutral';
  }

  calculateSwingLevels(marketData, indicators) {
    const atr = indicators.atr;
    return {
      breakout_level: Math.round((indicators.sma_20 + atr * 0.3) * 100) / 100,
      breakdown_level: Math.round((indicators.sma_20 - atr * 0.3) * 100) / 100,
      target_high: Math.round((indicators.sma_20 + atr * 1.5) * 100) / 100,
      target_low: Math.round((indicators.sma_20 - atr * 1.5) * 100) / 100,
      stop_loss: Math.round((marketData.price - atr * 0.8) * 100) / 100,
      stop_loss_high: Math.round((marketData.price + atr * 0.8) * 100) / 100
    };
  }

  determineMediumTermTrend(indicators, fundamentals, sentiment, marketData) {
    let score = 0;
    if (marketData.price > indicators.sma_50) score += 1;
    if (indicators.sma_20 > indicators.sma_50) score += 1;
    if (fundamentals.revenue_growth > 10) score += 1;
    if (sentiment.overall === 'bullish') score += 1;
    
    return score >= 3 ? 'bullish' : score <= 1 ? 'bearish' : 'neutral';
  }

  calculateExpectedMove(indicators, volatility) {
    return (volatility / indicators.sma_20) * 100 * 5; // 5x ATR as expected move
  }

  determineLongTermVerdict(fundamentals, sentiment) {
    let score = 0;
    if (fundamentals.pe_ratio < 25) score += 1;
    if (fundamentals.roe > 15) score += 1;
    if (fundamentals.debt_equity < 1) score += 1;
    if (fundamentals.revenue_growth > 10) score += 1;
    if (sentiment.overall === 'bullish') score += 1;
    
    if (score >= 4) return 'strong_buy';
    if (score >= 3) return 'buy';
    if (score >= 2) return 'hold';
    return 'sell';
  }

  calculateBusinessStrength(fundamentals) {
    const score = (
      (fundamentals.roe > 15 ? 25 : 0) +
      (fundamentals.debt_equity < 0.5 ? 25 : 0) +
      (fundamentals.revenue_growth > 15 ? 25 : 0) +
      (fundamentals.profit_growth > 15 ? 25 : 0)
    );
    return score >= 75 ? 'excellent' : score >= 50 ? 'good' : score >= 25 ? 'average' : 'weak';
  }

  // Generate AI summary using RAG approach
  async generateAISummary(symbol, analysis, sentiment) {
    const summaries = [];
    
    // Intraday summary
    if (analysis.intraday) {
      const intraday = analysis.intraday;
      summaries.push(`Intraday: ${intraday.trend} trend with ${intraday.confidence}% confidence. ${intraday.setup} pattern detected.`);
    }
    
    // Swing summary
    if (analysis.swing) {
      const swing = analysis.swing;
      summaries.push(`Swing: ${swing.setup} setup over ${swing.time_horizon} with risk-reward of ${swing.risk_reward}.`);
    }
    
    // Medium-term summary
    if (analysis.short_term) {
      const short = analysis.short_term;
      summaries.push(`Short-term: ${short.direction} bias expecting ${short.expected_move} move over ${short.timeframe}.`);
    }
    
    // Long-term summary
    if (analysis.long_term) {
      const long = analysis.long_term;
      summaries.push(`Long-term: ${long.verdict} recommendation with ${long.strength} business fundamentals.`);
    }
    
    // Overall sentiment
    summaries.push(`Market sentiment: ${sentiment.overall} with sentiment score of ${sentiment.score.toFixed(2)}.`);
    
    return summaries.join(' ');
  }

  // Identify risk factors
  identifyRiskFactors(analysis, sentiment) {
    const risks = [];
    
    if (sentiment.score < -0.3) risks.push('negative_sentiment');
    if (analysis.intraday?.confidence < 50) risks.push('low_intraday_confidence');
    if (analysis.long_term?.fundamentals?.debt_equity > 1.5) risks.push('high_debt');
    if (analysis.swing?.volume_confirmation === false) risks.push('low_volume_confirmation');
    
    return risks.length > 0 ? risks : ['market_volatility'];
  }

  // Helper methods for mock data generation
  async getStockName(symbol) {
    const names = {
      'RELIANCE': 'Reliance Industries Ltd.',
      'TCS': 'Tata Consultancy Services',
      'INFY': 'Infosys Ltd.',
      'HDFCBANK': 'HDFC Bank Ltd.',
      'ICICIBANK': 'ICICI Bank Ltd.',
      'SBIN': 'State Bank of India',
      'LT': 'Larsen & Toubro Ltd.',
      'WIPRO': 'Wipro Ltd.',
      'AXISBANK': 'Axis Bank Ltd.',
      'KOTAKBANK': 'Kotak Mahindra Bank Ltd.'
    };
    return names[symbol] || `${symbol} Ltd.`;
  }

  getStockNameSync(symbol) {
    const names = {
      'RELIANCE': 'Reliance Industries Ltd.',
      'TCS': 'Tata Consultancy Services',
      'INFY': 'Infosys Ltd.',
      'HDFCBANK': 'HDFC Bank Ltd.',
      'ICICIBANK': 'ICICI Bank Ltd.',
      'SBIN': 'State Bank of India',
      'LT': 'Larsen & Toubro Ltd.',
      'WIPRO': 'Wipro Ltd.',
      'AXISBANK': 'Axis Bank Ltd.',
      'KOTAKBANK': 'Kotak Mahindra Bank Ltd.'
    };
    return names[symbol] || `${symbol} Ltd.`;
  }

  getSector(symbol) {
    const sectors = {
      'RELIANCE': 'Energy',
      'TCS': 'Technology',
      'INFY': 'Technology',
      'HDFCBANK': 'Financials',
      'ICICIBANK': 'Financials',
      'SBIN': 'Financials',
      'LT': 'Infrastructure',
      'WIPRO': 'Technology',
      'AXISBANK': 'Financials',
      'KOTAKBANK': 'Financials'
    };
    return sectors[symbol] || 'Unknown';
  }

  generateKeyFactors(symbol) {
    const factors = [
      'strong_earnings',
      'sector_momentum',
      'institutional_buying',
      'technical_breakout',
      'market_leadership',
      'expansion_plans'
    ];
    return factors.sort(() => Math.random() - 0.5).slice(0, 3);
  }

  generateMockHeadlines(symbol) {
    const headlines = [
      `${symbol} reports strong Q3 earnings`,
      `Analysts maintain bullish view on ${symbol}`,
      `${symbol} announces new expansion plans`,
      `Institutional investors increase stake in ${symbol}`,
      `${symbol} shows technical breakout patterns`
    ];
    return headlines.sort(() => Math.random() - 0.5).slice(0, 2);
  }

  // Additional helper methods
  calculatePatternStrength(indicators) {
    return Math.round(Math.random() * 40 + 60); // Mock 60-100
  }

  identifyKeyMediumTermFactors(indicators, fundamentals, sentiment) {
    return ['technical_trend', 'fundamental_strength', 'market_sentiment'].sort(() => Math.random() - 0.5).slice(0, 2);
  }

  calculateTechnicalScore(indicators) {
    return Math.round(Math.random() * 30 + 35); // Mock 35-65
  }

  calculateFundamentalScore(fundamentals) {
    return Math.round(Math.random() * 25 + 37.5); // Mock 37.5-62.5
  }

  analyzeSectorTrend(sector) {
    return ['bullish', 'neutral', 'bearish'][Math.floor(Math.random() * 3)];
  }

  analyzeInstitutionalActivity(fundamentals) {
    return fundamentals.institutional_holding > 25 ? 'high' : 'moderate';
  }

  assessBusinessQuality(fundamentals) {
    const score = fundamentals.roe + (20 - fundamentals.pe_ratio) + (15 - fundamentals.revenue_growth);
    return score > 40 ? 'excellent' : score > 20 ? 'good' : 'average';
  }

  assessCompetitiveAdvantage(symbol, fundamentals) {
    return ['strong', 'moderate', 'emerging'][Math.floor(Math.random() * 3)];
  }

  calculateLongTermConfidence(fundamentals, sentiment) {
    let confidence = 50;
    if (fundamentals.roe > 15) confidence += 15;
    if (fundamentals.debt_equity < 1) confidence += 15;
    if (sentiment.overall === 'bullish') confidence += 10;
    return Math.min(90, confidence);
  }

  assessFutureProspects(fundamentals, sentiment) {
    return ['excellent', 'good', 'moderate'][Math.floor(Math.random() * 3)];
  }

  assessExpansionPotential(fundamentals) {
    return fundamentals.revenue_growth > 15 ? 'high' : 'moderate';
  }
}

// Export singleton instance
export const tradingEngine = new TradingAnalysisEngine();
