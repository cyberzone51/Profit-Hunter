fetch('http://localhost:3000/api/tickers').then(res => res.json()).then(data => console.log(data.retCode)).catch(console.error);
