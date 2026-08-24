export function extractCanaryUrl(service, tag = 'canary') {
  const traffic = service?.status?.traffic;
  if (!Array.isArray(traffic)) return '';

  const taggedTraffic = traffic.find(
    (item) => item && item.tag === tag && typeof item.url === 'string'
  );
  return taggedTraffic?.url ?? '';
}

export function extractFullTrafficRevision(service) {
  const traffic = service?.status?.traffic;
  if (!Array.isArray(traffic)) return '';
  const target = traffic.find(
    (item) =>
      item && item.percent === 100 && typeof item.revisionName === 'string'
  );
  return target?.revisionName ?? '';
}

function parseArgs(argv) {
  const args = { tag: 'canary', fullTrafficRevision: false };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--tag' && argv[index + 1]) {
      args.tag = argv[index + 1];
      index += 1;
    } else if (argv[index] === '--full-traffic-revision') {
      args.fullTrafficRevision = true;
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
  const { tag, fullTrafficRevision } = parseArgs(process.argv.slice(2));
  const input = await readStdin();
  try {
    const service = JSON.parse(input || '{}');
    const value = fullTrafficRevision
      ? extractFullTrafficRevision(service)
      : extractCanaryUrl(service, tag);
    if (!value) {
      console.error(
        fullTrafficRevision
          ? 'Cloud Run service has no revision receiving 100% traffic'
          : `Cloud Run traffic tag "${tag}" has no URL yet`
      );
      process.exit(1);
    }
    console.log(value);
  } catch (error) {
    console.error(
      `Could not parse Cloud Run service JSON: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    process.exit(1);
  }
}
