const path = require("node:path");
const { pathToFileURL } = require("node:url");

function buildWindowUrl({ isSolo = false, view = null, id = null } = {}) {
  const params = new URLSearchParams();
  if (isSolo) params.set("solo", "1");
  if (view) params.set("view", view);
  if (id) params.set("id", id);

  const baseUrl = pathToFileURL(path.join(__dirname, "index.html")).toString();
  const query = params.toString();
  return query ? `${baseUrl}?${query}` : baseUrl;
}

module.exports = {
  buildWindowUrl,
};
