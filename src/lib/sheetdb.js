const axios = require('axios');
const config = require('../config');

const client = axios.create({
  baseURL: config.sheetdbUrl,
  headers: { 'Content-Type': 'application/json' },
});

if (config.sheetdbAuth) {
  const auth = Buffer.from(
    `${config.sheetdbAuth.login}:${config.sheetdbAuth.password}`
  ).toString('base64');
  client.defaults.headers.Authorization = `Basic ${auth}`;
}

const cache = { data: {}, time: {} };
const TTL = 60 * 60 * 1000;
const STALE_TTL = 2 * 60 * 60 * 1000;

function isCached(sheetName) {
  return (
    cache.data[sheetName] &&
    cache.time[sheetName] &&
    Date.now() - cache.time[sheetName] < TTL
  );
}

function isStale(sheetName) {
  return (
    cache.data[sheetName] &&
    cache.time[sheetName] &&
    Date.now() - cache.time[sheetName] < STALE_TTL
  );
}

function invalidate(sheetName) {
  delete cache.data[sheetName];
  delete cache.time[sheetName];
}

const pendingRevalidation = {};

async function revalidate(sheetName) {
  if (pendingRevalidation[sheetName]) return;
  pendingRevalidation[sheetName] = true;
  try {
    const res = await client.get('/', { params: { sheet: sheetName } });
    cache.data[sheetName] = res.data;
    cache.time[sheetName] = Date.now();
  } catch (err) {
    console.error(`[SheetDB] Revalidation failed for ${sheetName}:`, err.message);
  } finally {
    delete pendingRevalidation[sheetName];
  }
}

async function read(sheetName, options = {}) {
  const params = { sheet: sheetName };
  if (options.limit) params.limit = options.limit;
  if (options.offset) params.offset = options.offset;
  if (options.search) params.search = JSON.stringify(options.search);

  const isFullRead = Object.keys(options).length === 0;

  if (isFullRead && cache.data[sheetName]) {
    if (isCached(sheetName)) {
      return cache.data[sheetName];
    }
    if (isStale(sheetName)) {
      revalidate(sheetName);
      return cache.data[sheetName];
    }
  }

  const res = await client.get('/', { params });

  if (isFullRead) {
    cache.data[sheetName] = res.data;
    cache.time[sheetName] = Date.now();
  }

  return res.data;
}

async function create(sheetName, data) {
  const payload = Array.isArray(data) ? data : [data];
  const res = await client.post('/', { data: payload, sheet: sheetName });
  invalidate(sheetName);
  return res.data;
}

async function update(sheetName, searchColumn, searchValue, newData) {
  const res = await client.patch(
    `/${searchColumn}/${encodeURIComponent(searchValue)}`,
    { data: newData, sheet: sheetName }
  );
  invalidate(sheetName);
  return res.data;
}

async function remove(sheetName, searchColumn, searchValue) {
  const res = await client.delete(
    `/${searchColumn}/${encodeURIComponent(searchValue)}`,
    { data: { sheet: sheetName } }
  );
  invalidate(sheetName);
  return res.data;
}

module.exports = { read, create, update, remove };
