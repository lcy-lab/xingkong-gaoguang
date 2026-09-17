const crypto = require("crypto");
const https = require("https");
const { URLSearchParams } = require("url");

function percentEncode(value) {
  return encodeURIComponent(value)
    .replace(/!/g, "%21")
    .replace(/'/g, "%27")
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29")
    .replace(/\*/g, "%2A");
}

function sendAliyunSms(phone, code) {
  const accessKeyId = process.env.ALIYUN_ACCESS_KEY_ID;
  const accessKeySecret = process.env.ALIYUN_ACCESS_KEY_SECRET;
  const signName = process.env.ALIYUN_SMS_SIGN_NAME;
  const templateCode = process.env.ALIYUN_SMS_TEMPLATE_CODE;
  if (!accessKeyId || !accessKeySecret || !signName || !templateCode) {
    return Promise.reject(new Error("未配置阿里云短信参数。"));
  }

  const params = {
    AccessKeyId: accessKeyId,
    Action: "SendSms",
    Format: "JSON",
    PhoneNumbers: phone,
    RegionId: "cn-hangzhou",
    SignName: signName,
    SignatureMethod: "HMAC-SHA1",
    SignatureNonce: crypto.randomBytes(16).toString("hex"),
    SignatureVersion: "1.0",
    TemplateCode: templateCode,
    TemplateParam: JSON.stringify({ code }),
    Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    Version: "2017-05-25",
  };

  const canonical = Object.keys(params)
    .sort()
    .map((key) => `${percentEncode(key)}=${percentEncode(String(params[key]))}`)
    .join("&");
  const stringToSign = `GET&${percentEncode("/")}&${percentEncode(canonical)}`;
  const signature = crypto
    .createHmac("sha1", `${accessKeySecret}&`)
    .update(stringToSign)
    .digest("base64");
  const query = `${canonical}&Signature=${percentEncode(signature)}`;

  return new Promise((resolve, reject) => {
    https
      .get(`https://dysmsapi.aliyuncs.com/?${query}`, (res) => {
        let body = "";
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          try {
            const data = JSON.parse(body);
            if (data.Code === "OK") resolve(data);
            else reject(new Error(data.Message || "短信发送失败"));
          } catch (err) {
            reject(err);
          }
        });
      })
      .on("error", reject);
  });
}

async function sendSms(phone, code) {
  if (process.env.SMS_DEV === "1" || process.env.SMS_DEV === "true") {
    console.log(`[SMS-DEV] ${phone} 验证码 ${code}`);
    return { dev: true };
  }
  await sendAliyunSms(phone, code);
  return { dev: false };
}

module.exports = { sendSms };
