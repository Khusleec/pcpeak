const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { v4: uuidv4 } = require('uuid');
const pool = require('../db/pool');
const config = require('./index');

// Only register the Google strategy when credentials are configured.
// Without this guard, passport-google-oauth20 throws on import because it
// validates clientID at construction time.
if (config.google.clientId && config.google.clientSecret) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: config.google.clientId,
        clientSecret: config.google.clientSecret,
        callbackURL: config.google.callbackUrl,
      },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const googleId = profile.id;
        const email = profile.emails?.[0]?.value;
        if (!email) return done(new Error('Google профайлд имэйл олдсонгүй'), null);
        // Schema requires display_name NOT NULL — fall back to local part of email.
        const displayName = profile.displayName || email.split('@')[0];
        const avatarUrl = profile.photos?.[0]?.value || null;

        // Look up by google_id
        let result = await pool.query('SELECT * FROM users WHERE google_id = ?', [googleId]);

        if (result.rows.length === 0) {
          // Try linking to an existing email account
          result = await pool.query('SELECT * FROM users WHERE email = ?', [email]);

          if (result.rows.length > 0) {
            await pool.query(
              'UPDATE users SET google_id = ?, avatar_url = COALESCE(avatar_url, ?) WHERE email = ?',
              [googleId, avatarUrl, email]
            );
            result = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
          } else {
            // Create new user
            const newId = uuidv4();
            await pool.query(
              `INSERT INTO users (id, google_id, email, display_name, avatar_url, role_id)
               VALUES (?, ?, ?, ?, ?, 3)`,
              [newId, googleId, email, displayName, avatarUrl]
            );
            result = await pool.query('SELECT * FROM users WHERE id = ?', [newId]);
          }
        }

        return done(null, result.rows[0]);
      } catch (err) {
        return done(err, null);
      }
    }
    )
  );
} else {
  console.warn('[passport] Google OAuth not configured — /api/auth/google routes will return 503.');
}

module.exports = passport;
