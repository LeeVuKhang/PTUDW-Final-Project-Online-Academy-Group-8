/**
 * Global Authentication Utilities for JWT-based auth with HTTPOnly cookies
 * This script handles authentication state and automatic retry on token expiration
 */

// Store original fetch BEFORE we override it
const originalFetch = window.fetch;

// Global auth helper
window.authHelper = {
    /**
     * Enhanced fetch wrapper that automatically includes credentials
     * and handles 401 (unauthorized) responses by redirecting to login
     * @param {string} url - The URL to fetch
     * @param {Object} options - Fetch options
     * @returns {Promise<Response>}
     */
    async fetch(url, options = {}) {
        // Merge options with credentials: 'include' to send HTTPOnly cookies
        const config = {
            ...options,
            credentials: 'include', // Critical: This sends JWT cookies
        };

        // Only set Content-Type to JSON if body is not FormData
        // FormData needs browser to auto-set Content-Type with boundary
        if (!(options.body instanceof FormData)) {
            config.headers = {
                'Content-Type': 'application/json',
                ...options.headers,
            };
        } else {
            // For FormData, keep original headers but don't set Content-Type
            config.headers = { ...options.headers };
        }

        try {
            // CRITICAL: Use originalFetch to avoid infinite recursion
            const response = await originalFetch(url, config);

            // Handle 401 Unauthorized (token expired or invalid)
            if (response.status === 401) {
                console.warn('[AuthHelper] Unauthorized access - redirecting to signin');
                const currentUrl = window.location.pathname + window.location.search;

                // Save current URL to return after login
                // Note: Server will also save this in retUrl cookie via middleware
                window.location.href = `/account/signin?retUrl=${encodeURIComponent(currentUrl)}`;

                // Throw to prevent further processing
                throw new Error('Authentication required');
            }

            // Handle 403 Forbidden (insufficient permissions)
            if (response.status === 403) {
                console.warn('[AuthHelper] Forbidden - insufficient permissions');
                // Optionally redirect to 403 page or show error message
            }

            return response;
        } catch (error) {
            console.error('[AuthHelper] Fetch error:', error);
            throw error;
        }
    },

    /**
     * Check if user is authenticated (has valid JWT)
     * Note: This is a simple check - actual validation happens on server
     * @returns {boolean}
     */
    isAuthenticated() {
        // Check if cookies contain accessToken (not exact check due to HttpOnly)
        // This is approximate - server is the source of truth
        return document.cookie.includes('accessToken');
    },

    /**
     * Logout user by calling signout endpoint
     */
    async logout() {
        try {
            const form = document.createElement('form');
            form.method = 'POST';
            form.action = '/account/signout';
            document.body.appendChild(form);
            form.submit();
        } catch (error) {
            console.error('[AuthHelper] Logout error:', error);
        }
    },
};

// Monkey-patch global fetch to use authHelper.fetch by default
// This ensures all fetch calls automatically include credentials
window.fetch = function (url, options) {
    // Only apply to our own API calls (not external resources)
    if (typeof url === 'string' && (url.startsWith('/') || url.startsWith(window.location.origin))) {
        return window.authHelper.fetch(url, options);
    }
    // External URLs use original fetch
    return originalFetch(url, options);
};

console.log('[AuthHelper] JWT authentication utilities loaded');
