// @todo: add countdown to isYoinkable timestamp from contract
// This file should be updated to read the actual timestamp from the contract
// when connecting to real data

export interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalSeconds: number;
}

/**
 * Calculates time remaining until a target timestamp
 * @param targetTimestamp - Unix timestamp in milliseconds when yoink becomes available
 * @returns TimeRemaining object with days, hours, minutes, seconds
 */
export function calculateTimeRemaining(targetTimestamp: number): TimeRemaining {
  const now = Date.now();
  const difference = targetTimestamp - now;

  if (difference <= 0) {
    return {
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      totalSeconds: 0,
    };
  }

  const totalSeconds = Math.floor(difference / 1000);
  const days = Math.floor(totalSeconds / (24 * 60 * 60));
  const hours = Math.floor((totalSeconds % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((totalSeconds % (60 * 60)) / 60);
  const seconds = totalSeconds % 60;

  return {
    days,
    hours,
    minutes,
    seconds,
    totalSeconds,
  };
}

/**
 * Formats time remaining into a human-readable string
 * @param timeRemaining - TimeRemaining object
 * @param format - 'short' for "2d 5h 30m", 'long' for "2 days, 5 hours, 30 minutes", or 'clock' for "2:14:30"
 * @returns Formatted time string
 */
export function formatTimeRemaining(
  timeRemaining: TimeRemaining,
  format: 'short' | 'long' | 'clock' = 'short',
): string {
  const { days, hours, minutes, seconds } = timeRemaining;

  if (timeRemaining.totalSeconds <= 0) {
    return format === 'clock' ? '0:00:00' : 'Available now';
  }

  if (format === 'clock') {
    // Format as "D:HH:MM" (no seconds)
    const paddedHours = hours.toString().padStart(2, '0');
    const paddedMinutes = minutes.toString().padStart(2, '0');
    return `${days}:${paddedHours}:${paddedMinutes}`;
  }

  if (format === 'short') {
    const parts: string[] = [];
    // @note uses dynamic timer from contract, got rid of days
    // if (days > 0) parts.push(`${days}d`);
    const totalHours = days * 24 + hours;
    if (totalHours > 0) parts.push(`${totalHours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0) parts.push(`${seconds}s`);

    return parts.length > 0 ? parts.join(' ') : '0s';
  }

  // Long format
  const parts: string[] = [];
  if (days > 0) parts.push(`${days} day${days !== 1 ? 's' : ''}`);
  if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
  if (minutes > 0) parts.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);
  if (seconds > 0 && days === 0 && hours === 0) {
    parts.push(`${seconds} second${seconds !== 1 ? 's' : ''}`);
  }

  return parts.length > 0 ? parts.join(', ') : 'Available now';
}

/**
 * Gets the yoink availability timestamp
 * @todo: Replace with actual contract call to get the timestamp when yoink becomes available
 * @returns Unix timestamp in milliseconds when yoink becomes available
 */
export function getYoinkAvailableTimestamp(): number {
  // @todo: Replace this placeholder with actual contract data
  // This should read from the contract to get the timestamp of the last train movement
  // and add 2 days (or 3 days depending on user eligibility) to determine when yoink is available

  // Placeholder: 2 days from now
  const twoDaysFromNow = Date.now() + 2 * 24 * 60 * 60 * 1000;
  return twoDaysFromNow;
}

/**
 * Checks if yoink is currently available
 * @returns boolean indicating if yoink action is available
 */
export function isYoinkAvailable(): boolean {
  const targetTimestamp = getYoinkAvailableTimestamp();
  return Date.now() >= targetTimestamp;
}

/**
 * Hook-like function to get current countdown state
 * Call this in a useEffect with setInterval to get live updates
 * @returns Object with isAvailable flag and formatted countdown
 */
export function getYoinkCountdownState(): {
  isAvailable: boolean;
  timeRemaining: TimeRemaining;
  shortFormat: string;
  longFormat: string;
  clockFormat: string;
} {
  const targetTimestamp = getYoinkAvailableTimestamp();
  const timeRemaining = calculateTimeRemaining(targetTimestamp);
  const isAvailable = timeRemaining.totalSeconds <= 0;

  return {
    isAvailable,
    timeRemaining,
    shortFormat: formatTimeRemaining(timeRemaining, 'short'),
    longFormat: formatTimeRemaining(timeRemaining, 'long'),
    clockFormat: formatTimeRemaining(timeRemaining, 'clock'),
  };
}
