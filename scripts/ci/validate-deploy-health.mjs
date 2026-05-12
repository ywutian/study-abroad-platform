function unwrapHealthBody(body) {
  if (!body || typeof body !== 'object') return null;
  return body.data && typeof body.data === 'object' ? body.data : body;
}

function parseBody(body) {
  if (typeof body !== 'string') return body;
  return JSON.parse(body);
}

export function evaluateDeployHealth({ httpStatus, body }) {
  const errors = [];
  const warnings = [];
  const statusCode = Number(httpStatus);
  let parsedBody;

  if (statusCode !== 200) {
    errors.push(`HTTP status is ${httpStatus}, expected 200`);
  }

  try {
    parsedBody = parseBody(body);
  } catch (error) {
    errors.push(
      `Health response is not valid JSON: ${error instanceof Error ? error.message : String(error)}`
    );
    return {
      ok: false,
      status: 'unknown',
      databaseStatus: 'unknown',
      redisStatus: null,
      errors,
      warnings,
    };
  }

  const health = unwrapHealthBody(parsedBody);
  const checks = health?.checks && typeof health.checks === 'object' ? health.checks : null;
  const status = typeof health?.status === 'string' ? health.status : 'unknown';
  const databaseStatus =
    typeof checks?.database?.status === 'string' ? checks.database.status : 'missing';
  const redisStatus = typeof checks?.redis?.status === 'string' ? checks.redis.status : null;

  if (!health) {
    errors.push('Health response does not contain a body object');
  }
  if (!checks) {
    errors.push('Health response does not contain checks');
  }
  if (databaseStatus !== 'ok') {
    errors.push(`Database check is ${databaseStatus}, expected ok`);
  }

  if (checks) {
    for (const [name, check] of Object.entries(checks)) {
      if (name === 'redis' || name === 'database') continue;
      const componentStatus =
        check && typeof check === 'object' && 'status' in check ? check.status : 'missing';
      if (componentStatus !== 'ok') {
        errors.push(`${name} check is ${componentStatus}, expected ok`);
      }
    }
  }

  if (redisStatus && redisStatus !== 'ok') {
    warnings.push(
      `Redis check is ${redisStatus}; deploy can proceed because Redis has application fallbacks`
    );
  }
  if (status !== 'ok' && errors.length === 0) {
    warnings.push(`Full /health status is ${status}; deploy-critical checks are ok`);
  }

  return {
    ok: errors.length === 0,
    status,
    databaseStatus,
    redisStatus,
    errors,
    warnings,
  };
}

function parseArgs(argv) {
  const args = { httpStatus: '000', label: 'Deploy' };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--http-status' && argv[index + 1]) {
      args.httpStatus = argv[index + 1];
      index += 1;
    } else if (argv[index] === '--label' && argv[index + 1]) {
      args.label = argv[index + 1];
      index += 1;
    }
  }
  return args;
}

async function readStdin() {
  let input = '';
  for await (const chunk of process.stdin) {
    input += chunk;
  }
  return input;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { httpStatus, label } = parseArgs(process.argv.slice(2));
  const body = await readStdin();
  const result = evaluateDeployHealth({ httpStatus, body });

  for (const warning of result.warnings) {
    console.warn(`::warning title=${label} health warning::${warning}`);
  }

  if (result.ok) {
    console.log(
      `✅ ${label} health check passed: HTTP ${httpStatus}, health=${result.status}, database=${result.databaseStatus}, redis=${result.redisStatus ?? 'absent'}`
    );
    process.exit(0);
  }

  for (const error of result.errors) {
    console.error(`::error title=${label} health failed::${error}`);
  }
  process.exit(1);
}
