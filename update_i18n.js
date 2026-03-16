import fs from 'fs';

const filePath = './src/i18n.ts';
let content = fs.readFileSync(filePath, 'utf-8');

const newTranslations = {
  en: {
    "Scanning order books, calculating technical indicators, and running machine learning models for": "Scanning order books, calculating technical indicators, and running machine learning models for",
    "STRONG BUY": "STRONG BUY",
    "STRONG SELL": "STRONG SELL",
    "NEUTRAL": "NEUTRAL",
    "Strong Uptrend": "Strong Uptrend",
    "Strong Downtrend": "Strong Downtrend",
    "Mixed": "Mixed",
    "Trend Strength": "Trend Strength",
    "Strong": "Strong",
    "Beginning": "Beginning",
    "Flat": "Flat",
    "Overbought": "Overbought",
    "Oversold": "Oversold",
    "Neutral": "Neutral",
    "Bullish Cross": "Bullish Cross",
    "Bearish Cross": "Bearish Cross",
    "Bullish": "Bullish",
    "Bearish": "Bearish",
    "Accumulation": "Accumulation",
    "Distribution": "Distribution",
    "In Channel": "In Channel",
    "Stop Loss ref": "Stop Loss ref",
    "Not financial advice. Trade at your own risk.": "Not financial advice. Trade at your own risk.",
    "Close Analysis": "Close Analysis"
  },
  ru: {
    "Scanning order books, calculating technical indicators, and running machine learning models for": "Сканирование стаканов, расчет технических индикаторов и запуск моделей машинного обучения для",
    "STRONG BUY": "СТРОГИЙ ПОКУПАТЬ",
    "STRONG SELL": "СТРОГИЙ ПРОДАВАТЬ",
    "NEUTRAL": "НЕЙТРАЛЬНО",
    "Strong Uptrend": "Сильный восходящий тренд",
    "Strong Downtrend": "Сильный нисходящий тренд",
    "Mixed": "Смешанный",
    "Trend Strength": "Сила тренда",
    "Strong": "Сильный",
    "Beginning": "Начало",
    "Flat": "Флэт",
    "Overbought": "Перекуплен",
    "Oversold": "Перепродан",
    "Neutral": "Нейтрально",
    "Bullish Cross": "Бычье пересечение",
    "Bearish Cross": "Медвежье пересечение",
    "Bullish": "Бычий",
    "Bearish": "Медвежий",
    "Accumulation": "Накопление",
    "Distribution": "Распределение",
    "In Channel": "В канале",
    "Stop Loss ref": "Stop Loss ref",
    "Not financial advice. Trade at your own risk.": "Не финансовый совет. Торгуйте на свой страх и риск.",
    "Close Analysis": "Закрыть анализ"
  }
};

// For other languages, just copy English for now
const langs = ['ko', 'ja', 'zh', 'vi', 'id', 'de', 'cs', 'it', 'fr', 'es'];
for (const lang of langs) {
  newTranslations[lang] = { ...newTranslations.en };
}

for (const [lang, translations] of Object.entries(newTranslations)) {
  const regex = new RegExp(`(${lang}:\\s*{\\s*translation:\\s*{)([\\s\\S]*?)(}\\s*})`);
  content = content.replace(regex, (match, p1, p2, p3) => {
    let newProps = '';
    for (const [key, value] of Object.entries(translations)) {
      if (!p2.includes(`"${key}":`)) {
        newProps += `      "${key}": "${value}",\n`;
      }
    }
    return `${p1}${p2}${newProps}${p3}`;
  });
}

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Translations added successfully.');
