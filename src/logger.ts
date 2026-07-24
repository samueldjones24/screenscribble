type LogLevel = 'debug' | 'info' | 'warn' | 'error';

function formatMessage(level: LogLevel, message: string): string {
  return `[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}`;
}

export function log(level: LogLevel, message: string): void {
  if (!import.meta.env.DEV && level === 'info') {
    return;
  }

  const formatted = formatMessage(level, message);
  if (level === 'error') {
    console.error(formatted);
  } else if (level === 'warn') {
    console.warn(formatted);
  } else {
    console.info(formatted);
  }
}
