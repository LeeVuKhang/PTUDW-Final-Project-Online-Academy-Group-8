import { verifyAccessToken, verifyRefreshToken, generateAccessToken, setTokenCookies } from '../utils/jwt.util.js';
import userModel from './user.model.js';

/**
 * Middleware to authenticate JWT from cookies
 * Replaces session-based checkAuthenticated
 */
export async function authenticateJWT(req, res, next) {
    const accessToken = req.cookies.accessToken;
    const refreshToken = req.cookies.refreshToken;

    if (!accessToken) {
        // No access token - save current URL for redirect after login
        const url = req.originalUrl || req.url || '/';
        const isAuthRoute = /^\/account(\/|$)/i.test(url);

        if (!isAuthRoute) {
            // Store return URL in a temporary cookie (expires in 10 minutes)
            res.cookie('retUrl', url, {
                maxAge: 10 * 60 * 1000,
                httpOnly: true,
                sameSite: 'strict',
            });
        }

        return res.redirect('/account/signin');
    }

    try {
        // Verify access token
        const decoded = verifyAccessToken(accessToken);
        req.user = decoded; // Attach user to request
        return next();
    } catch (err) {
        // Access token expired or invalid - try refresh token
        if (refreshToken) {
            try {
                const decodedRefresh = verifyRefreshToken(refreshToken);

                // Refresh token is valid - fetch fresh user data and issue new access token
                try {
                    const user = await userModel.findById(decodedRefresh.user_id);

                    if (!user) {
                        // User no longer exists
                        return res.redirect('/account/signin');
                    }

                    const newAccessToken = generateAccessToken(user);
                    res.cookie('accessToken', newAccessToken, {
                        httpOnly: true,
                        secure: process.env.NODE_ENV === 'production',
                        sameSite: 'strict',
                        maxAge: 15 * 60 * 1000, // 15 minutes
                    });

                    req.user = {
                        user_id: user.user_id,
                        username: user.username,
                        email: user.email,
                        role: user.role,
                        name: user.name,
                        image_url: user.image_url,
                        self_introduction: user.self_introduction,
                    };
                    return next();
                } catch (dbErr) {
                    console.error('[authenticateJWT] Database error:', dbErr);
                    return res.redirect('/account/signin');
                }
            } catch (refreshErr) {
                // Refresh token also invalid - redirect to login
                console.error('[authenticateJWT] Refresh token error:', refreshErr.message);
                return res.redirect('/account/signin');
            }
        } else {
            // No refresh token available
            return res.redirect('/account/signin');
        }
    }
}

/**
 * Optional authentication - doesn't redirect if not authenticated
 * Used for pages that work with or without login (e.g., home page, course listing)
 */
export function optionalAuth(req, res, next) {
    const accessToken = req.cookies.accessToken;

    if (!accessToken) {
        req.user = null;
        return next();
    }

    try {
        const decoded = verifyAccessToken(accessToken);
        req.user = decoded;
        next();
    } catch (err) {
        // Token invalid - continue as guest
        req.user = null;
        next();
    }
}

/**
 * Middleware to check if user is Admin (role = 0)
 */
export function checkAdmin(req, res, next) {
    if (req.user && req.user.role === 0) {
        next();
    } else {
        res.render('vwAccount/403');
    }
}

/**
 * Middleware to check if user is Instructor (role = 2) or Admin (role = 0)
 */
export function checkInstructor(req, res, next) {
    if (req.user && (req.user.role === 2 || req.user.role === 0)) {
        next();
    } else {
        res.render('vwAccount/403');
    }
}

/**
 * Middleware to check if user is Student (role = 1) or Instructor (role = 2)
 * Note: Original had a typo (eq.session instead of req.session)
 */
export function checkUser(req, res, next) {
    if (req.user && (req.user.role === 1 || req.user.role === 2)) {
        next();
    } else {
        res.render('vwAccount/403');
    }
}

// Alias for backward compatibility
export const checkAuthenticated = authenticateJWT;
