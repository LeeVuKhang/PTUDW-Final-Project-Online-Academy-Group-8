import jwt from 'jsonwebtoken';

// Load JWT configuration from environment variables
const {
    JWT_ACCESS_SECRET,
    JWT_REFRESH_SECRET,
    JWT_ACCESS_EXPIRES_IN,
    JWT_REFRESH_EXPIRES_IN,
} = process.env;

// Validate required environment variables
function requireEnv(name, val) {
    if (!val) {
        throw new Error(`[JWT] Missing ${name}. Check .env file`);
    }
    return val;
}

const accessSecret = requireEnv('JWT_ACCESS_SECRET', JWT_ACCESS_SECRET);
const refreshSecret = requireEnv('JWT_REFRESH_SECRET', JWT_REFRESH_SECRET);
const accessExpiresIn = JWT_ACCESS_EXPIRES_IN || '15m';
const refreshExpiresIn = JWT_REFRESH_EXPIRES_IN || '7d';

console.log('[JWT] Configuration loaded:', {
    accessExpiresIn,
    refreshExpiresIn,
    secretsConfigured: !!(accessSecret && refreshSecret)
});

/**
 * Generate JWT access token
 * @param {Object} user - User object from database
 * @returns {string} JWT access token
 */
export function generateAccessToken(user) {
    const payload = {
        user_id: user.user_id,
        username: user.username,
        email: user.email,
        role: user.role,
        name: user.name,
        image_url: user.image_url,
        self_introduction: user.self_introduction,
    };

    return jwt.sign(payload, accessSecret, {
        expiresIn: accessExpiresIn,
        issuer: 'online-academy',
        audience: 'online-academy-users',
    });
}

/**
 * Generate JWT refresh token
 * @param {Object} user - User object from database
 * @returns {string} JWT refresh token
 */
export function generateRefreshToken(user) {
    const payload = {
        user_id: user.user_id,
        username: user.username,
        role: user.role,
    };

    return jwt.sign(payload, refreshSecret, {
        expiresIn: refreshExpiresIn,
        issuer: 'online-academy',
        audience: 'online-academy-users',
    });
}

/**
 * Verify and decode JWT access token
 * @param {string} token - JWT access token
 * @returns {Object} Decoded payload
 * @throws {Error} If token is invalid or expired
 */
export function verifyAccessToken(token) {
    try {
        return jwt.verify(token, accessSecret, {
            issuer: 'online-academy',
            audience: 'online-academy-users',
        });
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            throw new Error('Access token expired');
        } else if (err.name === 'JsonWebTokenError') {
            throw new Error('Invalid access token');
        }
        throw err;
    }
}

/**
 * Verify and decode JWT refresh token
 * @param {string} token - JWT refresh token
 * @returns {Object} Decoded payload
 * @throws {Error} If token is invalid or expired
 */
export function verifyRefreshToken(token) {
    try {
        return jwt.verify(token, refreshSecret, {
            issuer: 'online-academy',
            audience: 'online-academy-users',
        });
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            throw new Error('Refresh token expired');
        } else if (err.name === 'JsonWebTokenError') {
            throw new Error('Invalid refresh token');
        }
        throw err;
    }
}

/**
 * Set JWT tokens as HTTPOnly cookies
 * @param {Object} res - Express response object
 * @param {string} accessToken - JWT access token
 * @param {string} refreshToken - JWT refresh token
 */
export function setTokenCookies(res, accessToken, refreshToken) {
    // Access token cookie (expires in 15 minutes by default)
    res.cookie('accessToken', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', // HTTPS only in production
        sameSite: 'strict', // CSRF protection
        maxAge: 60 * 60 * 1000, // 60 minutes in milliseconds
    });

    // Refresh token cookie (expires in 7 days by default)
    res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
    });
}

/**
 * Clear JWT cookies (for logout)
 * @param {Object} res - Express response object
 */
export function clearTokenCookies(res) {
    res.clearCookie('accessToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
    });

    res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
    });
}
