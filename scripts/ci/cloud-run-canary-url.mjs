export function extractCanaryUrl(service, tag = 'canary') {
  const traffic = service?.status?.traffic;
  if (!Array.isArray(traffic)) return '';

  const taggedTraffic = traffic.find(
    (item) => item && item.tag === tag && typeof item.url === 'string'
  );
  return taggedTraffic?.url ?? '';
}

function parseArgs(argv) {
  const args = { tag: 'canary' };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--tag' && argv[index + 1]) {
      args.tag = argv[index + 1];
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
  const { tag } = parseArgs(process.argv.slice(2));
  const input = await readStdin();
  try {
    const service = JSON.parse(input || '{}');
    const url = extractCanaryUrl(service, tag);
    if (!url) {
      console.error(`Cloud Run traffic tag "${tag}" has no URL yet`);
      process.exit(1);
    }
    console.log(url);
  } catch (error) {
    console.error(
      `Could not parse Cloud Run service JSON: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    process.exit(1);
  }
}
