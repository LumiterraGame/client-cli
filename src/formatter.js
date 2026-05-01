/**
 * Formats a JSON response and writes it to stdout.
 */
export function output(response, pretty = false) {
  const json = pretty
    ? JSON.stringify(response, null, 2)
    : JSON.stringify(response);

  process.stdout.write(json + "\n");
}

/**
 * Determines the exit code from the response.
 */
export function exitCode(response) {
  return response && response.success ? 0 : 1;
}
