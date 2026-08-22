import io from 'socket.io-client';

/**
 * Returns the backend server URL for Socket.io connections.
 * If VITE_API_URL is configured (e.g. 'https://tapin-1s8k.onrender.com'),
 * extracts the root origin/host so Socket.io connects to the correct backend server.
 */
export const getSocketUrl = () => {
  const apiUrl = import.meta.env.VITE_API_URL;
  if (apiUrl) {
    // Strip trailing '/api' or slashes if provided
    return apiUrl.replace(/\/api\/?$/, '').replace(/\/+$/, '');
  }
  // In local development, return undefined so Socket.io defaults to window.location (which Vite proxies to http://localhost:5000)
  return undefined;
};

/**
 * Creates and returns a configured Socket.io client instance.
 */
export const createSocket = (options = {}) => {
  const url = getSocketUrl();
  return io(url, {
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    ...options
  });
};

export default createSocket;
