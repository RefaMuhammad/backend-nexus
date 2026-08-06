const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/User");

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails && profile.emails.length > 0 ? profile.emails[0].value : null;
        if (!email) return done(new Error("No email provided by Google"), null);

        // 1. Cari by googleId (sudah pernah login Google)
        let user = await User.findOne({ googleId: profile.id });
        if (user) return done(null, user);

        // 2. Cari by email (sudah register via email+password)
        user = await User.findOne({ email });
        if (user) {
          // Link Google ke akun yang sudah ada
          user.googleId = profile.id;
          user.isVerified = true;
          await user.save();
          return done(null, user);
        }

        // 3. Buat akun baru
        user = await User.create({
          email,
          googleId: profile.id,
          isVerified: true,
          profile: {
            fullName: profile.displayName || "New User",
            avatarUrl: (profile.photos && profile.photos.length > 0) ? profile.photos[0].value : ""
          }
        });
        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    },
  ),
);

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  const user = await User.findById(id);
  done(null, user);
});

module.exports = passport;
