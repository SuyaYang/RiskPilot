import { createMerchantServer } from "./server";
const port = Number(process.env.MERCHANT_PORT || 3200);
const server = createMerchantServer({ port });
server.on("error", error => { console.error(`Merchant demo could not start: ${error.message}`); process.exitCode = 1; });
server.listen(port, "127.0.0.1", () => console.log(`Independent Sandbox merchant: http://localhost:${port}\nStore → PayPal Continue → RiskPilot impact review → explicit confirmation → store receipt. No extension required.`));
