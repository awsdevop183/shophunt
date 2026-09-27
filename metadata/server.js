'use strict';
/* ============================================================================
 * ShopHunt — MOCK cloud metadata service (fake IMDS)
 * ----------------------------------------------------------------------------
 * ⚠️  This is a FAKE, self-contained imitation of a cloud instance metadata
 *     service (like AWS IMDS at 169.254.169.254). It exists ONLY so students
 *     can practice exploiting the SSRF flagship and "steal" credentials that
 *     are entirely fabricated. It NEVER talks to any real cloud provider.
 *
 * It runs on an ISOLATED, internal docker network (see docker-compose.yml) and
 * is not published to the host, so it is reachable only server-side — exactly
 * like a real metadata endpoint would be from a vulnerable server.
 *
 * Endpoints mimic AWS IMDS so real-world tooling/payloads work:
 *   GET  /latest/meta-data/
 *   GET  /latest/meta-data/iam/security-credentials/
 *   GET  /latest/meta-data/iam/security-credentials/<role>
 *   GET  /latest/dynamic/instance-identity/document
 *   GET  /latest/meta-data/hostname, /instance-id, /local-ipv4, ...
 *   PUT  /latest/api/token                     (IMDSv2 token flow)
 *   GET  /latest/user-data
 * Plus a FAKE internal cloud API to demonstrate post-exploitation impact:
 *   GET  /lab-cloud/s3/backups                 (requires the stolen creds)
 * ========================================================================== */

const http = require('http');
const url = require('url');

const PORT = process.env.PORT || 80;

// ---- Fabricated, obviously-fake instance + role data -----------------------
const FAKE_ROLE = 'shophunt-app-instance-role';

// These credentials are 100% fake and only "valid" against the mock cloud API
// below. AKIA-prefixed key is fictional; the whole point is teaching, not access.
const FAKE_CREDENTIALS = {
  Code: 'Success',
  LastUpdated: '2026-01-15T09:12:33Z',
  Type: 'AWS-HMAC',
  AccessKeyId: 'AKIAI44QH8DHBLABFAKE',
  SecretAccessKey: 'je7MtGbClwBF/2Zp9Utk/h3yCo8nvbLABFAKEKEY',
  Token: 'IQoJb3JpZ2luX2VjEXAMPLEFAKESESSIONTOKENFORTRAININGONLYxxxxxxxxxxxxxxxx==',
  Expiration: '2099-12-31T23:59:59Z',
};

const INSTANCE_IDENTITY = {
  accountId: '000000000000',
  region: 'lab-local-1',
  instanceId: 'i-0fakelab00c0ffee',
  instanceType: 't3.micro',
  imageId: 'ami-0faketrainingimage',
  privateIp: '10.20.30.40',
  version: '2017-09-30',
};

const META_TREE = {
  'ami-id': INSTANCE_IDENTITY.imageId,
  'hostname': 'ip-10-20-30-40.lab-local-1.compute.internal',
  'instance-id': INSTANCE_IDENTITY.instanceId,
  'instance-type': INSTANCE_IDENTITY.instanceType,
  'local-ipv4': INSTANCE_IDENTITY.privateIp,
  'public-ipv4': '203.0.113.42',
  'placement/region': INSTANCE_IDENTITY.region,
  'placement/availability-zone': 'lab-local-1a',
};

// Fake EC2 user-data — the kind of thing that leaks secrets in the real world.
const FAKE_USER_DATA = [
  '#!/bin/bash',
  '# ShopHunt bootstrap (FAKE user-data for the recon/SSRF lab)',
  'export DB_PASSWORD="shophunt-lab-only"',
  'export INTERNAL_SLACK_WEBHOOK="https://hooks.slack.invalid/T000/B000/FAKE"',
  'export BACKUP_BUCKET="shophunt-prod-backups"',
  'echo "bootstrap complete"',
].join('\n');

function send(res, status, body, type = 'text/plain') {
  res.writeHead(status, {
    'Content-Type': type,
    'Server': 'EC2ws',                 // mimic the real IMDS Server header
    'X-Robots-Tag': 'noindex',
  });
  res.end(body);
}

const server = http.createServer((req, res) => {
  const { pathname, query } = url.parse(req.url, true);
  const p = pathname.replace(/\/+$/, '') || '/';

  // IMDSv2 token endpoint. We accept the PUT and hand back a token, but (like a
  // deliberately misconfigured target) IMDSv1 also works without it, so the
  // SSRF is exploitable even with a simple GET.
  if (req.method === 'PUT' && p === '/latest/api/token') {
    return send(res, 200, 'AQAEAFAKEIMDSv2TOKENforTRAININGonly==');
  }

  if (req.method !== 'GET') return send(res, 405, 'Method Not Allowed');

  // Root + meta-data index listings (trailing-slash listings like real IMDS)
  if (p === '/' || p === '/latest' || p === '/latest/meta-data') {
    return send(res, 200, [
      'ami-id', 'hostname', 'instance-id', 'instance-type',
      'local-ipv4', 'public-ipv4', 'iam/', 'placement/',
    ].join('\n'));
  }

  // IAM role listing
  if (p === '/latest/meta-data/iam/security-credentials') {
    return send(res, 200, FAKE_ROLE);
  }

  // The juicy one: fake IAM credentials for the role.
  if (p === `/latest/meta-data/iam/security-credentials/${FAKE_ROLE}`) {
    return send(res, 200, JSON.stringify(FAKE_CREDENTIALS, null, 2), 'application/json');
  }
  // Also answer for any role name so guessing still "works" in the lab.
  if (p.startsWith('/latest/meta-data/iam/security-credentials/')) {
    return send(res, 200, JSON.stringify(FAKE_CREDENTIALS, null, 2), 'application/json');
  }

  // Instance identity document
  if (p === '/latest/dynamic/instance-identity/document') {
    return send(res, 200, JSON.stringify(INSTANCE_IDENTITY, null, 2), 'application/json');
  }

  // user-data (frequently leaks secrets on real instances)
  if (p === '/latest/user-data') {
    return send(res, 200, FAKE_USER_DATA);
  }

  // Individual meta-data leaves
  const leaf = p.replace(/^\/latest\/meta-data\//, '');
  if (p.startsWith('/latest/meta-data/') && META_TREE[leaf] !== undefined) {
    return send(res, 200, String(META_TREE[leaf]));
  }

  // -------------------------------------------------------------------------
  // FAKE internal cloud API — demonstrates post-exploitation impact.
  // "Accepts" the stolen fake credentials (Authorization header carrying the
  // fake AccessKeyId) and returns fake "sensitive" backup data. This is the
  // follow-on endpoint that shows why leaked IMDS creds matter, without any
  // real cloud access.
  // -------------------------------------------------------------------------
  if (p === '/lab-cloud/s3/backups') {
    const auth = req.headers['authorization'] || '';
    const key = query.access_key || '';
    const presented = auth.includes(FAKE_CREDENTIALS.AccessKeyId) ||
                      key === FAKE_CREDENTIALS.AccessKeyId;
    if (!presented) {
      return send(res, 403, JSON.stringify({
        error: 'AccessDenied',
        message: 'Provide the instance role credentials (AccessKeyId) to list backups.',
        hint: 'Authorization: AWS4-HMAC-SHA256 Credential=<AccessKeyId>/... OR ?access_key=<AccessKeyId>',
      }, null, 2), 'application/json');
    }
    return send(res, 200, JSON.stringify({
      bucket: 'shophunt-prod-backups',
      note: 'FAKE data — proves the stolen instance credentials were accepted.',
      objects: [
        { key: 'db-dumps/shophunt-2026-01-15.sql.gz', size: 91234567 },
        { key: 'pii-exports/customers-fake.csv', size: 234123 },
        { key: 'secrets/app-config.fake.env', size: 1422 },
      ],
    }, null, 2), 'application/json');
  }

  return send(res, 404, 'Not Found');
});

server.listen(PORT, () => {
  console.log(`[mock-metadata] FAKE IMDS listening on :${PORT} (training only)`);
});
