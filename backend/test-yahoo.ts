import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance();

(yahooFinance.quote('VOO') as any).then((res: any) => {
  console.log("Success:", res.symbol);
}).catch((err: any) => {
  console.error("Error fetching VOO:", err.message);
});
