// server.js - 使用 Alpha Vantage 抓取美股行情，意大利股票手动价格，不含 AI 解析
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

// ===== Alpha Vantage 配置（只用于美股） =====
// 已写死你的 API KEY，不再依赖环境变量
const ALPHA_VANTAGE_API_KEY = "ZG4H6IIL92LJBUFX";

// 简单提示一下，防止以后不小心改掉
if (!ALPHA_VANTAGE_API_KEY) {
  console.warn("⚠ 当前没有配置 Alpha Vantage API Key，美股行情将无法获取！");
}
// =======================================

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

/**
 * GET /api/quote
 * 用于前端获取美股实时行情
 * 仅支持 market=US，美股；意大利股票请在前端手动录入现价
 *
 * 请求示例：
 *   /api/quote?symbol=SYM&market=US
 */
app.get("/api/quote", async (req, res) => {
  const symbol = (req.query.symbol || "").trim();
  const market = (req.query.market || "US").toUpperCase();

  if (!symbol) {
    return res.status(400).json({
      error:
        "symbol 参数必填，请填写股票代码（括号里的英文字母），例如 SYM / AAPL。",
    });
  }

  if (market !== "US") {
    return res.status(400).json({
      error: "当前行情接口仅支持美股；意大利股票请在前端录入或修改现价。",
    });
  }

  const rawSymbol = symbol.toUpperCase();

  try {
    const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(
      rawSymbol
    )}&apikey=${ALPHA_VANTAGE_API_KEY}&datatype=json`;

    console.log("调用 Alpha Vantage (US):", url);

    const resp = await axios.get(url, { timeout: 10000 });
    const data = resp.data || {};

    // ★ 把 Alpha 返回的原始 JSON 打印出来，方便在 Render 上看问题
    console.log(
      "Alpha Vantage 返回原始数据:",
      JSON.stringify(data).slice(0, 500) // 防止太长
    );

    // 频率限制 / 日调用限制时，Alpha 会返回 Note 或 Information
    if (data.Note || data.Information) {
      throw new Error(
        (data.Note || data.Information) +
          "（可能是请求频率或每日次数限制导致）"
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

    const result = {
      symbol: rawSymbol,
      shortName: rawSymbol,
      price,
      currency: "USD",
      source: "Alpha Vantage",
    };

    console.log("获取美股行情成功:", result);
    res.json(result);
  } catch (err) {
    console.error("获取美股行情出错:", err.message);
    res.status(500).json({
      error:
        "未能获取该美股行情，请确认代码是否正确，或稍后再试。详细信息：" +
        err.message,
    });
  }
});

// ------- 静态页面兜底（Render、本地都通用） -------
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
    `✅ Italy + US portfolio tracker (US=AlphaVantage, IT=手动价格, 无AI解析) running at http://localhost:${PORT}`
  );
});
