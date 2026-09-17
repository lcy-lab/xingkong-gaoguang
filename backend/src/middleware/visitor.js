const VISITOR_RE = /^[a-zA-Z0-9-]{8,64}$/;

function getVisitorId(req) {
  const header = String(req.headers["x-visitor-id"] || "").trim();
  if (VISITOR_RE.test(header)) return header;
  return "";
}

module.exports = { getVisitorId };
