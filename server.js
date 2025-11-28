// server.js
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

// ========== Alpha Vantage（只给美股用） ==========
// !!! 这里一定要换成你自己的 Alpha Vantage API Key !!!
// 登录 https://www.alphavantage.co 复制你的 KEY，粘贴到下面这行引号里：
const ALPHA_VANTAGE_API_KEY = "ZG4H6IIL92LJBUFX";
// ================================================

if (!ALPHA_VANTAGE_API_KEY || ALPHA_VANTAGE_API_KEY.includes("在这里")) {
  console.warn(
    "⚠ 警告：当前 ALPHA_VANTAGE_API_KEY 还没有配置，美股行情会返回错误。"
  );
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

/**
 * 美股行情（Alpha Vantage）
 */
async function fetchAlphaQuote_US(symbol) {
  if (!ALPHA_VANTAGE_API_KEY || ALPHA_VANTAGE_API_KEY.includes("在这里")) {
    throw new Error(
      "服务器未配置 Alpha Vantage API Key，请先在 server.js 顶部填写你的 API Key。"
    );
  }

  const raw = (symbol || "").trim().toUpperCase();
  if (!raw) throw new Error("symbol 不能为空");

  const alphaSymbol = raw;

  const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(
    alphaSymbol
  )}&apikey=${ALPHA_VANTAGE_API_KEY}&datatype=json`;

  console.log("调用 Alpha Vantage (US):", url);

  const resp = await axios.get(url, { timeout: 10000 });
  const data = resp.data || {};

  if (data.Note) {
    throw new Error(
      "Alpha Vantage 提示调用太频繁（免费账户限制），请稍后再试。"
    );
  }

  const quote = data["Global Quote"] || data["Global_Quote"];
  if (!quote || !quote["05. price"]) {
    throw new Error(
      "未在 Alpha Vantage 找到该美股，请确认代码是否正确，例如 SYM / AAPL。"
    );
  }

  const price = parseFloat(quote["05. price"]);
  if (!isFinite(price)) {
    throw new Error("返回价格不是有效数字：" + quote["05. price"]);
  }

  return {
    symbol: alphaSymbol,
    shortName: alphaSymbol,
    price,
    currency: "USD",
    source: "Alpha Vantage"
  };
}

/**
 * 综合行情接口：
 * 目前只有美股会调用，意大利部分已改为手动价格，不再请求外部接口。
 *   /api/quote?symbol=SYM&market=US
 */
app.get("/api/quote", async (req, res) => {
  const symbol = (req.query.symbol || "").trim();
  const market = (req.query.market || "US").toUpperCase(); // 只支持 US

  if (!symbol) {
    return res.status(400).json({
      error:
        "symbol 参数必填，请填写股票代码（括号里的英文字母），例如美股 SYM / AAPL。"
    });
  }

  try {
    if (market !== "US") {
      // 前端现在不会传 IT 到这里，这里只是兜底
      return res.status(400).json({
        error: "当前接口仅支持美股行情；意大利股票价格已改为手动维护。"
      });
    }

    const quote = await fetchAlphaQuote_US(symbol);
    console.log("获取美股行情成功:", quote);
    res.json(quote);
  } catch (err) {
    console.error("获取美股行情出错:", err.message);
    res.status(500).json({
      error:
        "未能获取该美股行情，请确认代码是否正确，或稍后再试。详细信息：" +
        err.message
    });
  }
});

// 静态页面兜底
app.get("*", (req, res) => {
  const htmlPath = path.join(__dirname, "public", "index.html");
  const htmPath = path.join(__dirname, "public", "index.htm");

  if (fs.existsSync(htmlPath)) {
    res.sendFile(htmlPath);
  } else if (fs.existsSync(htmPath)) {
    res.sendFile(htmPath);
  } else {
    res
      .status(404)
      .send("找不到前端页面：请确认 public 目录下存在 index.html 或 index.htm");
  }
});

app.listen(PORT, () => {
  console.log(
    `✅ Italy + US portfolio tracker (US=AlphaVantage, IT=手动价格) running at http://localhost:${PORT}`
  );
});
